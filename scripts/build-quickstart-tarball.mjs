#!/usr/bin/env node
/**
 * Build the synthetic npm tarball shipped with the dsh-policy-ledger quickstart.
 *
 *   node scripts/build-quickstart-tarball.mjs           # write the .tgz
 *   node scripts/build-quickstart-tarball.mjs --check   # verify the shipped bytes are reproducible
 *
 * The tarball is assembled with fflate (gzip) plus a tiny deterministic tar writer
 * (fixed mtime/uid/gid/mode, entries sorted), so rebuilding it yields the same SHA-256.
 * Contents are synthetic: no real package, no customer data, no executable install script.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'fflate'

const here = path.dirname(fileURLToPath(import.meta.url))
const outFile = path.join(here, '..', 'samples', 'quickstart', 'input', 'synthetic-widget-1.0.0.tgz')

const files = [
  ['package/package.json', JSON.stringify({
    name: '@synthetic/widget',
    version: '1.0.0',
    description: 'Synthetic widget used by the dsh-policy-ledger quickstart. Not a real package.',
    main: 'lib.js',
    dsh: { bundle: { patch: './cordis.patch.yml' } },
    bin: { 'widget-cli': './cli.js' },
  }, null, 2) + '\n'],
  ['package/cordis.patch.yml', '- insert:\n    - id: synthetic-widget\n      name: synthetic-widget\n'],
  ['package/lib.js', [
    "import { defineTool } from '@deepseek-ai/dsh-tools'",
    '',
    "export const widget = defineTool({",
    "  name: 'widget.read',",
    "  description: 'Read a synthetic widget record. Read-only.',",
    '})',
    '',
  ].join('\n')],
  ['package/README.md', '# @synthetic/widget\n\nSynthetic test package. No real code, no network, no install script.\n'],
]

function tarHeader(name, size) {
  const header = Buffer.alloc(512, 0)
  header.write(name, 0, 100, 'utf8')
  header.write('0000644\0', 100)
  header.write('0000000\0', 108)
  header.write('0000000\0', 116)
  header.write(`${size.toString(8).padStart(11, '0')}\0`, 124)
  header.write('00000000000\0', 136)
  header.write('        ', 148)
  header.write('0', 156)
  header.write('ustar\0', 257)
  header.write('00', 263)
  header.write('root', 265)
  header.write('root', 297)
  let sum = 0
  for (const byte of header) sum += byte
  header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148)
  return header
}

function buildTar(entries) {
  const chunks = []
  for (const [name, text] of entries) {
    const data = Buffer.from(text, 'utf8')
    chunks.push(tarHeader(name, data.length), data)
    const pad = (512 - (data.length % 512)) % 512
    if (pad) chunks.push(Buffer.alloc(pad, 0))
  }
  chunks.push(Buffer.alloc(1024, 0))
  return Buffer.concat(chunks)
}

const tar = buildTar(files)
const tgz = Buffer.from(gzipSync(tar, { level: 9, mtime: 0 }))
const sha256 = createHash('sha256').update(tgz).digest('hex')

if (process.argv.includes('--check')) {
  if (!existsSync(outFile)) {
    console.error(`missing ${path.relative(process.cwd(), outFile)}; run without --check first`)
    process.exit(1)
  }
  const shipped = readFileSync(outFile)
  const shippedSha = createHash('sha256').update(shipped).digest('hex')
  if (shippedSha !== sha256) {
    console.error(`tarball is not reproducible: shipped ${shippedSha}, rebuilt ${sha256}`)
    process.exit(1)
  }
  console.log(`tarball ok: ${path.relative(process.cwd(), outFile)} (${tgz.length} bytes, sha256 ${sha256})`)
} else {
  writeFileSync(outFile, tgz)
  console.log(`wrote ${path.relative(process.cwd(), outFile)} (${tgz.length} bytes, sha256 ${sha256})`)
}
