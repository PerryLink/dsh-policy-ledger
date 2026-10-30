# Fixtures — SKU-03 S1

- Synthetic npm tarballs: safe (bundle), medium (bundle+bin), risky (bundle+client+postinstall+outbound URL+tool). Generated with `tar` in temp dirs.
- Install logs: 404, EACCES, ETIMEDOUT, ENOSPC, postinstall.
- No real profile, no private package, no token, no customer log.
- Tarballs are generated per acceptance run and deleted; no raw fixture is committed.
