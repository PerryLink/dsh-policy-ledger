# Changelog

## [0.2.0] — 2026-11-03

### Stable

- First non-alpha release: tool names and the CLI surface are covered by a
  compatibility promise (breaking changes require a minor bump).
- Ships a quickstart sample, a one-line prompt, a permission block and real captures.

## [0.2.0-alpha.14] — 2026-11-01

### Security / Fixes

- Release configuration hardening: wider host peer range and a build step before publish.


### Added

- `trust.risk_matrix`: fleet-level risk view over named snapshots — counts per R0-R3, the highest level and the R2/R3 names to review. Read-only. Verified by `node --test test/*.test.mjs` (10/10).

## [0.2.0] — 2026-11-01

### Added

- `trust.risk_report`: per-factor risk explanation (bundle/client/binary +1, build script/outbound host/credential reference +2) with the R0-R3 verdict; `riskFromCaps` now delegates to the same breakdown. Read-only. Verified by `node --test test/*.test.mjs` (7/7).

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
