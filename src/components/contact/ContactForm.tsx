'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AUTH_BUTTON, AUTH_INPUT, AUTH_LABEL, AUTH_LINK } from '@/components/auth/AuthShell'
import { TurnstileWidget } from '@/components/TurnstileWidget'
import { captchaRequired } from '@/lib/turnstile'
import { CONTACT_LIMITS, validateContact, type ContactInput } from '@/lib/contact'

type FieldErrors = Partial<Record<keyof ContactInput, string>>

export function ContactForm() {
  const [values, setValues] = useState<ContactInput>({ name: '', email: '', company: '', message: '' })
  const [website, setWebsite] = useState('') // hidden field: only bots fill it in
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaReset, setCaptchaReset] = useState(0)
  const captchaReady = !captchaRequired() || !!captchaToken

  function set<K extends keyof ContactInput>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    const check = validateContact(values)
    if (!check.ok) {
      setErrors(check.errors)
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, website, captchaToken }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string; fields?: FieldErrors }
      if (!res.ok) {
        if (body.fields) setErrors(body.fields)
        setFormError(body.error ?? 'Something went wrong. Please try again.')
        setCaptchaReset((n) => n + 1) // Turnstile tokens are single-use
        return
      }
      setSentTo(check.data.email)
    } catch {
      setFormError('Could not reach the server. Check your connection and try again.')
    } finally {
      setSending(false)
    }
  }

  if (sentTo) {
    return (
      <div role="status" className="text-center">
        <p className="text-lg font-semibold text-white">Thank you, your message is on its way.</p>
        <p className="mt-2 text-sm text-gray-400">We will reply to {sentTo}.</p>
        <Link href="/" className={`mt-6 inline-block text-sm ${AUTH_LINK}`}>
          Back to the home page
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div>
        <label htmlFor="contact-name" className={AUTH_LABEL}>Your name</label>
        <input id="contact-name" autoComplete="name" maxLength={CONTACT_LIMITS.name} value={values.name} onChange={(e) => set('name', e.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'contact-name-err' : undefined} className={AUTH_INPUT} />
        {errors.name && <p id="contact-name-err" className="mt-1 text-sm text-red-400">{errors.name}</p>}
      </div>
      <div>
        <label htmlFor="contact-email" className={AUTH_LABEL}>Email</label>
        <input id="contact-email" type="email" autoComplete="email" maxLength={CONTACT_LIMITS.email} value={values.email} onChange={(e) => set('email', e.target.value)} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'contact-email-err' : undefined} className={AUTH_INPUT} />
        {errors.email && <p id="contact-email-err" className="mt-1 text-sm text-red-400">{errors.email}</p>}
      </div>
      <div>
        <label htmlFor="contact-company" className={AUTH_LABEL}>Company <span className="font-normal text-gray-500">(optional)</span></label>
        <input id="contact-company" autoComplete="organization" maxLength={CONTACT_LIMITS.company} value={values.company} onChange={(e) => set('company', e.target.value)} className={AUTH_INPUT} />
      </div>
      <div>
        <label htmlFor="contact-message" className={AUTH_LABEL}>How can we help?</label>
        <textarea id="contact-message" rows={5} maxLength={CONTACT_LIMITS.messageMax} value={values.message} onChange={(e) => set('message', e.target.value)} aria-invalid={!!errors.message} aria-describedby={errors.message ? 'contact-message-err' : undefined} className={AUTH_INPUT} />
        {errors.message && <p id="contact-message-err" className="mt-1 text-sm text-red-400">{errors.message}</p>}
      </div>

      {/* Hidden from people and screen readers; bots tend to fill every field. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="contact-website">Leave this empty</label>
        <input id="contact-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      <TurnstileWidget onToken={setCaptchaToken} resetSignal={captchaReset} />
      {formError && <p role="alert" className="text-sm text-red-400">{formError}</p>}
      <button type="submit" disabled={sending || !captchaReady} className={AUTH_BUTTON}>
        {sending ? 'Sending…' : 'Send message'}
      </button>
    </form>
  )
}
