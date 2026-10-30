import type { NextConfig } from 'next';

const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1').origin;
// Socket.IO upgrades to a WebSocket on the API's origin (chat).
const socketOrigin = apiOrigin.replace(/^http/, 'ws');
const isDev = process.env.NODE_ENV !== 'production';

/**
 * Content Security Policy: which hosts the page may talk to. Inline scripts stay allowed because
 * Next.js needs them and nonces would make every page dynamic (Cache Components); the host lists,
 * `frame-ancestors` and `object-src` still block injected third-party scripts, framing and plugins.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // Cloudinary serves every uploaded image and video (ADR 0010).
  "img-src 'self' data: blob: https://res.cloudinary.com",
  "media-src 'self' https://res.cloudinary.com",
  "font-src 'self'",
  // The API, its socket, and direct uploads to Cloudinary.
  `connect-src 'self' ${apiOrigin} ${socketOrigin} https://api.cloudinary.com${isDev ? ' ws://localhost:*' : ''}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
