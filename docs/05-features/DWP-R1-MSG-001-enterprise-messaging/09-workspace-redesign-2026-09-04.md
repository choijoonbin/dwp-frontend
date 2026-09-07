# Messenger Workspace Redesign

Review date: 2026-09-04. This implementation note supersedes earlier UI proposals where they
describe a different framework, transport, editor, or component layout.

## User And Work

The primary user is an authenticated tenant member. The home answers "What needs my reply or
attention now?" and the conversation workspace answers "Where can I continue this conversation
without losing its context?" The archetypes are an actionable overview and a list-detail workspace.
The primary actions are opening priority conversations, replying, reacting, and continuing a thread.

## Reference Decisions

The two supplied Stitch screenshots informed the compact navigation hierarchy, three-column
conversation composition, individual identity colors, restrained surfaces, integrated composer,
and separate home context rail. Public retrieval of the private Stitch project was unavailable;
the supplied screenshots were inspected directly. This is not a claim of access to its source code.

- [Slack message display preferences](https://slack.com/help/articles/213893898-Change-how-messages-are-displayed):
  preserve personal density and avatar preferences; distinguish channel collaboration from DM bubbles.
- [Slack threads](https://slack.com/help/articles/115000769927-Use-threads-to-organize-discussions):
  keep replies in a contextual pane without discarding the main conversation.
- [Slack themes](https://slack.com/help/articles/205166337-Change-your-Slack-theme):
  appearance is personal; DWP's existing tenant restrictions remain authoritative.
- [Teams chat and channel organization](https://support.microsoft.com/en-US/teams/teams-channels/explore-the-new-chat-and-channels-experience-in-microsoft-teams):
  group pinned conversations, channels, and direct messages; make unread work easy to reach.

The reference's decorative AI summaries, hardcoded task cards, and implied live meeting state are
not copied. DWP only displays data returned through its existing authorized APIs.

## Runtime Architecture

The repository is React + Vite + React Router, not Next.js. Existing MUI, the DWP design system,
TanStack Query, and the real REST/SSE adapters remain in place. No second framework, mock socket,
duplicate chat store, or redundant route contract was introduced.

The canonical `/messages/home`, `/messages/inbox`, `/messages/spaces`, `/messages/direct`,
`/messages/people`, and `/messages/later` routes remain compatible. Conversation and thread state
stay in the existing URL/query and controller contracts. Meeting entry continues through the
existing conversation meeting integration. App/admin capabilities and membership PEP are unchanged.

```text
features/messaging/
  messaging-home.tsx
  messaging-home-sections.tsx
  messaging-home-continuation-sections.tsx
  messaging-conversation-workspace.tsx
  messaging-workspace-chrome.tsx
  messaging-conversation-list-pane.tsx
  messaging-navigator-model.ts
  messaging-conversation-header.tsx
  messaging-timeline-pane.tsx
  messaging-message-row.tsx
  messaging-message-body.tsx
  messaging-composer.tsx
  messaging-conversation-context.tsx
  messaging-thread-panel.tsx
  messaging-visual-model.ts
  use-messaging-workspace-controller.ts
```

`MessagingConversation`, `MessagingMessage`, reactions, attachments, and preferences continue to
use the shared API types. Navigator grouping is pure and tested. The visual adapter derives its
palette and radii from foundation tokens rather than creating a parallel design system.

## Shipped Behavior

- One compact workspace with a grouped navigator, conversation stream, and context/thread rail.
- Cursor-based conversation pagination; pinned/favorite items appear once, with unread-first ordering.
- Collaboration-oriented channel feed; existing personal DM/group bubble and density options remain.
- Stable identity colors, visible selection, contextual reaction/reply actions, and a complete More menu.
- Integrated composer with Enter/Shift+Enter/IME protection, mentions, expressions, attachments,
  failure recovery, and meeting entry retained.
- Fenced Markdown code display with copy action; compact previews remove code fence markers.
- Context rail shows actual recent messages and loaded active threads, not fabricated AI output.
- Home prioritizes mentions/unread/saved work and links directly to conversations, Space, and Later.
- Small screens use one pane at a time, a single-row header, compact actions, and safe-area padding.
- Motion follows theme durations and respects reduced motion. Dark surfaces and categorical initials
  are contrast-tested. Status announcements sit outside the ARIA feed.

## Cleanup And Data

The existing implementations were refactored in place. The former large heading, flat navigator,
always-visible action strip, separate composer framing, and duplicated fixture utilities were replaced.
No second legacy/new workspace toggle is left behind. No new package or dependency was installed.

This change does not require a schema migration. The message, membership, preference, attachment,
reaction, thread, and saved-item records remain in use; none was proven unused. No table or retained
customer data was deleted merely to accompany a visual redesign.

## Verification

- Independent design and architecture agents reviewed desktop/mobile screenshots and retained flows.
- Messenger unit tests: 11 files, 31 tests passed, including palette contrast and navigator ordering.
- Playwright exercises home, composer, IME, reactions, threads, saved items, edits/deletes, attachments,
  failed sends, pagination, meetings entry, personal preferences, and policy restrictions.
- Visual evidence covers 1440, 1280, 390, and 320 CSS pixels; a 720x450 viewport checks the effective
  layout of a 1440x900 display at 200% zoom. Forced colors and reduced motion are captured separately.
- Axe checks run against the actual rendered home and conversation workspace, including dark mode.
- E2E uses deterministic API fixtures. It verifies the real frontend and API contracts, not live SSE
  delivery, media transport, provider readiness, or production database behavior.

Final execution results:

| Gate                                                    | Result                                                               |
| ------------------------------------------------------- | -------------------------------------------------------------------- |
| Messenger Playwright, desktop + mobile                  | 33 passed; 1 desktop skip for the mobile-only geometry case          |
| Full TypeScript                                         | Passed                                                               |
| Messenger ESLint / Prettier / i18n                      | Passed                                                               |
| Vite production compilation                             | Passed; Messenger is an async route chunk, 150.47 kB / 39.92 kB gzip |
| Feature/API/import-cycle/reachability/export boundaries | Passed                                                               |
| Messenger design-system additions                       | No increased raw-style allowances; 6 legacy uses removed             |
| Messenger maintenance source budget                     | 1413 to 1410 lines; allowance ratcheted down                         |
| Root release build                                      | Blocked by the shared Gateway OpenAPI snapshot mismatch              |
| Root architecture completion                            | Blocked by Home 1048/1000 and Notifications 1021/1000 source lines   |
| Root initial bundle budget                              | 1164.1/1074.2 KiB raw and 330.7/317.4 KiB gzip; over budget          |
| Root design-system gate                                 | Other Home/Mail changes and their baseline ratchet remain            |

Browser evidence is under `../.codex-artifacts/messaging-redesign-complete` relative to the frontend
repository. The two shared allowance files were changed only to reduce Messenger's exact entries;
no allowance was raised. Unrelated concurrent Home/Mail/Calendar/OpenAPI changes were not reverted
or silently accepted. Backend tests were not rerun because no backend or database file changed.

## Explicit Limits

This UI delivery is not a claim of complete parity with every Slack feature. AI TL;DR, cross-app
approval/calendar action capsules, very-large-history virtualization, and independent huddle routing
need their own authorized data/action contracts and acceptance work. The current context summary is
a truthful view of the loaded message window, not an all-history aggregate. No disabled fake controls
or mock intelligence were added to suggest those capabilities are already available.
