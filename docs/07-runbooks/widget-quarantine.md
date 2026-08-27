# Widget Version Quarantine

- Owners: Product Security and Provider Control
- Scope: one immutable Widget Version and every channel/policy resolving to it

## Enter when

- security, privacy, evidence-expiry, malicious behavior, or material certification failure is confirmed;
- an unsafe allow or Binding mismatch names the Version.

## Execute

1. Resolve the Version and current manifest hash without exposing tenant/user data in the incident channel.
2. Append `QUARANTINED`, Safety revision, Audit, Event, and Outbox in one transaction.
3. Verify new discovery is denied. Phase 1A records would-deny/would-stop-data only; Authoritative mode blocks actual data/action.
4. Preserve existing Home layout/config as unavailable state; do not silently delete user placement.
5. If evidence expired, preserve the exact sorted invalid-entry `causeDigest` and scheduler idempotency key.

## Clear

- Require restored current Risk/Evidence Gate and full Manifest Binding Gate.
- Require a 30-minute immutable clearance approval by an actor different from the quarantiner.
- Recheck manifest, evidence, binding/head, catalog, safety, and approval tuple under the Version lock.
- Append a new `CLEAR` revision; never rewrite the quarantine row.
