# Changelog

## [0.3.0] — 2026-11-13

### Breaking

- **Tool names now use underscores instead of dots.** The provider validates
  every `tools[].name` against `^[a-zA-Z0-9_-]+$`; a dotted name makes it
  reject the whole `tools` array (`Invalid 'tools[N].name'`), so the plugin
  registered but no request carrying the tools could succeed. Every tool was
  renamed by writing the namespace separator as `_` instead of `.`:

  - `trust` + `.` + `capability_snapshot` → `trust_capability_snapshot`
  - `trust` + `.` + `diff` → `trust_diff`
  - `trust` + `.` + `assert_tarball` → `trust_assert_tarball`
  - `trust` + `.` + `assert` (deprecated alias) → `trust_assert` (still deprecated)
  - `install` + `.` + `diagnose` → `install_diagnose`
  - `install` + `.` + `probe` → `install_probe`
  - `install` + `.` + `bundle` → `install_bundle`
  - `trust` + `.` + `risk_report` → `trust_risk_report`
  - `trust` + `.` + `risk_matrix` → `trust_risk_matrix`

  Dotted aliases cannot be put on the wire, so no compatibility alias is kept:
  callers must migrate prompts, saved calls and permission rules to the
  underscore names. Tool names are covered by the 0.2.0 compatibility promise,
  so this breaking change is the 0.3.0 minor bump.
- Added `test/tool-name-wire.test.mjs`: every registered tool name must match
  `^[a-zA-Z0-9_-]+$`, contain no dot, stay in the `trust_` / `install_`
  namespace and be unique across the nine registered tools.
- README (five languages), `TROUBLESHOOTING.md`, `APPROVAL-AND-EVIDENCE.md`,
  `PUBLISH-STATUS.md`, `BUILD-LOG.md`, `BUILD-PLAN-03.md`, the generated hero
  and flow artwork, the quickstart runner, the acceptance script and the
  source/tests were updated with the rename.

## [0.2.0] — 2026-11-03

### Stable

- First non-alpha release: tool names and the CLI surface are covered by a
  compatibility promise (breaking changes require a minor bump).
- Ships a quickstart sample, a one-line prompt, a permission block and real captures.

## [0.2.0-alpha.14] — 2026-11-01

### Security / Fixes

- Release configuration hardening: wider host peer range and a build step before publish.


### Added

- `trust_risk_matrix`: fleet-level risk view over named snapshots — counts per R0-R3, the highest level and the R2/R3 names to review. Read-only. Verified by `node --test test/*.test.mjs` (10/10).

## [0.2.0] — 2026-11-01

### Added

- `trust_risk_report`: per-factor risk explanation (bundle/client/binary +1, build script/outbound host/credential reference +2) with the R0-R3 verdict; `riskFromCaps` now delegates to the same breakdown. Read-only. Verified by `node --test test/*.test.mjs` (7/7).

## [0.2.0-alpha.9] — 2026-11-01

### Changed

- Documentation: five-language fixture/acceptance links now resolve on npm; added specific related-checker/tool links.
- Marketplace metadata: taxonomy category, archetype, domains and status; docs page now shows the same.
- Added a real terminal hero (and GIF for the active docs set) plus `TROUBLESHOOTING.md`.

All notable changes to `dsh-policy-ledger` are documented here. The format follows Keep a Changelog; this project uses alpha versions.

## [0.2.0-alpha.8] — 2026-11-01

### Added

- Five-language READMEs: English, 简体中文, Español, Português, हिन्दी.
- Local workflow SVG at `docs/assets/dsh-policy-ledger-flow.svg`.
- Family cross-links (domain index, checker family, `dsh-kit`), compatibility, permissions, and related-work sections.
- Standard repository files: `SECURITY.md`, `PRIVACY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, and `icon.svg`.

### Changed

- README aligned with the PerryLink DSH checker/plugin family style; package remains public/synthetic, alpha, not GA.

## [Earlier]

Earlier alpha builds are available from npm and GitHub Releases; this file starts at the family-standard documentation wave.
