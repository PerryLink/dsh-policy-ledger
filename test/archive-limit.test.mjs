import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, truncate, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { inspectPackageTarball } from '../lib/adapters/tarball.js'
import { createTools } from '../lib/plugin/tools.js'

const BOMB_BYTES = 40 * 1024 * 1024
const OVERSIZE_BYTES = 9 * 1024 * 1024
const TIME_LIMIT_MS = 2000

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
  await writeFile(path.join(packageDir, 'lib.js'), source || 'export const x = 1\n')
  const tar = path.join(root, `${name}.tgz`)
  execFileSync('tar', ['-czf', tar, '-C', dir, 'package'])
  return tar
}

function toolByName(tools, name) {
  const tool = tools.find((candidate) => candidate.name === name)
  assert.ok(tool, `missing tool: ${name}`)
  return tool
}

test('a normal small tarball still passes the archive limits', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-archive-limit-'))
  try {
    const tar = await makeTgz(dir, 'safe', { name: '@synthetic/archive-safe', version: '1.0.0' }, "defineTool({ name: 'safe.read' })\n")
    const tools = createTools({ snapshots: new FakeTable(), incidents: new FakeTable(), baseDir: path.join(dir, 'store'), inputRoots: [dir] })
    const snapshot = await toolByName(tools, 'trust.capability_snapshot').execute(
      { tarball_path: tar },
      { callId: 'archive-limit-normal', agent: { id: 'tester' } },
    )
    assert.equal(snapshot.name, '@synthetic/archive-safe')
    assert.equal(snapshot.version, '1.0.0')
    assert.equal(snapshot.risk, 'R0')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a high-ratio gzip bomb is rejected fast with E_TRUST_ARCHIVE_LIMIT', () => {
  const bomb = gzipSync(Buffer.alloc(BOMB_BYTES))
  assert.ok(bomb.length < 100 * 1024, `bomb should stay small, got ${bomb.length} bytes`)

  let caught
  const started = performance.now()
  assert.throws(
    () => inspectPackageTarball(bomb),
    (error) => {
      caught = error
      assert.equal(error.name, 'TrustError')
      assert.equal(error.code, 'E_TRUST_ARCHIVE_LIMIT')
      assert.match(error.message, /E_TRUST_ARCHIVE_LIMIT/)
      return true
    },
  )
  const elapsedMs = performance.now() - started
  assert.ok(elapsedMs < TIME_LIMIT_MS, `bomb rejection took ${elapsedMs.toFixed(1)} ms (limit ${TIME_LIMIT_MS} ms)`)
  console.log(`[archive-limit] ${BOMB_BYTES / 1024 / 1024} MiB gzip bomb (${bomb.length} B) rejected in ${elapsedMs.toFixed(1)} ms: ${caught.code}`)
})

test('an oversized raw tarball file is rejected before it is read', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-archive-limit-'))
  try {
    const big = path.join(dir, 'oversized.tgz')
    await writeFile(big, '')
    await truncate(big, OVERSIZE_BYTES)

    const snapshots = new FakeTable()
    snapshots.map.set('snap_oversize', { snapshot_id: 'snap_oversize', spec: '@synthetic/oversize@1.0.0', name: '@synthetic/oversize', version: '1.0.0', caps: [] })
    const tools = createTools({ snapshots, incidents: new FakeTable(), baseDir: path.join(dir, 'store'), inputRoots: [dir] })
    const exec = { callId: 'archive-limit-oversize', agent: { id: 'tester' } }
    const calls = [
      ['trust.capability_snapshot', { tarball_path: big }],
      ['trust.assert_tarball', { snapshot_id: 'snap_oversize', tarball_path: big }],
    ]

    for (const [name, args] of calls) {
      const started = performance.now()
      await assert.rejects(
        () => toolByName(tools, name).execute(args, exec),
        (error) => {
          assert.equal(error.code, 'E_TRUST_ARCHIVE_LIMIT', `${name} should reject the oversized file`)
          return true
        },
      )
      const elapsedMs = performance.now() - started
      assert.ok(elapsedMs < TIME_LIMIT_MS, `${name} oversized rejection took ${elapsedMs.toFixed(1)} ms`)
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
