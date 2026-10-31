# @perrylink/dsh-policy-ledger

Read-only capability snapshot, tarball assert and install diagnosis for DeepSeek Harness.

> **Status: alpha / public-synthetic / partial / not counted / not GA.** No customer evidence, customer data, or production-readiness claim. All acceptance rows are `counted=false`.

## Install

```sh
dsh plugin --profile <profile> add @perrylink/dsh-policy-ledger
dsh --profile <profile> --dump-config | grep dsh-policy-ledger
```

CLI:

```sh
dsh-policy-ledger doctor ./some-package.tgz --json
```

Requires DSH `>=0.2.1-rc.3 <0.3.0` and Node `>=24.9 <25`.

<details>
<summary>中文摘要</summary>

只读安装诊断：能力快照、tarball 断言与安装日志分类。 安装：`dsh plugin --profile <profile> add @perrylink/dsh-policy-ledger`。公开/合成、alpha、非 GA。

</details>

## Tools

| Tool | What it does | Risk |
|---|---|---|
| `trust.capability_snapshot` | Extract declared capabilities and R0–R3 risk from a local npm `.tgz`: tools, bundle/client/bin/skill, build scripts, outbound hosts, credential references | R0 local read |
| `trust.diff` | Compare two stored snapshots: added/removed capabilities, risk escalation, blockers | R0 |
| `trust.assert_tarball` | Re-read a tarball and compare it with a stored snapshot: pass/missing/extra/changed/unknown | R0 |
| `install.diagnose` | Classify an install log into stage, root cause and three actions; return unknown rather than guess | R0 |
| `install.probe` | Check disk free, write permission, proxy, optional registry RTT, node/pnpm | R0 |
| `install.bundle` | Write a redacted incident ZIP (diagnosis + evidence lines) | R1 local write |

## Input / output

**Input:** a local npm `.tgz`, a stored snapshot, an install log, or the local environment. **Output:** a capability snapshot, snapshot diff, tarball assert result, install diagnosis, environment probe, or redacted incident ZIP. The CLI exposes `dsh-policy-ledger doctor <tgz> --json`.

## Configuration

| Env | Default | Meaning |
|---|---|---|
| `DSH_TRUST_HOME` | `$DSH_HOME/storages/dsh-policy-ledger` | bundles and local storage |
| `DSH_TRUST_INPUT_ROOTS` | `current working directory` | tarball allowlist |

## Limits / non-claims

- This is **not** a policy ledger, Gate, ledger, rollback, retry, or profile five-state product; the package name is retained for npm continuity.
- No signing root, no policy evaluation/apply/rollback/receipt, no Client, Skill, or Bundle surface.
- No customer profile, registry token, or private package is included.
- `install.bundle` writes a local redacted ZIP; it does not upload anything.
- No customer evidence, customer data, or production-readiness claim; all fixtures are public/synthetic.

## Public sample

Public/synthetic tarballs and install-log fixtures; `ACCEPTANCE.csv` lists 4 public checks. No customer profile is included.

## Development

```sh
pnpm install --frozen-lockfile
pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm gate:sku03
```

## License

Apache-2.0. See `LICENSE`, `NOTICE`, `THIRD-PARTY-NOTICES`.
