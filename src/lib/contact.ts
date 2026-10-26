// ============================================================
// Contact form: validation, spam checks and the email text. Pure functions;
// the endpoint (src/app/api/contact/route.ts) does the sending.
// ============================================================
export const CONTACT_LIMITS = { name: 100, email: 200, company: 120, messageMin: 10, messageMax: 3000 } as const

export interface ContactInput {
  name: string
  email: string
  company: string
  message: string
}

export type ContactResult =
  | { ok: true; data: ContactInput }
  | { ok: false; errors: Partial<Record<keyof ContactInput, string>> }

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/

/** Single line, no control characters, trimmed (names and subjects end up in email headers). */
export function oneLine(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

export function validateContact(raw: unknown): ContactResult {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const name = oneLine(src.name, CONTACT_LIMITS.name)
  const email = oneLine(src.email, CONTACT_LIMITS.email).toLowerCase()
  const company = oneLine(src.company, CONTACT_LIMITS.company)
  // The message keeps its line breaks; only other control characters go.
  const message =
    typeof src.message === 'string'
      ? src.message.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim()
      : ''

  const errors: Partial<Record<keyof ContactInput, string>> = {}
  if (!name) errors.name = 'Please enter your name.'
  if (!EMAIL_RE.test(email)) errors.email = 'Please enter a valid email address.'
  if (message.length < CONTACT_LIMITS.messageMin) errors.message = `Please write at least ${CONTACT_LIMITS.messageMin} characters.`
  else if (message.length > CONTACT_LIMITS.messageMax) errors.message = `Please keep it under ${CONTACT_LIMITS.messageMax} characters.`

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, data: { name, email, company, message } }
}

/** The caller's address as the hosting platform reports it (first entry of x-forwarded-for). */
export function clientIp(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || headers.get('x-real-ip')?.trim() || 'unknown'
}

export function contactSubject(data: ContactInput): string {
  return `PlyCount website message from ${data.name}${data.company ? ` (${data.company})` : ''}`
}

export function contactText(data: ContactInput, ip: string): string {
  return [
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    data.company ? `Company: ${data.company}` : null,
    '',
    data.message,
    '',
    `Sent from the contact form at plycounts.com (IP ${ip}). Reply to this email to answer ${data.name}.`,
  ]
    .filter((line): line is string => line !== null)
    .join('\n')
}
