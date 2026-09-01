# Benchmark and Product Decisions

Reviewed on 2026-08-26 using the signed-in WEHAGO Meet web client, publicly
served client structure, official help centers, and official platform docs.
WEHAGO's private repository was not available and is not inferred here.

## Comparative findings

| Product         | Strongest pattern adopted                                                                               | Gap DWP must avoid                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| WEHAGO Meet     | Organization selection, meeting code, calendar/messenger continuity, transcript/material/sketch archive | Sparse archive home, weak visible governance hierarchy, fragmented meeting and record flow |
| Zoom            | Waiting room, host tools, breakout control, device test, layered account policy                         | Dense toolbars and settings that expose implementation complexity                          |
| Google Meet     | Predictable bottom controls, low-friction pre-join, dynamic layout, Calendar artifacts                  | Important advanced actions hidden behind activity panels                                   |
| Microsoft Teams | Co-host policy, recap, enterprise meeting options                                                       | Heavy navigation and competing collaboration surfaces                                      |
| Webex           | Security classification, compliance controls, editable recap                                            | Administrative language can dominate everyday meeting work                                 |
| Slack Huddles   | One-click contextual start and durable conversation follow-up                                           | Insufficient model for scheduled, governed formal meetings                                 |
| Butter          | Agenda-first facilitation and outcome-oriented recap                                                    | Workshop visual language is too playful for every enterprise meeting                       |

## WEHAGO direct observations

The current home separates a meeting-code input and `새 회의 만들기` from a
large Meeting Archive. The archive detail provides organizer and participant
snapshots, connected meetings, keywords, transcript, materials, sketch, and a
meeting note/summary pane. Official guides additionally confirm public/private
meetings, external email invitations, screen and document sharing, reactions,
speech recognition, captions/interpretation, virtual backgrounds, and mobile use.

DWP retains the useful continuity but places the next meeting, immediate actions,
today's timeline, and recent outcomes in one balanced work surface. Archive depth
is reached after selection rather than consuming most of the initial viewport.

## Visual direction

- Use DWP's quiet operational shell instead of a decorative meeting landing page.
- Keep the app name, next useful action, and media readiness visible immediately.
- Use one cobalt action color, teal readiness states, coral attention states, and
  neutral surfaces rather than a monochrome blue meeting screen.
- Keep fixed-format controls stable. Video tiles, labels, speaking indicators, and
  connection states may not resize the control bar.
- Use one secondary panel at a time. Chat occupies a stable right rail on desktop
  and a full-height overlay on mobile; host-only waiting-room controls use a
  separate modal drawer so panels never compete or unpredictably resize the stage.
- Animate reactions and panel transitions only; respect reduced motion.

## Design references

