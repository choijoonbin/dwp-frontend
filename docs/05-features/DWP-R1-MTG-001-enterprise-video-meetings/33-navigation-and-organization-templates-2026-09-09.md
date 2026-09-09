# Navigation and organization template completion — 2026-09-09

## Scope and user journeys

This increment covers member navigation, U02 return context, U10 template actions, U07 readability, and the U14 organization-template management gap. It preserves the shared DWP shell and the existing `/meetings/admin/policies` route. Booking, preparation content, recap/follow-up commands and media infrastructure belong to the parallel owners.

The organization-template user is an authorized Meetings administrator. Their operational question is which shared agenda structure members can reuse. Their primary action is creating or updating that structure. The page uses a list-detail workspace and the existing DWP template form, with a separate policy/template tab inside U14.

## Implemented behavior

- **U02:** `q` and zero-based `page` are URL state. Preparation, new scheduling and personal-room routes preserve search, date, time scope, role, series and selected meeting. Returning removes workflow-only `view`, `meetingId`, `templateId` and `templateVersion` parameters. A reload restores the same list context.
- **U10:** Import is reachable at 320/390px as a labelled 44px icon button. Category/favorite filters reset pagination and expose `aria-pressed`. Import still reviews editable structure before an explicit personal-template command; sharing carries only a same-origin selection URL.
- **Navigation:** The seven member destinations and three administration destinations support keyboard activation, current-selection indication and mobile drawer operation. Member navigation does not expose administration. Navigation does not acquire media.
- **U07:** Publication-stage captions inherit the verified stage foreground, fixing dark captions on a filled publication background. Quality captions select the lighter success token in the dark theme. Light/dark desktop and mobile recap/library journeys are covered by axe checks.
- **U14:** The new Organization templates tab uses `/v1/admin/templates` list/detail/create/update/delete. Create permissions use the existing `ADMIN.MEETINGS / MANAGE` check; edit/delete also require the authoritative record's `canEdit`. All writes are enforced by the server.
- **U14 state flow:** Loading, filtered/empty list, collection error, detail error, permission loss, retry, create, edit, delete confirmation, delete error and version conflict are visible. Search, page, selection and current section live in the URL. Policy changes require explicit discard before switching sections.
- **U14 concurrency:** Update/delete submit the captured `expectedVersion`. Unchanged failed commands retain their idempotency key. A conflict keeps form input visible, disables stale resubmission, refreshes the record and requires closing/reopening the latest revision. Responses cannot commit after unmount or identity/authority replacement. An admin change invalidates member template catalogs.

## Verification

Evidence directory: `/Users/a10697/Work/DWP/output/meeting-navigation-completion-2026-09-09/`.

- App unit tests: **57 passed**, covering admin mounted policy behavior, context routing and template validation.
- Shared admin-template API tests: **12 passed**, covering scoped routes, command body, expected version, stable key, receipt binding, invalid references and propagated 401/403/409/503 errors.
- Scoped ESLint: **passed**, with output in `lint.log`.
- Final E2E: **23 passed / 1 intentional project skip** in `frozen-regressions.log`, plus **6 passed** for U10 in `template-frozen.log`. After visual cleanup of the refresh label and destructive-action hierarchy, the affected CRUD and English dark/forced-colors 200% cases passed **4/4** again in `admin-layout-final.log`.
- Full workspace TypeScript check: **passed**, with output in `types-final.log`.
- The broader U07/U10/U11/U12/U13/U14/U15 runtime/design audit produced **36 passed / 15 intentional project skips** and one initial U14 1440px render-wait failure. The exact U14 case is included in the final regression run.
- Screenshots include U02 restored context; U10 mobile import affordance; U14 filled and empty organization catalogs; English dark/high-contrast 200% text; U07 published pipeline in both themes; and member/admin navigation.
- Existing golden snapshots were **not updated** in this increment. New screenshots are evidence, not a replacement for approved source comparison.

The stored Stitch source gallery, design contract, frame register, correction notes and handoff 28/31/32 were used for the audit. Existing U10/U11/U12 and administrator runtime screenshots were inspected for hierarchy, clipped work, shell alignment and mobile controls. The added organization-template area is a DWP-native functional extension, not a claim that an unprovided Stitch frame was approved.

## Remaining service boundaries

U13 failover and audit-ticket actions, and U15 evidence export, legal-hold synchronization, forced crypto-shred and emergency stop remain visibly unavailable because corresponding executable contracts are not connected. The operations report export does have a separate implemented API path. Organizational exceptions, provider measurements and audit/history collections continue to show their actual unavailable state when their owner contract has no data.

No provider/recording/transcription/AI pipeline GO status is inferred from these UI tests. Product media operational NO_GO remains governed by its own evidence and release gate.
