import { ImageResponse } from 'next/og'

// Social preview card (1200x630) used by Open Graph and Twitter/X link previews.
export const alt = 'PlyCount: contract pricing and live margin for paper converters'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: '#1c4130',
          color: '#ffffff',
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 700, color: '#e3ebe6', marginBottom: 32 }}>PlyCount</div>
        <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1, maxWidth: 980 }}>
          Contract pricing software for paper converters
        </div>
        <div style={{ fontSize: 34, color: '#e3ebe6', marginTop: 36, maxWidth: 940 }}>
          The right price for every customer, SKU and quantity, with live margin on every quote.
        </div>
      </div>
    ),
    { ...size }
  )
}
