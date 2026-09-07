# Mail Home and Governed Actions

## Product Decision

- Primary user: a member processing personal and authorized shared mail.
- Operational question: which message needs attention now, and what can I safely do next?
- Primary action: open the relevant thread, or review a contextual action proposal.
- Archetype: command center linked to the existing list-detail workspace.
- Keep the repository's React Router, MUI and DWP design system. The supplied Next.js prompt is a reference, not a requirement to replace the application framework.

## Reference and Adoption

The supplied [Stitch Mail project](https://stitch.withgoogle.com/projects/13391261371843159731) was inspected in its authenticated desktop preview. Adopted aspects are the compact briefing, five actionable signals, focused message queue, and a distinct contextual action rail. DWP retains its product shell, real API state, authorization boundaries and responsive navigation.

| Reference pattern          | DWP implementation                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Compact signal tiles       | Unread, urgent, reply needed, later and proposal counts with actual destinations                                                |
| Focus queue                | Sender, unread/urgent state, subject, snippet, attachment and timestamp linked to the thread                                    |
| Three contextual proposals | First three proposals, explicit expansion, type-specific icons and semantic colors                                              |
| Action details             | Source evidence plus available schedule, attendees, location, project, assignee or draft attributes                             |
| Review before execution    | Review dialog, versioned decision API, then destination app; no claim of completed external execution                           |
| Lower work area            | Shared mailbox, contacts/groups and organization tools; placed below the focus queue on desktop to avoid rail-driven whitespace |

Mobile reading order remains focus queue, proposals, then work tools. Tokens govern typography and radii; dark mode uses readable foregrounds; reduced motion removes hover displacement. Dialogs, fields, progress, errors and icon actions use DWP components.

The existing home API returns at most four recent proposals independently of the overall pending count. Home labels that bounded preview explicitly when the total is larger; expanding the cards does not claim to load the entire pending catalog.

## Address Book and Group Mail

`/mail/contacts` contains personal contacts, personal groups and company-directory lookup. Home and the Mail sidebar expose the same route. The directory lookup observes People visibility; saving a copied contact does not imply a continuously synchronized directory record.

- Contacts support create, edit, favorite and archive.
- Groups support create, edit, archive and versioned member replacement.
- Group sending displays every recipient name/address and requires explicit recipient review.
- One send attempt freezes the group version, recipient view, message and idempotency key. An uncertain response is retried with the same request, including after closing and reopening the same dialog within this mounted workspace.
- A version conflict refreshes the latest recipients without changing that idempotency key, requires a fresh review, and preserves the original request for result verification. The UI never interprets HTTP 409 as proof that the original message was not queued.
- Server receipts serialize replay. An immutable recipient snapshot and transactional delivery outbox preserve the accepted recipients during delivery retries.
- State is tenant/user scoped; composite constraints and PostgreSQL tests cover cross-tenant relationships and version changes.
- Actual external delivery still depends on a deployed provider adapter and customer consent. A queued result is not presented as provider delivery success.

Public API additions: `GET /v1/mail/address-book`; `POST /v1/mail/contacts`; `PUT/DELETE /v1/mail/contacts/{contactId}`; `POST /v1/mail/contact-groups`; `PUT/DELETE /v1/mail/contact-groups/{groupId}`; `PUT /v1/mail/contact-groups/{groupId}/members`; `POST /v1/mail/contact-groups/{groupId}/messages`. This is seven path keys and nine operations. Platform V220 stores the address-book data, command receipts and recipient snapshots. Canonical generation is coordinated by the integration owner.

## Action Extension Contract

The current catalog supports reply draft, calendar event, leave preparation, work item and notification escalation. A descriptor binds type, version, minimum risk, resource, permission, route boundary, required payload and safe display fields. Unsupported versions/types, expired proposals and policy mismatches are disabled; the backend remains authoritative.

Adding a renderer alone does not add an executable integration. Jira/Notion or another provider requires its own reviewed command adapter, installation/consent state, source ACL revalidation, request fingerprint, idempotency, audit and completion receipt. A provider name in a proposed payload is context only, not evidence of an installed connector.

Official comparisons informing the design:

- [Google Workspace add-on actions](https://developers.google.com/workspace/add-ons/concepts/actions): bind contextual controls to explicit callbacks; draft review remains a user step.
- [Atlassian Forge automation actions](https://developer.atlassian.com/platform/forge/manifest-reference/modules/automation-action/): explicit action definition, inputs, outputs and provider configuration.
- [Outlook actionable-message refresh](https://learn.microsoft.com/en-us/outlook/actionable-messages/auto-invoke): refresh actionable context rather than trusting an old card.
- [CloudEvents specification](https://github.com/cloudevents/spec): candidate interoperability format for future domain completion events, not a newly enabled transport.

## Remaining Gates

| Item                                                                     | State / owner                                                                                           |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Mail Home, contextual review and personal contacts/groups                | Implemented; target regression and visual evidence recorded during handoff                              |
| Customer OAuth, provider consent and production delivery credentials     | BLOCKED_EXTERNAL; integration/customer owner                                                            |
| Jira/Notion command execution and cross-app editable payload handoff     | Not implemented by the Mail card; requires destination/provider contract and its own execution evidence |
| Durable recovery after leaving the address book or a full browser reload | Follow-up; current same-request retention is in-memory, no PII persisted to browser storage             |
| Incoming automatic rules and irreversible deletion                       | Remain disabled until authoritative ingestion and retention/hold gates are available                    |
| Shared source-size/design baseline and generated contract integration    | Integration owner; no increased allowance or speculative generated contract edits                       |

## Verification

Mail unit tests cover navigation, keyboard behavior, snooze, autosave, API wrappers and proposal descriptors. Dedicated E2E covers group recipient review, response-loss replay, version-conflict recipient refresh, original-request verification, proposal review and destination navigation, 1440/1280/390/320 layouts, 200% reflow, dark/high-contrast and reduced motion. Mail backend tests run in an isolated build snapshot with actual PostgreSQL containers; temporary verification containers and the snapshot are removed after results are recorded.

The 2026-09-04 publication evidence is kept outside the source tree. Backend Mail validation passed 15 suites and 57 tests, including 6 address-book unit/PostgreSQL tests; no PostgreSQL test container or build snapshot remains. Frontend target validation passed 7 files and 39 unit tests, typecheck, scoped ESLint, i18n, display-dictionary, generated-contract checks and isolated Vite compilation. Mail's async chunk is 135.87 kB raw / 32.01 kB gzip. Shared initial-bundle budgets, a Notifications source-size excess, one stale Home internal-export allowance and a downward design-adoption baseline ratchet remain integration-owner items rather than Mail exceptions.

- Full Mail E2E: 41 passed, one intentional mobile skip for the desktop-owned 320px/text-zoom audit; no failures. Output: `/tmp/dwp-mail-final-clean-20260904`.
- Final bounded-preview/theme regression: six passed across Chromium and mobile. Output: `/tmp/dwp-mail-preview-final-20260904`.
- Actual authenticated browser: `http://localhost:4200/mail/home` and contacts were inspected using the local API, including a fresh reload and the corrected lower layout. Browser E2E uses controlled fixtures for deterministic failure/retry paths; PostgreSQL tests separately verify persistence and concurrency.
- Backend XML evidence: `/tmp/dwp-mail-backend-evidence-20260904`; the isolated build snapshot `/tmp/dwp-mail-addressbook-final-PPv6TK` and all its PostgreSQL test containers were removed.
- Independent read-only expert review rechecked group-level attempt retention, same-UUID version recovery, original-request replay and lower-layout changes; no reproducible P0/P1 remained in that bounded review.
- No partial commit, public contract generation, common gate allowance increase or unrelated-product edit was performed by this Mail work.
