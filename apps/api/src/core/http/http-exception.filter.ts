import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { type ApiErrorBody, ERROR_CODES, type ErrorCode } from '@ruet-chottor/shared';
import type { Response } from 'express';

const CODE_BY_STATUS: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ERROR_CODES.BAD_REQUEST,
  [HttpStatus.UNAUTHORIZED]: ERROR_CODES.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ERROR_CODES.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ERROR_CODES.NOT_FOUND,
  [HttpStatus.CONFLICT]: ERROR_CODES.CONFLICT,
  [HttpStatus.UNPROCESSABLE_ENTITY]: ERROR_CODES.VALIDATION_FAILED,
  [HttpStatus.TOO_MANY_REQUESTS]: ERROR_CODES.RATE_LIMITED,
};

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

/** Turns every error into `{ error: { code, message } }` (CLAUDE.md §11). */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = toErrorResponse(exception);
    if (status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }
    response.status(status).json(body);
  }
}

export function toErrorResponse(exception: unknown): { status: number; body: ApiErrorBody } {
  if (!(exception instanceof HttpException)) {
    // Never leak internal error details to clients.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { error: { code: ERROR_CODES.INTERNAL_ERROR, message: GENERIC_MESSAGE } },
    };
  }

  const status = exception.getStatus();
  const res = exception.getResponse();
  const custom = typeof res === 'object' && res !== null ? (res as Record<string, unknown>) : {};

  let code: string;
  if (typeof custom.code === 'string') code = custom.code;
  else if (status >= 500) code = ERROR_CODES.INTERNAL_ERROR;
  else code = CODE_BY_STATUS[status] ?? ERROR_CODES.BAD_REQUEST;

  let message: string;
  if (status >= 500) message = GENERIC_MESSAGE;
  else if (typeof custom.message === 'string') message = custom.message;
  else message = exception.message;

  return { status, body: { error: { code, message } } };
}
