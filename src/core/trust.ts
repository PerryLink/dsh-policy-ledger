export type Risk = 'R0' | 'R1' | 'R2' | 'R3'
export type CapabilityKind = 'bundle' | 'client' | 'bin' | 'skill' | 'tool' | 'build-script' | 'network' | 'credential'

export interface Capability {
  kind: CapabilityKind
  name: string
  detail?: string
}

export interface Snapshot {
  snapshot_id: string
  spec: string
  name: string
  version: string
  integrity: string
  caps: Capability[]
  tool_names: string[]
  outbound_hosts: string[]
  cred_refs: string[]
  build_scripts: string[]
  risk: Risk
  source: 'extracted'
  extractor_version: string
  unknowns: string[]
}

export interface DiffResult {
  added_caps: Capability[]
  removed_caps: Capability[]
  risk_from: Risk
  risk_to: Risk
  escalated: boolean
  blockers: string[]
}

export type TrustErrorCode =
  | 'E_TRUST_FILE_UNREADABLE'
  | 'E_TRUST_TARBALL_INVALID'
  | 'E_TRUST_TARBALL_LIMIT'
  | 'E_TRUST_ARCHIVE_LIMIT'
  | 'E_TRUST_CAP_UNKNOWN'
  | 'E_TRUST_SNAPSHOT_NOT_FOUND'
  | 'E_TRUST_ASSERT_FAILED'
  | 'E_TRUST_DIAGNOSE_UNKNOWN'
  | 'E_TRUST_BUNDLE_FAILED'
  | 'E_TRUST_PATH_NOT_ALLOWED'

export class TrustError extends Error {
  readonly code: TrustErrorCode
  readonly retryable: boolean
  readonly needsReview: boolean
  constructor(code: TrustErrorCode, message: string, options: { retryable?: boolean; needsReview?: boolean } = {}) {
    super(`${code}: ${message}`)
    this.name = 'TrustError'
    this.code = code
    this.retryable = options.retryable ?? false
    this.needsReview = options.needsReview ?? false
  }
}

