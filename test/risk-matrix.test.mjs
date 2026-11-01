import test from 'node:test'
import assert from 'node:assert/strict'
import { riskMatrix } from '../lib/core/trust.js'
import { createTools } from '../lib/plugin/tools.js'

class FakeTable { map = new Map(); get(k){return this.map.get(k)}; entries(){return this.map.entries()}; get size(){return this.map.size}; async put(k,v){this.map.set(k,v)} }
const tools = Object.fromEntries(createTools({ snapshots: new FakeTable(), incidents: new FakeTable(), baseDir: '/tmp/policy-matrix', inputRoots: ['/tmp'] }).map((t) => [t.name, t]))
const exec = { callId: 'matrix' }

test('counts per risk level and the highest level', async () => {
  const r = await tools['trust.risk_matrix'].execute({ rows: [
    { name: 'a', risk: 'R0' }, { name: 'b', risk: 'R1' }, { name: 'c', risk: 'R3' }, { name: 'd', risk: 'R1' },
  ] }, exec)
  assert.equal(r.total, 4)
  assert.equal(r.highest, 'R3')
  assert.deepEqual(r.attention, ['c'])
  assert.equal(r.by_risk.R1, 2)
})

test('empty input has no highest level', () => {
  const m = riskMatrix([])
  assert.equal(m.total, 0)
  assert.equal(m.highest, null)
  assert.deepEqual(m.attention, [])
})

test('R2 and R3 rows are both listed for review, sorted by name', () => {
  const m = riskMatrix([{ name: 'z', risk: 'R2' }, { name: 'a', risk: 'R3' }, { name: 'm', risk: 'R1' }])
  assert.deepEqual(m.attention, ['a', 'z'])
  assert.equal(m.by_risk.R2, 1)
  assert.equal(m.by_risk.R3, 1)
})
