# Messenger Home And Inbox Refinement

Review date: 2026-09-04. This note supersedes the layout, dependency and verification
details in `09-workspace-redesign-2026-09-04.md`; the receipt privacy contract in note 10
remains authoritative.

## Purpose And Reference

The primary user is a tenant member. Home answers "Which conversation needs my attention,
and where can I resume work?" Inbox answers "How can I reply without losing the discussion
and its context?" The primary actions are opening a priority conversation and sending a reply.
The page archetypes are an actionable overview and a list-detail workspace.

The supplied Home and Inbox images and the authenticated
[Stitch project](https://stitch.withgoogle.com/projects/13391261371843159731) were inspected.
The project exposes the Next-Gen Enterprise Messenger Home and Advanced Enterprise Messenger
Inbox designs. This was a rendered-design review, not access to proprietary application source.
Independent implementation agents covered Home, backend visibility/security, and rich composition.
The parent task integrated their contracts and verified the rendered journeys.

The adopted design characteristics are compact navigation, clear blue selection, restrained
identity colors, an action-focused center, a separate contextual rail, and an integrated composer.
The existing DWP shell, design tokens, Lucide controls, tenant authority and personal preferences
remain in place. Decorative AI output, invented online status and encryption claims were not copied.

## Implemented Journeys

| Area               | Behavior                                                                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home focus         | Mentions, unread conversations and saved work lead to their actual destination. Completion and partial-error states remain distinct.                                      |
| Priority list      | All, Mentions, Space and DM tabs retain `focus` in the URL. Mentions use the server MENTIONS query; filtering precedes the six-row preview limit.                         |
| Shared assets      | Recent eligible files and HTTP(S) links come from the new owner-service endpoint, with a source-conversation action and loading/error/empty states.                       |
| Huddle             | Select an active conversation and enter the existing capability-checked meeting lobby. Media/provider readiness is not inferred from a decorative banner.                 |
| People             | A person action creates or resolves the real direct conversation and navigates to it. Presence is identified as a directory snapshot.                                     |
| Continuation rail  | Space/DM switching and saved-message continuation preserve real conversation destinations.                                                                                |
| Inbox navigator    | Favorites, channels and DMs are grouped; All/Favorites/Unread filters apply to loaded conversations. When more pages exist, this limitation and Load more remain visible. |
| Conversation brief | The latest three loaded, undeleted root messages are shown verbatim as previews. Clicking one focuses and scrolls the actual timeline row. This is not AI summarization.  |
| Context rail       | Active threads open the reply panel; members open the existing member workflow. Below 1280px the context toggle opens a dialog instead of squeezing the stream.           |
| Rich composition   | Bold, italic, inline/fenced code and numbered/bulleted lists preserve selection, keyboard navigation, IME handling and the existing TEXT send contract.                   |
| Read receipts      | Read, unconfirmed and private recipients remain distinct. Personal company-wide sharing controls and server-side redaction are retained.                                  |

The compact navigator was corrected after browser verification: a linked-Space badge could
consume the entire conversation-name width. Compact entries now prioritize the name; the
Space relationship remains available in the detailed context.

## Architecture And Data

React, Vite, React Router, MUI, TanStack Query and the existing REST/SSE transport are retained.
No Next.js migration, fake WebSocket, duplicate chat store or second route hierarchy was added.
Canonical `/messages/home`, `/messages/inbox`, `/messages/direct`, `/messages/spaces`,
`/messages/people` and `/messages/later` routes remain compatible.

```text
features/messaging/
  messaging-home.tsx
  messaging-home-sections.tsx
  messaging-home-continuation-sections.tsx
  messaging-home-huddle.tsx
  messaging-home-shared-assets.tsx
  messaging-home-model.ts
  messaging-conversation-workspace.tsx
  messaging-conversation-list-pane.tsx
  messaging-navigator-model.ts
  messaging-conversation-context.tsx
  messaging-context-model.ts
  messaging-composer.tsx
  messaging-formatting-toolbar.tsx
  messaging-formatting-model.ts
  messaging-formatting-parser.ts
  messaging-message-body.tsx
shared-utils/src/api/
  messaging-home-api.ts
  messaging-privacy-api.ts
```

`marked@18.0.11` is pinned in Yarn as the sole new parser dependency. Its lexer feeds an
allowlisted React renderer: raw HTML is never injected, image tokens stay literal, unsafe
schemes and credential-bearing links are rejected, and code does not generate mentions.
The previous ad hoc code-fence parser was replaced rather than retained beside the new parser.

The new `GET /api/messaging/v1/home/shared-assets?limit=6` endpoint is scoped by the trusted
identity and `APP.MESSAGING:VIEW`. The frontend cache key includes tenant and user. The limit
is 1..20 and the link preview examines at most 100 recent visible link-bearing messages,
20 links per message and 2048 characters per link. No external URL scraping is performed.

Visibility requires active conversation, membership and viewer, eligible history sequence,
undeleted USER messages, and CLEAN attached files. Responses contain no storage keys or
download grants. Existing attachment grant creation and consumption both revalidate current
membership, history visibility, message deletion and conversation/person lifecycle. Home
unread counts ignore deleted messages; archived conversations do not inflate mentions or saves.

The backend is separated into Home DTO/controller/service/repository/link-extractor classes.
No new table or migration was necessary. Applied Messaging V16 remains immutable. Existing
message, membership, receipt, attachment and preference tables are used; none was proven unused,
so no customer data or table was deleted merely for a visual redesign.

## Verification

- Backend: 193 tests passed with no skips, failures or errors, including fresh PostgreSQL 18.4.
  The new shared-asset and Home-metric PostgreSQL suites cover 10 cases in addition to existing
  receipt, migration, security and attachment tests.
- Frontend: Messenger unit tests cover navigator/focus ordering, context roots and threads,
  safe formatting, selection/IME behavior, visual tokens and receipt observation/privacy.
- E2E: `messaging-home.spec.ts`, `messaging-context-workspace.spec.ts`,
  `messaging-read-receipts.spec.ts` and `messaging.spec.ts` exercise the real UI with deterministic
  API fixtures. Desktop/mobile, 1440/1280/390/320 widths, 720x450 effective zoom layout, Korean
  long content, dark mode, forced colors, reduced motion, focus and Axe are included.
- Live Gateway: shared-assets GET returned 200; invalid limit 21 returned 400; Home returned 200.
  The authenticated verification account had zero eligible assets. This empty response was not
  replaced with mock entries. Populated and revoked-access cases were verified in PostgreSQL/E2E.
- The Messaging service was restarted and reached readiness on port 8007. Other services were
  not restarted by this task.

### Final Results

| Gate                                               | Result                                                                  |
| -------------------------------------------------- | ----------------------------------------------------------------------- |
| `yarn vitest run apps/dwp/src/features/messaging`  | 16 files, 84/84 passed                                                  |
| Four Messenger Playwright specs, Chromium + mobile | 51 passed, 1 intentional desktop skip for the mobile-only geometry case |
| `yarn typecheck`                                   | Passed                                                                  |
| Messenger ESLint / Prettier / i18n                 | Passed                                                                  |
| Production and maintenance source-size             | Passed; no allowance increased                                          |
| Vite production compilation                        | Passed; Messenger async chunk 177.57 kB / 47.50 kB gzip                 |
| Owner-service tests, including fresh PostgreSQL    | 193 passed; no skipped/failing/error tests                              |
| Live Gateway Home/shared-assets                    | 200 / 200; invalid limit 400                                            |
| Full root `yarn build`                             | Blocked at global allowance ratchet: 199 removed grandfathered JSX uses |
| Root initial bundle budget                         | 1172.7/1074.2 KiB raw, 333.4/317.4 KiB gzip; over budget                |

The final browser run used a copied production build at
`../.codex-artifacts/messaging-production-snapshot-20260904-1206`, served only for verification
on port 4218. This avoids unrelated shared-tree hot reloads resetting an open thread mid-test.
The earlier development-server run was 50 passed, 1 skipped and 1 interrupted receipt case;
the same receipt test passed against the fixed production artifact without relaxing its visibility
or focus assertions. The production test server was stopped after verification.

```sh
E2E_REUSE_EXISTING_SERVER=true E2E_BASE_URL=http://127.0.0.1:4218 \
  corepack yarn playwright test e2e/messaging-home.spec.ts \
  e2e/messaging-context-workspace.spec.ts e2e/messaging-read-receipts.spec.ts \
  e2e/messaging.spec.ts --project=chromium --project=mobile --workers=1 \
  --output=../.codex-artifacts/messaging-production-acceptance
```

The screenshot evidence under that output directory includes Korean Home at 1440/320,
Home dark/forced-colors, Inbox at 1440/1280/390/320 and effective 200% zoom, long Korean
messages, and the full workspace dark/forced-colors variants. These captures use test data;
the production application still uses real APIs.

## Explicit Boundaries

The recent-message brief is not an AI TL;DR and does not summarize unrequested history.
AI-generated reply drafts, cross-app action execution, and live meeting transcription need
their own consent, authorization, provider and audit contracts. No inert AI button suggests
they have shipped. Presence is not proof of an active socket. This change does not certify
production media infrastructure, end-to-end encryption, compliance retention or load capacity.

E2E fixtures are test-only; production Home reads real authorized APIs. Shared Gateway/OpenAPI,
menu, global design-system allowance and unrelated Home/Calendar/Mail/Notification files were
not edited to force a green integration gate. No partial commit was created.
