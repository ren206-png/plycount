'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { TurnstileWidget } from '@/components/TurnstileWidget'
import { captchaOptions, captchaRequired } from '@/lib/turnstile'
import { STAFF_JOIN_NAME_KEY } from '@/lib/auth/staff-join'
import { AUTH_BUTTON, AUTH_BUTTON_GLASS, AUTH_INPUT, AUTH_LABEL, AUTH_LINK, AuthShell } from '@/components/auth/AuthShell'

export default function StaffJoinPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaReset, setCaptchaReset] = useState(0)
  const captchaReady = !captchaRequired() || !!captchaToken

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    const supabase = createClient()

    // The name rides along on the auth user's metadata so the request survives
    // the email-confirmation round trip (see AuthProvider).
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        ...captchaOptions(captchaToken),
        data: { [STAFF_JOIN_NAME_KEY]: fullName.trim() },
      },
    })

    if (error || !data.user) {
      toast.error(error?.message ?? 'Could not send your request')
      setIsSubmitting(false)
      // Captcha tokens are single-use: ask for a fresh challenge before a retry.
      setCaptchaReset((n) => n + 1)
      return
    }

    if (!data.session) {
      // Email confirmation is required: the request is completed automatically
      // the first time this person signs in after confirming.
      setIsSubmitting(false)
      toast.success('Request created. Confirm your email, then sign in to send it for approval.')
      router.push('/login')
      return
    }

    const { error: requestError } = await supabase.rpc('request_staff_access', {
      p_full_name: fullName.trim(),
    })
    if (requestError) {
      toast.error(`Account created, but the access request failed: ${requestError.message}`)
      setIsSubmitting(false)
      return
    }
    await supabase.auth.updateUser({ data: { [STAFF_JOIN_NAME_KEY]: null } })

    setIsSubmitting(false)
    router.push('/pending')
    router.refresh()
  }

  return (
    <AuthShell
      title="Request staff access"
      subtitle="For factory staff. The administrator reviews every request, and you can sign in once it is approved."
      footer={
        <>
          Already approved?{' '}
          <Link href="/login" className={AUTH_LINK}>
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className={AUTH_LABEL}>Your full name</label>
          <input required maxLength={120} autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={AUTH_INPUT} />
        </div>
        <div>
          <label className={AUTH_LABEL}>Work email</label>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={AUTH_INPUT} />
        </div>
        <div>
          <label className={AUTH_LABEL}>Choose a password</label>
          <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={AUTH_INPUT} />
        </div>
        <TurnstileWidget onToken={setCaptchaToken} resetSignal={captchaReset} />
        <button type="submit" disabled={isSubmitting || !captchaReady} className={AUTH_BUTTON}>
          {isSubmitting ? 'Sending request…' : 'Request access'}
        </button>
      </form>
    </AuthShell>
  )
}
