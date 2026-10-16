'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
import { cn } from '@/lib/utils'
import { ResponsiveShell } from '@/components/layout/ResponsiveShell'

const NAV = [
  { href: '/portal', label: 'Overview' },
  { href: '/portal/quotes', label: 'Quotes' },
  { href: '/portal/orders', label: 'Orders' },
  { href: '/portal/invoices', label: 'Invoices' },
]

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { profile, organization, signOut, isSigningOut, isLoading, isClientViewer } = useAuth()

  useEffect(() => {
    // Staff shouldn't land in the portal — send them to the real dashboard.
    if (!isLoading && !isClientViewer) {
      router.replace('/dashboard')
    }
  }, [isLoading, isClientViewer, router])

  if (isLoading || !isClientViewer) return null

  return (
    <ResponsiveShell
      title={organization?.name ?? 'PlyCount'}
      brand={
        <>
          <p className="text-lg font-bold text-brand-700">{organization?.name ?? 'PlyCount'}</p>
          <p className="text-xs text-gray-500">Customer portal</p>
        </>
      }
      nav={NAV.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'block rounded-md px-3 py-2 text-sm font-medium',
              active ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            {item.label}
          </Link>
        )
      })}
      footer={
        <>
          <p className="truncate text-sm font-medium text-gray-900">{profile?.full_name}</p>
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
      {children}
    </ResponsiveShell>
  )
}
