# 0011 — Class representatives are a verified badge, not a role

**Status:** Accepted · 2026-10-31

## Context

Class representatives (CRs) speak for their class and will soon be able to propose class events. Members need to
trust that someone calling themselves a CR really is one, but there is no official list of CRs to import, and CRs
change from year to year. Each account has exactly one role (CLAUDE.md §6), and a CR is usually also a student, and
sometimes a club manager or moderator.

## Decision

- CR status is a **separate verified record** (`ClassRepRequest`) beside the account, not a new `Role`.
- The student **asks** from My profile with their section and a short proof note; a **moderator or admin verifies**
  or turns it down in the admin panel. Staff cannot review their own request.
- The class (department and series) comes from the roll ([ADR 0006](0006-department-from-roll.md)), so a student
  can only ask for their own class; only the section is chosen.
- It lasts **until revoked**: the student steps down or staff remove it. Rows are never deleted, so the history
  of who was CR stays.
- A partial unique index allows at most one open (pending or approved) request per member.
- Every decision is written to the moderation log ([ADR 0007](0007-moderation-log-and-account-sanctions.md)), so the
  feature needs `FEATURE_ADMIN`.

## Alternatives considered

- **A `class_rep` role:** simpler permission checks, but one role per account means a CR who manages a club would
  lose one of them, and it changes the role list in CLAUDE.md §6.
- **Admins appoint CRs directly:** no request flow, but staff would have to know every CR on campus.
- **Teachers approve:** closest to real life, but few teacher accounts exist on the platform yet.
- **Yearly expiry:** keeps the list fresh, but adds a timer and re-applications; staff can revoke instead.

## Consequences

- Other modules ask "is this member a verified CR?" through the users module (the `classRep` field on profiles),
  not through role checks.
- A CR whose role later changes (e.g. to alumni) keeps the badge until staff revoke it.
