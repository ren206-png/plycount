import { describe, expect, it } from 'vitest'
import { generateSku, inferProductType, skuBase } from './sku'

describe('skuBase', () => {
  it('reads as type, ply and pack count', () => {
    expect(skuBase({ type: 'bath_tissue', ply: 2, packQty: 96 })).toBe('BT2-96')
    expect(skuBase({ type: 'paper_towel', ply: 1, packQty: 6 })).toBe('PT1-6')
    expect(skuBase({ type: 'napkin', ply: 2, packQty: 3000 })).toBe('NK2-3000')
  })

  it('leaves out what was not entered', () => {
    expect(skuBase({ type: 'bath_tissue', packQty: 96 })).toBe('BT-96')
    expect(skuBase({ type: 'bath_tissue', ply: 2 })).toBe('BT2')
    expect(skuBase({ type: 'other' })).toBe('PR')
    expect(skuBase({ type: 'facial_tissue', ply: 0, packQty: -4 })).toBe('FT')
    expect(skuBase({ type: 'facial_tissue', ply: null, packQty: Number.NaN })).toBe('FT')
  })

  it('ignores decimals', () => {
    expect(skuBase({ type: 'bath_tissue', ply: 2.7, packQty: 96.2 })).toBe('BT2-96')
  })
})

describe('generateSku', () => {
  const spec = { type: 'bath_tissue' as const, ply: 2, packQty: 96 }

  it('starts at 001', () => {
    expect(generateSku(spec, [])).toBe('BT2-96-001')
  })

  it('takes the next free number for the same shape', () => {
    expect(generateSku(spec, ['BT2-96-001'])).toBe('BT2-96-002')
    expect(generateSku(spec, ['BT2-96-001', 'BT2-96-002', 'PT1-6-001'])).toBe('BT2-96-003')
  })

  it('fills a gap, and ignores case and spaces when checking', () => {
    expect(generateSku(spec, ['bt2-96-001 ', 'BT2-96-003'])).toBe('BT2-96-002')
  })

  it('does not collide with other shapes', () => {
    expect(generateSku(spec, ['BT2-48-001', 'BT3-96-001'])).toBe('BT2-96-001')
  })
})

describe('inferProductType', () => {
  it('guesses from the product name', () => {
    expect(inferProductType('2-Ply Standard Bath Tissue')).toBe('bath_tissue')
    expect(inferProductType('Hardwound Paper Towel')).toBe('paper_towel')
    expect(inferProductType('Dinner Napkin 2-ply')).toBe('napkin')
    expect(inferProductType('Facial Tissue Box')).toBe('facial_tissue')
    expect(inferProductType('Toilet paper jumbo roll')).toBe('bath_tissue')
    expect(inferProductType('Kitchen roll')).toBe('other')
    expect(inferProductType('')).toBe('other')
  })

  it('prefers the more specific word', () => {
    expect(inferProductType('Facial tissue')).toBe('facial_tissue')
    expect(inferProductType('Paper towel tissue wrap')).toBe('paper_towel')
  })
})
