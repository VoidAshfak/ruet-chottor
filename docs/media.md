# Media uploads (images, videos, documents)

Shared infrastructure in `core/media`, not a feature module: any content module can attach files. Files are stored in
Cloudinary and uploaded straight from the browser, so they never pass through our API
([ADR 0010](decisions/0010-media-on-cloudinary.md)).

## How an upload works

```
Browser ──1. POST /media/uploads {purpose, kind, fileName, bytes}──▶ API   (signs one random file name)
Browser ──2. POST file + signed fields ─────────────────────────────▶ Cloudinary
Browser ──3. POST /media/uploads/:id/complete ──────────────────────▶ API   (checks the stored file)
Browser ──4. save the post with mediaIds: [...] ────────────────────▶ API   (content module attaches)
```

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/media/uploads` | Ticket for one upload: `{ assetId, uploadUrl, fields, maxBytes }` (60 per hour) |
| POST | `/api/v1/media/uploads/:id/complete` | Checks the file in Cloudinary → `MediaAsset` (`url`, `thumbnailUrl`, size) |
| DELETE | `/api/v1/media/uploads/:id` | Removes your upload that is not attached to anything |

All need a login, and only the uploader can complete or remove an upload (others get `404`).

## Limits

| Kind | Formats | Max size |
|---|---|---|
| image | jpg, jpeg, png, webp, gif, heic | 10 MB |
| video | mp4, webm, mov | 100 MB |
| document | pdf, docx, pptx, xlsx, txt | 10 MB |

Images are stored with their metadata stripped (no GPS location), rotated upright and capped at 2560 px. No purpose
accepts documents yet; enabling them needs a content check first (ADR 0010).

Each purpose decides which kinds it accepts and how many per item (`MEDIA_PURPOSES` in
`packages/shared/src/media/schemas.ts`), e.g. `news.post`: images and videos, up to 4.

## Using it in a content module

1. Add a purpose to `MEDIA_PURPOSES` (e.g. `'lost-found.item': { kinds: ['image'], maxPerItem: 3 }`).
2. Accept `mediaIds: mediaIdsSchema(max)` in the create/update body.
3. After saving the item, call `MediaService.attach(ownerId, purpose, itemId, mediaIds)` (it checks ownership and
   deletes files that were removed). Read files with `forContent(purpose, ids)`; call `releaseContent()` when the item
   is deleted.
4. In the web form use `<MediaUploader purpose=... value onChange onBusyChange />`; show files with `<MediaGallery>`.
   Both are in `apps/web/src/components/media/`.

## Setting up Cloudinary (once)

1. Create a free account at [cloudinary.com](https://cloudinary.com).
2. In the console, open **Settings → API Keys** and copy the **API environment variable**
   (`cloudinary://<api_key>:<api_secret>@<cloud_name>`) into `CLOUDINARY_URL` in `apps/api/.env`.
3. Set `MEDIA_FOLDER` per environment (`ruet-chottor/dev`, `ruet-chottor/staging`, ...).
4. Never commit the URL: it contains the API secret.

## Tests

`apps/api/src/core/media/*.spec.ts` (signature against Cloudinary's documented example, attach rules),
`apps/api/test/media.e2e-spec.ts` (endpoints with a fake Cloudinary), `apps/web/src/lib/media-upload.spec.ts`.
