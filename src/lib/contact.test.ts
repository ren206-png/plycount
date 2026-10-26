import { describe, expect, it } from 'vitest'
import { CONTACT_LIMITS, clientIp, contactSubject, contactText, oneLine, validateContact } from './contact'

const good = { name: 'Pat Lee', email: 'Pat@Example.com', company: 'Lee Paper', message: 'We would like a quote for 2-ply tissue.' }

describe('validateContact', () => {
  it('accepts a normal message and tidies it', () => {
    const r = validateContact(good)
    expect(r).toEqual({ ok: true, data: { name: 'Pat Lee', email: 'pat@example.com', company: 'Lee Paper', message: good.message } })
  })

  it('company is optional', () => {
    const r = validateContact({ ...good, company: undefined })
    expect(r.ok && r.data.company).toBe('')
  })

  it('names every problem at once', () => {
    const r = validateContact({ name: '  ', email: 'nope', message: 'short' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['email', 'message', 'name'])
  })

  it('rejects emails with spaces, commas or several addresses', () => {
    for (const email of ['a b@x.com', 'a@x.com, b@y.com', 'a@x', '@x.com', 'a@@x.com', '"a"@x.com']) {
      expect(validateContact({ ...good, email }).ok, email).toBe(false)
    }
  })

  it('caps the message length', () => {
    expect(validateContact({ ...good, message: 'x'.repeat(CONTACT_LIMITS.messageMax + 1) }).ok).toBe(false)
    expect(validateContact({ ...good, message: 'x'.repeat(CONTACT_LIMITS.messageMax) }).ok).toBe(true)
  })

  it('treats anything that is not an object as empty', () => {
    expect(validateContact(null).ok).toBe(false)
    expect(validateContact('hello').ok).toBe(false)
    expect(validateContact({ name: 5, email: {}, message: [] }).ok).toBe(false)
  })

  it('keeps line breaks in the message but strips control characters', () => {
    const r = validateContact({ ...good, message: 'line one\r\nline two\u0000 and more words' })
    expect(r.ok && r.data.message).toBe('line one\nline two and more words')
  })
})

describe('header safety', () => {
  it('a name cannot smuggle a second header line', () => {
    expect(oneLine('Pat\r\nBcc: someone@evil.test', 100)).toBe('Pat Bcc: someone@evil.test')
    const r = validateContact({ ...good, name: 'Pat\r\nBcc: x@y.com' })
    expect(r.ok && /[\r\n]/.test(contactSubject(r.data))).toBe(false)
  })
})

describe('clientIp', () => {
  const h = (m: Record<string, string>) => ({ get: (k: string) => m[k.toLowerCase()] ?? null })
  it('uses the first forwarded address', () => {
    expect(clientIp(h({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }))).toBe('203.0.113.9')
  })
  it('falls back to x-real-ip, then unknown', () => {
    expect(clientIp(h({ 'x-real-ip': '198.51.100.4' }))).toBe('198.51.100.4')
    expect(clientIp(h({}))).toBe('unknown')
  })
})

describe('email text', () => {
  it('subject names the sender and company, body carries everything needed to reply', () => {
    const r = validateContact(good)
    if (!r.ok) throw new Error('expected valid')
    expect(contactSubject(r.data)).toBe('PlyCount website message from Pat Lee (Lee Paper)')
    const text = contactText(r.data, '203.0.113.9')
    expect(text).toContain('Email: pat@example.com')
    expect(text).toContain('We would like a quote')
    expect(text).toContain('203.0.113.9')
  })
})
