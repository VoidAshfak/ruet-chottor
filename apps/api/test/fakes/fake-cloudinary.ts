import { ServiceUnavailableException } from '@nestjs/common';
import {
  type CloudinaryResource,
  type CloudinaryResourceType,
  signParams,
} from '../../src/core/media/cloudinary.client.js';

/**
 * Stands in for Cloudinary: `uploaded` plays the role of the files the browser sent.
 * Tests put a file there to simulate a finished upload.
 */
export class FakeCloudinary {
  configured = true;
  uploaded = new Map<string, CloudinaryResource>();
  destroyed: string[] = [];

  get isConfigured() {
    return this.configured;
  }

  assertConfigured() {
    if (!this.configured) {
      throw new ServiceUnavailableException({
        code: 'SERVICE_UNAVAILABLE',
        message: 'File uploads are not available right now.',
      });
    }
  }

  signUpload(resourceType: CloudinaryResourceType, params: Record<string, string>) {
    const signed = { ...params, timestamp: '1700000000' };
    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/demo/${resourceType}/upload`,
      fields: { ...signed, api_key: 'key', signature: signParams(signed, 'secret') },
    };
  }

  async getResource(_type: CloudinaryResourceType, publicId: string) {
    return this.uploaded.get(publicId) ?? null;
  }

  async destroy(_type: CloudinaryResourceType, publicId: string) {
    this.destroyed.push(publicId);
    this.uploaded.delete(publicId);
  }

  deliveryUrl(resourceType: CloudinaryResourceType, publicId: string, transformation?: string) {
    return ['https://res.cloudinary.com/demo', resourceType, 'upload', transformation, publicId]
      .filter(Boolean)
      .join('/');
  }
}
