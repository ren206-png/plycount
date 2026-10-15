'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
import { cn } from '@/lib/utils'
import { hasAccess } from '@/lib/auth/approval'
import { APPROVALS_HREF, buildNav } from '@/lib/nav'
import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { profile, organization, signOut, isLoading, isClientViewer, isPlatformAdmin } = useAuth()

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

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <p className="text-lg font-bold text-brand-700">PlyCount</p>
          <p className="truncate text-xs text-gray-500">
            {isLoading ? 'Loading…' : organization?.name ?? 'No organization'}
          </p>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {buildNav(isPlatformAdmin).map((item) => {
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
        </nav>
        <div className="border-t border-gray-200 px-5 py-4">
          <p className="truncate text-sm font-medium text-gray-900">{profile?.full_name}</p>
          <p className="truncate text-xs text-gray-500">{profile?.role}</p>
          <button
            onClick={() => signOut()}
            className="mt-2 text-xs font-medium text-gray-500 hover:text-gray-800"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8">{children}</main>
    </div>
  )
}
