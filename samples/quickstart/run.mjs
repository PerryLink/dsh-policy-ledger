#!/usr/bin/env node
/**
 * dsh-policy-ledger quickstart — runs the built install-doctor tools over a bundled
 * synthetic tarball and install log. `expected/result.json` is the stdout of
 * `node samples/quickstart/run.mjs --json`, so it is a real run over the sample.
 *
 *   node samples/quickstart/run.mjs            # human-readable summary
 *   node samples/quickstart/run.mjs --json     # the golden result on stdout
 *   node samples/quickstart/run.mjs --check    # recompute and diff against the golden file
 *
 * Everything is local and synthetic: no registry, no network, no real package.
 */
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTools } from '../../lib/plugin/tools.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const inputDir = path.join(here, 'input')
const expectedPath = path.join(here, 'expected', 'result.json')
const mode = process.argv.includes('--check') ? 'check' : process.argv.includes('--json') ? 'json' : 'summary'

class MemoryTable {
  map = new Map()
  get(key) { return this.map.get(key) }
  entries() { return this.map.entries() }
  get size() { return this.map.size }
  async put(key, value) { this.map.set(key, value) }
}

async function run() {
  const tarballPath = path.join(inputDir, 'synthetic-widget-1.0.0.tgz')
  const logText = await readFile(path.join(inputDir, 'install.log'), 'utf8')
  const baseDir = await mkdtemp(path.join(os.tmpdir(), 'dsh-policy-ledger-quickstart-'))
  try {
    const tools = Object.fromEntries(createTools({
      snapshots: new MemoryTable(),
      incidents: new MemoryTable(),
      baseDir,
      inputRoots: [inputDir],
    }).map((tool) => [tool.name, tool]))
    const call = (name, args) => tools[name].execute(args, { callId: 'quickstart' })

    const snapshot = await call('trust.capability_snapshot', { tarball_path: tarballPath })
    const asserted = await call('trust.assert_tarball', { snapshot_id: snapshot.snapshot_id, tarball_path: tarballPath })
    const factors = await call('trust.risk_report', {
      caps: snapshot.caps.map((cap) => ({ kind: cap.kind, name: cap.name })),
      hosts: snapshot.outbound_hosts,
      build_scripts: snapshot.build_scripts,
      cred_refs: snapshot.cred_refs,
    })
    const diagnosis = await call('install.diagnose', { log_text: logText })
    const matrix = await call('trust.risk_matrix', { rows: [{ name: `${snapshot.name}@${snapshot.version}`, risk: snapshot.risk }] })

    assert.ok(asserted.ok, 'the re-read tarball should match its own snapshot')
    return {
      sample: 'samples/quickstart/input',
      synthetic: true,
      package: {
        name: snapshot.name,
        version: snapshot.version,
        snapshot_id: snapshot.snapshot_id,
        integrity: snapshot.integrity,
        risk: snapshot.risk,
      },
      capabilities: snapshot.caps.map((cap) => `${cap.kind}:${cap.name}`).sort(),
      tool_names: snapshot.tool_names,
      assert: { ok: asserted.ok, rows: asserted.rows.map((row) => `${row.exporter}:${row.state}`) },
      risk_factors: {
        risk: factors.risk,
        score: factors.score,
        factors: factors.factors.map((factor) => `${factor.factor}:${factor.points}`),
      },
      diagnosis: {
        stage: diagnosis.stage,
        error_code: diagnosis.error_code,
        root_cause: diagnosis.root_cause,
        actions: diagnosis.actions,
        confidence: diagnosis.confidence,
        evidence_lines: diagnosis.evidence_lines,
      },
      risk_matrix: matrix,
    }
  } finally {
    await rm(baseDir, { recursive: true, force: true })
  }
}

function printSummary(result) {
  console.log('dsh-policy-ledger quickstart - synthetic tarball (not a real package)')
  console.log(`package ${result.package.name}@${result.package.version}: risk ${result.package.risk}, ${result.capabilities.length} capabilities`)
  console.log(`assert: ${result.assert.ok ? 'ok' : 'mismatch'} (${result.assert.rows.filter((row) => row.endsWith(':pass')).length}/${result.assert.rows.length} pass)`)
  console.log(`risk factors: ${result.risk_factors.factors.join(', ')} -> ${result.risk_factors.risk}`)
  console.log(`diagnosis: ${result.diagnosis.error_code} (stage ${result.diagnosis.stage}, confidence ${result.diagnosis.confidence})`)
  console.log(`risk matrix: ${result.risk_matrix.total} package, highest ${result.risk_matrix.highest}, ${result.risk_matrix.attention.length} to review`)
}

const result = await run()

if (mode === 'json') {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
} else if (mode === 'check') {
  const expected = JSON.parse(await readFile(expectedPath, 'utf8'))
  assert.deepEqual(result, expected)
  printSummary(result)
  console.log('golden samples/quickstart/expected/result.json matches')
  console.log('quickstart ok')
} else {
  printSummary(result)
}
