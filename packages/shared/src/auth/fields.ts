import { z } from 'zod';
import { isCommonPassword } from './common-passwords.js';

/**
 * RUET roll: 7 digits = admission year (2) + department code (2) + serial (3), e.g. 1703103.
 * Department codes are not checked here; `users/departments.ts` maps them to names.
 */
export const rollSchema = z
  .string()
  .trim()
  .regex(/^\d{7}$/, 'Roll must be 7 digits, e.g. 1703103');

/** Registration number printed on the RUET ID card. Digits only. */
export const registrationNoSchema = z
  .string()
  .trim()
  .regex(/^\d{3,12}$/, 'Registration number must be 3 to 12 digits');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address').max(254));

/**
 * Bangladeshi mobile number. Accepts `01XXXXXXXXX`, `+8801XXXXXXXXX` or `8801XXXXXXXXX`
 * (spaces and dashes ignored) and normalises to `+8801XXXXXXXXX`.
 */
export const phoneSchema = z
  .string()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .pipe(
    z
      .string()
      .regex(
        /^(?:\+?88)?01[3-9]\d{8}$/,
        'Enter a Bangladeshi mobile number, 11 digits starting with 01',
      ),
  )
  .transform((value) => `+880${value.slice(-10)}`);

export const MIN_AGE = 15;
export const MAX_AGE = 100;

/** Whole years between a `YYYY-MM-DD` birth date and `today`. */
export function ageOn(dateOfBirth: string, today: Date): number {
  const [year, month, day] = dateOfBirth.split('-').map(Number) as [number, number, number];
  let age = today.getUTCFullYear() - year;
  const beforeBirthday =
    today.getUTCMonth() + 1 < month ||
    (today.getUTCMonth() + 1 === month && today.getUTCDate() < day);
  if (beforeBirthday) age -= 1;
  return age;
}

/** `YYYY-MM-DD`. Never shown publicly (CLAUDE.md §6). */
export const dateOfBirthSchema = z.iso.date('Enter a date as YYYY-MM-DD').refine((value) => {
  const age = ageOn(value, new Date());
  return age >= MIN_AGE && age <= MAX_AGE;
}, `Age must be between ${MIN_AGE} and ${MAX_AGE}`);

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** Length and common-password rules. Context checks (not your roll) live in signupRequestSchema. */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`)
  .refine((value) => !isCommonPassword(value), 'This password is too common. Choose another one');

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(80, 'Name must be at most 80 characters');

/** 6-digit one-time login code. */
export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'The code has 6 digits');
