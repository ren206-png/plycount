// ============================================================
// Next.js Middleware — Session refresh + Route Protection
//
// The session refresh (supabase.auth.getUser()) MUST run on
// every request. Without it, the access token expires after an
// hour and every subsequent call fails until the user re-logs in.
// API routes get the refresh but are never redirected to /login.
// ============================================================
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { hasAccess } from '@/lib/auth/approval'
import { mfaLoginUrl, needsSecondStep } from '@/lib/auth/mfa'
import { isPublicSeoPath } from '@/lib/public-seo-paths'

const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/staff/join',
  '/forgot-password',
  '/reset-password',
  '/portal/set-password',
  '/api/',
]

// Endpoints that must work without an approved session (uptime checks and
// Stripe's server-to-server webhook, which has no user at all).
const API_GATE_EXEMPT = ['/api/health', '/api/stripe/webhook', '/api/auth/signout']

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    isPublicSeoPath(pathname) ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$/.test(pathname)
  ) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Record<string, unknown>)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isApi = pathname.startsWith('/api/')

  // Two-step sign-in. An account that turned it on must enter its authenticator
  // code before anything else works: a password alone gets API calls a 401 and
  // app pages a redirect to the code screen. (The database refuses such a
  // session too, see migration 022; this keeps the app closed as well.) Reading
  // the session's level is a local decode of the cookie, no extra network call.
  if (user) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (needsSecondStep({ factors: user.factors, currentLevel: aal?.currentLevel })) {
      if (isApi) {
        if (API_GATE_EXEMPT.some((p) => pathname === p || pathname.startsWith(p + '/'))) return supabaseResponse
        return NextResponse.json({ error: 'Enter your authenticator code to finish signing in.' }, { status: 401 })
      }
      const needsGate = pathname.startsWith('/dashboard') || pathname.startsWith('/portal') || pathname === '/pending'
      if (needsGate) return NextResponse.redirect(new URL(mfaLoginUrl(pathname), request.url))
      // Public pages (including /login, where the code is entered) stay reachable.
      return supabaseResponse
    }
  }

  // Approval gate ("no approval, no access"). A signed-in account whose
  // profile is pending/suspended/deactivated gets nothing: API calls are
  // refused and app pages redirect to the waiting screen. RLS enforces the
  // same rule in the database; this keeps the app (and the endpoints that
  // use the organization's own email/accounting credentials) closed too.
  const gateApplies =
    !!user &&
    (isApi
      ? !API_GATE_EXEMPT.some((p) => pathname === p || pathname.startsWith(p + '/'))
      : pathname.startsWith('/dashboard') || pathname.startsWith('/portal') || pathname === '/pending')

  if (gateApplies && user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('status')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    // No profile yet = a brand-new signup mid-setup; the app creates it
    // (as pending) on first load and the next request is gated.
    if (profile && !hasAccess(profile.status)) {
      if (isApi) {
        return NextResponse.json({ error: 'Your account is waiting for approval.' }, { status: 403 })
      }
      if (pathname !== '/pending') {
        return NextResponse.redirect(new URL('/pending', request.url))
      }
    } else if (pathname === '/pending') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  if (isApi) {
    return supabaseResponse
  }

  const isPublicRoute = PUBLIC_ROUTES.some(r => pathname === r || (r !== '/' && pathname.startsWith(r)))

  if (!user && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user && (pathname.startsWith('/login') || pathname.startsWith('/signup'))) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  // robots.txt, sitemap.xml and the social images are public and skip the gate entirely.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|opengraph-image|twitter-image|apple-icon|manifest.webmanifest).*)'],
}
