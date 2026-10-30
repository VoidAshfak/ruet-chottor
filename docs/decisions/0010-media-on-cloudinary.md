# 0010. Images, videos and documents on Cloudinary, uploaded directly from the browser

- **Status:** Accepted (replaces the "local disk / S3 behind a StorageService" line of ADR 0001)
- **Date:** 2026-10-30

## Context

News needs photos and videos; lost & found, the marketplace and shared academic documents will follow. The
project runs on free tiers and a small API server, and most students use phones on mobile data. Files must not pass
through the API (memory, bandwidth, timeouts), images must be resized for phones, and photo location data must not
leak.

## Decision

- **Cloudinary** (free tier) stores and delivers every file: images and video as `image`/`video` resources, documents
  as `raw`. Chosen with the project owner over Cloudflare R2 (no image/video processing) and ImageKit.
- **Signed direct uploads** in three steps (`core/media`):
  1. `POST /media/uploads` checks the purpose, kind, extension and declared size, stores a `pending` `MediaAsset` and
     returns a signature for exactly one random `public_id` in `MEDIA_FOLDER`, limited to the allowed formats.
     Signatures expire after an hour (Cloudinary's rule). The API secret never leaves the server.
  2. The browser POSTs the file straight to Cloudinary (with progress, `lib/media-upload.ts`).
  3. `POST /media/uploads/:id/complete` asks Cloudinary's Admin API what was really stored and rejects (and deletes)
     anything of the wrong type or too large. Only then is the asset `ready`.
- **Content modules attach** ready assets through `MediaService.attach()` (ownership, purpose and count checked) and
  read them with `forContent()`. Removing a file from content, or deleting the content, deletes it from Cloudinary.
- **Images are cleaned as they are stored**: a signed incoming transformation
  (`a_exif/c_limit,w_2560,h_2560/fl_force_strip`) rotates them upright, caps them at 2560 px and strips all metadata,
  so even the original file has no GPS location.
- **Delivery** uses CDN transformations: `f_auto,q_auto` plus a size cap, so each device gets a small modern format. The web app uses plain `<img>`/`<video preload="none">`, not `next/image`,
  so our server never re-processes media.
- **No SDK**: the signature is a SHA-1 of the sorted parameters (checked in a unit test against Cloudinary's documented
  example), and the Admin/Upload API calls are plain `fetch`.
- **No scheduler**: abandoned uploads (pending > 2 h, unattached > 24 h) are cleaned up before the owner's next upload.

## Consequences

- One env var, `CLOUDINARY_URL`. Without it, uploads answer 503 and the rest of the app works.
- Free-tier limits apply: 10 MB per image or document, 100 MB per video, about 25 GB of storage and bandwidth combined
  per month.
- Files are public by URL once uploaded (random, unguessable names). Hiding content stops our API from serving the
  URL, but someone who already copied it can still open it until the content is deleted.
- Videos are stored as uploaded (re-encoding on upload is slow on the free plan), so a phone video's own metadata may
  include location. The upload tip tells members that photos are cleaned; consider an incoming video transformation if
  this matters.
- Images and videos are checked by what Cloudinary decoded, not by the extension. Documents (`raw`) are not decoded, so
  before any purpose accepts documents, add a content check (e.g. the file's leading bytes) in `completeUpload`.
- Documents (PDF) need "Allow delivery of PDF and ZIP files" turned on in the Cloudinary console's security settings
  when the documents feature is built.
