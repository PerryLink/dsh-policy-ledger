import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createTools } from '../lib/plugin/tools.js'
import { inspectPackageTarball } from '../lib/adapters/tarball.js'

class FakeTable {
  map = new Map()
  get(key) { return this.map.get(key) }
  entries() { return this.map.entries() }
  get size() { return this.map.size }
  async put(key, value) { this.map.set(key, value) }
}

async function makeTgz(root, name, pkg, source = '') {
  const dir = path.join(root, name.replace(/[^a-z0-9]+/gi, '-'))
  const packageDir = path.join(dir, 'package')
  await mkdir(packageDir, { recursive: true })
  await writeFile(path.join(packageDir, 'package.json'), JSON.stringify(pkg, null, 2))
  await writeFile(path.join(packageDir, 'lib.js'), source || "export const x = 1\n")
  if (pkg.dsh?.bundle) await writeFile(path.join(packageDir, 'cordis.patch.yml'), '- insert:\n    - id: demo\n      name: demo\n')
  const tar = path.join(root, `${name}.tgz`)
  execFileSync('tar', ['-czf', tar, '-C', dir, 'package'])
  return tar
}

test('extracts capabilities and risk with a fail-closed R3', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-trust-test-'))
  try {
    const tar = await makeTgz(dir, 'risky', {
      name: '@synthetic/risky', version: '1.0.0',
      dsh: { bundle: { patch: './cordis.patch.yml' }, client: { platform: 'web' } },
      bin: { 'risky-cli': './cli.js' },
      scripts: { postinstall: 'node build.js' },
    }, "const url = 'https://evil.example.com/api';\ndefineTool({ name: 'demo.read', description: 'x' })\n")
    const snapshot = inspectPackageTarball(await readFile(tar), 'risky')
    assert.equal(snapshot.name, '@synthetic/risky')
    assert.equal(snapshot.risk, 'R3')
    assert.ok(snapshot.tool_names.includes('demo.read'))
    assert.ok(snapshot.build_scripts.includes('postinstall'))
    assert.ok(snapshot.outbound_hosts.includes('evil.example.com'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('snapshot -> diff -> assert -> diagnose -> bundle -> probe', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-trust-test-'))
  try {
    const safeTar = await makeTgz(dir, 'safe', { name: '@synthetic/safe', version: '1.0.0', dsh: { bundle: { patch: './cordis.patch.yml' } } }, "defineTool({ name: 'safe.read' })\n")
    const riskyTar = await makeTgz(dir, 'risky', { name: '@synthetic/risky', version: '2.0.0', dsh: { bundle: { patch: './cordis.patch.yml' }, client: { platform: 'web' } }, scripts: { postinstall: 'node build.js' } }, "const url = 'https://evil.example.com/x'; defineTool({ name: 'risky.write' })\n")
    const snapshots = new FakeTable()
    const incidents = new FakeTable()
    const tools = createTools({ snapshots, incidents, baseDir: path.join(dir, 'store'), inputRoots: [dir] })
    const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]))
    const exec = { callId: 'trust-call', agent: { id: 'tester' } }
    const safe = await byName['trust_capability_snapshot'].execute({ tarball_path: safeTar }, exec)
    const risky = await byName['trust_capability_snapshot'].execute({ tarball_path: riskyTar }, exec)
    assert.equal(safe.risk, 'R1')
    assert.equal(risky.risk, 'R3')
    const diff = await byName['trust_diff'].execute({ from_snapshot_id: safe.snapshot_id, to_snapshot_id: risky.snapshot_id }, exec)
    assert.equal(diff.escalated, true)
    assert.ok(diff.blockers.length > 0)
    const pass = await byName['trust_assert'].execute({ snapshot_id: safe.snapshot_id, tarball_path: safeTar }, exec)
    assert.equal(pass.ok, true)
    const fail = await byName['trust_assert'].execute({ snapshot_id: safe.snapshot_id, tarball_path: riskyTar }, exec)
    assert.equal(fail.ok, false)
    const diagnosed = await byName['install_diagnose'].execute({ log_text: 'ERR_PNPM_FETCH_404 404 Not Found\\n GET https://registry.npmjs.org/@x/y' }, exec)
    assert.equal(diagnosed.error_code, 'E_TRUST_RESOLVE_404')
    assert.equal(diagnosed.actions.length, 3)
    const bundle = await byName['install_bundle'].execute({ incident_id: diagnosed.incident_id }, exec)
    assert.match(bundle.sha256, /^[0-9a-f]{64}$/)
    const probe = await byName['install_probe'].execute({ network: false }, exec)
    assert.equal(probe.node, process.version)
    assert.equal(probe.perm, 'ok')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('path allowlist fails closed', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-trust-test-'))
  try {
    const tools = createTools({ snapshots: new FakeTable(), incidents: new FakeTable(), baseDir: path.join(dir, 'store'), inputRoots: [dir] })
    const snapshot = tools.find((tool) => tool.name === 'trust_capability_snapshot')
    await assert.rejects(() => snapshot.execute({ tarball_path: '/etc/hosts' }, { callId: 'c' }), /E_TRUST_PATH_NOT_ALLOWED/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
