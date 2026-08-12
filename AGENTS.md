# DWP Frontend Product Experience Rules

These rules are mandatory for every frontend change in this repository.

## Product Character

- Learn functional patterns from global enterprise products, but do not imitate SAP,
  Salesforce, or generic admin-dashboard visual styling.
- DWP should feel calm, responsive, precise, and alive. It must not feel like a static
  database viewer, a marketing landing page, or a collection of interchangeable cards.
- Use the DWP design system and domain language. Do not copy template layouts, assets,
  illustrations, or component styling into the product.

## Start With The Work

- Before designing a screen, state its primary user, operational question, primary action,
  and page archetype: command center, list-detail, workflow, studio, graph, or focus form.
- Keep a page simple when the task is singular. Complexity is justified only by real
  comparison, monitoring, investigation, or authoring needs.
- Tables are for comparison. Pair operational tables with filters, saved state, selection,
  an inspector or detail route, and complete loading/empty/error/permission states.
- A dashboard must answer a concrete question. It needs scope, time context, freshness,
  thresholds or baselines, and drill-down. A row of unrelated current-value KPIs is not a
  finished dashboard.

## Visual And Interaction Language

- Use a stable responsive grid inside the fluid workspace. Do not scatter content across
  an unconstrained wide canvas or leave accidental empty regions.
- Create hierarchy with composition, type, restrained surface tones, and semantic color.
  Avoid monochrome line-only layouts, decorative gradients, glow, blobs, and card soup.
- Use charts only for trend, comparison, distribution, threshold, or relationship. Every
  chart needs an accessible text/table equivalent and cannot depend on color alone.
- Prefer linked interaction: changing scope or time updates related content; selecting a
  row, metric, graph node, or anomaly opens or filters meaningful detail.
- Motion explains cause and spatial continuity. Respect reduced motion and never use
  continuous animation as decoration.
- Use Lucide icons through approved components. Icon buttons require accessible names and
  tooltips when their meaning is not obvious.

## Operational Screen Contract

- Show customer or user impact before infrastructure detail.
- Prioritize exceptions and decisions; compress healthy repetition into a concise state.
- Expose live/paused/stale status and the last successful refresh.
- Preserve scope, filters, time range, selection, and inspector state in the URL or a saved
  view when the workflow benefits from return navigation or sharing.
- High-impact changes require preview, impact, approval or justification, progress,
  recovery, and audit evidence.

## Quality Gate

- Verify 1440px, 1280px, 390px, and 320px layouts plus 200% zoom.
- Verify light/dark, high contrast, reduced motion, keyboard-only navigation, visible focus,
  long Korean/English labels, and partial API failure.
- Capture Playwright screenshots for changed journeys. Check overflow, blank canvases,
  overlapping content, and whether the first viewport exposes real work.
- Do not mark a menu complete because it renders or calls an API. The representative user
  journey and all material states must work end to end.

The detailed rationale and page inventory live in:

- `docs/04-design-system/DWP Product Experience Rules.md`
- `docs/02-research/DWP Experience Modernization Roadmap 2026-08-12.md`
