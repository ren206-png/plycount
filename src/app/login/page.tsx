'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { safeRedirectPath } from '@/lib/auth/redirect'
import { TurnstileWidget } from '@/components/TurnstileWidget'
import { captchaOptions, captchaRequired } from '@/lib/turnstile'
import { AUTH_BUTTON, AUTH_BUTTON_GLASS, AUTH_INPUT, AUTH_LABEL, AUTH_LINK, AuthShell } from '@/components/auth/AuthShell'

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaOptions(captchaToken),
    })
    setIsSubmitting(false)

    if (error) {
      toast.error(error.message)
      // Captcha tokens are single-use: ask for a fresh challenge before a retry.
      setCaptchaReset((n) => n + 1)
      return
    }

    router.push(safeRedirectPath(searchParams.get('redirect')))
    router.refresh()
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back. Sign in to your PlyCount account."
      footer={
        <>
          Factory staff?{' '}
          <Link href="/staff/join" className={AUTH_LINK}>
            Request access
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className={AUTH_LABEL}>Email</label>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={AUTH_INPUT} />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-300">Password</label>
            <Link href="/forgot-password" className={`text-sm ${AUTH_LINK}`}>
              Forgot password?
            </Link>
          </div>
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={AUTH_INPUT} />
        </div>
        <TurnstileWidget onToken={setCaptchaToken} resetSignal={captchaReset} />
        <button type="submit" disabled={isSubmitting || !captchaReady} className={AUTH_BUTTON}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  )
}
