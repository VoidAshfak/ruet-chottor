import { z } from 'zod';
import {
  dateOfBirthSchema,
  emailSchema,
  nameSchema,
  otpCodeSchema,
  passwordSchema,
  phoneSchema,
  registrationNoSchema,
  rollSchema,
} from './fields.js';

export const ROLES = [
  'student',
  'alumni',
  'teacher',
  'club_manager',
  'moderator',
  'admin',
] as const;

export type Role = (typeof ROLES)[number];

/** Lifetimes shared by the API (cookies, Redis TTLs) and the web app (countdowns). */
export const AUTH_LIMITS = {
  accessTokenSeconds: 15 * 60,
  refreshTokenDays: 30,
  otpSeconds: 5 * 60,
  otpMaxAttempts: 5,
  otpResendCooldownSeconds: 60,
  otpMaxResends: 3,
} as const;

/** POST /api/v1/auth/signup */
export const signupRequestSchema = z
  .object({
    name: nameSchema,
    roll: rollSchema,
    registrationNo: registrationNoSchema,
    email: emailSchema,
    phone: phoneSchema,
    dateOfBirth: dateOfBirthSchema,
    password: passwordSchema,
  })
  .refine((data) => !data.password.includes(data.roll), {
    path: ['password'],
    message: 'Password must not contain your roll',
  });

export type SignupRequest = z.infer<typeof signupRequestSchema>;
export type SignupInput = z.input<typeof signupRequestSchema>;

/** The logged-in user as the web app sees it. Never includes contact details or date of birth. */
export const sessionUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  roll: z.string(),
  role: z.enum(ROLES),
});

export type SessionUser = z.infer<typeof sessionUserSchema>;

export const signupResponseSchema = z.object({ user: sessionUserSchema });
export type SignupResponse = z.infer<typeof signupResponseSchema>;

/** POST /api/v1/auth/login — step 1: roll + password. */
export const loginRequestSchema = z.object({
  roll: rollSchema,
  // Only the length cap here: old accounts must still log in if the signup rules get stricter.
  password: z.string().min(1, 'Enter your password').max(128),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const OTP_CHANNELS = ['email', 'sms'] as const;

/** Step 1 succeeded: a code was sent; the client keeps `challengeId` for step 2. */
export const otpChallengeSchema = z.object({
  challengeId: z.string(),
  channel: z.enum(OTP_CHANNELS),
  /** Masked, e.g. `a•••@example.com`. */
  destination: z.string(),
  expiresInSeconds: z.number().int(),
  resendInSeconds: z.number().int(),
});

export type OtpChallenge = z.infer<typeof otpChallengeSchema>;

/** POST /api/v1/auth/otp/verify — step 2. */
export const verifyOtpRequestSchema = z.object({
  challengeId: z.string().min(1).max(100),
  code: otpCodeSchema,
});

export type VerifyOtpRequest = z.infer<typeof verifyOtpRequestSchema>;

/** POST /api/v1/auth/otp/resend */
export const resendOtpRequestSchema = z.object({
  challengeId: z.string().min(1).max(100),
});

export type ResendOtpRequest = z.infer<typeof resendOtpRequestSchema>;

/** GET /api/v1/auth/session, and the body of a successful verify/refresh. */
export const sessionResponseSchema = z.object({ user: sessionUserSchema });
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