export const EXTRACTOR_VERSION = '1.0.0'
export const RISK_ORDER: Record<Risk, number> = { R0: 0, R1: 1, R2: 2, R3: 3 }

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
  return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(',')}}`
}

export interface RiskFactor { factor: string; points: number }
export interface RiskBreakdown { risk: Risk; score: number; factors: RiskFactor[]; capped: boolean }
export function riskBreakdown(caps: Capability[], hosts: string[], buildScripts: string[], credRefs: string[]): RiskBreakdown {
  const factors: RiskFactor[] = []
  if (caps.some((cap) => cap.kind === 'bundle')) factors.push({ factor: 'bundle patch', points: 1 })
  if (caps.some((cap) => cap.kind === 'client')) factors.push({ factor: 'client call', points: 1 })
  if (caps.some((cap) => cap.kind === 'bin')) factors.push({ factor: 'binary', points: 1 })
  if (buildScripts.length > 0) factors.push({ factor: 'build script', points: 2 })
  if (hosts.length > 0) factors.push({ factor: 'outbound host', points: 2 })
  if (credRefs.length > 0) factors.push({ factor: 'credential reference', points: 2 })
  const score = factors.reduce((sum, f) => sum + f.points, 0)
  const risk: Risk = score >= 3 ? 'R3' : score === 2 ? 'R2' : score === 1 ? 'R1' : 'R0'
  return { risk, score, factors, capped: score > 3 }
}
export function riskFromCaps(caps: Capability[], hosts: string[], buildScripts: string[], credRefs: string[]): Risk {
  return riskBreakdown(caps, hosts, buildScripts, credRefs).risk
}

export function diffSnapshots(from: Snapshot, to: Snapshot): DiffResult {
  const key = (cap: Capability) => `${cap.kind}:${cap.name}`
  const fromKeys = new Set(from.caps.map(key))
  const toKeys = new Set(to.caps.map(key))
  const added = to.caps.filter((cap) => !fromKeys.has(key(cap)))
  const removed = from.caps.filter((cap) => !toKeys.has(key(cap)))
  const escalated = RISK_ORDER[to.risk] > RISK_ORDER[from.risk]
  const blockers: string[] = []
  if (escalated) blockers.push(`risk escalated ${from.risk} -> ${to.risk}`)
  if (to.build_scripts.length > from.build_scripts.length) blockers.push('new build script')
  if (to.cred_refs.length > from.cred_refs.length) blockers.push('new credential reference')
  if (to.outbound_hosts.some((host) => !from.outbound_hosts.includes(host))) blockers.push('new outbound host')
  return { added_caps: added, removed_caps: removed, risk_from: from.risk, risk_to: to.risk, escalated, blockers }
}

export interface Diagnosis {
  stage: 'resolve' | 'fetch' | 'extract' | 'link' | 'build' | 'activate' | 'unknown'
  error_code: string
  root_cause: string
  actions: string[]
  confidence: number
  evidence_lines: string[]
}

export function classifyInstallLog(logText: string): Diagnosis {
  const lines = logText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const pick = (pattern: RegExp) => lines.filter((line) => pattern.test(line)).slice(0, 3)
  const evidence = (pattern: RegExp) => {
    const matched = pick(pattern)
    return matched.length > 0 ? matched : lines.slice(0, 2)
  }
  const make = (stage: Diagnosis['stage'], code: string, root: string, actions: string[], confidence = 0.9): Diagnosis => ({
    stage,
    error_code: code,
    root_cause: root,
    actions,
    confidence,
    evidence_lines: evidence(new RegExp(code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')),
  })
  if (/ERR_PNPM_.*404|404 Not Found|E404/i.test(logText)) {
    return make('resolve', 'E_TRUST_RESOLVE_404', 'package or version not found in the configured registry', ['verify scoped name and version', 'check registry and auth', 'retry with the exact version/tarball'])
  }
  if (/EACCES|EPERM|permission denied/i.test(logText)) {
    return make('link', 'E_TRUST_LINK_EACCES', 'filesystem permission denied while linking', ['check profile directory permissions', 'close other DSH processes', 'retry once'])
  }
  if (/ETIMEDOUT|ENOTFOUND|ECONNREFUSED|network/i.test(logText)) {
    return make('fetch', 'E_TRUST_FETCH_NETWORK', 'registry or network unreachable', ['check proxy/DNS', 'retry with backoff', 'use a local tarball'])
  }
  if (/ENOSPC|no space/i.test(logText)) {
    return make('extract', 'E_TRUST_EXTRACT_NOSPC', 'disk full while extracting', ['free disk space', 'move store/cache', 'retry'])
  }
  if (/ERR_PNPM_PEER_DEP_ISSUES|peer dependenc/i.test(logText)) {
    return make('resolve', 'E_TRUST_RESOLVE_PEER', 'peer dependency conflict', ['inspect peer ranges', 'pin compatible versions', 'do not force-install silently'])
  }
  if (/postinstall|preinstall|install script|build script/i.test(logText)) {
    return make('build', 'E_TRUST_BUILD_SCRIPT', 'install/build script failed', ['capture the script output', 'run the build locally', 'disable the script only with explicit review'])
  }
  if (/integrity|EINTEGRITY|checksum/i.test(logText)) {
    return make('fetch', 'E_TRUST_FETCH_INTEGRITY', 'integrity/checksum mismatch', ['clear cache', 're-download the tarball', 'verify registry and lockfile'])
  }
  if (/activate|mount|plugin.*failed|apply/i.test(logText)) {
    return make('activate', 'E_TRUST_ACTIVATE_FAILED', 'plugin activation/apply failed after install', ['check DSH logs', 'inspect the plugin manifest', 'rollback or remove'])
  }
  return {
    stage: 'unknown',
    error_code: 'E_TRUST_DIAGNOSE_UNKNOWN',
    root_cause: 'not enough evidence to classify; refusing to guess',
    actions: ['provide the full install log', 'run install.probe', 'escalate to a human'],
    confidence: 0,
    evidence_lines: lines.slice(0, 2),
  }
}

export interface RiskRow { name: string; risk: Risk }
export interface RiskMatrix {
  total: number
  by_risk: Record<Risk, number>
  highest: Risk | null
  attention: string[]
}
/** Fleet-level view of declared risks: counts by level, the highest level and the R2/R3 rows. */
export function riskMatrix(rows: RiskRow[]): RiskMatrix {
  const by_risk: Record<Risk, number> = { R0: 0, R1: 0, R2: 0, R3: 0 }
  let highest: Risk | null = null
  const attention: string[] = []
  for (const row of rows) {
    by_risk[row.risk] += 1
    if (highest === null || RISK_ORDER[row.risk] > RISK_ORDER[highest]) highest = row.risk
    if (row.risk === 'R2' || row.risk === 'R3') attention.push(row.name)
  }
  return { total: rows.length, by_risk, highest, attention: attention.sort() }
}
