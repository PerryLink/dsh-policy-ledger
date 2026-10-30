# PUBLISH-STATUS — @perrylink/dsh-policy-ledger

## 0.1.0-alpha.0 — published 2026-10-31T06:55+08:00 (bin missing)

- npm publish exit 0; shasum `92adfa65ec89a3dd9c94b6ce87660b3ecb9ecfae`.
- npm **removed** the bin because it was written as `./bin/dsh-policy-ledger.mjs`; alpha.0 has no CLI.
- Registry root 404 immediately after publish (first-package processing).

## 0.1.0-alpha.1 — submitted 2026-10-31T06:56+08:00

- Fix: `bin/dsh-policy-ledger.mjs` (no `./`).
- npm publish exit 0; shasum `48bc6971149eaf99a8d4822274bdf4cabf4eaaa0`.
- Verify `dist-tags` and install the exact tarball before announcing; first-package propagation may lag.
- No unpublish/deprecate.
