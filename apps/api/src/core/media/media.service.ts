import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type CreateUploadRequest,
  ERROR_CODES,
  MEDIA_FORMATS,
  MEDIA_MAX_BYTES,
  MEDIA_PURPOSES,
  type MediaAsset,
  type MediaKind,
  type MediaPurpose,
  type UploadTicket,
} from '@ruet-chottor/shared';
import type { MediaAsset as MediaRow } from '../../generated/prisma/client.js';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RateLimitService } from '../rate-limit/rate-limit.service.js';
import { CloudinaryClient, type CloudinaryResourceType } from './cloudinary.client.js';

const HOUR_MS = 60 * 60 * 1000;

export const MEDIA_RATE_LIMITS = {
  uploads: { name: 'media:uploads', limit: 60, windowSeconds: 60 * 60 },
} as const;

/** Unfinished uploads and files never attached to anything are deleted after this long. */
export const MEDIA_STALE_AFTER_MS = { pending: 2 * HOUR_MS, unattached: 24 * HOUR_MS } as const;

/**
 * Applied to images as they are stored: rotate by the camera's orientation, cap the size, and drop
 * all metadata (EXIF GPS location included), so even the original URL leaks nothing.
 */
export const IMAGE_INCOMING_TRANSFORMATION = 'a_exif/c_limit,w_2560,h_2560/fl_force_strip';

const RESOURCE_TYPE: Record<MediaKind, CloudinaryResourceType> = {
  image: 'image',
  video: 'video',
  document: 'raw',
};

const badRequest = (message: string) =>
  new BadRequestException({ code: ERROR_CODES.BAD_REQUEST, message });
const notFound = () =>
  new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'File not found.' });

/**
 * Uploads go straight from the browser to Cloudinary (ADR 0010). This service signs the upload,
 * checks the stored file afterwards, and lets content modules attach checked files to their items.
 */
