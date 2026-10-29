# 0003 — Theme colors from the RUET logo

**Status:** Accepted · 2026-10-28

## Context

The brief says the color theme should follow the RUET logo, and the UI must stay readable (text contrast 4.5:1 or
higher, CLAUDE.md §9). The logo has three colors: a blue disc, an orange gear and a green book.

## Decision

Colors were sampled from the logo's pixels and checked for contrast against white:

| Logo color | Sampled | Contrast on white | Token | Used for |
|---|---|---|---|---|
| Blue (disc) | `#0F7DBC` | 4.49:1 | `--ring` | Focus outlines |
| Blue, deepened | `#0D6AA3` | 5.82:1 | `--primary` | Buttons, links, brand name, active states |
| Light blue (disc) | `#81C9F2` | 1.82:1 | `--accent` = tint `#EAF5FD` | Hover and selected backgrounds |
| Orange (gear) | `#EB8A1B` | 2.57:1 | `--brand-orange` | Decoration only (header top bar). Never text |
| Green (book) | `#007749` | 5.62:1 | `--brand-green` | Success states |

- Blue is the one accent color (CLAUDE.md §9); orange and green are used sparingly.
- All values live in `apps/web/src/styles/theme.css`. Components use token classes only.
- The logo emblem itself is not shown in the UI. RUET Chottor is a student project, not an official university
  service, so it should not look like one.

## Consequences

Changing the brand colors touches one file only. Any new color must pass the same contrast check.
