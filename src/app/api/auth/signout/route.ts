// ============================================================
// POST /api/auth/signout — ends the session on the SERVER so the auth
// cookies are cleared by this response's Set-Cookie headers. Clearing
// them only from browser JavaScript races with the next page load (the
// browser can request /login while the old cookie is still being sent, and
// the middleware then bounces a "signed-in" user straight back to the
// dashboard, which looked like Sign out needing two clicks).
// Works for any signed-in account, including pending ones, so the approval
// gate in src/middleware.ts exempts this path.
// ============================================================
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST() {
  const supabase = await createClient()
  // Revokes the session on Supabase and removes the auth cookies from this response.
  await supabase.auth.signOut()
  return NextResponse.json({ ok: true })
}
