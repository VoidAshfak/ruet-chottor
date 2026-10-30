import { z } from 'zod';

// Images, videos and documents live in Cloudinary (ADR 0010). The browser uploads directly with a
// short-lived signature from the API, so files never pass through our server.

export const MEDIA_KINDS = ['image', 'video', 'document'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/** Allowed file formats (extensions as Cloudinary reports them). */
export const MEDIA_FORMATS = {
  image: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'],
  video: ['mp4', 'webm', 'mov'],
  document: ['pdf', 'docx', 'pptx', 'xlsx', 'txt'],
} as const satisfies Record<MediaKind, readonly string[]>;

const MB = 1024 * 1024;

/** Upper limits per file; Cloudinary's free plan caps images and documents at 10 MB, videos at 100 MB. */
export const MEDIA_MAX_BYTES = {
  image: 10 * MB,
  video: 100 * MB,
  document: 10 * MB,
} as const satisfies Record<MediaKind, number>;

/**
 * Where an upload is going to be attached, with what it may contain. A content module adds its
 * entry when it starts using media.
 */
export const MEDIA_PURPOSES = {
  'news.post': { kinds: ['image', 'video'], maxPerItem: 4 },
  'clubs.logo': { kinds: ['image'], maxPerItem: 1 },
  'clubs.cover': { kinds: ['image'], maxPerItem: 1 },
  'events.poster': { kinds: ['image'], maxPerItem: 1 },
  'lost-found.item': { kinds: ['image'], maxPerItem: 3 },
} as const satisfies Record<string, { kinds: readonly MediaKind[]; maxPerItem: number }>;
export type MediaPurpose = keyof typeof MEDIA_PURPOSES;
const PURPOSE_KEYS = Object.keys(MEDIA_PURPOSES) as [MediaPurpose, ...MediaPurpose[]];

/** The file kind for an extension, or null if it is not allowed at all. */
export function mediaKindOf(fileName: string): MediaKind | null {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  for (const kind of MEDIA_KINDS) {
    if ((MEDIA_FORMATS[kind] as readonly string[]).includes(extension)) return kind;
  }
  return null;
}

/** POST /media/uploads: ask for permission to upload one file. */
export const createUploadRequestSchema = z
  .object({
    purpose: z.enum(PURPOSE_KEYS),
    kind: z.enum(MEDIA_KINDS),
    /** Only its extension is used: it must match `kind`, and documents keep it in their URL. */
    fileName: z.string().trim().min(1).max(200),
    /** Declared size; checked again against the real file after the upload. */
    bytes: z.number().int().positive(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const rules = MEDIA_PURPOSES[value.purpose];
    if (!(rules.kinds as readonly MediaKind[]).includes(value.kind)) {
      ctx.addIssue({
        code: 'custom',
        path: ['kind'],
        message: 'This file type is not allowed here',
      });
    }
    if (mediaKindOf(value.fileName) !== value.kind) {
      ctx.addIssue({
        code: 'custom',
        path: ['fileName'],
        message: `Allowed: ${MEDIA_FORMATS[value.kind].join(', ')}`,
      });
    }
    if (value.bytes > MEDIA_MAX_BYTES[value.kind]) {
      ctx.addIssue({
        code: 'custom',
        path: ['bytes'],
        message: `Files of this type are at most ${MEDIA_MAX_BYTES[value.kind] / MB} MB`,
      });
    }
  });
export type CreateUploadRequest = z.infer<typeof createUploadRequestSchema>;

/** Everything the browser needs to POST the file straight to Cloudinary. */
export const uploadTicketSchema = z.object({
  assetId: z.string(),
  uploadUrl: z.string(),
  /** Form fields to send along with `file`, exactly as given. */
  fields: z.record(z.string(), z.string()),
  maxBytes: z.number().int(),
});
export type UploadTicket = z.infer<typeof uploadTicketSchema>;

export const mediaAssetSchema = z.object({
  id: z.string(),
  kind: z.enum(MEDIA_KINDS),
  format: z.string(),
  bytes: z.number().int(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  /** Optimised for display (format, quality and size chosen by the CDN). */
  url: z.string(),
  /** A small preview image for images and videos; null for documents. */
  thumbnailUrl: z.string().nullable(),
});
export type MediaAsset = z.infer<typeof mediaAssetSchema>;

export const mediaAssetIdParamSchema = z.object({ id: z.uuid() });

/** For content bodies that carry attachments, e.g. `{ ..., mediaIds: [...] }`. */
export const mediaIdsSchema = (max: number) =>
  z
    .array(z.uuid())
    .max(max, `At most ${max} files`)
    .refine((ids) => new Set(ids).size === ids.length, 'A file is attached twice');
