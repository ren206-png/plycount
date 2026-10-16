import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { markDataUri, markSvg } from './brand'

const file = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('PlyCount logo', () => {
  it('keeps the published logo files identical to the code that draws it', () => {
    expect(file('public/brand/plycount-mark.svg')).toBe(markSvg('pc', 64) + '\n')
    expect(file('src/app/icon.svg')).toBe(markSvg('pc', 64) + '\n')
  })

  it('gives each mark on a page its own gradient ids', () => {
    expect(markSvg('a')).toContain('id="a-tile"')
    expect(markSvg('b')).toContain('id="b-tile"')
    expect(markSvg('a')).not.toContain('id="b-tile"')
  })

  it('has a full-bleed square version for app icons', () => {
    expect(markSvg('pc', 180, true)).toContain('rx="0"')
    expect(markSvg('pc', 64, false)).toContain('rx="15"')
  })

  it('can be embedded as an image URL', () => {
    expect(markDataUri(64)).toMatch(/^data:image\/svg\+xml;utf8,%3Csvg/)
  })
})
