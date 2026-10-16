'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { TurnstileWidget } from '@/components/TurnstileWidget'
import { captchaOptions, captchaRequired } from '@/lib/turnstile'
import { AUTH_BUTTON, AUTH_BUTTON_GLASS, AUTH_INPUT, AUTH_LABEL, AUTH_LINK, AuthShell } from '@/components/auth/AuthShell'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaReset, setCaptchaReset] = useState(0)
  const captchaReady = !captchaRequired() || !!captchaToken

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
      ...captchaOptions(captchaToken),
    })
    setIsSubmitting(false)

    if (error) {
      toast.error(error.message)
      // Captcha tokens are single-use: ask for a fresh challenge before a retry.
      setCaptchaReset((n) => n + 1)
      return
    }
    // Same message whether or not the address has an account, so this form
    // cannot be used to find out who is registered.
    setSent(true)
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle={sent ? undefined : 'Enter your email and we will send you a link to choose a new password.'}
      footer={
        <Link href="/login" className={AUTH_LINK}>
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <p className="text-sm leading-relaxed text-gray-300">
          If an account exists for <span className="font-medium text-white">{email}</span>, we have emailed a link to
          reset the password. It can take a minute; check your spam folder too.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className={AUTH_LABEL}>Email</label>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={AUTH_INPUT} />
          </div>
          <TurnstileWidget onToken={setCaptchaToken} resetSignal={captchaReset} />
          <button type="submit" disabled={isSubmitting || !captchaReady} className={AUTH_BUTTON}>
            {isSubmitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
