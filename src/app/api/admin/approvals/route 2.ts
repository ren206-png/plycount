// ============================================================
// POST /api/admin/approvals — platform admin only. Approves or rejects
// a self-service signup that is waiting in `pending` status.
//   approve -> status 'active'      (the account gains access)
//   reject  -> status 'deactivated' (the account stays shut out)
// Only profiles that are still pending can be changed here, so this
// cannot be used to reactivate or edit any other account.
// Uses the admin client for the write: the database also forbids anyone
// but a platform admin from leaving `pending` (see migration 015), and the
// caller is verified as an active platform admin first.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isPlatformAdminRole } from '@/lib/auth/roles'

export const runtime = 'nodejs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  const { data: me } = await supabase
    .from('user_profiles')
    .select('role, status')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!me || !isPlatformAdminRole(me.role) || me.status !== 'active') {
    return NextResponse.json({ error: 'Only the platform administrator can approve accounts.' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const profileId = typeof body.profileId === 'string' ? body.profileId : ''
  const action = body.action
  if (!UUID.test(profileId) || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json({ error: 'A profileId and an action of "approve" or "reject" are required.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('user_profiles')
    .update({ status: action === 'approve' ? 'active' : 'deactivated' })
    .eq('id', profileId)
    .eq('status', 'pending')
    .select('id, email')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'No pending account with that id.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, email: data.email, status: action === 'approve' ? 'active' : 'deactivated' })
}
