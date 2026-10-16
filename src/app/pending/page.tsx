'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
import { AUTH_BUTTON_GLASS, AuthShell } from '@/components/auth/AuthShell'
import { hasAccess } from '@/lib/auth/approval'

export default function PendingApprovalPage() {
  const router = useRouter()
  const { profile, user, isLoading, signOut, isSigningOut, refreshProfile } = useAuth()

  // If the account gets approved while this page is open, move on.
  useEffect(() => {
    if (!isLoading && profile && hasAccess(profile.status)) {
      router.replace(profile.role === 'client_viewer' ? '/portal' : '/dashboard')
    }
  }, [isLoading, profile, router])

  const status = profile?.status
  const blocked = status === 'suspended' || status === 'deactivated'

  return (
    <AuthShell
      centered
      title={blocked ? 'Account unavailable' : 'Waiting for approval'}
      subtitle={
        blocked
          ? 'This account does not have access. Contact the PlyCount administrator if you think this is a mistake.'
          : profile?.role === 'sales_rep'
            ? 'Your staff access request has been sent. You can use PlyCount as soon as the administrator approves it.'
            : 'Your account has been created. Access opens as soon as the PlyCount administrator approves it.'
      }
    >
      {user?.email && <p className="mb-5 text-sm text-gray-500">Signed in as {user.email}</p>}
      <div className="flex justify-center gap-3">
        {!blocked && (
          <button type="button" onClick={() => refreshProfile()} className={AUTH_BUTTON_GLASS}>
            Check again
          </button>
        )}
        <button type="button" onClick={() => signOut()} disabled={isSigningOut} className={AUTH_BUTTON_GLASS}>
          {isSigningOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </AuthShell>
  )
}
