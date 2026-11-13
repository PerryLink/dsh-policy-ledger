import test from 'node:test'
import assert from 'node:assert/strict'
import { createTools } from '../lib/plugin/tools.js'
import { riskBreakdown } from '../lib/core/trust.js'

class FakeTable { map = new Map(); get(k){return this.map.get(k)}; entries(){return this.map.entries()}; get size(){return this.map.size}; async put(k,v){this.map.set(k,v)} }
const tools = Object.fromEntries(createTools({ snapshots: new FakeTable(), incidents: new FakeTable(), baseDir: '/tmp/policy-risk', inputRoots: ['/tmp'] }).map((t) => [t.name, t]))
const exec = { callId: 'risk' }

test('no capabilities is R0 with an empty factor list', async () => {
  const r = await tools['trust_risk_report'].execute({ caps: [] }, exec)
  assert.equal(r.risk, 'R0')
  assert.equal(r.score, 0)
  assert.deepEqual(r.factors, [])
  assert.equal(r.capped, false)
})

test('a single network host already scores R2', async () => {
  const r = await tools['trust_risk_report'].execute({ caps: [], hosts: ['api.example.test'] }, exec)
  assert.equal(r.risk, 'R2')
  assert.equal(r.score, 2)
  assert.deepEqual(r.factors, [{ factor: 'outbound host', points: 2 }])
})

test('hosts plus credentials plus a build script cap at R3', async () => {
  const r = await tools['trust_risk_report'].execute({ caps: [{ kind: 'bundle', name: 'patch' }], hosts: ['api.example.test'], cred_refs: ['GH_TOKEN'], build_scripts: ['postinstall'] }, exec)
  assert.equal(r.risk, 'R3')
  assert.equal(r.score, 7)
  assert.equal(r.capped, true)
  assert.equal(r.factors.length, 4)
})

test('riskBreakdown and the tool agree', async () => {
  const caps = [{ kind: 'client', name: 'http' }]
  const direct = riskBreakdown(caps, [], [], [])
  const viaTool = await tools['trust_risk_report'].execute({ caps }, exec)
  assert.equal(viaTool.risk, direct.risk)
  assert.equal(viaTool.score, direct.score)
})
