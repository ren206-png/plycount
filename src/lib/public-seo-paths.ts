// ============================================================
// Files that search engines and link previews fetch with no login:
// robots.txt, sitemap.xml and the generated social images. The sign-in
// gate in src/middleware.ts must never redirect these to /login, or Google
// cannot read the sitemap and shared links show no preview image.
// ============================================================
export function isPublicSeoPath(pathname: string): boolean {
  return (
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/opengraph-image' ||
    pathname === '/twitter-image' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/apple-icon' ||
    pathname.startsWith('/opengraph-image/') ||
    pathname.startsWith('/twitter-image/')
  )
}
