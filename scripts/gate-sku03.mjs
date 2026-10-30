import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
try { execFileSync(process.execPath, ['scripts/acceptance.mjs'], { stdio: 'inherit' }) } catch { process.exit(1) }
const rows = readFileSync('ACCEPTANCE.csv', 'utf8').trim().split('\n').slice(1).map((line) => line.split(','))
if (!rows.length) { console.error('gate: no rows'); process.exit(2) }
for (const row of rows) {
  if (row.length < 7 || !row[0] || !row[1] || !row[2] || !row[3] || !row[4] || !row[5] || row[6] !== 'true') { console.error(`gate: bad row ${row.join(',')}`); process.exit(1) }
}
console.log(`gate ok: ${rows.length} SKU-03 S1 rows (public/synthetic, not counted)`)
