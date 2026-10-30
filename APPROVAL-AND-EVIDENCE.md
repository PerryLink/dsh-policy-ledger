# SKU-03 approval and evidence — 2026-10-31

**User approval**: 2026-10-31 "现在和未来都批准" — public/synthetic demo path approved for subsequent SKUs.

## Gate status

- Required: 20 real agent profiles + 2 IT interviews.
- Current authorized real evidence: **0 profiles / 0 interviews**.
- Public/synthetic demo approved; all acceptance rows `not counted`, `STATUS: partial`.
- Do not read the user's real `~/.dsh` profiles; use temp/synthetic tarballs only.

## Narrow S1 (public demo)

- `trust.capability_snapshot`: local tarball → declared capabilities, risk, hosts, script/credential flags.
- `trust.diff`: two stored snapshots → added/removed capabilities, risk escalation.
- `trust.assert`: stored snapshot vs a re-read tarball → five-state rows.
- `install.diagnose`: log text → stage/root cause/3 actions/confidence, never guesses unknown.
- `install.probe`: local env + optional registry RTT.
- `install.bundle`: redacted incident ZIP with hashes.
- `install.retry` (delegated `dsh plugin add`) is deferred because it is an R2 external write and needs a confirmation/approval contract; no shell execution in S1.
- No Client, no Gate tools, no signing root, no ledger/rollback in S1.
