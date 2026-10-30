# BUILD-LOG — @perrylink/dsh-policy-ledger

## 2026-10-31 — S1 / 0.1.0-alpha.0

- User-approved public/synthetic demo; 0 real profiles/0 interviews; `partial`, `not counted`.
- 6 tools: capability_snapshot/diff/assert, install.diagnose/probe/bundle; CLI `dsh-policy-ledger doctor <tgz>`.
- `trust` domain (snapshots/incidents); local bundles; no Client/Gate/install.retry.
- `pnpm test` 3/3; `gate:sku03` 4 rows: snapshot 3/3, diff 1/1, diagnose 5/5, bundle 1/1.
- Name audit: scoped/bare/bin 404; `dsh-trust` bare taken; `dsh-plugin-doctor` bin taken.
- Publish: pending.

### alpha.1 bin fix

- npm removed the alpha.0 bin because the path was `./bin/dsh-policy-ledger.mjs`; alpha.1 uses `bin/dsh-policy-ledger.mjs`.

### alpha.0/alpha.1 publish (2026-10-31 06:55 +08)

- alpha.0 published but npm removed its bin (path had `./`); shasum `92adfa...`.
- alpha.1 fixes the bin path; published shasum `48bc6971149eaf99a8d4822274bdf4cabf4eaaa0`; verify registry/install.
