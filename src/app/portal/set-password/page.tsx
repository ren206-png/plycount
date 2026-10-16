'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AUTH_BUTTON, AUTH_INPUT, AUTH_LABEL, AuthShell } from '@/components/auth/AuthShell'
import { toast } from 'sonner'

export default function PortalSetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.')
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

    toast.success('Password set — welcome to the portal.')
    router.push('/portal')
    router.refresh()
  }

  return (
    <AuthShell title="Set your password" subtitle="Choose a password to finish setting up your customer portal access.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className={AUTH_LABEL}>New password</label>
          <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={AUTH_INPUT} />
        </div>
        <button type="submit" disabled={isSubmitting} className={AUTH_BUTTON}>
          {isSubmitting ? 'Saving…' : 'Save password'}
        </button>
      </form>
    </AuthShell>
  )
}
