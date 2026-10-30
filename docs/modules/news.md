# News

Campus news and announcements. Anyone logged in can read and post. Posts from verified roles (moderator, admin,
club manager) are published at once; everyone else's posts wait for a moderator (CLAUDE.md §7). Posts can carry up to
4 photos or videos ([media](../media.md)) and can be reported like any other content ([moderation](moderation.md)).

**Status:** Done (Phase 3). No comments in this version.
**Feature flag:** `FEATURE_NEWS` (needs `FEATURE_AUTH` and `FEATURE_ADMIN`; reviews are written to admin's
moderation log). Photos need `CLOUDINARY_URL`; reporting needs `FEATURE_MODERATION`.

## User flows

- A member opens **News**: published posts, newest first, filtered by category (Announcement, Academic, Event,
  Club, General). Verified authors show a "Verified" label.
- **Write a post**: title, category, text (plain, line breaks kept) and optional photos/videos, which upload straight
  to Cloudinary while the member types. The button says **Publish** for verified roles and **Send for review**
  otherwise.
- **My posts** lists the member's posts with their state: "Waiting for review", "Published", or "Not published" with
  the moderator's note.
- A moderator opens **Admin → News review**, reads each waiting post and **Approves** (published, logged) or
  **Rejects** with a reason the author sees.
- Authors edit and delete their own posts. An edit by an unverified author goes back to review, so an approved post
  cannot be swapped for something else. Deleting also deletes its photos and videos.
- A club manager can **Post as** one of their clubs ([clubs](clubs.md)); the post shows "for <club>", links to the
  club, and appears under the club's "See news from this club" (`/news?club=<id>`).
- Anyone can **Report** a published post; moderators hide or remove it from the Reports queue. The author then sees
  "A moderator hid this post".

## Roles & permissions

| Action | student / alumni / teacher | club_manager | moderator | admin |
|---|---|---|---|---|
| Read published news | ✅ | ✅ | ✅ | ✅ |
| Post (published at once) | ❌ (reviewed first) | ✅ | ✅ | ✅ |
| Edit / delete own posts | ✅ | ✅ | ✅ | ✅ |
| Review queue, approve, reject | ❌ | ❌ | ✅ | ✅ |

Staff routes use `@Roles('moderator', 'admin')`, and roles are read again from the database. Suspended or banned
members cannot post or edit.

## Data model

See the `// ===== news =====` section of [`schema.prisma`](../../apps/api/prisma/schema.prisma).

- **NewsPost**: `title` (5–120), `category`, `body` (20–5000), `createdById`, `review`
  (`pending | approved | rejected`), `reviewNote`, `reviewedById`, `reviewedAt`, `status`
  (`visible | hidden | removed`, from moderation), `publishedAt` (first approval; sorts the feed), `deletedAt`.
- Photos and videos are `MediaAsset` rows with purpose `news.post` and `contentId` = the post.
- Log actions `approve_content` and `reject_content` (admin's `ModerationAction`).

## API

All paths start with `/api/v1/news` and need a login. Errors use `{ error: { code, message } }`.

| Method | Path | Auth/role | Description |
|---|---|---|---|
| GET | `/?category=&clubId=&cursor=&limit=` | member | Published posts, newest first |
| GET | `/mine?cursor=` | member | Your posts in every state |
| GET | `/:id` | member | A published post; the author and staff also get unpublished ones (others `404`) |
| POST | `/` | member | `{ title, category, body, mediaIds?, clubId? }` → the post (5 per hour; `clubId` only for its managers) |
| PATCH | `/:id` | author | Same body; replaces the post and its files |
| DELETE | `/:id` | author | `204`; deletes its files from Cloudinary |
| GET | `/review?cursor=` | moderator, admin | Waiting posts, oldest first |
| POST | `/:id/approve` | moderator, admin | `{ note? }` → published post |
| POST | `/:id/reject` | moderator, admin | `{ reason }` (5–500 characters) → rejected post |

## Moderation

- Review before publishing for unverified authors (above).
- `news.post` is registered with the moderation registry (`news-moderation.ts`): only published posts can be
  reported; hidden or removed posts leave the feed and are served only to their author (marked `moderated`) and
  staff.
- Rate limits: 5 new posts and 30 edits per member per hour; 120 reviews per staff member per 15 minutes.

## Configuration

| Env var | Default | Description |
|---|---|---|
| `FEATURE_NEWS` | off | Registers `/news` routes (only together with `FEATURE_ADMIN`), shows **News** and **Admin → News review** |

## Code map

- Backend: `apps/api/src/modules/news/` (`NewsService`, `NewsController`, `NewsModeration`)
- Frontend: `apps/web/src/features/news/` (`NewsFeed`, `NewsArticle`, `NewsEditor`, `MyNews`, `NewsReviewQueue`)
- Pages: `apps/web/src/app/(app)/news`, `news/new`, `news/mine`, `news/[id]`, `news/[id]/edit`, `admin/news`
- Schemas: `packages/shared/src/news/`
- Seed: `apps/api/prisma/seed/news.ts` (three published posts, one waiting, one rejected; text only)
- Tests: `apps/api/src/modules/news/news.service.spec.ts`, `apps/api/test/news.e2e-spec.ts`,
  `apps/web/e2e/news.spec.ts` (including a photo upload with Cloudinary mocked)

## Known limitations / future work

- No comments, reactions or pinned posts.
- No notification when a post is approved or rejected (needs `notifications`); authors check **My posts**.
- Plain text only (no links preview or formatting).
- Approved posts by unverified authors go back to review on every edit, even a typo fix.
