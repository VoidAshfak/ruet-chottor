import { describe, expect, it } from 'vitest';
import { checkFile } from './media-upload';

const MB = 1024 * 1024;

describe('checkFile', () => {
  it('accepts images and videos for news posts', () => {
    expect(checkFile({ name: 'Notice.JPG', size: 2 * MB }, 'news.post')).toEqual({ kind: 'image' });
    expect(checkFile({ name: 'clip.mp4', size: 40 * MB }, 'news.post')).toEqual({ kind: 'video' });
  });

  it('rejects other types and files over the limit', () => {
    expect(checkFile({ name: 'notes.pdf', size: MB }, 'news.post')).toHaveProperty('error');
    expect(checkFile({ name: 'setup.exe', size: MB }, 'news.post')).toHaveProperty('error');
    expect(checkFile({ name: 'big.png', size: 11 * MB }, 'news.post')).toEqual({
      error: 'Images can be at most 10 MB',
    });
  });
});
