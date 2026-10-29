---
name: add-user-guidance
description: Add the three required guidance layers to a RUET Chottor feature - page descriptions, (i) info tips, and a first-visit intro popup - with all text in the module's help.ts. Use whenever a page, form or feature is added or changed.
---

# Add user guidance

RUET Chottor has no marketing, so the UI must teach itself. Every feature needs all three layers.

## 1. Write the text in `apps/web/src/features/<module>/help.ts`

All guidance text lives here, never inline in components.

```ts
export const help = {
  page: {
    title: "Lost & Found",
    description: "Report items you lost or found on campus, and help them get back to their owners.",
  },
  tips: {
    location: "Where on campus you lost or found it, e.g. 'Central Library, 2nd floor'.",
    contactVisible: "If on, people can see your phone number on this post. Off by default.",
  },
  intro: [
    { title: "Lost something?", body: "Post it here with a photo and where you last saw it." },
    { title: "Found something?", body: "Post it so the owner can find you." },
    { title: "Mark it resolved", body: "When the item is returned, mark the post resolved." },
  ],
} as const;
```

## 2. Writing rules

- Plain, friendly English a first-year student understands. No jargon ("OTP" → "one-time code").
- Description: one sentence, says what the page is **for**.
- Tips: max ~25 words. Explain *what* it does and *why* it matters (especially privacy effects).
- Intro: 2–4 steps, each with a title (≤ 5 words) and body (≤ 25 words).
- Never use guidance text to cover up confusing UI. If something needs a long explanation, simplify the UI.

## 3. Where tips are required

Add `<InfoTip text={help.tips.x} />` next to:
- any field whose purpose or format is not obvious (roll, registration no., location, price),
- every privacy or visibility toggle,
- every action with consequences (report, delete, mark resolved, leave group),
- every role-specific control (club manager, moderator).

## 4. Components (in `apps/web/src/components/guide/`)

- `<PageHeader title description />` — renders the title and the one-line description.
- `<InfoTip text />` — `(i)` icon button; Radix Tooltip on hover/focus, Popover on tap (mobile).
  Must have `aria-label="More info"` and be keyboard reachable.
- `<FirstVisitGuide moduleKey steps />` — dialog shown on the first visit to a module.
  Skippable, has "Back / Next / Done", and on dismiss calls `PATCH /api/v1/users/me/guides`
  with `{ moduleKey }` so it never shows again on any device. Cache the dismissed state in
  TanStack Query; localStorage only as a fast fallback.
- A "Show tips again" option in user settings resets dismissed guides.

If these components do not exist yet, create them first (once), then use them.

## 5. Check

- [ ] Page has `<PageHeader>` with description
- [ ] Every non-obvious control has an `<InfoTip>`
- [ ] `<FirstVisitGuide>` added with 2–4 steps
- [ ] No guidance text hard-coded in components
- [ ] Tips work with mouse, keyboard and touch
