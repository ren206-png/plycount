import type { MetadataRoute } from 'next'
import { SITE_NAME } from '@/lib/site'

// Lets phones install PlyCount to the home screen with its own icon and a
// full-screen window.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: 'Contract pricing and live margin for paper converters.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0a0c0b',
    theme_color: '#1c4130',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  }
}
