import { describe, expect, it } from 'vitest'
import { contentSecurityPolicy, securityHeaders } from './security-headers.mjs'

const SUPABASE = 'https://abcdefgh.supabase.co'
const csp = (o = {}) => contentSecurityPolicy({ isProd: true, supabaseUrl: SUPABASE, ...o })
const directive = (policy: string, name: string) =>
  policy.split('; ').find((d) => d.startsWith(`${name} `))?.slice(name.length + 1).split(' ') ?? []

describe('content security policy', () => {
  it('lets pages talk only to PlyCount, the Supabase project and Cloudflare Turnstile', () => {
    const p = csp()
    expect(directive(p, 'connect-src')).toEqual(["'self'", SUPABASE, 'wss://abcdefgh.supabase.co', 'https://challenges.cloudflare.com'])
    expect(directive(p, 'frame-src')).toEqual(['https://challenges.cloudflare.com'])
    expect(directive(p, 'script-src')).toContain('https://challenges.cloudflare.com')
  })

  it('has no wildcard or scheme-wide script source', () => {
    for (const s of directive(csp(), 'script-src')) {
      expect(s, s).not.toBe('*')
      expect(s, s).not.toBe('https:')
      expect(s, s).not.toBe('data:')
      expect(s).not.toContain('*')
    }
  })

  it('refuses framing, plugins, base tag tricks and foreign form posts', () => {
    const p = csp()
    expect(directive(p, 'frame-ancestors')).toEqual(["'none'"])
    expect(directive(p, 'object-src')).toEqual(["'none'"])
    expect(directive(p, 'base-uri')).toEqual(["'self'"])
    expect(directive(p, 'form-action')).toEqual(["'self'"])
    expect(directive(p, 'default-src')).toEqual(["'self'"])
  })

  it('allows eval only in development, and upgrades insecure requests only in production', () => {
    expect(directive(csp({ isProd: true }), 'script-src')).not.toContain("'unsafe-eval'")
    expect(directive(csp({ isProd: false }), 'script-src')).toContain("'unsafe-eval'")
    expect(csp({ isProd: true })).toContain('upgrade-insecure-requests')
    expect(csp({ isProd: false })).not.toContain('upgrade-insecure-requests')
  })

  it('adds the error-reporting host only once a Sentry address is configured', () => {
    expect(csp()).not.toContain('sentry')
    const withSentry = csp({ sentryDsn: 'https://key@o123.ingest.sentry.io/456' })
    expect(directive(withSentry, 'connect-src')).toContain('https://o123.ingest.sentry.io')
  })

  it('falls back to any Supabase project when the address is missing or unreadable', () => {
    expect(directive(contentSecurityPolicy({ isProd: true }), 'connect-src')).toContain('https://*.supabase.co')
    expect(directive(contentSecurityPolicy({ isProd: true, supabaseUrl: 'not a url' }), 'connect-src')).toContain('https://*.supabase.co')
  })
})

describe('the other security headers', () => {
  const h = Object.fromEntries(securityHeaders().map((x: { key: string; value: string }) => [x.key, x.value]))

  it('blocks framing and type sniffing and limits what other sites learn', () => {
    expect(h['X-Frame-Options']).toBe('DENY')
    expect(h['X-Content-Type-Options']).toBe('nosniff')
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(h['Cross-Origin-Opener-Policy']).toBe('same-origin')
  })

  it('switches off sensors and payment for the site', () => {
    for (const f of ['camera', 'microphone', 'geolocation', 'payment', 'usb']) expect(h['Permissions-Policy']).toContain(`${f}=()`)
  })
})
