<div align="center">

# dsh-policy-ledger

> **Status: KEEP — install-only companion.** Not a duplicate of `dsh-plugin-doctor`: this answers "what is installed, what does the tarball contain, why did the install fail?" with a read-only capability snapshot, tarball assertions and install-log diagnosis. `dsh-plugin-doctor` does package-structure, cordis and sandbox-smoke checks. Use both when you need both questions answered.

[![npm](https://img.shields.io/npm/v/dsh-policy-ledger)](https://www.npmjs.com/package/dsh-policy-ledger)
[![CI](https://github.com/PerryLink/dsh-policy-ledger/actions/workflows/ci.yml/badge.svg)](https://github.com/PerryLink/dsh-policy-ledger/actions)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
[![dsh-plugin](https://img.shields.io/badge/dsh--plugin-%E2%9C%93-green)](https://github.com/topics/dsh-plugin)
[![docs](https://img.shields.io/badge/docs-domain%20index-0b5fff)](https://perrylink.github.io/dsh-plugins/)

**Read-only install doctor: capability snapshot, tarball assert and install diagnosis.**

> **Status: alpha / public-synthetic / partial / not counted / not GA.** No customer evidence, customer data, or production-readiness claim.

[English](README.md) · [简体中文](README-zh.md) · [Español](README-es.md) · [Português](README-pt.md) · [हिन्दी](README-hi.md)

```sh
dsh plugin --profile <profile> add dsh-policy-ledger
```

</div>

![Workflow diagram for dsh-policy-ledger: local input, plugin, local output.](docs/assets/dsh-policy-ledger-flow.svg)

*Workflow: local input → plugin → local output. No model call is required.*

## Install

Install and verify:

```sh
dsh plugin --profile <profile> add dsh-policy-ledger
dsh --profile <profile> --dump-config | grep dsh-policy-ledger
```

Uninstall:

```sh
dsh plugin --profile <profile> remove dsh-policy-ledger
```

## What it does

Read-only install doctor: capability snapshot, tarball assert and install diagnosis. Runs locally on DeepSeek Harness. The table below is the exact tool surface; the examples use the real command surface.

Input and output stay local; nothing is uploaded.

## Tools

Tool names and descriptions are kept in English to match the runtime output.

| Tool | Purpose | Risk |
|---|---|---|
| `trust.capability_snapshot` | Extract declared capabilities and R0–R3 risk from a local npm `.tgz`: tools, bundle/client/bin/skill, build scripts, outbound hosts, credential references | R0 local read |
| `trust.diff` | Compare two stored snapshots: added/removed capabilities, risk escalation, blockers | R0 |
| `trust.assert_tarball` | Re-read a tarball and compare it with a stored snapshot: pass/missing/extra/changed/unknown | R0 |
| `install.diagnose` | Classify an install log into stage, root cause and three actions; return unknown rather than guess | R0 |
| `install.probe` | Check disk free, write permission, proxy, optional registry RTT, node/pnpm | R0 |
| `install.bundle` | Write a redacted incident ZIP (diagnosis + evidence lines) | R1 local write |

## Quick start

```sh
dsh plugin --profile <profile> add dsh-policy-ledger
dsh --profile <profile> --dump-config | grep dsh-policy-ledger
```

## Limits

- Public/synthetic only; no customer data or customer evidence.
- Alpha/partial, not counted, no GA or production-readiness claim.
- No model or network call unless a tool explicitly says so.
- The exact per-tool boundaries are in the table and `ACCEPTANCE.csv`.

## Public sample

Public/synthetic fixtures live in `test/fixtures/`; `ACCEPTANCE.csv` records the public checks with `counted=false`.

## Development

```sh
pnpm install --frozen-lockfile
pnpm build && pnpm lint && pnpm typecheck && pnpm test
```

## Family

<details>
<summary>DSH domain plugin family (15 packages + 2 suites)</summary>

| Package | npm |
|---|---|
| **[dsh-einvoice](https://github.com/PerryLink/dsh-einvoice)** | [npm](https://www.npmjs.com/package/dsh-einvoice) |
| **[dsh-docx-redline](https://github.com/PerryLink/dsh-docx-redline)** | [npm](https://www.npmjs.com/package/dsh-docx-redline) |
| **[dsh-policy-ledger](https://github.com/PerryLink/dsh-policy-ledger)** | [npm](https://www.npmjs.com/package/dsh-policy-ledger) |
| **[dsh-ghg](https://github.com/PerryLink/dsh-ghg)** | [npm](https://www.npmjs.com/package/dsh-ghg) |
| **[dsh-bankrec](https://github.com/PerryLink/dsh-bankrec)** | [npm](https://www.npmjs.com/package/dsh-bankrec) |
| **[dsh-ap-three-way](https://github.com/PerryLink/dsh-ap-three-way)** | [npm](https://www.npmjs.com/package/dsh-ap-three-way) |
| **[dsh-ifc-qto](https://github.com/PerryLink/dsh-ifc-qto)** | [npm](https://www.npmjs.com/package/dsh-ifc-qto) |
| **[dsh-qms-capa](https://github.com/PerryLink/dsh-qms-capa)** | [npm](https://www.npmjs.com/package/dsh-qms-capa) |
| **[dsh-legal-intake](https://github.com/PerryLink/dsh-legal-intake)** | [npm](https://www.npmjs.com/package/dsh-legal-intake) |
| **[dsh-legal-clause](https://github.com/PerryLink/dsh-legal-clause)** | [npm](https://www.npmjs.com/package/dsh-legal-clause) |
| **[dsh-freight-audit](https://github.com/PerryLink/dsh-freight-audit)** | [npm](https://www.npmjs.com/package/dsh-freight-audit) |
| **[dsh-hs-candidate](https://github.com/PerryLink/dsh-hs-candidate)** | [npm](https://www.npmjs.com/package/dsh-hs-candidate) |
| **[dsh-travel-recon](https://github.com/PerryLink/dsh-travel-recon)** | [npm](https://www.npmjs.com/package/dsh-travel-recon) |
| **[dsh-pim-lint](https://github.com/PerryLink/dsh-pim-lint)** | [npm](https://www.npmjs.com/package/dsh-pim-lint) |
| **[dsh-eval-pack](https://github.com/PerryLink/dsh-eval-pack)** | [npm](https://www.npmjs.com/package/dsh-eval-pack) |
| **[dsh-finops-suite](https://github.com/PerryLink/dsh-finops-suite)** | [npm](https://www.npmjs.com/package/dsh-finops-suite) |
| **[dsh-contract-suite](https://github.com/PerryLink/dsh-contract-suite)** | [npm](https://www.npmjs.com/package/dsh-contract-suite) |

</details>

## License

Apache-2.0. See `LICENSE`, `NOTICE`, `THIRD-PARTY-NOTICES`.
