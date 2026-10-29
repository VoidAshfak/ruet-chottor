import {
  type LoginRequest,
  otpChallengeSchema,
  type SessionUser,
  sessionResponseSchema,
  type SignupRequest,
  signupResponseSchema,
} from '@ruet-chottor/shared';
import { z } from 'zod';
import { ApiError, apiRequest } from '@/lib/api-client';

export const authApi = {
  signup: (body: SignupRequest) =>
    apiRequest('/auth/signup', signupResponseSchema, { method: 'POST', body }),

  login: (body: LoginRequest) =>
    apiRequest('/auth/login', otpChallengeSchema, { method: 'POST', body }),

  verifyOtp: (challengeId: string, code: string) =>
    apiRequest('/auth/otp/verify', sessionResponseSchema, {
      method: 'POST',
      body: { challengeId, code },
    }),

  resendOtp: (challengeId: string) =>
    apiRequest('/auth/otp/resend', otpChallengeSchema, { method: 'POST', body: { challengeId } }),

  logout: () => apiRequest('/auth/logout', z.undefined(), { method: 'POST' }),

  /** The logged-in user, or null when nobody is logged in. */
  async session(): Promise<SessionUser | null> {
    try {
      return (await apiRequest('/auth/session', sessionResponseSchema)).user;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        // The access token may just have expired: try the refresh token once.
        try {
          return (await apiRequest('/auth/refresh', sessionResponseSchema, { method: 'POST' }))
            .user;
        } catch {
          return null;
        }
      }
      throw error;
    }
  },
};
