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
