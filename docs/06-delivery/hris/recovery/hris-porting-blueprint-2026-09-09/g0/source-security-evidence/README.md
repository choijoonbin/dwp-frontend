# SKKF source security evidence

Status: **REFERENCE ONLY — NOT APPROVED FOR CODE OR DEPENDENCY IMPORT**  
Captured at: `2026-09-09T09:06:00Z`  
Scanner: `scan_source_security.py` `1.0.0`

This package records six immutable detached snapshots, current-tree credential
pattern locations, full-reachable-history pattern-count transitions, build and
dependency manifests, license/notice hashes, and every tracked binary/archive
identified by extension, magic, or NUL-byte inspection. No matched value, source
line, diff, commit message, author identity, environment value, or credential
hash is written to these reports.

The CycloneDX document is a static reference inventory only. It does not assert
license compatibility, vulnerability status, provenance, transitive completeness
for Gradle, or approval to import anything into DWP.

## Counts

- Current tracked files: `11512`
- Current credential-like location/rule findings: `1149`
- Full-history pattern-count transitions: `7911`
- Manifest files: `30`
- Dependency records: `3134`
- License/notice candidates: `14`
- Tracked binary/archive records: `732`
- Master coverage rows mapped: `2269`
- G1 sanitized-view-accessible coverage rows: `2258`
- Explicitly blocked or retired coverage rows: `11`

## Fail-closed limits

- Pattern matching is deterministic, not proof that a credential is live or that
  no unrecognized secret exists. Every finding remains quarantined until a human
  Security disposition; live credentials require revoke/rotate evidence.
- Archive members and compressed payloads are not unpacked or executed. Their
  containers are hashed and prohibited from import.
- Gradle inventory contains literal static declarations only; no Gradle task or
  dependency resolution was executed. Yarn lock resolutions are parsed statically.
- History scope is every commit reachable from `--all` refs at the recorded Git
  object database state. Reflog-only, unreachable, pruned, or external history is
  outside evidence scope.
- Sanitized views exclude whole files on any deny rule or credential finding.
  Included text remains proprietary reference material and cannot be copied into
  DWP. Renaming to `.analysis.txt` plus read-only permissions prevents the views
  from being normal build inputs; OS-level isolation is still not a legal strict
  clean room.
