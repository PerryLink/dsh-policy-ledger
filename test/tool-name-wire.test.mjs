import test from 'node:test'
import assert from 'node:assert/strict'
import { createTools } from '../lib/plugin/tools.js'

class T {
  map = new Map()
  get(k) { return this.map.get(k) }
  entries() { return this.map.entries() }
  get size() { return this.map.size }
  async put(k, v) { this.map.set(k, v) }
}

// The model wire format only accepts names matching ^[a-zA-Z0-9_-]+$.
// A dotted name (the 0.2.x "trust.<tool>" / "install.<tool>" style) is rejected
// by the provider with `Invalid 'tools[N].name'` and takes the whole tools array
// down with it, so the plugin registers but no request that carries the tools
// can succeed.
const WIRE_NAME = /^[a-zA-Z0-9_-]+$/

// The nine registered names, including the deprecated trust_assert alias.
const EXPECTED = [
  'install_bundle',
  'install_diagnose',
  'install_probe',
  'trust_assert',
  'trust_assert_tarball',
  'trust_capability_snapshot',
  'trust_diff',
  'trust_risk_matrix',
  'trust_risk_report',
]

test('every registered tool name is a valid model wire name', () => {
  const tools = createTools({
    snapshots: new T(),
    incidents: new T(),
    baseDir: '/tmp/policy-ledger-wire',
    inputRoots: ['/tmp/policy-ledger-wire'],
  })
  assert.equal(tools.length, EXPECTED.length)
  for (const tool of tools) {
    assert.match(tool.name, WIRE_NAME, `${tool.name} would be rejected by the provider`)
    assert.ok(!tool.name.includes('.'), `${tool.name} must not contain a dot`)
    assert.ok(tool.name.startsWith('trust_') || tool.name.startsWith('install_'), `${tool.name} must keep the trust_/install_ namespace`)
  }
  const names = tools.map((tool) => tool.name)
  assert.equal(new Set(names).size, names.length, 'tool names must be unique')
  assert.deepEqual([...names].sort(), EXPECTED)
})
