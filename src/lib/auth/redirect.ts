// ============================================================
// Post-login redirect validation. The login page honors a
// ?redirect= query param (set by the middleware when it bounces
// an unauthenticated visitor), but that param is attacker-
// controllable: a link like /login?redirect=https://evil.example
// would otherwise send a freshly signed-in user off-site to a
// phishing page. Only same-site paths are allowed through.
// ============================================================
export function safeRedirectPath(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (!raw) return fallback
  // Must be a path on this site: a single leading "/" (not "//", which is
  // protocol-relative), no backslashes (browsers treat "/\host" like
  // "//host"), and no control characters.
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback
  if (raw.includes('\\') || /[\u0000-\u001f\u007f]/.test(raw)) return fallback
  return raw
}
