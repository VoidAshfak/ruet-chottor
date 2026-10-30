import { describe, expect, it } from 'vitest';
import { parseCloudinaryUrl, signParams } from './cloudinary.client.js';

describe('signParams', () => {
  // The worked examples from https://cloudinary.com/documentation/authentication_signatures
  it('matches Cloudinary’s documented example', () => {
    expect(
      signParams(
        {
          timestamp: '1315060510',
          public_id: 'sample_image',
          eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop',
        },
        'abcd',
      ),
    ).toBe('bfd09f95f331f558cbd1320e67aa8d488770583e');
    expect(signParams({ timestamp: '1315060510' }, 'abcd')).toBe(
      'a21ad0f63beb4de2e5575204b79ab90bffb02c10',
    );
  });
});

describe('parseCloudinaryUrl', () => {
  it('reads key, secret and cloud name', () => {
    expect(parseCloudinaryUrl('cloudinary://123456:s3cr%2Bt@my-cloud')).toEqual({
      apiKey: '123456',
      apiSecret: 's3cr+t',
      cloudName: 'my-cloud',
    });
  });
});
