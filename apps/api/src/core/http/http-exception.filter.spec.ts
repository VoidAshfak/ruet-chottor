import { ConflictException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { toErrorResponse } from './http-exception.filter.js';

describe('toErrorResponse', () => {
  it('maps a known status to its error code', () => {
    expect(toErrorResponse(new NotFoundException('No such club.'))).toEqual({
      status: 404,
      body: { error: { code: 'NOT_FOUND', message: 'No such club.' } },
    });
  });

  it('keeps a custom code thrown by a module', () => {
    const error = new ConflictException({
      code: 'ROLL_TAKEN',
      message: 'Roll already registered.',
    });
    expect(toErrorResponse(error).body).toEqual({
      error: { code: 'ROLL_TAKEN', message: 'Roll already registered.' },
    });
  });

  it('hides details of unexpected errors', () => {
    const { status, body } = toErrorResponse(new Error('connection string leaked'));
    expect(status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).not.toContain('leaked');
  });

  it('hides details of 5xx HttpExceptions', () => {
    const { body } = toErrorResponse(new HttpException('db down', HttpStatus.SERVICE_UNAVAILABLE));
    expect(body.error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong. Please try again.',
    });
  });
});
