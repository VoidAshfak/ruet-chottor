import { describe, expect, it } from 'vitest';
import { createUploadRequestSchema, mediaKindOf } from './schemas.js';

describe('media schemas', () => {
  it('works out the kind from the extension', () => {
    expect(mediaKindOf('Photo.JPEG')).toBe('image');
    expect(mediaKindOf('lecture.mp4')).toBe('video');
    expect(mediaKindOf('notes.pdf')).toBe('document');
    expect(mediaKindOf('virus.exe')).toBeNull();
    expect(mediaKindOf('no-extension')).toBeNull();
  });

  it('only signs what the purpose allows, matching the extension, within the size limit', () => {
    const ok = { purpose: 'news.post', kind: 'image', fileName: 'a.png', bytes: 1000 };
    expect(createUploadRequestSchema.safeParse(ok).success).toBe(true);
    expect(createUploadRequestSchema.safeParse({ ...ok, fileName: 'a.mp4' }).success).toBe(false);
    expect(
      createUploadRequestSchema.safeParse({ ...ok, kind: 'document', fileName: 'a.pdf' }).success,
    ).toBe(false);
    expect(createUploadRequestSchema.safeParse({ ...ok, bytes: 20 * 1024 * 1024 }).success).toBe(
      false,
    );
  });
});
