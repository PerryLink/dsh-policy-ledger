# Changelog

## 0.1.0-alpha.2 — 2026-10-31

- Pinned zod to 4.6.7 with pnpm-workspace override; fixes CI duplicate-zod type failure.

## 0.1.0-alpha.1 — 2026-10-31

- Fix npm bin: `bin/dsh-policy-ledger.mjs` without a `./` prefix; alpha.0 was published without a CLI bin.

## 0.1.0-alpha.0 — 2026-10-31

- First S1: capability snapshot/diff/assert, install diagnose/probe/bundle, CLI doctor.
- Synthetic public-demo acceptance; no Gate tools, Client or install.retry.
