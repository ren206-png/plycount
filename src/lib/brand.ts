// ============================================================
// The PlyCount logo mark, in one place.
//
// A "P" whose bowl is three nested plies, on a deep-green tile. This function
// is the single source: React components render it inline, the app icon and
// social image embed it, and public/brand/plycount-mark.svg and
// src/app/icon.svg are generated from it (brand.test.ts fails if they drift).
//
// `uid` keeps gradient ids unique when several marks are on one page.
// ============================================================
export const BRAND = {
  tileFrom: '#2a6a4d',
  tileTo: '#0d261b',
  plyFrom: '#f8d896',
  plyTo: '#e8a247',
} as const

export function markSvg(uid = 'pc', size = 64, square = false): string {
  const tile = `${uid}-tile`
  const ply = `${uid}-ply`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">` +
    `<defs>` +
    `<linearGradient id="${tile}" x1="8" y1="4" x2="56" y2="62" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="${BRAND.tileFrom}"/><stop offset="1" stop-color="${BRAND.tileTo}"/></linearGradient>` +
    `<linearGradient id="${ply}" x1="0" y1="14" x2="0" y2="50" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="${BRAND.plyFrom}"/><stop offset="1" stop-color="${BRAND.plyTo}"/></linearGradient>` +
    `</defs>` +
    `<rect width="64" height="64" rx="${square ? 0 : 15}" fill="url(#${tile})"/>` +
    (square
      ? ''
      : `<rect x="0.75" y="0.75" width="62.5" height="62.5" rx="14.25" fill="none" stroke="#ffffff" stroke-opacity="0.14" stroke-width="1.5"/>`) +
    `<g fill="none" stroke="url(#${ply})" stroke-linejoin="round">` +
    `<path d="M22 17H33.5a11.5 11.5 0 0 1 0 23H22" stroke-width="2.8"/>` +
    `<path d="M22 21.3H33.5a7.2 7.2 0 0 1 0 14.4H22" stroke-width="2.8" stroke-opacity="0.72"/>` +
    `<path d="M22 25.6H33.5a2.9 2.9 0 0 1 0 5.8H22" stroke-width="2.8" stroke-opacity="0.46"/>` +
    `</g>` +
    `<rect x="18" y="15.6" width="6.5" height="34.4" rx="3.25" fill="url(#${ply})"/>` +
    `</svg>`
  )
}

/** For places that need an image URL rather than markup (ImageResponse, manifests). */
export function markDataUri(size = 64, square = false): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(markSvg('pc', size, square))}`
}
