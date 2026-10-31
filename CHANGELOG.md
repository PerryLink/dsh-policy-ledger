# Changelog

## 0.2.0-alpha.1 — 2026-10-31

- Boundary correction: customer evidence and Gate/ledger/retry/five-state are permanently out of scope, not deferred.

## 0.2.0-alpha.0 — 2026-10-31

- Corrected scope/name mismatch: current package is an S1 read-only install doctor, not a policy ledger/Gate.
- Renamed `trust.assert` → `trust.assert_tarball`; old name kept as deprecated alias.
- Fixed THIRD-PARTY-NOTICES (was incorrectly the einvoice notice).

## 0.1.0-alpha.2 — 2026-10-31

- Pinned zod to 4.6.7 with pnpm-workspace override; fixes CI duplicate-zod type failure.

## 0.1.0-alpha.1 — 2026-10-31

- Fix npm bin: `bin/dsh-policy-ledger.mjs` without a `./` prefix; alpha.0 was published without a CLI bin.

## 0.1.0-alpha.0 — 2026-10-31

- First S1: capability snapshot/diff/assert, install diagnose/probe/bundle, CLI doctor.
- Synthetic public-demo acceptance; no Gate tools, Client or install.retry.
