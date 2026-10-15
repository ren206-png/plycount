import { describe, expect, it } from 'vitest'
import { captchaOptions, captchaRequired } from './turnstile'

describe('captchaRequired', () => {
  it('is off without a site key, on with one', () => {
    expect(captchaRequired('')).toBe(false)
    expect(captchaRequired('0x4AAAAAAAexample')).toBe(true)
  })
})

describe('captchaOptions', () => {
  it('passes the token through as captchaToken', () => {
    expect(captchaOptions('abc123')).toEqual({ captchaToken: 'abc123' })
  })

  it('adds nothing when there is no token', () => {
    expect(captchaOptions(null)).toEqual({})
    expect(captchaOptions(undefined)).toEqual({})
    expect(captchaOptions('')).toEqual({})
  })
})
