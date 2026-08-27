# X-03 authorization negative matrix — internal evidence boundary

X-03 remains **PENDING_INTERNAL**. The backend source of truth is
`dwp-backend/contracts/product-authorization/authorization-negative-matrix.v1.json`, enforced by
`dwp-backend/scripts/check-authorization-negative-matrix.py` and the backend root `check` task.

The reusable Gateway PEP matrix fixes five attack vectors: cross-tenant identity assertion,
scope escape, stale authority revision, NORMAL/SUPPORT confused deputy, and internal-header spoof.
Every referenced test must resolve to an existing Java test method. The matrix binds the signed
46-case canonical negative fixture catalog to a Gateway adapter catalog-integrity test. That test
checks projection, checksum, record identity and non-empty signed expectations; it does not execute
the fixtures through a Gateway or owner-service PEP. The matrix separately derives product contract
status from the checksummed v3 route kinds and classifies every product/vector cell exactly once
across the 12-product rollout inventory.

Current pilot evidence is deliberately partial:

- Approvals and HCM are `EXACT` because each has `PAGE`, `DATA` and `ACTION` routes.
- Communications and Services are `INCOMPLETE_KINDS`: both lack a `DATA` route and remain capped at
  rollout state `100`.
- Approvals lacks explicit cross-tenant and SUPPORT-mode owner-service matrix coverage.
- Communications and Services lack explicit cross-tenant and canonical opaque-scope-escape
  owner-service matrix coverage. HCM also lacks that canonical scope-escape coverage. The former
  references exercised cross-surface route-key or non-allowlisted-query rejection, which are useful
  controls but do not prove the `SCOPE_ESCAPE` cell.
- Calendar, DWAI·ON, Mail, Meetings, Messaging, Notifications, Spaces and Workplace are explicitly
  `MISSING`. They may not exceed rollout state `100`, cannot claim owner-service PEP evidence, and
  raw `110` remains fail-closed in the Gateway contract-eligibility test.

Owner-service identity follows the real Gateway route and the independently deployed service PEP.
Notifications is owned by `dwp-notification-server` (`SERVICE_NOTIFICATION_URL` and
`NotificationSecurityFilter`), while Spaces is owned by `dwp-space-server` (`SERVICE_SPACE_URL` and
`SpaceSecurityFilter`). A `dwp-platform-server/src/test` reference cannot satisfy either product's
owner-service cell. This routing correction changes ten cell owners, not their evidence state: all
five cells for each product remain missing.

The validator reports 47 of 60 missing product/vector cells. The earlier structural count of 44
treated three semantically mismatched `SCOPE_ESCAPE` references as proof; those cells are now
fail-closed as missing. Gateway coverage and a product's
owner-service coverage are recorded separately; a common Gateway denial never fills a missing
owner-service cell. Matrix `completionState` is calculation-derived: it is `COMPLETE` only when all
12 products have all required `PAGE`, `DATA` and `ACTION` kinds, all 60 owner-service vector cells
have qualifying references, and no product blocker remains; otherwise it is `PARTIAL`. X-03 may move
out of `PENDING_INTERNAL` only after the local matrix is complete, the security owner approves the
result, and a separately recorded automated PEP test run is attached. Catalog checksum and Java
method-existence validation are fail-closed development evidence, not PEP execution or production
approval.
