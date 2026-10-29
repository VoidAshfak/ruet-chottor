import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { ERROR_CODES } from '@ruet-chottor/shared';
import type { z } from 'zod';

/**
 * Validates a request part with a shared Zod schema: `@Body(new ZodValidationPipe(schema))`.
 * Returns the parsed (trimmed, normalised) value, so services never see raw input.
 */
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    const issue = result.error.issues[0];
    const field = issue?.path.join('.');
    const message = issue
      ? field
        ? `${field}: ${issue.message}`
        : issue.message
      : 'Invalid input';
    throw new BadRequestException({ code: ERROR_CODES.VALIDATION_FAILED, message });
  }
}
