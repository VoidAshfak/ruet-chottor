# 0009. Content plugs into moderation through a registry in core

- **Status:** Accepted
- **Date:** 2026-10-30

## Context

Every module with user-generated content must be reportable and moderatable (CLAUDE.md §7). The moderation module
needs to load a reported item, check that the reporter may see it, and hide or restore it. But modules may not import
each other's internals (§4), every module must work with the others switched off, and chat already depends on nothing
but `core`.

## Decision

- `core/moderation/moderatable-content.registry.ts` holds a `ModeratableContentRegistry` (global, from `CoreModule`).
- A content module implements `ModeratableContent` (`type`, `label`, `canReport`, `load`, `setStatus`) and
  registers itself in `onModuleInit`. Chat does this in `chat-moderation.ts`.
- The moderation module looks types up in the registry. If the owning module is off, its type is simply missing:
  reports are refused and the queue shows the item without a preview.
- Content types are listed once in `MODERATABLE_CONTENT_TYPES` (shared), so requests are validated with Zod.
- Moderation writes to admin's `ModerationLogService` (ADR 0007), so `FEATURE_MODERATION` only takes effect together
  with `FEATURE_ADMIN`.
- Staff see only `load()`'s preview of the reported item. For private chats this means one message, never the
  conversation around it (decided with the project owner).

## Consequences

- Neither chat nor moderation imports the other; each can be switched off on its own.
- A content module is responsible for its own visibility rules and for telling open clients about status changes
  (chat emits `chat:message:moderated`).
- Moderators may lack context for harassment that spans several messages; members can report each one.
