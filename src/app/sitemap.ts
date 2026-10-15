import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

// Only the public landing page is meant to be found in search. The app itself
// (dashboard, portal, login) is private and marked noindex.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE_URL, lastModified: new Date(), changeFrequency: 'monthly', priority: 1 }]
}
