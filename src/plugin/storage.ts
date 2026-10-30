import { createHash, randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { Context } from '@deepseek-ai/cordis'
import { z } from 'zod'

const capabilitySchema = z.object({
  kind: z.enum(['bundle', 'client', 'bin', 'skill', 'tool', 'build-script', 'network', 'credential']),
  name: z.string(),
  detail: z.string().optional(),
})

export const snapshotSchema = z.object({
  snapshot_id: z.string(),
  spec: z.string(),
  name: z.string(),
  version: z.string(),
  integrity: z.string(),
  caps: z.array(capabilitySchema),
  tool_names: z.array(z.string()),
  outbound_hosts: z.array(z.string()),
  cred_refs: z.array(z.string()),
  build_scripts: z.array(z.string()),
  risk: z.enum(['R0', 'R1', 'R2', 'R3']),
  source: z.literal('extracted'),
  extractor_version: z.string(),
  unknowns: z.array(z.string()),
  created_at: z.string(),
  run_id: z.string(),
  actor: z.string(),
  evidence_sha256: z.string(),
})

export const incidentSchema = z.object({
  incident_id: z.string(),
  stage: z.enum(['resolve', 'fetch', 'extract', 'link', 'build', 'activate', 'unknown']),
  error_code: z.string(),
  root_cause: z.string(),
  actions: z.array(z.string()),
  confidence: z.number(),
  evidence_lines: z.array(z.string()),
  log_sha256: z.string(),
  created_at: z.string(),
  run_id: z.string(),
  actor: z.string(),
})

export type SnapshotRecord = z.infer<typeof snapshotSchema>
export type IncidentRecord = z.infer<typeof incidentSchema>
export type TrustTable<T> = {
  get(key: string): T | undefined
  entries(): IterableIterator<[string, T]>
  readonly size: number
  put(key: string, value: T): Promise<void>
}

export const trustSpec = defineDomain({
  name: 'trust',
  version: 1,
  tables: {
    snapshots: domainTable<string, SnapshotRecord>(snapshotSchema),
    incidents: domainTable<string, IncidentRecord>(incidentSchema),
  },
})

export async function openTrustTables(ctx: Context): Promise<{ snapshots: TrustTable<SnapshotRecord>; incidents: TrustTable<IncidentRecord> }> {
  const domain = await ctx.storageDomain.open(trustSpec)
  ctx.effect(() => () => domain.close(), 'dsh-policy-ledger.domainClose')
  return {
    snapshots: domain.table('snapshots') as TrustTable<SnapshotRecord>,
    incidents: domain.table('incidents') as TrustTable<IncidentRecord>,
  }
}

export function sha256Buffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
export function newId(prefix: string): string {
  let time = Date.now()
  let head = ''
  for (let index = 0; index < 10; index += 1) {
    head = CROCKFORD[time % 32] + head
    time = Math.floor(time / 32)
  }
  let tail = ''
  for (const byte of randomBytes(8)) tail += CROCKFORD[byte % 32]
  return `${prefix}_${head}${tail}`
}

export async function writeBundle(baseDir: string, name: string, bytes: Buffer): Promise<string> {
  const dir = path.join(baseDir, 'bundles')
  await mkdir(dir, { recursive: true })
  const filePath = path.join(dir, name)
  await writeFile(filePath, bytes)
  return filePath
}
