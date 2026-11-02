import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import {
  EXTRACTOR_VERSION,
  TrustError,
  canonicalJson,
  riskFromCaps,
  type Capability,
  type Snapshot,
} from '../core/trust.js'

const MAX_PARTS = 5000
/** Hard cap on the decompressed stream; passed to zlib so a gzip bomb is aborted while inflating. */
const MAX_BYTES = 32 * 1024 * 1024

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function parseOctal(bytes: Uint8Array): number {
  const value = Buffer.from(bytes).toString('ascii').replace(/\0/g, '').trim()
  if (!value) return 0
  const parsed = Number.parseInt(value, 8)
  return Number.isFinite(parsed) ? parsed : 0
}

function tarEntries(buffer: Buffer): Map<string, Buffer> {
  let tar: Buffer
  try {
    tar = gunzipSync(buffer, { maxOutputLength: MAX_BYTES })
  } catch (error) {
    // zlib aborts as soon as the inflated output passes maxOutputLength, so the bomb never
    // materializes; distinguish that from malformed/non-gzip input.
    if ((error as NodeJS.ErrnoException).code === 'ERR_BUFFER_TOO_LARGE') {
      throw new TrustError('E_TRUST_ARCHIVE_LIMIT', `gzip output exceeds ${MAX_BYTES} bytes`)
    }
    throw new TrustError('E_TRUST_TARBALL_INVALID', 'not a gzip-compressed npm tarball')
  }
  const entries = new Map<string, Buffer>()
  let offset = 0
  let total = 0
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) break
    let name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '')
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '')
    if (prefix) name = `${prefix}/${name}`
    const size = parseOctal(header.subarray(124, 136))
    const type = String.fromCharCode(header[156] ?? 0)
    offset += 512
    if (size < 0 || offset + size > tar.length) throw new TrustError('E_TRUST_TARBALL_INVALID', 'truncated tar entry')
    if (type === '0' || type === '\0') {
      if (name.startsWith('package/')) {
        const relative = name.slice('package/'.length)
        if (relative) entries.set(relative, tar.subarray(offset, offset + size))
        total += size
        if (entries.size > MAX_PARTS) throw new TrustError('E_TRUST_TARBALL_LIMIT', `too many entries: ${entries.size}`)
        if (total > MAX_BYTES) throw new TrustError('E_TRUST_TARBALL_LIMIT', 'uncompressed tarball too large')
      }
    }
    offset += Math.ceil(size / 512) * 512
  }
  return entries
}

function textOf(entries: Map<string, Buffer>, name: string): string | undefined {
  const value = entries.get(name)
  return value ? Buffer.from(value).toString('utf8') : undefined
}

function hostsOf(text: string): string[] {
  const hosts = new Set<string>()
  for (const match of text.matchAll(/https?:\/\/([^/\s"'<>]+)/g)) {
    const host = (match[1] ?? '').toLowerCase()
    if (!host) continue
    if (['github.com', 'www.npmjs.com', 'npmjs.com', 'registry.npmjs.org', 'www.w3.org', 'schemas.openxmlformats.org', 'json-schema.org', 'opensource.org'].includes(host)) continue
    hosts.add(host)
  }
  return [...hosts].sort()
}

function credsOf(text: string): string[] {
  const creds = new Set<string>()
  for (const match of text.matchAll(/\b(Authorization|API[_-]?KEY|ACCESS[_-]?TOKEN|SECRET[_-]?KEY|PASSWORD|CREDENTIALS?)\b/gi)) {
    creds.add(match[1]!.toUpperCase())
  }
  return [...creds].sort()
}

export function inspectPackageTarball(buffer: Buffer, specLabel?: string): Snapshot {
  if (buffer.length === 0) throw new TrustError('E_TRUST_FILE_UNREADABLE', 'empty tarball')
  const entries = tarEntries(buffer)
  const packageJsonText = textOf(entries, 'package.json')
  if (!packageJsonText) throw new TrustError('E_TRUST_TARBALL_INVALID', 'tarball has no package/package.json')
  let pkg: Record<string, unknown>
  try {
    pkg = JSON.parse(packageJsonText) as Record<string, unknown>
  } catch {
    throw new TrustError('E_TRUST_TARBALL_INVALID', 'package.json is not valid JSON')
  }
  const name = typeof pkg.name === 'string' ? pkg.name : ''
  const version = typeof pkg.version === 'string' ? pkg.version : ''
  if (!name || !version) throw new TrustError('E_TRUST_TARBALL_INVALID', 'package.json lacks name/version')
  const dsh = pkg.dsh && typeof pkg.dsh === 'object' ? (pkg.dsh as Record<string, unknown>) : {}
  const scripts = pkg.scripts && typeof pkg.scripts === 'object' ? (pkg.scripts as Record<string, unknown>) : {}
  const bin = pkg.bin && typeof pkg.bin === 'object' ? Object.keys(pkg.bin as Record<string, unknown>) : []
  const caps: Capability[] = []
  if (dsh.bundle) caps.push({ kind: 'bundle', name: 'dsh.bundle', detail: 'bundle patch' })
  if (dsh.client) caps.push({ kind: 'client', name: 'dsh.client', detail: 'web client' })
  for (const command of bin) caps.push({ kind: 'bin', name: command })
  if (Array.isArray(dsh.skills)) for (const skill of dsh.skills) caps.push({ kind: 'skill', name: String(skill) })

  const sourceEntries = [...entries.entries()].filter(([entry]) => /\.(?:js|mjs|cjs|ts|tsx|jsx)$/.test(entry))
  const sourceText = sourceEntries.map(([, bytes]) => Buffer.from(bytes).toString('utf8')).join('\n')
  const toolNames = new Set<string>()
  for (const match of sourceText.matchAll(/defineTool\s*\(\s*\{[\s\S]{0,500}?name\s*:\s*['"]([^'"]+)['"]/g)) toolNames.add(match[1]!)
  for (const tool of toolNames) caps.push({ kind: 'tool', name: tool })

  const buildScripts = ['preinstall', 'install', 'postinstall', 'prepare'].filter((key) => typeof scripts[key] === 'string')
  for (const script of buildScripts) caps.push({ kind: 'build-script', name: script, detail: String(scripts[script]) })
  const allText = [packageJsonText, textOf(entries, 'README.md') ?? '', sourceText].join('\n')
  const outboundHosts = hostsOf(allText)
  for (const host of outboundHosts) caps.push({ kind: 'network', name: host })
  const credRefs = credsOf(allText)
  for (const cred of credRefs) caps.push({ kind: 'credential', name: cred })

  const unknowns: string[] = []
  if (sourceEntries.length === 0) unknowns.push('no executable source file parsed')
  if (dsh.bundle && !textOf(entries, 'cordis.patch.yml')) unknowns.push('dsh.bundle declared without cordis.patch.yml')
  const risk = riskFromCaps(caps, outboundHosts, buildScripts, credRefs)
  const integrity = sha256(buffer)
  const snapshotId = `snap_${sha256(Buffer.from(canonicalJson({ name, version, integrity, caps, risk }))).slice(0, 24)}`
  return {
    snapshot_id: snapshotId,
    spec: specLabel ?? `${name}@${version}`,
    name,
    version,
    integrity,
    caps,
    tool_names: [...toolNames].sort(),
    outbound_hosts: outboundHosts,
    cred_refs: credRefs,
    build_scripts: buildScripts,
    risk,
    source: 'extracted',
    extractor_version: EXTRACTOR_VERSION,
    unknowns,
  }
}
