/** DSH Host entry for SKU-03 S1 (read-only capability/installation doctor). */

import path from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { createTools } from './tools.js'
import { openTrustTables } from './storage.js'

export const name = 'dsh-policy-ledger'
export const inject = ['tools', 'storageDomain']

export async function apply(ctx: Context): Promise<void> {
  const baseDir = process.env.DSH_TRUST_HOME ?? path.join(process.env.DSH_HOME ?? process.cwd(), 'storages', 'dsh-policy-ledger')
  const roots = (process.env.DSH_TRUST_INPUT_ROOTS ?? process.cwd()).split(path.delimiter).map((entry) => entry.trim()).filter(Boolean)
  const { snapshots, incidents } = await openTrustTables(ctx)
  for (const tool of createTools({ snapshots, incidents, baseDir, inputRoots: roots })) ctx.tools.register(tool)
}
