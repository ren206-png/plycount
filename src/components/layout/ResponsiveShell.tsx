'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface Props {
  /** Short name shown in the top bar on phones. */
  title: string
  /** Small icon shown before the title in the top bar. */
  titleIcon?: React.ReactNode
  /** Sidebar header block (name + subtitle). */
  brand: React.ReactNode
  /** Sidebar links. */
  nav: React.ReactNode
  /** Sidebar footer (who is signed in, sign out). */
  footer: React.ReactNode
  children: React.ReactNode
}

// On a desktop screen: a fixed sidebar beside the page, as before. On a phone:
// a top bar with a menu button, and the sidebar becomes a drawer that slides
// over the page and closes on navigation, on tapping outside it, or on Escape.
export function ResponsiveShell({ title, titleIcon, brand, nav, footer, children }: Props) {
  const pathname = usePathname()
  // The drawer is open only for the page it was opened on, so moving to another
  // page closes it without any extra bookkeeping.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === pathname

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenOn(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="min-h-screen md:flex">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 md:hidden">
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="app-sidebar"
          onClick={() => setOpenOn(pathname)}
          className="-ml-1 rounded-md p-2 text-gray-700 hover:bg-gray-100"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        {titleIcon}
        <span className="text-base font-bold text-brand-700">{title}</span>
      </header>

      {open && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpenOn(null)}
        />
      )}

      <aside
        id="app-sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col overflow-y-auto border-r border-gray-200 bg-white transition-transform duration-200',
          'md:static md:z-auto md:max-w-none md:shrink-0 md:translate-x-0 md:transition-none',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpenOn(null)}
          className="absolute right-3 top-3 rounded-md p-2 text-gray-500 hover:bg-gray-100 md:hidden"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="border-b border-gray-200 px-5 py-4 pr-14 md:pr-5">{brand}</div>
        <nav className="flex-1 space-y-1 px-3 py-4">{nav}</nav>
        <div className="border-t border-gray-200 px-5 py-4">{footer}</div>
      </aside>

      <main className="min-w-0 flex-1 bg-gray-50 p-4 md:overflow-y-auto md:p-8">{children}</main>
    </div>
  )
}
