import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeCloudinary } from '../../../test/fakes/fake-cloudinary.js';
import { FakePrisma } from '../../../test/fakes/fake-prisma.js';
import type { Env } from '../config/env.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RateLimitService } from '../rate-limit/rate-limit.service.js';
import type { CloudinaryClient } from './cloudinary.client.js';
import { MEDIA_STALE_AFTER_MS, MediaService } from './media.service.js';

const OWNER = '0190f0e0-0000-7000-8000-000000000001';
const OTHER = '0190f0e0-0000-7000-8000-000000000002';
const POST = '0190f0e0-0000-7000-8000-0000000000a1';

describe('MediaService', () => {
  let prisma: FakePrisma;
  let cloudinary: FakeCloudinary;
  let media: MediaService;

  beforeEach(() => {
    prisma = new FakePrisma();
    cloudinary = new FakeCloudinary();
    media = new MediaService(
      prisma as unknown as PrismaService,
      cloudinary as unknown as CloudinaryClient,
      { consume: async () => {} } as unknown as RateLimitService,
      { get: () => 'ruet-chottor/test' } as unknown as ConfigService<Env, true>,
    );
  });

  /** Signs, "uploads" and checks one image, like the browser flow. */
  const readyImage = async (ownerId = OWNER) => {
    const ticket = await media.createUpload(ownerId, {
      purpose: 'news.post',
      kind: 'image',
      fileName: 'photo.jpg',
      bytes: 1000,
    });
    cloudinary.uploaded.set(ticket.fields.public_id!, {
      format: 'jpg',
      bytes: 1000,
      width: 800,
      height: 600,
    });
    return media.completeUpload(ownerId, ticket.assetId);
  };

  it('signs one random file name in the environment folder, limited to image formats', async () => {
    const ticket = await media.createUpload(OWNER, {
      purpose: 'news.post',
      kind: 'image',
      fileName: 'photo.png',
      bytes: 1000,
    });
    expect(ticket.fields.public_id).toBe(`ruet-chottor/test/news-post/${ticket.assetId}`);
    expect(ticket.fields.allowed_formats).toContain('webp');
    expect(ticket.fields.signature).toMatch(/^[0-9a-f]{40}$/);
    // Location data is stripped from the stored original, not only from delivered copies.
    expect(ticket.fields.transformation).toContain('fl_force_strip');
  });

  it('attaches files in order and replaces ones that were removed', async () => {
    const [a, b, c] = [await readyImage(), await readyImage(), await readyImage()];
    expect((await media.attach(OWNER, 'news.post', POST, [b.id, a.id])).map((m) => m.id)).toEqual([
      b.id,
      a.id,
    ]);
    await media.attach(OWNER, 'news.post', POST, [c.id, b.id]);
    expect((await media.forContent('news.post', [POST])).get(POST)?.map((m) => m.id)).toEqual([
      c.id,
      b.id,
    ]);
    expect(prisma.mediaAssets.find((m) => m.id === a.id)).toBeUndefined();
    expect(cloudinary.destroyed).toHaveLength(1);
  });

  it('refuses files of another member, unfinished uploads and too many files', async () => {
    const theirs = await readyImage(OTHER);
    await expect(media.attach(OWNER, 'news.post', POST, [theirs.id])).rejects.toThrow(
      /cannot be used/,
    );
    const pending = await media.createUpload(OWNER, {
      purpose: 'news.post',
      kind: 'image',
      fileName: 'p.jpg',
      bytes: 10,
    });
    await expect(media.attach(OWNER, 'news.post', POST, [pending.assetId])).rejects.toThrow(
      /cannot be used/,
    );
    const many = await Promise.all(Array.from({ length: 5 }, () => readyImage()));
    await expect(
      media.attach(
        OWNER,
        'news.post',
        POST,
        many.map((m) => m.id),
      ),
    ).rejects.toThrow(/At most 4/);
  });

  it('cleans up abandoned uploads before a new one', async () => {
    const old = await readyImage();
    prisma.mediaAssets.find((m) => m.id === old.id)!.createdAt = new Date(
      Date.now() - MEDIA_STALE_AFTER_MS.unattached - 1000,
    );
    await readyImage();
    expect(prisma.mediaAssets.map((m) => m.id)).not.toContain(old.id);
  });
});
