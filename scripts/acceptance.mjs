/** SKU-03 S1 acceptance: synthetic package tarballs + install logs; not counted. */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { mkdirSync, writeFileSync } from 'node:fs'
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

async function makeTgz(root, name, pkg, source) {
  const dir = path.join(root, name.replace(/[^a-z0-9]+/gi, '-'))
  const packageDir = path.join(dir, 'package')
  await mkdir(packageDir, { recursive: true })
  await writeFile(path.join(packageDir, 'package.json'), JSON.stringify(pkg, null, 2))
  await writeFile(path.join(packageDir, 'lib.js'), source)
  if (pkg.dsh?.bundle) await writeFile(path.join(packageDir, 'cordis.patch.yml'), '- insert:\n    - id: demo\n      name: demo\n')
  const tar = path.join(root, `${name}.tgz`)
  execFileSync('tar', ['-czf', tar, '-C', dir, 'package'])
  return tar
}

const root = process.cwd()
const runId = `sku03-${new Date().toISOString().replace(/[:.]/g, '-')}`
const evidenceDir = path.join(root, 'evidence', runId)
mkdirSync(evidenceDir, { recursive: true })
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-trust-accept-'))
const samples = []
const coverage = { snapshot: 0, diff: 0, diagnose: 0, bundle: 0 }
try {
  const safeTar = await makeTgz(dir, 'safe', { name: '@synthetic/safe', version: '1.0.0', dsh: { bundle: { patch: './cordis.patch.yml' } } }, "defineTool({ name: 'safe.read' })\n")
  const mediumTar = await makeTgz(dir, 'medium', { name: '@synthetic/medium', version: '1.0.0', dsh: { bundle: { patch: './cordis.patch.yml' } }, bin: { 'medium-cli': './cli.js' } }, "defineTool({ name: 'medium.read' })\n")
  const riskyTar = await makeTgz(dir, 'risky', { name: '@synthetic/risky', version: '2.0.0', dsh: { bundle: { patch: './cordis.patch.yml' }, client: { platform: 'web' } }, scripts: { postinstall: 'node build.js' } }, "const url = 'https://evil.example.com/x'; defineTool({ name: 'risky.write' })\n")
  const snapshots = new FakeTable(); const incidents = new FakeTable()
  const tools = createTools({ snapshots, incidents, baseDir: path.join(dir, 'store'), inputRoots: [dir] })
  const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]))
  const exec = { callId: 'acceptance', agent: { id: 'acceptance' } }
  for (const [label, tarPath] of [['safe', safeTar], ['medium', mediumTar], ['risky', riskyTar]]) {
    const result = await byName['trust.capability_snapshot'].execute({ tarball_path: tarPath }, exec)
    samples.push({ name: label, sha256: sha256(await readFile(tarPath)), risk: result.risk, caps: result.caps.length })
    if (result.name && result.version && result.risk) coverage.snapshot += 1
  }
  const safe = await byName['trust.capability_snapshot'].execute({ tarball_path: safeTar }, exec)
  const risky = await byName['trust.capability_snapshot'].execute({ tarball_path: riskyTar }, exec)
  const diff = await byName['trust.diff'].execute({ from_snapshot_id: safe.snapshot_id, to_snapshot_id: risky.snapshot_id }, exec)
  if (diff.escalated && diff.blockers.length > 0) coverage.diff = 1
  const logs = [
    'ERR_PNPM_FETCH_404 404 Not Found\nGET https://registry.npmjs.org/@x/y',
    'EACCES: permission denied, mkdir /home/x/.dsh/profiles/p/node_modules',
    'ETIMEDOUT registry.npmjs.org',
    'ENOSPC: no space left on device',
    'postinstall script failed with exit code 1',
  ]
  for (const log of logs) {
    const diagnosed = await byName['install.diagnose'].execute({ log_text: log }, exec)
    if (diagnosed.error_code && diagnosed.stage && diagnosed.actions.length === 3) coverage.diagnose += 1
    if (log.includes('404')) {
      const bundled = await byName['install.bundle'].execute({ incident_id: diagnosed.incident_id }, exec)
      if (bundled.sha256 && bundled.path) coverage.bundle = 1
    }
  }
} finally {
  await rm(dir, { recursive: true, force: true })
}
const riskTools = createTools({ snapshots: new FakeTable(), incidents: new FakeTable(), baseDir: path.join(dir, 'risk'), inputRoots: [dir] })
const riskTool = Object.fromEntries(riskTools.map((t) => [t.name, t]))
const riskReport = await riskTool['trust.risk_report'].execute({ caps: [{ kind: 'bundle', name: 'patch' }], hosts: ['api.example.test'], cred_refs: ['GH_TOKEN'] }, { callId: 'risk' })
const metrics = [
  { req_id: 'SKU-03-A01', metric: '能力快照抽取（3 包）', threshold: '3/3', actual: coverage.snapshot, pass: coverage.snapshot === 3, counted: false },
  { req_id: 'SKU-03-A02', metric: '扩权 diff 捕获（1 对）', threshold: '1/1', actual: coverage.diff, pass: coverage.diff === 1, counted: false },
  { req_id: 'SKU-03-A03', metric: '安装日志归因（5 条）', threshold: '5/5', actual: coverage.diagnose, pass: coverage.diagnose === 5, counted: false },
  { req_id: 'SKU-03-A04', metric: '证据包生成（1 份）', threshold: '1/1', actual: coverage.bundle, pass: coverage.bundle === 1, counted: false },
  { req_id: 'SKU-03-A05', metric: '风险因子拆分（构包+出网+凭据）', threshold: 'R3', actual: riskReport.risk, pass: riskReport.risk === 'R3' && riskReport.factors.length === 3, counted: false },
]
const result = { run_id: runId, timestamp: new Date().toISOString(), scope: 'SKU-03-S1', status: 'partial', counted: false, note: 'synthetic tarballs/logs; user-approved public/synthetic; 0 real profiles/IT interviews', samples, metrics, pass: metrics.every((m) => m.pass) }
const resultText = `${JSON.stringify(result, null, 2)}\n`
writeFileSync(path.join(evidenceDir, 'result.json'), resultText)
const evidenceSha = sha256(resultText)
writeFileSync(path.join(root, 'ACCEPTANCE.csv'), ['req_id,metric,threshold,actual,script,evidence_sha256,pass', ...metrics.map((m) => `${m.req_id},${m.metric},${m.threshold},${m.actual},scripts/acceptance.mjs,${evidenceSha},${m.pass}`)].join('\n') + '\n')
if (!result.pass) { console.error(JSON.stringify(result, null, 2)); process.exit(1) }
console.log(`acceptance ok: ${runId}; snapshot=${coverage.snapshot}/3 diff=${coverage.diff}/1 diagnose=${coverage.diagnose}/5 bundle=${coverage.bundle}/1`)


// Normalize the public-only acceptance schema: source + counted=false.
{
  const fs = await import('node:fs')
  const file = 'ACCEPTANCE.csv'
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n')
  if (!lines[0].includes('source,counted')) {
    lines[0] += ',source,counted'
    for (let i = 1; i < lines.length; i += 1) lines[i] += ',public/synthetic,false'
    fs.writeFileSync(file, lines.join('\n') + '\n')
  }
}
