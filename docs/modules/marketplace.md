# Marketplace

Buying and selling between RUET members: books, calculators, drawing sets, cycles and more. The app only connects
buyer and seller; they meet on campus and **pay in person**. Listings that mention prohibited items wait for a
moderator before anyone sees them.

**Status:** Done (Phase 4).
**Feature flag:** `FEATURE_MARKETPLACE` (needs `FEATURE_AUTH`). Contact needs `FEATURE_CHAT`; photos need
`CLOUDINARY_URL`; holding and reporting need `FEATURE_MODERATION` (and so `FEATURE_ADMIN`).

## User flows

- A member opens **Marketplace**: available and reserved listings, filtered by category, price range or **Free
  only**, searched by text, sorted newest first or by price. Prices show as "৳1,20,000" (Bangladeshi grouping) or
  "Free".
- A listing shows photos, price, condition, where to meet, the seller, and a safety note ("Pay in person when you see
  the item. Never send money in advance."). **Message** opens a 1:1 chat with the seller; **Report** is there too.
- **Sell something**: title, category (books & notes, electronics, lab & drawing equipment, furniture, clothing,
  bicycles, tickets, other), condition (new, like new, good, fair), price in whole taka (0 for free), where to meet
  (campus places + "exactly where"), details and up to 5 photos. The form shows what may not be sold.
- **Held for review**: if the title or description mentions a held term (`HELD_TERMS`, e.g. "question paper",
  "leaked", "fake id", drugs or alcohol), the listing is saved hidden and the system files a report, so it appears in
  **Admin → Reports**. The seller sees "Waiting for a moderator: it mentions …". **Restore** publishes it (and closes
  the report); **Remove** keeps it off. An edit that adds a held term sends a published listing back for review.
- Sellers **Mark as reserved**, **Available again**, **Mark as sold**, **Renew for 30 days**, edit and delete
  (confirmed). Sold listings disappear for others; listings leave the marketplace 30 days after posting or renewal.

## Roles & permissions

| Action | Member | The seller | moderator / admin |
|---|---|---|---|
| Browse, open listings, message the seller | ✅ | ✅ | ✅ |
| Sell | ✅ | ✅ | ✅ |
| Edit, change state, renew, delete | ❌ | ✅ | via moderation (hide/remove/restore) |

Suspended members cannot sell. Responses never include contact details.

## Data model

See the `// ===== marketplace =====` section of [`schema.prisma`](../../apps/api/prisma/schema.prisma).

- **Listing**: `title` (3–100), `category`, `condition`, `priceTaka` (0–1,000,000; 0 = free), `description`,
  `meetPlace` (`CampusPlace`, shared with lost & found), `meetDetail`, `createdById`, `state`
  (`available | reserved | sold`), `expiresAt`, `status` (`visible | hidden | removed`), `heldTerm`.
- Photos are `MediaAsset`s with purpose `marketplace.listing` (up to 5 images).

## API

All paths start with `/api/v1/marketplace/listings` and need a login. Errors use `{ error: { code, message } }`.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/?category=&q=&minPrice=&maxPrice=&sort=newest\|price_asc\|price_desc&cursor=` | member | Available and reserved, unexpired, visible listings |
| GET | `/mine?cursor=` | member | Your listings in every state |
| GET | `/:id` | member | One listing (sold or moderated ones only to the seller and staff; `heldFor` only to the seller) |
| POST | `/` | member | `{ title, category, condition, priceTaka, description, meetPlace, meetDetail, mediaIds }` (10 per day) |
| PATCH | `/:id` | seller | Same body |
| POST | `/:id/state` | seller | `{ state: available \| reserved \| sold }` |
| POST | `/:id/renew` | seller | Another 30 days |
| DELETE | `/:id` | seller | `204`; deletes its photos from Cloudinary |

## Moderation

- `marketplace.listing` is registered with the moderation registry (`marketplace-moderation.ts`).
- Held listings use `ModerationService.holdForReview()`, exported by the moderation module: a report from the system
  account (`SYSTEM_MODERATOR_ID`) with the reason. Without moderation switched on, nothing can be reviewed, so nothing
  is held.
- Posting is limited to 10 listings per member per day; edits and state changes to 60 per hour.

## Configuration

| Env var | Default | Description |
|---|---|---|
| `FEATURE_MARKETPLACE` | off | Registers the routes and shows **Marketplace** |

## Code map

- Backend: `apps/api/src/modules/marketplace/` (`MarketplaceService`, `MarketplaceController`, `MarketplaceModeration`)
- Frontend: `apps/web/src/features/marketplace/` (`MarketBrowse`, `MyListings`, `ListingDetail`, `ListingForm`)
- Pages: `apps/web/src/app/(app)/marketplace`, `marketplace/new`, `marketplace/mine`, `marketplace/[id]`,
  `marketplace/[id]/edit`
- Schemas: `packages/shared/src/marketplace/` (including `PROHIBITED_ITEMS`, `HELD_TERMS`, `heldTermIn()`); campus
  places in `packages/shared/src/common/places.ts`, labels in `apps/web/src/lib/campus-places.ts`
- Seed: `apps/api/prisma/seed/marketplace.ts` (four demo listings, one free and one reserved)
- Tests: `packages/shared/src/marketplace/schemas.spec.ts`, `apps/api/test/marketplace.e2e-spec.ts`,
  `apps/web/e2e/marketplace.spec.ts`

## Known limitations / future work

- The held-term list is a simple word match: it catches obvious cases, not every way of describing something. Reports
  and moderators handle the rest.
- No offers, saved searches or seller ratings.
- No payment processing, on purpose.
