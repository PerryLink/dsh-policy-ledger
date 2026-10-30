#!/usr/bin/env node
/** Minimal CLI: dsh-policy-ledger doctor <package.tgz> [--json] */
import { readFileSync } from 'node:fs'
import { inspectPackageTarball } from '../lib/adapters/tarball.js'

const args = process.argv.slice(2)
const command = args[0]
if (command !== 'doctor' || !args[1]) {
  console.error('usage: dsh-policy-ledger doctor <package.tgz> [--json]')
  process.exit(64)
}
const file = args[1]
try {
  const snapshot = inspectPackageTarball(readFileSync(file), file)
  if (args.includes('--json')) {
    console.log(JSON.stringify(snapshot, null, 2))
  } else {
    console.log(`package: ${snapshot.name}@${snapshot.version}`)
    console.log(`risk: ${snapshot.risk} (extractor ${snapshot.extractor_version})`)
    console.log(`capabilities: ${snapshot.caps.length}`)
    for (const cap of snapshot.caps) console.log(`  - ${cap.kind}: ${cap.name}${cap.detail ? ` (${cap.detail})` : ''}`)
    if (snapshot.outbound_hosts.length) console.log(`outbound hosts: ${snapshot.outbound_hosts.join(', ')}`)
    if (snapshot.build_scripts.length) console.log(`build scripts: ${snapshot.build_scripts.join(', ')}`)
    if (snapshot.unknowns.length) console.log(`unknowns: ${snapshot.unknowns.join('; ')}`)
  }
  process.exit(snapshot.risk === 'R3' ? 2 : 0)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
