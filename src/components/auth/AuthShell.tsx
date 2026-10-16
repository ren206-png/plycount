import Link from 'next/link'
import { SITE_NAME } from '@/lib/site'
import { Logo } from '@/components/brand/Logo'

// Shared look for the sign-in, sign-up, password and access-request pages: the
// same dark theme and soft spotlight as the landing page, with the form on a
// glass card. Pure presentation; each page keeps its own form logic.
const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0c0b]'

export const AUTH_LABEL = 'mb-1.5 block text-sm font-medium text-gray-300'
export const AUTH_INPUT =
  'auth-input w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-amber-300/60 focus:outline-none focus:ring-1 focus:ring-amber-300/60'
export const AUTH_BUTTON = `inline-flex w-full items-center justify-center rounded-full bg-gradient-to-b from-white to-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-900 shadow-[0_0_0_1px_rgba(255,255,255,0.35),0_10px_40px_rgba(255,255,255,0.1)] transition hover:to-white disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`
export const AUTH_BUTTON_GLASS = `inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`
export const AUTH_LINK = 'font-medium text-amber-200 hover:text-amber-100 hover:underline'

interface Props {
  title: string
  subtitle?: React.ReactNode
  children: React.ReactNode
  /** Small text under the card, e.g. a link to another page. */
  footer?: React.ReactNode
  /** Center the text, for status pages with no form. */
  centered?: boolean
}

export function AuthShell({ title, subtitle, children, footer, centered }: Props) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0c0b] text-gray-100">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[560px] overflow-hidden">
        <div className="lp-glow absolute -top-40 left-1/2 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(52,140,100,0.5),rgba(52,140,100,0)_70%)] blur-2xl" />
        <div className="lp-glow absolute -top-28 left-[15%] h-[320px] w-[460px] rounded-full bg-[radial-gradient(closest-side,rgba(240,180,90,0.28),rgba(240,180,90,0)_70%)] blur-2xl" style={{ animationDelay: '-3s' }} />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
        <Link href="/" aria-label={`${SITE_NAME} home`} className={`mb-8 self-center rounded-lg ${FOCUS}`}>
          <Logo uid="auth" size={40} tone="dark" />
        </Link>
        <main className={`lp-rise rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.5)] backdrop-blur sm:p-8 ${centered ? 'text-center' : ''}`}>
          <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
          {subtitle && <p className="mt-2 text-sm leading-relaxed text-gray-400">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </main>
        {footer && <div className="mt-5 text-center text-sm text-gray-400">{footer}</div>}
      </div>
    </div>
  )
}
