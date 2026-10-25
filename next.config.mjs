// Sentry 11 moved the build-time wrapper to the `/config` subpath.
import { withSentryConfig } from '@sentry/nextjs/config'
import { contentSecurityPolicy, securityHeaders } from './src/lib/security-headers.mjs'

/** @type {import('next').NextConfig} */
// The app itself (dashboard, portal, login, API) is private: tell search engines
// not to index it even if something links to it. Only the landing page (/) is public.
const PRIVATE_PATHS = ['/dashboard/:path*', '/portal/:path*', '/login', '/signup', '/forgot-password', '/reset-password', '/pending', '/staff/:path*', '/api/:path*']

const nextConfig = {
  reactStrictMode: true,
  // The browser tests build into their own folder so they never overwrite a normal build.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async headers() {
    return [
      // Browser protections on every response (framing, type sniffing, referrers, sensors).
      { source: '/:path*', headers: securityHeaders() },
      // The content security policy governs pages; API responses (JSON, PDFs) are left out.
      {
        source: '/((?!api/).*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy({
              isProd: process.env.NODE_ENV === 'production',
              supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
              sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
            }),
          },
        ],
      },
      ...PRIVATE_PATHS.map((source) => ({
        source,
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      })),
    ]
  },
}

// Sentry's build-time wrapper (source map upload, etc.) only does
// anything useful once a DSN is actually configured — with no DSN,
// sentry.*.config.ts never call Sentry.init() anyway, so skip the
// wrapper entirely rather than adding build-time behavior (and a
// noisy "no org/project configured" warning) for a feature that's
// off. SENTRY_AUTH_TOKEN is optional even when the DSN is set: it
// only gates source map upload for readable stack traces, not error
// capture itself.
export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      disableLogger: true,
      widenClientFileUpload: false,
    })
  : nextConfig
