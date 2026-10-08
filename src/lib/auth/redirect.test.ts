import { describe, expect, it } from 'vitest'
import { safeRedirectPath } from './redirect'

describe('safeRedirectPath', () => {
  it('falls back when there is no redirect', () => {
    expect(safeRedirectPath(null)).toBe('/dashboard')
    expect(safeRedirectPath(undefined)).toBe('/dashboard')
    expect(safeRedirectPath('')).toBe('/dashboard')
  })

  it('allows same-site paths, including query strings', () => {
    expect(safeRedirectPath('/dashboard/quotes')).toBe('/dashboard/quotes')
    expect(safeRedirectPath('/dashboard/quotes?tab=sent')).toBe('/dashboard/quotes?tab=sent')
  })

  it('rejects absolute and protocol-relative URLs', () => {
    expect(safeRedirectPath('https://evil.example')).toBe('/dashboard')
    expect(safeRedirectPath('http://evil.example/x')).toBe('/dashboard')
    expect(safeRedirectPath('//evil.example')).toBe('/dashboard')
    expect(safeRedirectPath('javascript:alert(1)')).toBe('/dashboard')
  })

  it('rejects backslash and control-character tricks', () => {
    expect(safeRedirectPath('/\\evil.example')).toBe('/dashboard')
    expect(safeRedirectPath('/\t/evil.example')).toBe('/dashboard')
    expect(safeRedirectPath('/ok\nSet-Cookie: x=1')).toBe('/dashboard')
  })

  it('honors a custom fallback', () => {
    expect(safeRedirectPath('https://evil.example', '/portal/quotes')).toBe('/portal/quotes')
  })
})
