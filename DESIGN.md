---
name: BeeGreat
description: One clear next focus, carried by Bee and the Hive.
colors:
  ink: "#202020"
  ink-soft: "#646464"
  canvas: "#f9f9f9"
  surface: "#fcfcfc"
  surface-muted: "#efefef"
  surface-selected: "#e8e8e8"
  line: "#d8d8d8"
  honey: "#ffdfb5"
  honey-strong: "#f5bd62"
  honey-ink: "#582d1d"
  primary: "#644a40"
  primary-hover: "#4f3931"
  primary-foreground: "#ffffff"
  destructive: "#c94b2c"
  success: "#35694a"
typography:
  headline:
    fontFamily: "ui-rounded, SF Pro Rounded, Arial Rounded MT Bold, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section: "64px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "12px 20px"
    height: "44px"
  button-quiet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "12px 20px"
    height: "44px"
  chip-action:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  input-composer:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
    height: "48px"
---

# Design System: BeeGreat

> The complete, cross-platform design system — including mobile tokens, motion,
> navigation patterns, chat surface, and the full `beeui` generative-UI
> vocabulary — lives in [`docs/design-system.md`](docs/design-system.md).
> This file remains the canonical web palette front-matter.

## Overview

**Creative North Star: "The Calm Hive"**

BeeGreat should feel like the mobile app opened onto a larger desk: focused, familiar, and quietly alive. A centered working column keeps attention on the current task while compact navigation and drawers reveal depth only when needed.

The system is restrained by default. Bee, honeycomb geometry, and warm honey color are signature details, not a decorative layer over every surface.

**Key characteristics:**

- One working column with an 800px maximum content width.
- Structural responsive changes instead of fluid display typography.
- Familiar controls with complete hover, focus, active, disabled, loading, and error states.
- Shared mobile assets for Bee, Hive, goals, voice, and brand marks.

## Colors

The palette pairs quiet neutral surfaces with earthy brown actions and honey used sparingly for progress, voice, and selection.

### Primary

- **Hive Brown:** Primary actions and decisive states. It should remain rare enough to signal commitment.

### Secondary

- **Warm Honey:** Progress, voice, and Hive feedback. Use it as a soft fill or small signal, not a page wash.

### Neutral

- **Soft Canvas:** Default page background.
- **Paper Surface:** Inputs and content surfaces.
- **Quiet Gray:** Secondary controls and grouped regions.
- **Charcoal Ink:** Primary text, with Soft Ink for supporting copy.

**The One Honey Rule.** Let one honey-accented element lead a region. Competing honey controls erase hierarchy.

## Typography

**Display Font:** the platform rounded system face, with system sans fallback
**Body Font:** Inter or the platform system sans

**Character:** Rounded headings carry BeeGreat's warmth. Body copy and controls stay familiar, compact, and easy to scan.

### Hierarchy

- **Headline:** Screen or empty-state title only; fixed scale and tight leading.
- **Title:** Section and item titles.
- **Body:** Instructions, messages, and prose, capped near 70 characters per line.
- **Label:** Buttons, navigation, status, and metadata. Use sentence case.

**The Quiet Type Rule.** Hierarchy comes from weight, spacing, and placement. Do not manufacture importance with tiny uppercase labels or oversized fluid headings.

## Elevation

The system is flat by default. Borders and tonal surface changes explain structure; a soft ambient shadow is reserved for temporary layers such as menus, drawers, and floating voice state.

**The Earned Lift Rule.** Persistent content stays on the canvas. Only content that moves above the interaction plane receives a shadow.

## Components

### Buttons

- **Shape:** Pill for primary and quiet actions; compact rounded squares or hex assets for icon actions.
- **Primary:** Hive Brown with white text, minimum 44px target.
- **Hover / Focus:** Slight tonal change, visible honey focus ring, and a short state transition.
- **Active:** Subtle 0.97 scale or 1px press shift. No bounce choreography.

### Chips

- **Style:** Paper surface, light border, sentence-case label, and 16px corner radius.
- **State:** Honey or selected neutral fill for selected actions; preserve a text or icon indicator.

### Cards / Containers

- **Corner Style:** 12px to 16px.
- **Background:** Paper or muted neutral surface.
- **Shadow Strategy:** None at rest.
- **Border:** One quiet 1px boundary when grouping needs it.
- **Internal Padding:** 16px mobile, up to 24px for larger desktop compositions.

### Inputs / Fields

- **Style:** Paper surface, one quiet border, 16px radius, and generous text inset.
- **Focus:** Honey focus ring plus a stronger boundary.
- **Error / Disabled:** Pair semantic color with a message or icon; preserve readable contrast.

### Navigation

Use the same Bee, honeycomb, Hive, and microphone assets as mobile. Desktop may use a compact rail; mobile uses bottom navigation. Active state uses a selected neutral or restrained honey fill, never a saturated inactive icon set.

### Bee Workspace

The conversation, empty state, and composer share one centered column. Conversation history lives in a drawer or secondary rail and must not squeeze the active thread below its useful width.

## Do's and Don'ts

### Do:

- **Do** reuse the mobile app's Bee, Hive, honeycomb, voice, logo, and motion assets.
- **Do** keep the current action and its status visible without explanatory prose.
- **Do** collapse navigation and history structurally at smaller widths.
- **Do** honor reduced motion and keep state transitions between 100ms and 240ms.
- **Do** provide typed recovery for every voice path.

### Don't:

- **Don't** build generic SaaS dashboards with dense chrome, nested card grids, and decorative metrics.
- **Don't** imitate generic AI chat products with gradients, glass panels, or an identity that stops at a prompt box.
- **Don't** add marketing copy, buzzwords, or explanatory text that delays the primary task.
- **Don't** create web-only styling that drifts from the mobile app's visual language or duplicates its assets.
- **Don't** use side accent stripes, gradient text, glassmorphism, decorative page-load motion, or uppercase labels as a default hierarchy device.
