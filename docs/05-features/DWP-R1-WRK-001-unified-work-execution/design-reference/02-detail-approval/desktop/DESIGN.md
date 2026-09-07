---
name: Precision Calendar System
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#006242'
  on-tertiary: '#ffffff'
  tertiary-container: '#007d55'
  on-tertiary-container: '#bdffdb'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.025em
  headline-md:
    fontFamily: geist
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: geist
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.015em
  body-lg:
    fontFamily: geist
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: -0.01em
  body-md:
    fontFamily: geist
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: -0.005em
  body-sm:
    fontFamily: geist
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
  label-md:
    fontFamily: geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: geist
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.02em
  mono-time:
    fontFamily: geist
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.04em
  shortcut-key:
    fontFamily: geist
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 12px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  grid-slot-15min: 1rem
  grid-slot-30min: 2rem
  grid-slot-60min: 4rem
  sidebar-width: 16rem
  time-rail-width: 3.5rem
  header-height: 3.5rem
  space-xxs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
  space-2xl: 2rem
---

## Brand & Style

This design system embodies high-velocity executive productivity, technical precision, and quiet sophistication. Tailored for knowledge workers, modern enterprise teams, and operators who demand rapid scheduling workflows, the system draws heavy aesthetic and functional influence from next-generation desktop productivity tools like Cron and Amie.

The aesthetic philosophy centers on **Ultra-Refined Functional Minimalism**:

- **Clarity over Clutter:** High data density balanced by disciplined white space, micro-borders, and structural alignments.
- **Dynamic Speed & Tactility:** Interactions feel instantaneous and sharp, leveraging keyboard-first navigation patterns, instant focus states, and low-latency UI responsiveness.
- **Inverted Command Modality:** While day-to-day scheduling occurs in an airy, crisp, light-mode environment, global search, switcher menus, and the command palette adopt a high-contrast, deep-slate obsidian glass treatment to focus cognitive intent.

## Colors

The palette establishes an ultra-clean, structural canvas where schedules and events hold primary visual weight.

### Surface and Canvas

- **Pure Canvas (`#FFFFFF`):** Base background for the primary scheduling matrix, active grid columns, and popovers.
- **Off-Canvas / Sidebars (`#F8FAFC`):** Micro-surface contrast for multi-month pickers, navigation rails, and collapsible side panels.
- **Muted Canvas (`#F1F5F9`):** Gridlines, inactive time spans, and non-working hours.

### Boundaries & Structure

- **Border Base (`#E2E8F0`):** Hairline structure for calendar column dividers, header dividers, and panels.
- **Subtle Border (`#F1F5F9`):** 15-minute / 30-minute interval markers inside the day/week grid.

### Key Accents

- **Primary Electric Blue (`#2563EB`):** Current-time indicator lines, active state markers, focused day badges, and primary call-to-actions.
- **Secondary Slate Dark (`#0F172A`):** Used exclusively for high-contrast command palettes, tooltips, and inverted keyboard shortcut keys.
- **Accent Emerald (`#10B981`):** Positive RSVP confirmations, available slots, and link status.

### Event Category Spectrum (Pastel Fills + Saturated Edges)

- **Work / Focus:** Fill `#EFF6FF`, Edge `#2563EB`, Text `#1E40AF`
- **Team / Syncs:** Fill `#F5F3FF`, Edge `#7C3AED`, Text `#5B21B6`
- **External / Client:** Fill `#ECFDF5`, Edge `#059669`, Text `#065F46`
- **Urgent / Out-of-Office:** Fill `#FFF1F2`, Edge `#E11D48`, Text `#9F1239`
- **Personal / Private:** Fill `#FFFBEB`, Edge `#D97706`, Text `#92400E`

## Typography

Typography drives the architectural rhythm of the calendar. Powered by `geist`, the type balances mechanical density with supreme geometric clarity.

- **Tabular Numerals:** All time stamps, duration labels, coordinate readouts, and matrix day-numbers must enforce `font-feature-settings: "tnum" 1` to ensure consistent vertical alignment across event blocks and headers.
- **Capitalization Rules:** Structural column labels (e.g., `MON 14`, `10 AM`) utilize uppercase formatting with expanded letter tracking (`letter-spacing: 0.02em` to `0.04em`) at small scales. Event titles within schedule blocks use natural sentence case.
- **Hierarchy Separation:** Time axes rely on `mono-time` (`11px`) set in `#94A3B8`, keeping the grid readable without competing with user-defined agenda items.

## Layout & Spacing

The layout model combines an enterprise side-panel architecture with a precision CSS time-grid:

- **Primary Layout Columns:**
  - **Left Rail (Navigation & Mini-Cal):** Fixed `16rem` width, collapsible via `[Cmd/Ctrl + B]`.
  - **Time Axis Rail:** Fixed `3.5rem` left offset with text right-aligned against the schedule edge.
  - **Schedule Viewport:** Fluid multi-column layout stretching evenly across `1`, `3`, `4`, or `7` equal flex columns based on selected range.
  - **Contextual Inspector (Right Panel):** Anchored `20rem` sliding drawer for attendee management and event details.

- **Vertical Time Geometry:**
  - Standard hour block height is `4rem` (64px).
  - 30-minute subdivisions measure `2rem` (32px).
  - 15-minute snapping markers measure `1rem` (16px).

