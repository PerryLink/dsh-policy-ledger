# @perrylink/dsh-policy-ledger

Read-only capability snapshot / diff / assert and install diagnosis for DeepSeek Harness — **SKU-03 S1 public/synthetic demo**.

> **Status: partial / not GA.** Customer gate is **0 real profiles / 0 IT interviews**. The user approved the public/synthetic demo path on 2026-10-31. No customer profile, registry token, or private package is included.

## Install

```sh
dsh plugin --profile <profile> add @perrylink/dsh-policy-ledger
dsh --profile <profile> --dump-config | grep dsh-policy-ledger
```

CLI:

```sh
dsh-policy-ledger doctor ./some-package.tgz --json
```

## Tools (S1)

| Tool | What it does | Risk |
|---|---|---|
| `trust.capability_snapshot` | Extract declared capabilities/R0–R3 risk from a local npm `.tgz`: tools, bundle/client/bin/skill, build scripts, outbound hosts, credential references | R0 local read |
| `trust.diff` | Compare two stored snapshots; added/removed caps, risk escalation, blockers | R0 |
| `trust.assert` | Re-read a tarball and compare with a stored snapshot; pass/missing/extra/changed/unknown | R0 |
| `install.diagnose` | Classify an install log into stage/root cause/3 actions; unknown rather than guess | R0 |
| `install.probe` | Disk free, write permission, proxy, optional registry RTT, node/pnpm | R0 |
| `install.bundle` | Redacted incident ZIP (diagnosis + evidence lines) | R1 local write |

Not in S1: `install.retry` (delegated external write), Gate tools (`trust.evaluate/apply/rollback/receipt`), Client, Skill, Bundle, signing root, ledger/rollback.

## Configuration

| Env | Default | Meaning |
|---|---|---|
| `DSH_TRUST_HOME` | `$DSH_HOME/storages/dsh-policy-ledger` | bundles and local storage |
| `DSH_TRUST_INPUT_ROOTS` | current working directory | tarball allowlist |

## Errors

`E_TRUST_FILE_UNREADABLE`, `E_TRUST_TARBALL_INVALID`, `E_TRUST_TARBALL_LIMIT`, `E_TRUST_CAP_UNKNOWN`, `E_TRUST_SNAPSHOT_NOT_FOUND`, `E_TRUST_ASSERT_FAILED`, `E_TRUST_DIAGNOSE_UNKNOWN`, `E_TRUST_BUNDLE_FAILED`, `E_TRUST_PATH_NOT_ALLOWED`.

## Development

```sh
pnpm install --frozen-lockfile
pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm gate:sku03
```

## License

Apache-2.0. See `LICENSE`, `NOTICE`, `THIRD-PARTY-NOTICES`.
