import { ImageResponse } from 'next/og'
import { markDataUri } from '@/lib/brand'

// Home-screen icon for iPhone and iPad ("Add to Home Screen"). iOS rounds the
// corners itself, so this one is a full-bleed square.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <img src={markDataUri(180, true)} width={180} height={180} alt="" />
    ),
    { ...size }
  )
}
