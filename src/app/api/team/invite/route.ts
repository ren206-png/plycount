// ============================================================
// POST /api/team/invite — adds a manager or staff member to the caller's own
// company. Sends them an invitation email (through the Supabase mailer, which
// goes out via Resend) with a link to choose a password, and creates their
// profile as active: the person adding them is the approval.
//
// Who may add whom (see src/lib/team.ts, and migration 020 for the database
// side): an owner or the platform administrator can add managers or staff; a
// manager can add staff only. This route writes with the service role, which
// the database rules do not apply to, so it checks the caller itself.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit/server'
import { canInviteRole, validInviteEmail } from '@/lib/team'
import { SITE_URL } from '@/lib/site'
import type { UserRole } from '@/types'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const { data: me } = await supabase
    .from('user_profiles')
    .select('organization_id, role, status')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!me || me.status !== 'active') return NextResponse.json({ error: 'Your account is not active.' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim().slice(0, 120) : ''
  const role = typeof body.role === 'string' ? body.role : ''

  if (!validInviteEmail(email)) return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
  if (!fullName) return NextResponse.json({ error: 'Their full name is required.' }, { status: 400 })
  if (!canInviteRole(me.role as UserRole, role)) {
    return NextResponse.json(
      {
        error:
          role === 'administrator'
            ? 'Only an owner can add a manager.'
            : 'You do not have permission to add this kind of account.',
      },
      { status: 403 }
    )
  }

  const withinLimit = await checkRateLimit(`team-invite:${me.organization_id}`, 10, 3600)
  if (!withinLimit) {
    return NextResponse.json({ error: 'Too many invitations sent recently. Try again in a while.' }, { status: 429 })
  }

  const admin = createAdminClient()

  const { data: existing } = await admin.from('user_profiles').select('id').ilike('email', email).maybeSingle()
  if (existing) {
    return NextResponse.json(
      { error: 'Someone with that email already has a PlyCount account. Ask them to sign in, or use "Forgot password".' },
      { status: 400 }
    )
  }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${SITE_URL}/reset-password`,
    data: { full_name: fullName },
  })
  if (inviteError || !invited.user) {
    return NextResponse.json({ error: inviteError?.message ?? 'Could not send the invitation.' }, { status: 502 })
  }

  const { error: profileError } = await admin.from('user_profiles').insert({
    auth_user_id: invited.user.id,
    organization_id: me.organization_id,
    email,
    full_name: fullName,
    role,
    status: 'active',
  })
  if (profileError) {
    // Do not leave a login with no profile behind.
    await admin.auth.admin.deleteUser(invited.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, email })
}
