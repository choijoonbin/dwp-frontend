# Widget Binding Catalog Release

- Owner: Platform Release owner
- Scope: migration-owned Product/App, Renderer, Data, Action, and Definition Binding heads

## Preconditions

- Schema, Golden, DB rows, catalog root, component revisions, and Manifest seeds pass independent verification.
- All changed App resources, authorities, renderer keys, capabilities, and owner products exist in the same release.
- Any shrink has a prior impact report and affected Published Versions are quarantined, revoked, or replaced first.

## Execute

1. Reserve a fresh migration number after checking tracked and workspace heads and obtaining a single owner.
2. Apply forward-only rows and atomically move the Binding head after all component hashes match.
3. Keep Application roles read-only; no online mutation route or runtime fallback is permitted.
4. Run full Published Manifest revalidation before readiness succeeds or Registry mutation opens.

## Abort and recover

- On fixture/DB/hash mismatch, fail readiness and all mutation; keep the previous Head authoritative.
- Roll forward with a correcting migration. Never delete or rewrite an accepted Binding revision.
- Attach DB snapshot, fixture digest, validation output, and affected Version decision to release evidence.
