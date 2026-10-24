import { describe, expect, it } from 'vitest'
import { cleanCode, isCompleteCode, mfaLoginUrl, needsSecondStep, verifiedFactorCount } from './mfa'

const verified = { factor_type: 'totp', status: 'verified' }
const unfinished = { factor_type: 'totp', status: 'unverified' }

describe('needsSecondStep', () => {
  it('asks for the code when two-step sign-in is on and the session is password-only', () => {
    expect(needsSecondStep({ factors: [verified], currentLevel: 'aal1' })).toBe(true)
  })

  it('lets the person in once the code has been entered', () => {
    expect(needsSecondStep({ factors: [verified], currentLevel: 'aal2' })).toBe(false)
  })

  it('never blocks an account that has not turned it on', () => {
    expect(needsSecondStep({ factors: [], currentLevel: 'aal1' })).toBe(false)
    expect(needsSecondStep({ factors: null, currentLevel: 'aal1' })).toBe(false)
    expect(needsSecondStep({ factors: undefined, currentLevel: undefined })).toBe(false)
  })

  it('does not lock anyone out because of a setup they started but never finished', () => {
    expect(needsSecondStep({ factors: [unfinished], currentLevel: 'aal1' })).toBe(false)
  })

  it('treats an unknown level as password-only', () => {
    expect(needsSecondStep({ factors: [verified], currentLevel: null })).toBe(true)
  })
})

describe('verifiedFactorCount', () => {
  it('counts only finished authenticator-app factors', () => {
    expect(verifiedFactorCount([verified, unfinished, { factor_type: 'phone', status: 'verified' }])).toBe(1)
    expect(verifiedFactorCount(undefined)).toBe(0)
  })
})

describe('cleanCode', () => {
  it('keeps digits only, at most six', () => {
    expect(cleanCode('123 456')).toBe('123456')
    expect(cleanCode('12-34-56-78')).toBe('123456')
    expect(cleanCode('abc')).toBe('')
  })

  it('only a full six digits is complete', () => {
    expect(isCompleteCode('123456')).toBe(true)
    expect(isCompleteCode('12345')).toBe(false)
    expect(isCompleteCode('12345a')).toBe(false)
  })
})

describe('mfaLoginUrl', () => {
  it('sends them to the code step and remembers where they were going', () => {
    expect(mfaLoginUrl('/dashboard/quotes')).toBe('/login?mfa=1&redirect=%2Fdashboard%2Fquotes')
    expect(mfaLoginUrl('/')).toBe('/login?mfa=1')
  })
})
