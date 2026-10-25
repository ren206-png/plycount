'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { safeRedirectPath } from '@/lib/auth/redirect'
import { MFA_PARAM, cleanCode, isCompleteCode, needsSecondStep } from '@/lib/auth/mfa'
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

  // 'code' = the password was right and the account has two-step sign-in on,
  // so the authenticator code is still owed.
  const [step, setStep] = useState<'password' | 'code'>('password')
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')

  // Sent here by the middleware (?mfa=1): already signed in with the password,
  // only the code is missing.
  useEffect(() => {
    if (searchParams.get(MFA_PARAM) !== '1') return
    void startCodeStep()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Moves to the code screen if this session still owes one. Returns true if it does. */
  async function startCodeStep(): Promise<boolean> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (!userData.user || !needsSecondStep({ factors: userData.user.factors, currentLevel: aal?.currentLevel })) return false
    const verified = userData.user.factors?.find((f) => f.factor_type === 'totp' && f.status === 'verified')
    if (!verified) return false
    setFactorId(verified.id)
    setCode('')
    setStep('code')
    return true
  }

  function finishSignIn() {
    router.push(safeRedirectPath(searchParams.get('redirect')))
    router.refresh()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaOptions(captchaToken),
    })

    if (error) {
      setIsSubmitting(false)
      toast.error(error.message)
      // Captcha tokens are single-use: ask for a fresh challenge before a retry.
      setCaptchaReset((n) => n + 1)
      return
    }

    if (await startCodeStep()) {
      setIsSubmitting(false)
      return
    }
    setIsSubmitting(false)
    finishSignIn()
  }

  async function handleCode(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId || !isCompleteCode(code)) return
    setIsSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
    setIsSubmitting(false)
    if (error) {
      toast.error('That code did not work. Check the 6 digits in your authenticator app and try again.')
      setCode('')
      return
    }
    finishSignIn()
  }

  async function cancelCodeStep() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setStep('password')
    setFactorId(null)
    setCode('')
    setPassword('')
    setCaptchaReset((n) => n + 1)
    router.replace('/login')
  }

  return (
    step === 'code' ? (
    <AuthShell
      title="Enter your code"
      subtitle="Open your authenticator app and type the 6-digit code for PlyCount."
      footer={
        <button type="button" onClick={cancelCodeStep} className={AUTH_LINK}>
          Use a different account
        </button>
      }
    >
      <form onSubmit={handleCode} className="flex flex-col gap-4">
        <div>
          <label htmlFor="mfa-code" className={AUTH_LABEL}>6-digit code</label>
          <input
            id="mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            maxLength={7}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(cleanCode(e.target.value))}
            className={`${AUTH_INPUT} text-center text-lg tracking-[0.4em]`}
          />
        </div>
        <button type="submit" disabled={isSubmitting || !isCompleteCode(code)} className={AUTH_BUTTON}>
          {isSubmitting ? 'Checking…' : 'Verify and sign in'}
        </button>
      </form>
    </AuthShell>
    ) : (
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
  )
}
