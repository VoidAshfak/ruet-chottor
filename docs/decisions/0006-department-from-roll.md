# 0006 — Department and series come from the roll

**Status:** Accepted · 2026-10-30

## Context

The directory must let members search by department and series (the admission year). A RUET roll already
holds both: `1703103` is series 17 (2017), department code 03 (CSE), serial 103. Asking users to pick a
department again invites mistakes and lets anyone claim any department. RUET may change or add department codes
in the future.

## Decision

- Department and series are **not stored**. They are computed from the roll whenever a profile is read.
- The code → department table lives in one file: `packages/shared/src/users/departments.ts`.
- Each entry may carry `fromSeries` / `untilSeries`. When a code changes meaning, the old entry is closed with
  `untilSeries` and a new one added with `fromSeries`, so older rolls keep their original department.
- A roll with an unknown code shows the department as "Unknown" instead of failing.

## Alternatives considered

- **User picks the department from a list**: works without a code table, but users can choose wrongly or
  claim a department they are not in.
- **Store the derived department at sign-up**: faster queries, but fixing a wrong table entry would need a data
  migration for every affected user.

## Consequences

- Fixing or extending the table fixes every profile at once, with no migration.
- The directory filters by department and series using the roll's digits (prefix / substring match).
- Teachers and staff do not have student rolls; the demo accounts use `00000xx` rolls, which read as series
  2000 and code 00. A proper field for non-students can come with the `admin` module.
