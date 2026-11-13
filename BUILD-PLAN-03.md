# BUILD-PLAN-03 — SKU-03 policy ledger S1 (public/synthetic)

## 1. Gate and approval

- Customer gate: **20 real profiles + 2 IT interviews**; current **0/0**.
- User approved public/synthetic demo on **2026-10-31**; all rows `not counted`, `STATUS: partial`.
- No real `~/.dsh` profile is read; synthetic tarballs only.

## 2. Narrow S1

6 tools: `trust_capability_snapshot`, `trust_diff`, `trust_assert`, `install_diagnose`, `install_probe`, `install_bundle`.
`install_retry` is deferred: it delegates an external `dsh plugin add` and needs a confirmation/approval contract. Gate tools and Client are deferred.

## 3. Extractors

- npm `.tgz` → tar entries → `package.json` + `cordis.patch.yml` + JS/TS source.
- Declared capabilities: bundle/client/bin/skill/tool/build-script/network/credential.
- Risk: R0 baseline; +1 bundle/client/bin, +2 build script/network/credential; capped at R3.
- Unknowns: no executable source, bundle without patch; fail closed.

## 4. Storage

`defineDomain({name:'trust',version:1,tables:{snapshots,incidents}})`; JSON KV; no migration; bundles under `DSH_TRUST_HOME/bundles`.

## 5. Acceptance (synthetic)

| ID | Metric | Threshold |
|---|---|---|
| SKU-03-A01 | capability extraction (3 packages) | 3/3 |
| SKU-03-A02 | privilege diff escalation (1 pair) | 1/1 |
| SKU-03-A03 | install-log diagnosis (5) | 5/5 |
| SKU-03-A04 | incident bundle (1) | 1/1 |

## 6. Name audit

- `dsh-policy-ledger` 404; bare `dsh-policy-ledger` 404; bin `dsh-policy-ledger` free.
- Bare `dsh-trust` is 200 (existing package); avoid; `dsh-plugin-doctor` occupies bin `dsh-plugin-doctor`; avoid.
- Similar existing: `dsh-trust`, `dsh-plugin-doctor` — different scope/name; this package uses a unique scoped name and bin.

## 7. Publish

`0.1.0-alpha.0`, `--tag next`, public; first version may have a temporary `0.0.0-stage` placeholder.

## 8. Risks

- Static extraction cannot see dynamic `ctx.tools.register` names → `unknown`, never pass.
- No real profiles → no claim about false-positive rate on real installs.
- `install_retry` absent; no shell execution from this package.
- Registry/mirror lag after new-package publish; verify exact tarball.

## 9. Out of scope

Gate policy/approval/rollback/ledger/receipt, Client/Skill/Bundle, signature roots, sandbox detonation, real customer profiles.
