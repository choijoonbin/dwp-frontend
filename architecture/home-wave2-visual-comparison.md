# Home Wave 2 accepted-source comparison

- Review date: 2026-09-16
- Review method: human perceptual review plus executable layout and behavior assertions
- Source of truth: `architecture/home-wave2-design-source-registry.v1.json` and its 33 accepted PNG hashes
- Decision: pass with product-native adaptations

## Final integrated verification

- Integrated implementation commit: `56c78e1e7fc51cac40b381d0e5376efceaa65a68`
- Runtime: Node.js 24.19.0, Playwright 1.58.0, Chromium project, one worker, host
  timezone with no override
- Combined acceptance result: clean run of 19/19 tests
  (Wave 2 acceptance 7, Wave 2 state evidence 8, Wave 3 governance 4)
- Wave 2 JUnit receipt: 15/15 tests, 0 failures, 0 skipped, 0 errors
- Visual policy: the final acceptance run used `--update-snapshots=none`; the evidence
  manifest binds all 33 canonical and 7 interaction PNGs to the implementation commit
- Combined receipt: `architecture/home-wave123-playwright.json`
- Wave 2 receipt: `architecture/home-wave2-playwright-junit.xml`

The accepted PNGs were compared with the full-page Chromium evidence listed in
`architecture/home-wave2-evidence.v1.json`. The comparison assessed information architecture,
section order, visual hierarchy, navigation allocation, responsive behavior, state semantics,
editor structure, and accessibility intent. The implementation uses the existing DWP tokens,
MUI, Lucide, local approved assets, permissions, and API contracts. It does not copy the reference
HTML, remote fonts, CDN assets, or placeholder navigation behavior.

| Canonical evidence                   | Perceptual and contract comparison                                                                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C01-D1440-BASE                       | Classic organizational portal hierarchy, 248px navigation, lead news, 18 apps, supporting news, knowledge/support, and compact personal summary align.   |
| C02-D1280-BASE                       | The same Classic hierarchy reflows inside the actual 1032px Home allocation with no right clipping.                                                      |
| C03-M390-BASE                        | Classic single-column reading order, 44px targets, and five-purpose bottom navigation align.                                                             |
| C04-M320-BASE                        | Compact mobile hierarchy and labels remain complete at 320px with no horizontal overflow.                                                                |
| C05-BROWSER-ZOOM-200-CSS720-r01      | Compact/tablet header navigation replaces fixed bottom navigation and preserves the full document at the accepted zoom boundary.                         |
| C06-TEXT-200-D1440-r04               | All 18 localized app names reflow without abbreviation or clipping at 200% text.                                                                         |
| C07-LONG-EN-D1280-r02                | Long English organization content wraps while keeping the approved portal hierarchy and accessible meaning.                                              |
| C08-DARK-D1440-r02                   | Dark surfaces retain hierarchy, contrast, borders, navigation, and state legibility.                                                                     |
| C09-HIGH-CONTRAST-D1440-r04          | Forced-color structure, focus visibility, and control boundaries remain perceivable.                                                                     |
| C10-D1440-EMPTY-r02                  | The successful zero-state appears inside the real Classic Home tree and provides a valid next action.                                                    |
| C10-M390-EMPTY-r01                   | The same successful zero-state and action reflow on mobile without navigation overlap.                                                                   |
| C11-D1440-PARTIAL-r02                | Verified content remains visible while affected sources, recovery action, and partial status are explicit.                                               |
| C11-M390-PARTIAL-r02                 | Partial-data provenance and retry remain readable in the mobile Home composition.                                                                        |
| C12-D1440-FORBIDDEN-r02              | Permission denial is contained to governed personal content while organizational content remains usable.                                                 |
| C12-M390-FORBIDDEN-r04               | The forbidden state retains the same containment and action semantics on mobile.                                                                         |
| C13-D1440-STALE-r02                  | Preserved data, last-success context, affected sources, and retry are explicit in the desktop Home tree.                                                 |
| C13-M390-STALE-r03                   | Stale-data semantics and preserved content retain priority on mobile.                                                                                    |
| C14-D1440-BACKGROUND-REFRESH-r02     | Refresh keeps verified content and two-card summary geometry in place.                                                                                   |
| C14-D1440-INITIAL-LOADING-r02        | The two-card layout-stable skeleton prevents a desktop content jump.                                                                                     |
| C14-M390-BACKGROUND-REFRESH-r02      | Mobile refresh preserves content, status, and single-document scrolling.                                                                                 |
| C14-M390-INITIAL-LOADING-r02         | Mobile loading preserves the accepted summary footprint and navigation clearance.                                                                        |
| C15-D1440-EDITOR-DIRTY-r01           | Dirty state, floating save/cancel controls, preserved draft, and editor chrome are visible in the real Home tree.                                        |
| C15-M390-EDITOR-DIRTY-r01            | Safe-area spacing keeps first, middle, last, save, and cancel controls reachable above the toolbar.                                                      |
| C16-D1440-SAVE-CONFLICT-r02          | An actual 409 produces the approved modal decision state, focus trap, and preserved draft.                                                               |
| C16-M390-SAVE-CONFLICT-r02           | Conflict actions and focus containment remain usable at 390px.                                                                                           |
| C17-MODE-PRESET                      | Independent Classic and Flow presets plus four device overlays are shown and round-trip without cross-mode mutation.                                     |
| C18-KEYBOARD-REDUCED-MOTION-SPEC-r02 | Skip, navigation, app, section, footer, dialog focus, and motion suppression follow the accepted accessibility contract.                                 |
| CLASSIC-STATE-COMPONENT-SPEC-A       | All nine reusable state primitives expose blocking, preservation, provenance, recovery, and transition rules in Korean.                                  |
| FLOW-BASE-DESKTOP-FINAL              | Flow uses a 64px rail, concrete priority action, linked meeting context, 38/34/28 execution layout, and no Classic news.                                 |
| FLOW-BASE-MOBILE-FINAL               | Meeting preparation, priority, today, response, Space preview, and request milestones follow the accepted mobile order.                                  |
| FLOW-EDITOR-DESKTOP                  | The separate three-panel Studio contains 12 catalog identities, inspector metadata, 38/34/28 canvas, save/restore controls, and bounded panel scrolling. |
| FLOW-PERSONALIZED-DESKTOP-FINAL      | Space, meeting, AI, place, and learning previews occupy the approved desktop hierarchy and remain fail-closed before provider activation.                |
| FLOW-PERSONALIZED-MOBILE-FINAL       | Meeting, Space, AI, place, and learning previews follow the approved one-column order with disabled 44px actions.                                        |

Intentional product adaptations are limited to established DWP copy, tokens, icons, local imagery,
permission-filtered navigation, and explicit unavailable states for provider-backed previews that are
not activated until Wave 4. Those adaptations preserve the accepted task hierarchy and prevent
prototype content from appearing as live enterprise data.
