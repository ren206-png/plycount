'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
import { cn } from '@/lib/utils'
import { hasAccess } from '@/lib/auth/approval'
import { SECURITY_HREF, verifiedFactorCount } from '@/lib/auth/mfa'
import { APPROVALS_HREF, buildNav, canAccessPath } from '@/lib/nav'
import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { ResponsiveShell } from '@/components/layout/ResponsiveShell'
import { Logo, LogoMark } from '@/components/brand/Logo'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, profile, organization, signOut, isSigningOut, isLoading, isClientViewer, isPlatformAdmin, isOrgAdmin } = useAuth()
  const flags = { isPlatformAdmin, isOrgAdmin }

  useEffect(() => {
    // A portal (client_viewer) login should never land on the staff
    // dashboard even if they guess the URL — RLS already blocks the
    // data, but this avoids showing an empty/broken staff UI.
    if (!isLoading && isClientViewer) {
      router.replace('/portal')
    }
    // Belt and braces: the middleware already sends unapproved accounts to
    // the waiting screen; this covers a stale client-side session.
    if (!isLoading && profile && !hasAccess(profile.status)) {
      router.replace('/pending')
    }
  }, [isLoading, isClientViewer, profile, router])

  const supabase = createClient()

  // Badge: how many signups are waiting for the platform admin.
  const { data: pendingCount } = useQuery({
    queryKey: ['pending-accounts-count'],
    enabled: isPlatformAdmin,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
      if (error) throw error
      return count ?? 0
    },
  })

  if (isClientViewer) return null

  // Owners and managers can see prices, costs and invoices, so nudge them to
  // turn on two-step sign-in until they have.
  const showMfaNudge = !isLoading && isOrgAdmin && !!user && verifiedFactorCount(user.factors) === 0 && pathname !== SECURITY_HREF

  return (
    <ResponsiveShell
      title="PlyCount"
      titleIcon={<LogoMark uid="bar" size={28} />}
      brand={
        <>
          <Logo uid="side" size={34} tone="light" />
          <p className="mt-1.5 truncate text-xs text-gray-500">
            {isLoading ? 'Loading…' : organization?.name ?? 'No organization'}
          </p>
        </>
      }
      nav={buildNav(flags).map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium',
              active ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <span>{item.label}</span>
            {item.href === APPROVALS_HREF && (pendingCount ?? 0) > 0 && (
              <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">
                {pendingCount}
              </span>
            )}
          </Link>
        )
      })}
      footer={
        <>
          <p className="truncate text-sm font-medium text-gray-900">{profile?.full_name}</p>
          <p className="truncate text-xs text-gray-500">{profile?.role}</p>
          <button
            onClick={() => signOut()}
            disabled={isSigningOut}
            className="mt-2 text-xs font-medium text-gray-500 hover:text-gray-800 disabled:opacity-60"
          >
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </button>
        </>
      }
    >
      {!isLoading && profile && !canAccessPath(pathname, flags) ? (
        <div className="mx-auto max-w-md rounded-lg border border-gray-200 bg-white p-6 text-center">
          <h1 className="text-lg font-semibold text-gray-900">No access to this page</h1>
          <p className="mt-2 text-sm text-gray-600">
            Your account does not have permission to use this part of PlyCount. Ask the administrator if you need it.
          </p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">
            Back to the dashboard
          </Link>
        </div>
      ) : (
        <>
          {showMfaNudge && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Protect your account: add a code from your phone to your password.{' '}
              <Link href={SECURITY_HREF} className="font-semibold underline">
                Turn on two-step sign-in
              </Link>
            </div>
          )}
          {children}
        </>
      )}
    </ResponsiveShell>
  )
}
