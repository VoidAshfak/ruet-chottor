# Lost & Found

A board for things lost and found on campus. Members post what, where and when, with up to three photos; the owner
and the finder get in touch through chat, so nobody's phone number is posted publicly.

**Status:** Done (Phase 4).
**Feature flag:** `FEATURE_LOST_FOUND` (needs `FEATURE_AUTH`). Contact needs `FEATURE_CHAT`; photos need
`CLOUDINARY_URL`; reporting needs `FEATURE_MODERATION`.

## User flows

- A member opens **Lost & Found**: open posts, newest first, filtered by Lost/Found, category (ID card, phone, keys,
  wallet, bag, book or notes, electronics, clothing, other), place (central library, academic building, cafeteria,
  central auditorium, residential hall, medical centre, playground, university bus, main gate, somewhere else) and a
  text search.
- **Post an item**: lost or found, what it is, a short title, where (plus "exactly where"), which day, details and
  photos.
- **Claims for found items**: the finder leaves one identifying detail out of the post and may add a public
  **check question** ("What is the lock-screen photo?"). The answer is never stored; the finder asks it in chat.
  Photos of found items are **blurred** for others until tapped, and the form reminds finders not to show ID numbers
  or faces.
- On a post, others see **Message** (opens a 1:1 chat with the poster) and **Report**. The poster sees **Edit**,
  **Mark as returned**, **Close post**, **Reopen for 30 days** and **Delete** (confirmed).
- **My posts** lists the member's own posts in every state.
- Posts leave the board **30 days** after posting (or reopening). No scheduler: the board leaves out open posts whose
  `expiresAt` has passed, and the poster can reopen them.

## Roles & permissions

| Action | Member | The poster | moderator / admin |
|---|---|---|---|
| Browse the board, open posts, message the poster | ✅ | ✅ | ✅ |
| Post | ✅ | ✅ | ✅ |
| Edit, change state, delete | ❌ | ✅ | via moderation (hide/remove) |

Suspended members cannot post or change posts. Responses never include contact details.

## Data model

See the `// ===== lost-found =====` section of [`schema.prisma`](../../apps/api/prisma/schema.prisma).

- **LostFoundItem**: `kind` (`lost | found`), `category`, `title` (3–100), `description` (≤ 2000), `place`,
  `placeDetail`, `happenedOn` (a date), `verifyQuestion` (found items only), `createdById`, `state`
  (`open | returned | closed`), `expiresAt`, `status` (`visible | hidden | removed`, from moderation).
- Photos are `MediaAsset`s with purpose `lost-found.item` (up to 3 images).

## API

All paths start with `/api/v1/lost-found/items` and need a login. Errors use `{ error: { code, message } }`.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/?kind=&category=&place=&q=&cursor=` | member | Open, unexpired, visible posts, newest first |
| GET | `/mine?cursor=` | member | Your posts in every state |
| GET | `/:id` | member | One post (done and expired ones show their state; moderated ones only to the poster and staff) |
| POST | `/` | member | `{ kind, category, title, description, place, placeDetail, happenedOn, verifyQuestion, mediaIds }` (10 per day) |
| PATCH | `/:id` | poster | Same body |
| POST | `/:id/state` | poster | `{ state: open \| returned \| closed }`; `open` reopens for another 30 days |
| DELETE | `/:id` | poster | `204`; deletes its photos from Cloudinary |

## Moderation

`lost-found.item` is registered with the moderation registry (`lost-found-moderation.ts`). Hidden or removed posts
leave the board and are served only to their poster (marked `moderated`) and staff. Posting is limited to 10 per
member per day.

## Configuration

| Env var | Default | Description |
|---|---|---|
| `FEATURE_LOST_FOUND` | off | Registers the routes and shows **Lost & Found** |

## Code map

- Backend: `apps/api/src/modules/lost-found/` (`LostFoundService`, `LostFoundController`, `LostFoundModeration`)
- Frontend: `apps/web/src/features/lost-found/` (`LostFoundBoard`, `MyItems`, `ItemDetail`, `ItemForm`, `ItemPhoto`)
- Pages: `apps/web/src/app/(app)/lost-found`, `lost-found/new`, `lost-found/mine`, `lost-found/[id]`,
  `lost-found/[id]/edit`
- Schemas: `packages/shared/src/lost-found/`
- Seed: `apps/api/prisma/seed/lost-found.ts` (three demo posts, text only)
- Tests: `packages/shared/src/lost-found/schemas.spec.ts`, `apps/api/test/lost-found.e2e-spec.ts`,
  `apps/web/e2e/lost-found.spec.ts`

## Known limitations / future work

- The blur only stops casual peeking: anyone can tap to reveal. Finders should still keep identifying details out
  of photos.
- No matching between lost and found posts, and no alerts for new posts in a category (needs `notifications`).
- Expired posts are not deleted; they simply leave the board.
