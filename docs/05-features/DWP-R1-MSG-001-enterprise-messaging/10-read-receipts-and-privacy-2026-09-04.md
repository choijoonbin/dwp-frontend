# Read Receipts and Personal Privacy

## Product Decision

Primary user: the message sender and each recipient. Operational question: has a
recipient confirmed this message on screen, and do they consent to sharing that fact?
Primary action: inspect a message's read status; independently control personal sharing.
Archetype: conversation list-detail with an on-demand status inspector and focus-form settings.

Official references reviewed on 2026-09-04:

- [Microsoft Teams read receipts](https://support.microsoft.com/en-us/teams/chat/use-read-receipts-for-messages-in-microsoft-teams): sender-visible read status, group read-by details, user privacy controls.
- [Signal read receipts](https://support.signal.org/hc/en-us/articles/360007059812-Read-Receipts): optional read-status sharing, distinct from delivery. Signal uses reciprocal opt-in; DWP deliberately uses independent personal disclosure as requested.

## Implemented

- Sent USER messages have a compact, keyboard-accessible status action. It opens a
  per-person inspector with READ, UNREAD (displayed as **Not confirmed**), and UNAVAILABLE
  (**Not shared**). A private person is never counted as unread.
- The conversation settings Privacy tab controls sharing for the current tenant/user
  across conversations. Default is enabled. Disabling hides prior observations too;
  re-enabling shares retained observations. There is no peer or administrator override.
- The user's own unread badges/cursor remain independent of sharing. Settings use
  optimistic versions; failed/stale writes do not change the displayed saved preference.
- Actual observations require a focused, visible window and a message sufficiently in
  the viewport for 650 ms. Offscreen rows, hidden panes and content behind dialogs are
  excluded. Opened thread replies are observed independently from the main conversation.
- Existing conversation cursors are not receipt evidence and are never backfilled into
  message observations. A later root message cannot establish that a reply was viewed.
- Inline queries batch the latest 50 loaded authored USER messages. Older messages can
  still be inspected on demand. Refresh is every 15 seconds while active, plus relevant
  existing realtime invalidations and an explicit refresh action in the inspector.
- No public read-activity event is emitted: the current SSE envelope identifies actors.
  The privacy change event is self-only. Query responses are no-store; stale results
  disappear on failed refresh and inactive receipt queries are not retained.
- A successful send means server acceptance, not device delivery. No invented delivery
  timestamp or per-message read timestamp is displayed. Recorded visibility is not proof
  of human comprehension or that notifications were read.

## Backend Contract

New Messaging V16 tables: `msg_user_privacy_preferences` and
`msg_message_read_observations`. Tenant/user/message keys, message/member foreign keys,
idempotent observations, and a self-only realtime audience constraint are enforced in SQL.

Routes under `/api/messaging/v1`:

| Method    | Path                                                | Contract                             |
| --------- | --------------------------------------------------- | ------------------------------------ |
| GET / PUT | `/privacy-preferences`                              | Own `{readReceiptsEnabled, version}` |
| POST      | `/conversations/{id}/read-receipts`                 | Observe 1-50 visible message IDs     |
| GET       | `/conversations/{id}/read-receipts?messageIds=...`  | Author-only batched summaries        |
| GET       | `/conversations/{id}/messages/{messageId}/receipts` | Author-only recipient detail         |

Read-only app members may change these two self-owned settings/observations without
receiving message-write permission. Every supplied message must satisfy tenant, active
membership, history and message lifecycle policy. A bad batch has no partial writes.
Later joiners and revoked/rejoined members do not enter historical audience counts.

The existing member endpoint redacts non-self private `lastReadMessageId`,
`lastReadSequence`, and `lastReadAt`. `readReceiptVisibility` makes this explicit.

## Verification

- Messaging backend: 176 tests, zero failures/skips, fresh PostgreSQL 18.4. Includes
  10 PostgreSQL receipt tests and 6 actual controller/security-filter contract tests.
- Frontend: 37 Messenger unit tests; full TypeScript and scoped ESLint pass.
- Browser: 6 new receipt/privacy journeys across desktop/mobile. Existing Messenger
  journeys: 33 pass, one intentional desktop skip of a mobile-only geometry test.
- Receipt inspector and privacy settings: keyboard labels, Axe, 320/390/1280/1440,
  720x450 effective zoom, high contrast/reduced motion; screenshots under
  `.codex-artifacts/messaging-read-receipts` in the workspace parent.
- Messaging 8007 restarted successfully with V16; real Gateway CSRF-authenticated
  sessions verify preference persistence, private cursor redaction, sender-only access,
  batch reads, idempotent observation POST and stale-version rejection. Original sharing
  preference restored. No messages created. The historical seed message predates current
  membership terms, so per-person status transitions are proven by fresh PG tests instead.
- Vite production compilation passes. Full repository release build remains separately
  blocked by existing Gateway snapshot drift, unrelated Home/Notifications source sizes,
  and other products' design-system/bundle debt. Those files are not changed here.

## Next Convenience Candidates

These are proposals, not controls presented as already implemented:

1. Per-thread notification subscriptions, independent of channel mute, with digest mode.
2. Silent sending and scheduled sending with cancel/retry states and a durable scheduler.
3. A personal follow-up reminder on a sent message, without exposing recipients' private
   status or automatically sending pressure notifications to them.
4. Search/filter in the read-by inspector for very large conversations; validate audience
   size and server pagination before exposing a large-group administrative view.

Existing mention-only notifications, Later, conversation appearance, draft retention and
unread navigation stay intact; they are not duplicated as new features.