- [Zoom Apps design resources](https://developers.zoom.us/docs/zoom-apps/design/design-resources/)
- [Google Meet desktop layout](https://support.google.com/meet/answer/10550593)
- [Butter agenda, run, and recap model](https://www.butter.us/)
- [Figma and Google Meet integration](https://help.figma.com/hc/en-us/articles/16921722048151-Figma-and-Google-Meet)
- [LiveKit React components](https://docs.livekit.io/reference/components/react/)

## Second-pass product boundary (2026-08-28)

The competitive target is the set of trusted enterprise jobs, not a count of Zoom
menu items. DWP now separates the planes below so everyday participants do not inherit
administrative complexity and administrators do not inherit meeting-content access.

| Plane      | Delivered navigation or surface | Responsibility                                                                                                                                    |
| ---------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| User work  | Meeting home                    | Start, schedule, join, capability-aware next action, and recent outcomes                                                                          |
| User work  | My meetings                     | Lifecycle-correct prepare, join, recap, or unavailable action                                                                                     |
| User work  | Join with code                  | Resolve, request admission, explicit failure recovery, and pre-join                                                                               |
| User work  | Live room                       | Media, screen share, participants, chat, speaking queue, reactions, content notice, and host recording readiness                                  |
| User work  | Meeting history / recap         | Governed artifacts, attendance, decisions, actions, and human-reviewed Agent intelligence                                                         |
| Management | Operations                      | Live/scheduled/waiting/failure/quality evidence and runtime capabilities                                                                          |
| Management | Policy                          | Access, collaboration, retention, capacity, and version-aware save validation                                                                     |
| Management | AI & data governance            | Recording/transcript/AI readiness, dependency gates, review/publish boundary, content ACL principle, retention, legal hold, and deletion evidence |

Zoom host controls, Teams intelligent recap, and Webex AI review patterns support
the same core conclusions: host authority must be explicit; recording and transcription
must be visible; AI recap requires transcription, review, and controlled sharing; and
administrative policy is distinct from meeting content. Breakout rooms, polls, Q&A,
whiteboards, advanced host moderation, PSTN/SIP, webinars, and live captions remain
separate delivery epics because their server/provider enforcement is not yet present.
No placeholder menu is presented as a completed capability.

## Visual quality reset (2026-08-31)

The captured production-shaped home exposed a design-review failure: three equal
action rectangles and a four-cell zero-value KPI grid were functionally legible but
did not establish a useful visual hierarchy. Passing accessibility and responsive
smoke tests did not make that composition product-quality. The Meeting experience
therefore adopts the following explicit hierarchy instead of treating every function
as an equal card.

1. The current job is the protagonist. A live or next meeting owns the dominant
   command surface; when no meeting exists, safe instant start becomes the dominant
   action.
2. Schedule and code join are compact tools beside that command, not competing hero
   cards. Code entry stays inline and carries its value into the join flow.
3. Operational signals are progressive disclosure. Zero and unmeasured values are
   not rendered as achievements; a quiet-day message replaces an empty KPI matrix.
4. Today's timeline and recent outcomes share one low-depth work surface. Spacing,
   type, tonal insets, and a single meaningful elevation create groups without a
   divider around every item.
5. Join, pre-join, live room, lobby, recap, operations, policy, and AI governance use
   the same surface depth, 44 px minimum targets, semantic state tones, focus
   treatment, forced-colors fallback, and reduced-motion behavior.
6. Published recap overview exposes the whole approved meeting-level analysis:
   summary, topics, decisions, actions, open questions, risks, and conversation
   climate. It never presents individual emotion, personality, health, or productivity
   inference.

The decisions align with the official product patterns reviewed in this pass:

- [Zoom Workplace desktop navigation and Home](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0064516)
  keeps start, join, schedule, and the next meeting immediately available.
- [Microsoft Teams Meet](https://support.microsoft.com/en-us/teams/apps-service/stay-on-top-of-meetings-with-meet-in-microsoft-teams)
  emphasizes up-next and recent meeting context, while
  [Teams recap](https://support.microsoft.com/en-us/teams/meetings/recap-in-microsoft-teams)
  brings recording, transcript, shared content, notes, and follow-up together.
- [Google Meet Home](https://support.google.com/meet/answer/17302648)
  combines fast create/join with the day's scheduled work.
- [Webex scheduling and classifications](https://help.webex.com/en-us/article/wy517z/Webex-App-Schedule-a-Meeting-from-the-Meetings-Calendar)
  validates making access and information classification understandable before join.
- [Fluent 2 layout](https://fluent2.microsoft.design/layout) and
  [elevation](https://fluent2.microsoft.design/elevation) support grouping with spacing
  and restrained depth instead of excess rules and nested cards.
- [WCAG 2.2 reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) remains a
  release contract at 320 CSS px and 200% zoom-equivalent layouts, not a post-design
  cleanup.

Visual acceptance is scenario-based rather than a single ideal screenshot: empty,
next, live, provider-blocked, join, published AI recap, and administrator readiness
states are exercised across desktop, tablet, mobile, dark, forced-colors, reduced
motion, Korean, and English variants. Structural assertions prevent the legacy equal
three-column command strip and four-cell empty KPI grid from returning.

## Recording and intelligence delivery truth

The managed pipeline is intentionally two-layered. DWP owns durable commands,
idempotency, producer assertions, consent and notice binding, artifact custody,
envelope encryption, retention evidence, human review, and published projections.
LiveKit Egress, trusted object storage, managed STT/broker, KMS, and the approved model
provider remain external deployment dependencies. Missing credentials, probes, region
policy, or deletion evidence must keep recording, transcription, and intelligence
fail-closed; local mocks or a green UI badge may never substitute for those operational
gates.
