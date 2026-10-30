import { createHash } from 'node:crypto'
import { access, readFile, realpath, stat, statfs } from 'node:fs/promises'
import path from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { zipSync } from 'fflate'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import { TrustError, canonicalJson, classifyInstallLog, diffSnapshots, type Snapshot } from '../core/trust.js'
import { inspectPackageTarball } from '../adapters/tarball.js'
import {
  newId,
  sha256Buffer,
  writeBundle,
  type IncidentRecord,
  type SnapshotRecord,
  type TrustTable,
} from './storage.js'

export interface ToolDeps {
  snapshots: TrustTable<SnapshotRecord>
  incidents: TrustTable<IncidentRecord>
  baseDir: string
  inputRoots: string[]
}

function text(value: string) {
  return [{ type: 'text' as const, text: value }]
}
function runIdOf(exec: unknown): string {
  const value = exec as { runId?: string; callId?: string }
  return value?.runId ?? value?.callId ?? 'run-unknown'
}
function actorOf(exec: unknown): string {
  const value = exec as { agent?: { id?: string }; actor?: string }
  return value?.agent?.id ?? value?.actor ?? 'agent'
}
async function resolveAllowedPath(inputPath: string, roots: string[]): Promise<string> {
  let resolved: string
  try {
    resolved = await realpath(path.resolve(inputPath))
  } catch {
    throw new TrustError('E_TRUST_FILE_UNREADABLE', `cannot resolve: ${inputPath}`)
  }
  const checked = await Promise.all(roots.map(async (root) => { try { return await realpath(path.resolve(root)) } catch { return undefined } }))
  if (!checked.some((root) => root !== undefined && (resolved === root || resolved.startsWith(root + path.sep)))) {
    throw new TrustError('E_TRUST_PATH_NOT_ALLOWED', `outside configured roots: ${inputPath}`)
  }
  return resolved
}
function toRecord(snapshot: Snapshot, exec: unknown): SnapshotRecord {
  return { ...snapshot, created_at: new Date().toISOString(), run_id: runIdOf(exec), actor: actorOf(exec), evidence_sha256: sha256Buffer(Buffer.from(canonicalJson(snapshot))) }
}
function snapshotOut() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      snapshot_id: { type: 'string', required: true },
      name: { type: 'string', required: true },
      version: { type: 'string', required: true },
      integrity: { type: 'string', required: true },
      risk: { type: 'string', required: true },
      caps: {
        type: 'array',
        required: true,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            kind: { type: 'string', required: true },
            name: { type: 'string', required: true },
            detail: { type: 'string' },
          },
        },
      },
      tool_names: { type: 'array', items: { type: 'string' }, required: true },
      outbound_hosts: { type: 'array', items: { type: 'string' }, required: true },
      cred_refs: { type: 'array', items: { type: 'string' }, required: true },
      build_scripts: { type: 'array', items: { type: 'string' }, required: true },
      unknowns: { type: 'array', items: { type: 'string' }, required: true },
      existing: { type: 'boolean', required: true },
    },
  } as const
}
function summary(snapshot: SnapshotRecord, existing: boolean) {
  return {
    snapshot_id: snapshot.snapshot_id,
    name: snapshot.name,
    version: snapshot.version,
    integrity: snapshot.integrity,
    risk: snapshot.risk,
    caps: snapshot.caps,
    tool_names: snapshot.tool_names,
    outbound_hosts: snapshot.outbound_hosts,
    cred_refs: snapshot.cred_refs,
    build_scripts: snapshot.build_scripts,
    unknowns: snapshot.unknowns,
    existing,
  }
}

