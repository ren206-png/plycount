import { ImageResponse } from 'next/og'
import { markDataUri } from '@/lib/brand'

// Social preview card (1200x630) used by Open Graph and Twitter/X link previews.
// Matches the dark landing page: spotlight, amber accent, and a small quote card
// (sample numbers, as on the page itself).
export const alt = 'PlyCount: contract pricing and live margin for paper converters'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'


function Row({ sku, margin, low }: { sku: string; margin: string; low?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'flex', fontSize: 20, color: '#d1d5db' }}>{sku}</div>
      <div
        style={{
          display: 'flex',
          fontSize: 20,
          fontWeight: 700,
          padding: '4px 12px',
          borderRadius: 999,
          color: low ? '#fca5a5' : '#6ee7b7',
          background: low ? 'rgba(239,68,68,0.16)' : 'rgba(16,185,129,0.16)',
        }}
      >
        {margin}
      </div>
    </div>
  )
}

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: '#0a0c0b',
          backgroundImage:
            'radial-gradient(ellipse 700px 380px at 50% -5%, rgba(52,140,100,0.55), rgba(10,12,11,0)), radial-gradient(ellipse 420px 260px at 12% 0%, rgba(240,180,90,0.30), rgba(10,12,11,0))',
          color: '#ffffff',
          padding: '72px 80px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: 640 }}>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 40, fontWeight: 700, marginBottom: 34 }}>
            <img src={markDataUri(64)} width={64} height={64} alt="" style={{ marginRight: 18 }} />
            PlyCount
          </div>
          <div style={{ display: 'flex', fontSize: 66, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1.5 }}>
            Contract pricing software for paper converters
          </div>
          <div style={{ display: 'flex', fontSize: 28, color: '#9ca3af', marginTop: 30, lineHeight: 1.35 }}>
            The right price for every customer, SKU and quantity, with live margin on every quote.
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: 380,
              padding: '26px 28px',
              borderRadius: 28,
              background: 'rgba(20,24,22,0.92)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, marginBottom: 14 }}>Quote for Northside</div>
            <Row sku="TP-2PLY-96" margin="19.4%" />
            <Row sku="PT-HWT-6" margin="28.2%" />
            <Row sku="NK-1PLY-3M" margin="9.9%" low />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', fontSize: 15, color: '#9ca3af', letterSpacing: 1 }}>QUOTE TOTAL</div>
                <div style={{ display: 'flex', fontSize: 34, fontWeight: 700 }}>$93,560</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', fontSize: 15, color: '#9ca3af', letterSpacing: 1 }}>BLENDED MARGIN</div>
                <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, color: '#6ee7b7' }}>19.6%</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
