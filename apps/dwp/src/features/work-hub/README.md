# Work Hub Boundary

Work Hub is the execution surface for the signed-in user's responsibilities across
Workspace, personal tasks, Approval, Service, and supported access-review sources.
Its canonical route is `/work/queue`. `/work`, `/work/home`, and retired Work child
routes redirect to that route while preserving supported query state. The former
standalone Work Home is no longer a product menu.

The feature owns the unified projection and the workflows that belong to Work:

- source aggregation, exact obligation identity, lifecycle and urgency, filtering,
  selection, source health, partial coverage, and permission-safe refresh;
- personal task create/edit, lifecycle commands, source-reference link/unlink, complete
  paginated timeline, version conflict recovery, and idempotent command retries;
- date-scoped Today Plan ordering, opaque persisted selections, optimistic concurrency,
  and inaccessible-reference preservation;
- Calendar focus-event creation plus Work relationship persistence, receipt recovery,
  bounded event lookup, link display, and explicit unlink;
- owner-specific source actions, Access Review and Service handoff, DWAI·ON handoff,
  and atomic batch preview with per-item receipts; and
- responsive list/detail, dialogs, keyboard focus, status announcements, and 320px/200%
  reflow behavior.

Source applications retain ownership of their records. Opening a source, adding an item
to Today Plan, creating a Calendar event, or receiving an AI response never completes
the source obligation. Approval and Service actions are exposed only when their current
owner contract and authorization allow them; otherwise Work provides a handoff.

## Runtime invariants

- Read `snapshot.sources` and `completeness` before presenting global totals. A bounded,
  forbidden, unavailable, or partially failed source is not an empty source.
- Purge retained source content after a forbidden refresh. Previous data may be retained
  only for a transport-unavailable refresh and must remain visibly stale/degraded.
- Dispatch mutations through the owner-specific action controller with the current
  version and a stable UUID for an uncertain retry. A newly confirmed intent receives a
  new UUID.
- Preserve inaccessible Today Plan selections through their opaque
  `DAY_PLAN_SELECTION` receipt. Resolve them only through the plan's current source
  mapping and never display or accept the opaque token as user input.
- Treat `REFERENCE_ONLY` as a bookmark requiring current owner verification. Workspace
  projections are not proof of Access Review authority.
- Keep a Calendar event receipt when link persistence is pending. Reopening the dialog
  must retry only the missing relationship; unlinking the relationship does not cancel
  the Calendar event.
- Clear batch selection when filters change and execute only the reviewed eligible
  snapshot. The Workspace batch command is atomic: show a confirmed receipt for each
  item only after the source confirms the whole request, and keep every item visibly
  unconfirmed when the response is unknown.

## Design evidence and release boundary

The implementation uses the 18 captured Stitch frames for layout and interaction
reference, then reconciles them with DWP tokens and real owner contracts. The design set
does not provide actual 1440px desktop frames, an actual 320px M2 frame, individual
mobile variants for 06–11, or complete dark, forced-colors, and 200% evidence. Claims in
the mockups such as live synchronization, legal effect, guaranteed audit logging, AI
success probability, or automatic form application are not product contracts.

Meeting owner-source resolution remains read-only. Meeting CREATE and REASSIGN remain
NO-GO until current authority, target eligibility, and the approved receiver/action
contract are verified. External production rollout evidence, Mail/Messaging capture
entry points, and generic direct approval or service completion are outside this
feature's completed scope.

See the
[design implementation closeout](../../../../../docs/05-features/DWP-R1-WRK-001-unified-work-execution/2026-09-04-design-implementation-closeout.md)
for the screen matrix, verification snapshot, and remaining operational gates.
