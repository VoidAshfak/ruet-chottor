import { Controller, Get, Query } from '@nestjs/common';
import {
  type DirectoryPage,
  type DirectoryQuery,
  directoryQuerySchema,
} from '@ruet-chottor/shared';
import type { Principal } from '../../core/auth/access-token.store.js';
import { CurrentUser } from '../../core/auth/decorators.js';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe.js';
import { DirectoryService } from './directory.service.js';

/** Logged-in members only (global AuthGuard). */
@Controller('directory')
export class DirectoryController {
  constructor(private readonly directory: DirectoryService) {}

  @Get()
  search(
    @CurrentUser() principal: Principal,
    @Query(new ZodValidationPipe(directoryQuerySchema)) query: DirectoryQuery,
  ): Promise<DirectoryPage> {
    return this.directory.search(principal.userId, query);
  }
}
