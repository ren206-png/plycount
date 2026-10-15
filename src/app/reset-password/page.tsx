'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

type LinkState = 'checking' | 'ready' | 'invalid'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [linkState, setLinkState] = useState<LinkState>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // The emailed link lands here with a one-time code; the Supabase client
  // exchanges it for a recovery session. Wait for that session (or give up
  // after a few seconds) instead of showing a form that cannot work.
  useEffect(() => {
    const supabase = createClient()
    let settled = false
    const ready = () => {
      settled = true
      setLinkState('ready')
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) ready()
    })
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) ready()
    })
    const timer = setTimeout(() => {
      if (!settled) setLinkState('invalid')
    }, 6000)
    return () => {
      sub.subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      toast.error('The two passwords do not match.')
      return
    }
    setIsSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setIsSubmitting(false)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Password updated.')
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Choose a new password</h1>
      {linkState === 'checking' && <p className="text-sm text-gray-500">Checking your link…</p>}
      {linkState === 'invalid' && (
        <>
          <p className="mb-6 text-sm text-gray-600">
            This reset link is invalid or has expired. Request a new one and use it within an hour.
          </p>
          <Link href="/forgot-password" className="text-sm font-medium text-brand-600 hover:underline">
            Send a new link
          </Link>
        </>
      )}
      {linkState === 'ready' && (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">New password</label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Confirm new password</label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving…' : 'Save password'}
          </button>
        </form>
      )}
    </main>
  )
}
