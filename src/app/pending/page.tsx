'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
import { Button } from '@/components/ui/Button'
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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
      <h1 className="text-2xl font-bold text-gray-900">
        {blocked ? 'Account unavailable' : 'Waiting for approval'}
      </h1>
      <p className="mt-3 text-gray-600">
        {blocked
          ? 'This account does not have access. Contact the PlyCount administrator if you think this is a mistake.'
          : profile?.role === 'sales_rep'
            ? 'Your staff access request has been sent. You can use PlyCount as soon as the administrator approves it.'
            : 'Your account has been created. Access opens as soon as the PlyCount administrator approves it.'}
      </p>
      {user?.email && <p className="mt-2 text-sm text-gray-500">Signed in as {user.email}</p>}
      <div className="mt-6 flex justify-center gap-3">
        {!blocked && (
          <Button variant="secondary" onClick={() => refreshProfile()}>
            Check again
          </Button>
        )}
        <Button variant="ghost" onClick={() => signOut()} disabled={isSigningOut}>
          {isSigningOut ? 'Signing out…' : 'Sign out'}
        </Button>
      </div>
    </main>
  )
}
