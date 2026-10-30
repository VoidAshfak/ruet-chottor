import { createHash } from 'node:crypto';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ERROR_CODES } from '@ruet-chottor/shared';
import type { Env } from '../config/env.js';

export type CloudinaryResourceType = 'image' | 'video' | 'raw';

export interface CloudinaryResource {
  format: string;
  bytes: number;
  width: number | null;
  height: number | null;
}

interface Credentials {
  apiKey: string;
  apiSecret: string;
  cloudName: string;
}

/**
 * Cloudinary's signature: sort the signed parameters by name, join as `a=1&b=2`, append the API
 * secret and take the SHA-1 hex digest. `file`, `cloud_name`, `resource_type` and `api_key` are
 * never signed. https://cloudinary.com/documentation/authentication_signatures
 */
export function signParams(params: Record<string, string>, apiSecret: string): string {
  const joined = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('sha1').update(`${joined}${apiSecret}`).digest('hex');
}

export function parseCloudinaryUrl(url: string): Credentials {
  const parsed = new URL(url);
  return {
    apiKey: decodeURIComponent(parsed.username),
    apiSecret: decodeURIComponent(parsed.password),
    cloudName: parsed.hostname,
  };
}

/**
 * The few Cloudinary calls the app needs, over plain HTTPS (no SDK). Everything that needs the API
 * secret happens here, on the server.
 */
@Injectable()
export class CloudinaryClient {
  private readonly logger = new Logger(CloudinaryClient.name);
  private readonly credentials: Credentials | null;

  constructor(config: ConfigService<Env, true>) {
    const url = config.get('CLOUDINARY_URL', { infer: true });
    this.credentials = url ? parseCloudinaryUrl(url) : null;
  }

  get isConfigured(): boolean {
    return this.credentials !== null;
  }

  /** Answers 503 when CLOUDINARY_URL is missing, before any other work. */
  assertConfigured(): void {
    this.require();
  }

  /** Form fields for a direct browser upload, valid for one hour (Cloudinary's rule). */
  signUpload(
    resourceType: CloudinaryResourceType,
    params: Record<string, string>,
  ): { uploadUrl: string; fields: Record<string, string> } {
    const { apiKey, apiSecret, cloudName } = this.require();
    const signed = { ...params, timestamp: String(Math.floor(Date.now() / 1000)) };
    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
      fields: { ...signed, api_key: apiKey, signature: signParams(signed, apiSecret) },
    };
  }

  /** What Cloudinary actually stored, or null if nothing was uploaded under that id. */
  async getResource(
    resourceType: CloudinaryResourceType,
    publicId: string,
  ): Promise<CloudinaryResource | null> {
    const { apiKey, apiSecret, cloudName } = this.require();
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/resources/${resourceType}/upload/${publicId
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`,
      { headers: { Authorization: `Basic ${btoa(`${apiKey}:${apiSecret}`)}` } },
    );
    if (response.status === 404) return null;
    if (!response.ok) throw this.unavailable(`lookup failed with ${response.status}`);
    const body = (await response.json()) as {
      format?: string;
      bytes: number;
      width?: number;
      height?: number;
    };
    return {
      // Raw files (documents) report no format; their public id ends in the extension.
      format: (body.format ?? publicId.split('.').pop() ?? '').toLowerCase(),
      bytes: body.bytes,
      width: body.width ?? null,
      height: body.height ?? null,
    };
  }

  /** Deletes a file. Best effort: a failure is logged, not thrown. */
  async destroy(resourceType: CloudinaryResourceType, publicId: string): Promise<void> {
    if (!this.credentials) return;
    const { apiKey, apiSecret, cloudName } = this.credentials;
    const params = {
      public_id: publicId,
      invalidate: 'true',
      timestamp: String(Math.floor(Date.now() / 1000)),
    };
    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`,
        {
          method: 'POST',
          body: new URLSearchParams({
            ...params,
            api_key: apiKey,
            signature: signParams(params, apiSecret),
          }),
        },
      );
      if (!response.ok) this.logger.warn(`Could not delete ${publicId}: ${response.status}`);
    } catch (error) {
      this.logger.warn(`Could not delete ${publicId}: ${String(error)}`);
    }
  }

  /** A CDN URL with transformations, e.g. `f_auto,q_auto,c_limit,w_1600`. */
  deliveryUrl(resourceType: CloudinaryResourceType, publicId: string, transformation?: string) {
    const parts = [
      `https://res.cloudinary.com/${this.require().cloudName}`,
      resourceType,
      'upload',
    ];
    if (transformation) parts.push(transformation);
    parts.push(publicId);
    return parts.join('/');
  }

  private require(): Credentials {
    if (!this.credentials) throw this.unavailable('CLOUDINARY_URL is not set');
    return this.credentials;
  }

  private unavailable(reason: string) {
    this.logger.warn(`Media unavailable: ${reason}`);
    return new ServiceUnavailableException({
      code: ERROR_CODES.SERVICE_UNAVAILABLE,
      message: 'File uploads are not available right now.',
    });
  }
}
