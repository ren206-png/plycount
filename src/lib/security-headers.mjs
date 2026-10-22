// ============================================================
// Browser-side protections sent with every response (see next.config.mjs).
//
//   X-Frame-Options / frame-ancestors   no other site can put PlyCount in a frame
//                                        (clickjacking)
//   X-Content-Type-Options              the browser may not guess file types
//   Referrer-Policy                     other sites see only our origin, never a path
//   Permissions-Policy                  camera, microphone, location, payment and
//                                        USB are switched off for this site
//   Content-Security-Policy             scripts, connections and frames may only
//                                        come from PlyCount itself, your own Supabase
//                                        project, and Cloudflare's Turnstile check
//
// The policy is deliberately specific: no wildcard script sources. It still
// allows inline scripts and styles because Next.js writes some of its own inline;
// tightening that needs per-request nonces, a bigger change. The CSP is not
// applied to /api responses (JSON and PDFs): it only governs pages, and a CSP on
// a PDF can stop the browser's built-in viewer.
//
// Plain .mjs so next.config.mjs can import it directly.
// ============================================================

const TURNSTILE = 'https://challenges.cloudflare.com'

function origin(url) {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/**
 * @param {{ isProd?: boolean, supabaseUrl?: string, sentryDsn?: string }} [opts]
 */
export function contentSecurityPolicy({ isProd = true, supabaseUrl, sentryDsn } = {}) {
  const supabase = (supabaseUrl && origin(supabaseUrl)) || 'https://*.supabase.co'
  const supabaseWs = supabase.replace(/^https:/, 'wss:')

  // Error reports go to Sentry once a DSN is configured.
  const sentryHost = sentryDsn ? origin(sentryDsn) : null
  const sentry = sentryHost ? [sentryHost] : []

  const directives = {
    'default-src': ["'self'"],
    // React's development build needs eval; the production build never does.
    'script-src': ["'self'", "'unsafe-inline'", ...(isProd ? [] : ["'unsafe-eval'"]), TURNSTILE],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", supabase, supabaseWs, TURNSTILE, ...sentry],
    'frame-src': [TURNSTILE],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'object-src': ["'none'"],
  }

  const parts = Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`)
  if (isProd) parts.push('upgrade-insecure-requests')
  return parts.join('; ')
}

export function securityHeaders() {
  return [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ]
}