- **Responsive Adaptations:**
  - **Desktop (>= 1280px):** Full view with perpetual mini-calendar rail and dynamic right-hand detail inspector.
  - **Tablet (768px - 1279px):** Left navigation collapses into an overlay drawer; default calendar shows 3-day or working-week view.
  - **Mobile (< 768px):** Grid converts into single-day view or vertical agenda list with bottom navigation bar and sticky header controls.

## Elevation & Depth

Visual depth is achieved through surgical micro-lines, translucent layering, and hyper-targeted shadows rather than heavy skeuomorphic shading.

- **Tier 0 (Base Canvas):** Pure white `#FFFFFF` grid surfaces with `#E2E8F0` and `#F1F5F9` border subdivisions. Completely flat.
- **Tier 1 (Event Badges & Drag Overlays):** Background colors at 100% opacity with a `box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.04)`. When dragged or resized, active badges lift with `box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04)` and scale to `1.02`.
- **Tier 2 (Popovers & Context Menus):** Pure white `#FFFFFF` shell, framed by a `1px` border of `rgba(226, 232, 240, 0.8)` with an ambient drop: `box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -1px rgba(15, 23, 42, 0.04)`.
- **Tier 3 (Floating Command Palette):** Deep-slate glassmorphism (`#0F172A` at `90%` opacity) paired with `backdrop-filter: blur(16px) saturate(180%)`. Outlined with a microscopic inner edge of `rgba(255, 255, 255, 0.12)` and a multi-stage ambient blur: `box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.08)`.

## Shapes

The design system uses soft, geometric radiuses (`roundedness: 1` equivalent to baseline `0.25rem` / `4px`) to preserve a crisp, technical identity without looking harsh.

- **Event Badges:** `6px` (`0.375rem`) border radius on all four corners. If an event spans multiple columns or is split across midnight, connected edges remain squared (`0px`).
- **Control Inputs & Buttons:** `6px` (`0.375rem`) corner rounding.
- **Date Highlight Pills:** Today's date in column headers uses a fully circular pill (`9999px`) with a fixed 24px diameter.
- **Modals & Command Palette Container:** `12px` (`0.75rem`) outer border radius.
- **Keyboard Shortcut Badges (`<kbd>`):** `4px` (`0.25rem`) corner radius.

## Components

### Event Badges (Schedule Cards)

- **Container:** Positioned absolutely in the time column. Soft pastel background fill (e.g., `#EFF6FF`).
- **Left Edge Accent:** Solid `3px` or `4px` saturated border-left (e.g., `#2563EB`) running the full vertical height of the badge.
- **Padding:** Compact `4px 8px`.
- **Content:** Title in `body-sm` (semibold), secondary location/conferencing link or time snippet in `label-sm` (regular, muted text matching the color tier).
- **Handles:** Subtly reveal top/bottom resize zones on hover (`cursor: ns-resize`).

### Command Palette (Quick Nav & Actions)

- **Floating Overlay:** Fixed center-top layout (`top: 15%`), max width `600px`.
- **Styling:** Dark slate background `#0F172A` with translucent frosted backing (`rgba(15, 23, 42, 0.88)` + `blur(16px)`).
- **Input Field:** Borderless, `16px` geist font, white text with `#94A3B8` placeholder. Preceded by a subtle `16px` search icon.
- **List Items:** Subtle hover/active selection state `#1E293B`. Text renders `#F8FAFC`.
- **Keyboard Shortcut Tooltips:** Embedded inline inside the item row, displaying high-contrast dark key tags with micro-borders (`border: 1px solid #334155`, background `#1E293B`, text `#94A3B8`).

### Buttons & Quick Actions

- **Primary Action:** Solid `#2563EB`, text `#FFFFFF`, hover `#1D4ED8`, height `32px`, font size `13px`, padding `0 12px`.
- **Secondary Action:** Background `#FFFFFF`, border `1px solid #E2E8F0`, text `#0F172A`, hover background `#F8FAFC`.
- **Ghost Action:** Background transparent, text `#64748B`, hover background `#F1F5F9`, hover text `#0F172A`.

### Grid Markers & Real-Time Indicator

- **Current Time Bar:** A vibrant `#2563EB` horizontal `1.5px` line stretching horizontally across the current active day or week columns. Anchored with an absolute left-aligned `#2563EB` solid circle (`8px` diameter) precisely centered over the time axis coordinate.

### Inputs & Date Switching Controls

- **Date Strip Segmented Control:** Joined pill container with `#F1F5F9` background, `2px` internal padding, containing toggle items (`Day`, `Week`, `Month`) with `6px` radius. Active option snaps with white background `#FFFFFF` and micro drop-shadow `0 1px 2px rgba(0, 0, 0, 0.06)`.
- **Inline Text Fields:** `32px` standard height, `1px solid #E2E8F0`, focus state creates a ring of `2px solid #2563EB` with `0px` offset.

### Chips & Participant Avatars

- **Attendee Pill:** Height `24px`, background `#F1F5F9`, rounded `9999px`. Displays `18px` avatar circle, user first name (`12px`), and confirmation status dot (Green for accepted, Yellow for tentative, Gray for pending).