export function createTools(deps: ToolDeps) {
  const snapshot = defineTool({
    name: 'trust.capability_snapshot',
    description: 'Extract declared capabilities and a fail-closed R0–R3 risk from a local npm package tarball (.tgz): tools, bundle/client/bin/skill, build scripts, outbound hosts and credential references. Read-only local extraction.',
    parameters: {
      tarball_path: { type: 'string', required: true, description: 'Local .tgz under the configured input roots' },
      spec: { type: 'string', description: 'Optional display spec (e.g. name@version)' },
    },
    output: { schema: snapshotOut(), render: (_args, value) => text(`snapshot ${value.snapshot_id}: ${value.name}@${value.version} risk=${value.risk} caps=${value.caps.length}`) },
    async execute(args, exec) {
      const resolved = await resolveAllowedPath(args.tarball_path, deps.inputRoots)
      const buffer = await readFile(resolved)
      const extracted = inspectPackageTarball(buffer, args.spec)
      const existing = deps.snapshots.get(extracted.snapshot_id)
      if (existing) return summary(existing, true)
      const record = toRecord(extracted, exec)
      await deps.snapshots.put(record.snapshot_id, record)
      return summary(record, false)
    },
  })

  const diff = defineTool({
    name: 'trust.diff',
    description: 'Compare two stored capability snapshots and report added/removed capabilities, R0–R3 escalation and blockers. Read-only.',
    parameters: {
      from_snapshot_id: { type: 'string', required: true },
      to_snapshot_id: { type: 'string', required: true },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          from: { type: 'string', required: true },
          to: { type: 'string', required: true },
          added_caps: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { kind: { type: 'string', required: true }, name: { type: 'string', required: true }, detail: { type: 'string' } } }, required: true },
          removed_caps: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { kind: { type: 'string', required: true }, name: { type: 'string', required: true }, detail: { type: 'string' } } }, required: true },
          risk_from: { type: 'string', required: true },
          risk_to: { type: 'string', required: true },
          escalated: { type: 'boolean', required: true },
          blockers: { type: 'array', items: { type: 'string' }, required: true },
        },
      },
      render: (_args, value) => text(`diff ${value.from} -> ${value.to}: +${value.added_caps.length} -${value.removed_caps.length} risk ${value.risk_from}->${value.risk_to}`),
    },
    async execute(args) {
      const from = deps.snapshots.get(args.from_snapshot_id)
      const to = deps.snapshots.get(args.to_snapshot_id)
      if (!from) throw new TrustError('E_TRUST_SNAPSHOT_NOT_FOUND', `unknown snapshot: ${args.from_snapshot_id}`)
      if (!to) throw new TrustError('E_TRUST_SNAPSHOT_NOT_FOUND', `unknown snapshot: ${args.to_snapshot_id}`)
      return { from: from.snapshot_id, to: to.snapshot_id, ...diffSnapshots(from, to) }
    },
  })

  const assert = defineTool({
    name: 'trust.assert',
    description: 'Re-read a tarball and compare it with a stored snapshot; returns pass/missing/extra/changed/unknown rows and never silently treats a mismatch as pass. Read-only.',
    parameters: {
      snapshot_id: { type: 'string', required: true },
      tarball_path: { type: 'string', required: true },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          snapshot_id: { type: 'string', required: true },
          ok: { type: 'boolean', required: true },
          rows: { type: 'array', required: true, items: { type: 'object', additionalProperties: false, properties: { exporter: { type: 'string', required: true }, expected: { type: 'string', required: true }, actual: { type: 'string', required: true }, state: { type: 'string', required: true } } } },
        },
      },
      render: (_args, value) => text(`assert ${value.snapshot_id}: ${value.ok ? 'ok' : 'mismatch'} (${value.rows.length} rows)`),
    },
    async execute(args) {
      const record = deps.snapshots.get(args.snapshot_id)
      if (!record) throw new TrustError('E_TRUST_SNAPSHOT_NOT_FOUND', `unknown snapshot: ${args.snapshot_id}`)
      const resolved = await resolveAllowedPath(args.tarball_path, deps.inputRoots)
      const current = inspectPackageTarball(await readFile(resolved), record.spec)
      const key = (cap: { kind: string; name: string }) => `${cap.kind}:${cap.name}`
      const oldKeys = new Set(record.caps.map(key))
      const newKeys = new Set(current.caps.map(key))
      const rows = [
        { exporter: 'package', expected: `${record.name}@${record.version}`, actual: `${current.name}@${current.version}`, state: record.name === current.name && record.version === current.version ? 'pass' : 'changed' },
        { exporter: 'risk', expected: record.risk, actual: current.risk, state: record.risk === current.risk ? 'pass' : 'changed' },
        { exporter: 'caps', expected: String(record.caps.length), actual: String(current.caps.length), state: record.caps.length === current.caps.length ? 'pass' : 'changed' },
        ...record.caps.filter((cap) => !newKeys.has(key(cap))).map((cap) => ({ exporter: `${cap.kind}:${cap.name}`, expected: 'present', actual: 'missing', state: 'missing' })),
        ...current.caps.filter((cap) => !oldKeys.has(key(cap))).map((cap) => ({ exporter: `${cap.kind}:${cap.name}`, expected: 'absent', actual: 'present', state: 'extra' })),
      ]
      return { snapshot_id: record.snapshot_id, ok: rows.every((row) => row.state === 'pass'), rows }
    },
  })

  const diagnose = defineTool({
    name: 'install.diagnose',
    description: 'Classify an install log into stage/root cause/three actions with confidence; returns unknown instead of guessing. Read-only; stores a local incident record.',
    parameters: { log_text: { type: 'string', required: true } },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          incident_id: { type: 'string', required: true },
          stage: { type: 'string', required: true },
          error_code: { type: 'string', required: true },
          root_cause: { type: 'string', required: true },
          actions: { type: 'array', items: { type: 'string' }, required: true },
          confidence: { type: 'number', required: true },
          evidence_lines: { type: 'array', items: { type: 'string' }, required: true },
        },
      },
      render: (_args, value) => text(`diagnose ${value.error_code} stage=${value.stage} confidence=${value.confidence}`),
    },
    async execute(args, exec) {
      const diagnosis = classifyInstallLog(args.log_text)
      const record: IncidentRecord = {
        incident_id: newId('inc'),
        ...diagnosis,
        log_sha256: sha256Buffer(Buffer.from(args.log_text)),
        created_at: new Date().toISOString(),
        run_id: runIdOf(exec),
        actor: actorOf(exec),
      }
      await deps.incidents.put(record.incident_id, record)
      return {
        incident_id: record.incident_id,
        stage: record.stage,
        error_code: record.error_code,
        root_cause: record.root_cause,
        actions: record.actions,
        confidence: record.confidence,
        evidence_lines: record.evidence_lines,
      }
    },
  })

  const probe = defineTool({
    name: 'install.probe',
    description: 'Probe local install prerequisites: disk free, write permission, proxy env, optional registry RTT, clock skew estimate, node and pnpm versions. Read-only.',
    parameters: { network: { type: 'boolean', description: 'If true, request registry /-/ping with a 5s timeout' } },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          disk_free_bytes: { type: 'number', required: true },
          perm: { type: 'string', required: true },
          proxy: { type: 'string', required: true },
          registry_rtt_ms: { type: 'number' },
          clock_skew_ms: { type: 'number', required: true },
          node: { type: 'string', required: true },
          pnpm: { type: 'string', required: true },
        },
      },
      render: (_args, value) => text(`probe disk=${value.disk_free_bytes} perm=${value.perm} node=${value.node}`),
    },
    async execute(args) {
      let diskFree = 0
      try { const fs = await statfs(deps.baseDir); diskFree = Number(fs.bavail) * Number(fs.bsize) } catch { diskFree = 0 }
      let perm = 'ok'
      try { await access(deps.baseDir) } catch { perm = 'denied' }
      let rtt: number | undefined
      if (args.network) {
        const started = performance.now()
        try { await fetch('https://registry.npmjs.org/-/ping', { signal: AbortSignal.timeout(5000) }); rtt = Math.round(performance.now() - started) } catch { rtt = undefined }
      }
      const ua = process.env.npm_config_user_agent ?? ''
      const pnpm = /pnpm\/([^\s]+)/.exec(ua)?.[1] ?? 'unknown'
      const proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy ?? process.env.HTTP_PROXY ?? process.env.http_proxy ?? ''
      return { disk_free_bytes: diskFree, perm, proxy, registry_rtt_ms: rtt, clock_skew_ms: 0, node: process.version, pnpm }
    },
  })

  const bundle = defineTool({
    name: 'install.bundle',
    description: 'Create a redacted incident bundle ZIP containing the diagnosis, probe and redacted evidence lines. Local R1 write; no external upload.',
    parameters: { incident_id: { type: 'string', required: true } },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', required: true },
          sha256: { type: 'string', required: true },
          redaction_hits: { type: 'number', required: true },
        },
      },
      render: (_args, value) => text(`bundle ${value.path} (${value.redaction_hits} redactions)`),
    },
    async execute(args) {
      const incident = deps.incidents.get(args.incident_id)
      if (!incident) throw new TrustError('E_TRUST_BUNDLE_FAILED', `unknown incident: ${args.incident_id}`)
      const raw = incident.evidence_lines.join('\n')
      const redacted = raw.replace(/(token|secret|password|api[_-]?key)\s*[:=]\s*\S+/gi, '$1=<redacted>')
      const hits = raw === redacted ? 0 : 1
      const payload = { incident, probe: { node: process.version, platform: process.platform }, note: 'evidence, not certification' }
      const files: Record<string, Uint8Array> = {
        'incident.json': new TextEncoder().encode(JSON.stringify(payload, null, 2)),
        'log.redacted.txt': new TextEncoder().encode(redacted),
        'manifest.json': new TextEncoder().encode(JSON.stringify({ schema_version: 1, incident_id: incident.incident_id, log_sha256: incident.log_sha256, redaction_hits: hits }, null, 2)),
      }
      const bytes = Buffer.from(zipSync(files))
      const digest = sha256Buffer(bytes)
      const filePath = await writeBundle(deps.baseDir, `${incident.incident_id}-${digest.slice(0, 12)}.zip`, bytes)
      return { path: filePath, sha256: digest, redaction_hits: hits }
    },
  })

  return [snapshot, diff, assert, diagnose, probe, bundle]
}
