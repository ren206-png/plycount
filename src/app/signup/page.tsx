'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { TurnstileWidget } from '@/components/TurnstileWidget'
import { captchaOptions, captchaRequired } from '@/lib/turnstile'
import { AUTH_BUTTON, AUTH_BUTTON_GLASS, AUTH_INPUT, AUTH_LABEL, AUTH_LINK, AuthShell } from '@/components/auth/AuthShell'

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    + '-' + Math.random().toString(36).slice(2, 6)
}

export default function SignupPage() {
  const router = useRouter()
  const [orgName, setOrgName] = useState('')
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

    // The org name/slug/full name are stashed as auth user metadata so
    // they survive the email-confirmation round trip: if this Supabase
    // project requires confirming email before a session exists (the
    // common case), signUp() below returns no session, and the org can't
    // be created yet — AuthProvider finishes the job the first time this
    // user actually authenticates (see loadProfileAndOrg's pending-org
    // fallback), reading these same fields back off user_metadata.
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        ...captchaOptions(captchaToken),
        data: {
          pending_org_name: orgName,
          pending_org_slug: slugify(orgName),
          pending_full_name: fullName,
        },
      },
    })

    if (signUpError || !signUpData.user) {
      toast.error(signUpError?.message ?? 'Sign up failed')
      setIsSubmitting(false)
      // Captcha tokens are single-use: ask for a fresh challenge before a retry.
      setCaptchaReset((n) => n + 1)
      return
    }

    if (!signUpData.session) {
      // Confirmation required — no session yet, so the org can't be
      // created here. It'll be created automatically on first login
      // once the user confirms their email (see AuthProvider).
      setIsSubmitting(false)
      toast.success('Account created — check your email to confirm it, then sign in to finish setup.')
      router.push('/login')
      return
    }

    const { error: orgError } = await supabase.rpc('create_organization_with_owner', {
      p_org_name: orgName,
      p_org_slug: slugify(orgName),
      p_full_name: fullName,
    })

    setIsSubmitting(false)

    if (orgError) {
      toast.error(`Account created, but organization setup failed: ${orgError.message}`)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <AuthShell
      title="Start your pilot"
      subtitle="Set up your company and the first admin account."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className={AUTH_LINK}>
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className={AUTH_LABEL}>Company name</label>
          <input required autoComplete="organization" value={orgName} onChange={(e) => setOrgName(e.target.value)} className={AUTH_INPUT} />
        </div>
        <div>
          <label className={AUTH_LABEL}>Your full name</label>
          <input required autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={AUTH_INPUT} />
        </div>
        <div>
          <label className={AUTH_LABEL}>Email</label>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={AUTH_INPUT} />
        </div>
        <div>
          <label className={AUTH_LABEL}>Password</label>
          <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={AUTH_INPUT} />
        </div>
        <TurnstileWidget onToken={setCaptchaToken} resetSignal={captchaReset} />
        <button type="submit" disabled={isSubmitting || !captchaReady} className={AUTH_BUTTON}>
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  )
}
