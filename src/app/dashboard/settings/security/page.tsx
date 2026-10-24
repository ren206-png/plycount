'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/providers/AuthProvider'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cleanCode, isCompleteCode } from '@/lib/auth/mfa'
import { toast } from 'sonner'

interface Enrolment {
  factorId: string
  qrCode: string
  secret: string
}

const FRIENDLY_NAME = 'Authenticator app'

export default function SecurityPage() {
  const { user, refreshProfile } = useAuth()
  const [supabase] = useState(() => createClient())
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const { data: factorIds, isLoading: loading, refetch } = useQuery({
    queryKey: ['mfa-factors'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw error
      return data.totp.map((f) => f.id)
    },
  })
  const enabledFactorId = factorIds?.[0] ?? null
  const load = async () => {
    await refetch()
  }

  async function startSetup() {
    setBusy(true)
    // A setup that was started but never finished would block a new one with
    // the same name, so clear those first.
    const { data: existing } = await supabase.auth.mfa.listFactors()
    for (const f of existing?.all ?? []) {
      if (f.factor_type === 'totp' && f.status !== 'verified') {
        await supabase.auth.mfa.unenroll({ factorId: f.id })
      }
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: FRIENDLY_NAME,
      issuer: 'PlyCount',
    })
    setBusy(false)
    if (error || !data) {
      toast.error(error?.message ?? 'Could not start the setup. Please try again.')
      return
    }
    setEnrolment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
    setCode('')
  }

  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault()
    if (!enrolment || !isCompleteCode(code)) return
    setBusy(true)
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolment.factorId, code })
    setBusy(false)
    if (error) {
      toast.error('That code did not match. Wait for a new one in your app and try again.')
      setCode('')
      return
    }
    toast.success('Two-step sign-in is on.')
    setEnrolment(null)
    await load()
    await refreshProfile()
  }

  async function cancelSetup() {
    if (enrolment) await supabase.auth.mfa.unenroll({ factorId: enrolment.factorId })
    setEnrolment(null)
    setCode('')
  }

  async function turnOff() {
    if (!enabledFactorId) return
    if (!window.confirm('Turn off two-step sign-in? Your account will be protected by the password only.')) return
    setBusy(true)
    const { error } = await supabase.auth.mfa.unenroll({ factorId: enabledFactorId })
    setBusy(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Two-step sign-in is off.')
    await load()
    await refreshProfile()
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Two-step sign-in</h1>
        <p className="mt-1 text-sm text-gray-600">
          Adds a 6-digit code from an authenticator app on your phone to your password. A stolen or guessed
          password alone then cannot get into {user?.email ?? 'your account'}.
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        {loading ? (
          <p className="text-sm text-gray-500">Checking…</p>
        ) : enabledFactorId ? (
          <div className="space-y-3">
            <p className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
              On
            </p>
            <p className="text-sm text-gray-700">
              You will be asked for a code from your authenticator app every time you sign in.
            </p>
            <Button variant="secondary" onClick={turnOff} disabled={busy}>
              Turn off
            </Button>
          </div>
        ) : enrolment ? (
          <form onSubmit={confirmSetup} className="space-y-4">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
              <li>
                Install an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, 1Password,
                Authy).
              </li>
              <li>In the app, add an account and scan this picture.</li>
            </ol>
            {/* eslint-disable-next-line @next/next/no-img-element -- Supabase returns the code as an inline SVG data URI */}
            <img
              src={enrolment.qrCode}
              alt="QR code to scan with your authenticator app"
              className="mx-auto h-44 w-44 rounded-md border border-gray-200 bg-white p-2"
            />
            <p className="text-center text-xs text-gray-500">
              Cannot scan? Type this key into the app instead:
              <br />
              <span className="select-all break-all font-mono text-gray-800">{enrolment.secret}</span>
            </p>
            <div>
              <label htmlFor="setup-code" className="mb-1 block text-sm font-medium text-gray-700">
                3. Type the 6-digit code the app shows
              </label>
              <Input
                id="setup-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(cleanCode(e.target.value))}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || !isCompleteCode(code)}>
                {busy ? 'Checking…' : 'Turn on'}
              </Button>
              <Button type="button" variant="ghost" onClick={cancelSetup} disabled={busy}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              Off
            </p>
            <p className="text-sm text-gray-700">
              Takes about a minute. Keep your phone safe: if you lose it, the platform administrator has to reset your
              two-step sign-in before you can get back in.
            </p>
            <Button onClick={startSetup} disabled={busy}>
              {busy ? 'Starting…' : 'Set up two-step sign-in'}
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}
