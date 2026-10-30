import { Body, Controller, Delete, HttpCode, Param, Post } from '@nestjs/common';
import {
  type CreateUploadRequest,
  createUploadRequestSchema,
  type MediaAsset,
  mediaAssetIdParamSchema,
  type UploadTicket,
} from '@ruet-chottor/shared';
import type { Principal } from '../auth/access-token.store.js';
import { CurrentUser } from '../auth/decorators.js';
import { ZodValidationPipe } from '../http/zod-validation.pipe.js';
import { MediaService } from './media.service.js';

/**
 * Direct-to-Cloudinary uploads (ADR 0010). Logged-in members only. Attaching a file to content
 * happens inside each content module, through MediaService.
 */
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('uploads')
  createUpload(
    @CurrentUser() principal: Principal,
    @Body(new ZodValidationPipe(createUploadRequestSchema)) body: CreateUploadRequest,
  ): Promise<UploadTicket> {
    return this.media.createUpload(principal.userId, body);
  }

  @Post('uploads/:id/complete')
  @HttpCode(200)
  complete(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(mediaAssetIdParamSchema)) params: { id: string },
  ): Promise<MediaAsset> {
    return this.media.completeUpload(principal.userId, params.id);
  }

  @Delete('uploads/:id')
  @HttpCode(204)
  cancel(
    @CurrentUser() principal: Principal,
    @Param(new ZodValidationPipe(mediaAssetIdParamSchema)) params: { id: string },
  ): Promise<void> {
    return this.media.cancelUpload(principal.userId, params.id);
  }
}
