import { describe, expect, it } from 'vitest'
import { isPublicSeoPath } from './public-seo-paths'
import { config } from '@/middleware'

describe('isPublicSeoPath', () => {
  it('recognises the files crawlers and link previews fetch', () => {
    for (const p of ['/robots.txt', '/sitemap.xml', '/opengraph-image', '/twitter-image', '/manifest.webmanifest', '/apple-icon']) {
      expect(isPublicSeoPath(p), p).toBe(true)
    }
  })

  it('does not open up anything else', () => {
    for (const p of ['/', '/login', '/dashboard', '/dashboard/robots.txt', '/api/health', '/robots.txt.bak', '/sitemap.xml/x']) {
      expect(isPublicSeoPath(p), p).toBe(false)
    }
  })
})

describe('middleware matcher', () => {
  // Next.js matcher strings are path patterns; this one is a plain negative lookahead,
  // so it behaves the same as the equivalent anchored regular expression.
  const runs = (pathname: string) => new RegExp(`^${config.matcher[0]}$`).test(pathname)

  it('skips the public SEO files so they are never redirected to the login page', () => {
    for (const p of ['/robots.txt', '/sitemap.xml', '/opengraph-image', '/twitter-image', '/manifest.webmanifest', '/apple-icon']) {
      expect(runs(p), p).toBe(false)
    }
  })

  it('still runs on the landing page, the login page and the private app', () => {
    for (const p of ['/', '/login', '/dashboard', '/dashboard/quotes', '/pending', '/staff/join', '/api/admin/approvals']) {
      expect(runs(p), p).toBe(true)
    }
  })
})