@Injectable()
export class MediaService {
  private readonly folder: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryClient,
    private readonly rateLimit: RateLimitService,
    config: ConfigService<Env, true>,
  ) {
    this.folder = config.get('MEDIA_FOLDER', { infer: true });
  }

  /** Step 1: a signed permission to upload exactly one file under a fresh random name. */
  async createUpload(ownerId: string, input: CreateUploadRequest): Promise<UploadTicket> {
    this.cloudinary.assertConfigured();
    await this.rateLimit.consume(MEDIA_RATE_LIMITS.uploads, ownerId);
    await this.cleanupStale(ownerId);

    const id = randomUUID();
    const extension = input.fileName.split('.').pop()!.toLowerCase();
    // Raw files keep their extension so downloads open in the right app.
    const name = input.kind === 'document' ? `${id}.${extension}` : id;
    const publicId = `${this.folder}/${input.purpose.replace('.', '-')}/${name}`;
    await this.prisma.mediaAsset.create({
      data: { id, ownerId, kind: input.kind, purpose: input.purpose, publicId },
    });

    const params: Record<string, string> = { public_id: publicId };
    if (input.kind !== 'document') params.allowed_formats = MEDIA_FORMATS[input.kind].join(',');
    if (input.kind === 'image') params.transformation = IMAGE_INCOMING_TRANSFORMATION;
    const { uploadUrl, fields } = this.cloudinary.signUpload(RESOURCE_TYPE[input.kind], params);
    return { assetId: id, uploadUrl, fields, maxBytes: MEDIA_MAX_BYTES[input.kind] };
  }

  /** Step 2: after the browser's upload, check what Cloudinary stored before it can be used. */
  async completeUpload(ownerId: string, assetId: string): Promise<MediaAsset> {
    const asset = await this.owned(ownerId, assetId);
    if (asset.status === 'ready') return this.present(asset);

    const resourceType = RESOURCE_TYPE[asset.kind];
    const stored = await this.cloudinary.getResource(resourceType, asset.publicId);
    if (!stored) throw badRequest('The upload did not finish. Please try again.');

    const allowed = (MEDIA_FORMATS[asset.kind] as readonly string[]).includes(stored.format);
    if (!allowed || stored.bytes > MEDIA_MAX_BYTES[asset.kind]) {
      await this.cloudinary.destroy(resourceType, asset.publicId);
      await this.prisma.mediaAsset.delete({ where: { id: asset.id } });
      throw badRequest(allowed ? 'This file is too large.' : 'This file type is not allowed.');
    }

    const ready = await this.prisma.mediaAsset.update({
      where: { id: asset.id },
      data: {
        status: 'ready',
        format: stored.format,
        bytes: stored.bytes,
        width: stored.width,
        height: stored.height,
      },
    });
    return this.present(ready);
  }

  /** The uploader removed a file before saving the post. */
  async cancelUpload(ownerId: string, assetId: string): Promise<void> {
    const asset = await this.owned(ownerId, assetId);
    if (asset.contentId) throw badRequest('This file is already part of a post.');
    await this.remove([asset]);
  }

  /**
   * Makes `assetIds` (in this order) the files of one content item. Files previously attached to it
   * but no longer listed are deleted. Throws if a file is not the owner's, not ready, meant for
   * another purpose, or attached elsewhere.
   */
  async attach(
    ownerId: string,
    purpose: MediaPurpose,
    contentId: string,
    assetIds: string[],
  ): Promise<MediaAsset[]> {
    const rules = MEDIA_PURPOSES[purpose];
    if (assetIds.length > rules.maxPerItem) {
      throw badRequest(`At most ${rules.maxPerItem} files.`);
    }
    const rows = assetIds.length
      ? await this.prisma.mediaAsset.findMany({ where: { id: { in: assetIds } } })
      : [];
    for (const id of assetIds) {
      const row = rows.find((r) => r.id === id);
      const usable =
        row &&
        row.ownerId === ownerId &&
        row.status === 'ready' &&
        row.purpose === purpose &&
        (row.contentId === null || row.contentId === contentId);
      if (!usable) throw badRequest('One of the files cannot be used. Remove it and upload again.');
    }

    const current = await this.prisma.mediaAsset.findMany({ where: { purpose, contentId } });
    await this.remove(current.filter((row) => !assetIds.includes(row.id)));

    const now = new Date();
    const attached: MediaRow[] = [];
    for (const [position, id] of assetIds.entries()) {
      attached.push(
        await this.prisma.mediaAsset.update({
          where: { id },
          data: { contentId, position, attachedAt: now },
        }),
      );
    }
    return attached.map((row) => this.present(row));
  }

  /** The files of several items at once, in their saved order. */
  async forContent(
    purpose: MediaPurpose,
    contentIds: string[],
  ): Promise<Map<string, MediaAsset[]>> {
    const result = new Map<string, MediaAsset[]>();
    if (contentIds.length === 0 || !this.cloudinary.isConfigured) return result;
    const rows = await this.prisma.mediaAsset.findMany({
      where: { purpose, contentId: { in: contentIds }, status: 'ready' },
    });
    for (const row of rows.sort((a, b) => a.position - b.position)) {
      const list = result.get(row.contentId!) ?? [];
      list.push(this.present(row));
      result.set(row.contentId!, list);
    }
    return result;
  }

  /** Deletes every file of a content item, e.g. when its author deletes it. */
  async releaseContent(purpose: MediaPurpose, contentId: string): Promise<void> {
    await this.remove(await this.prisma.mediaAsset.findMany({ where: { purpose, contentId } }));
  }

  /** Deletes the owner's abandoned uploads (run before each new upload, so no scheduler is needed). */
  async cleanupStale(ownerId: string): Promise<void> {
    const now = Date.now();
    const rows = await this.prisma.mediaAsset.findMany({ where: { ownerId, contentId: null } });
    await this.remove(
      rows.filter(
        (row) =>
          now - row.createdAt.getTime() >
          (row.status === 'pending'
            ? MEDIA_STALE_AFTER_MS.pending
            : MEDIA_STALE_AFTER_MS.unattached),
      ),
    );
  }

  private async owned(ownerId: string, assetId: string): Promise<MediaRow> {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: assetId } });
    // Someone else's file looks the same as a missing one.
    if (!asset || asset.ownerId !== ownerId) throw notFound();
    return asset;
  }

  private async remove(rows: MediaRow[]): Promise<void> {
    if (rows.length === 0) return;
    await Promise.all(
      rows.map((row) => this.cloudinary.destroy(RESOURCE_TYPE[row.kind], row.publicId)),
    );
    await this.prisma.mediaAsset.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
  }

  private present(row: MediaRow): MediaAsset {
    const type = RESOURCE_TYPE[row.kind];
    const url = (transformation?: string) =>
      this.cloudinary.deliveryUrl(type, row.publicId, transformation);
    return {
      id: row.id,
      kind: row.kind,
      format: row.format ?? '',
      bytes: row.bytes ?? 0,
      width: row.width,
      height: row.height,
      // The CDN picks the format and quality per device; large originals are scaled down.
      url:
        row.kind === 'image'
          ? url('f_auto,q_auto,c_limit,w_1600')
          : row.kind === 'video'
            ? url('f_auto,q_auto,c_limit,w_1280')
            : url(),
      thumbnailUrl:
        row.kind === 'image'
          ? url('f_auto,q_auto,c_fill,w_480,h_320')
          : row.kind === 'video'
            ? `${url('so_0,f_jpg,q_auto,c_fill,w_480,h_320')}.jpg`
            : null,
    };
  }
}
