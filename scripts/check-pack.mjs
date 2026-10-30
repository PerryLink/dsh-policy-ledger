import { readFileSync } from 'node:fs'
const files = JSON.parse(readFileSync('pack.json', 'utf8'))[0]?.files?.map((file) => file.path) ?? []
if (!files.length) throw new Error('empty pack')
for (const required of ['package.json', 'cordis.patch.yml', 'README.md', 'LICENSE', 'NOTICE', 'bin/dsh-policy-ledger.mjs', 'lib/plugin/index.js']) if (!files.includes(required)) throw new Error(`missing: ${required}`)
for (const file of files) for (const pattern of [/^src\//, /^test\//, /^scripts\//, /^fixtures\//, /^evidence\//, /\.env/, /\.pem$/, /node_modules\//, /\.tgz$/]) if (pattern.test(file)) throw new Error(`forbidden: ${file}`)
console.log(`pack ok: ${files.length} files`)
