# PUBLISH-STATUS — dsh-policy-ledger

## 0.1.0-alpha.0 — published 2026-10-31T06:55+08:00 (bin missing)

- npm publish exit 0; shasum `92adfa65ec89a3dd9c94b6ce87660b3ecb9ecfae`.
- npm **removed** the bin because it was written as `./bin/dsh-policy-ledger.mjs`; alpha.0 has no CLI.
- Registry root 404 immediately after publish (first-package processing).

## 0.1.0-alpha.1 — submitted 2026-10-31T06:56+08:00

- Fix: `bin/dsh-policy-ledger.mjs` (no `./`).
- npm publish exit 0; shasum `48bc6971149eaf99a8d4822274bdf4cabf4eaaa0`.
- Verify `dist-tags` and install the exact tarball before announcing; first-package propagation may lag.
- No unpublish/deprecate.

### alpha.1 verified 2026-10-31T06:57+08:00

- `dist-tags` showed `next: 0.1.0-alpha.1`; exact version and `bin` are public (`dsh-policy-ledger` → `bin/dsh-policy-ledger.mjs`).
- Registry tarball install into a temp DSH profile passed; layer `# == dsh-policy-ledger`; remove passed.
- `npm dist-tag add ...@0.1.0-alpha.1 latest` returned success; `latest` may lag briefly because alpha.0 was the first published version and had no bin.

### latest confirmed 2026-10-31T06:58+08:00

- `dist-tags`: `{ latest: "0.1.0-alpha.1", next: "0.1.0-alpha.1" }`.
- alpha.1 includes the CLI bin; alpha.0 remains historical/binless.

## 0.2.0-alpha.0 — install doctor scope (2026-10-31)

- Scope corrected: install doctor subset, not policy ledger/Gate.
- `trust.assert_tarball` added; old `trust.assert` deprecated alias.
- THIRD-PARTY-NOTICES fixed; 4 S1 rows, public/synthetic.

## 0.2.0-alpha.1 — public-only boundary (2026-10-31)

- Customer evidence and Gate/ledger/retry/five-state are permanently out of scope, not deferred.
