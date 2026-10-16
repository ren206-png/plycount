// ============================================================
// GET /api/invoices/:id/pdf — the customer-facing invoice PDF.
// Admins only: invoices (and the payments shown on them) are not visible to
// staff or customer-portal logins.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getInvoicePdfData } from '@/lib/pdf/getInvoicePdfData'
import { renderInvoicePdfBuffer } from '@/lib/pdf/renderInvoicePdf'
import { isAdminRole } from '@/lib/auth/roles'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('auth_user_id', user.id).maybeSingle()
  if (!profile || !isAdminRole(profile.role)) {
    return NextResponse.json({ error: 'Only an administrator can open invoices.' }, { status: 403 })
  }

  const result = await getInvoicePdfData(supabase, id, new Date().toISOString().slice(0, 10))
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 404 })

  const buffer = await renderInvoicePdfBuffer(result.data)
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${result.data.invoiceNumber}.pdf"`,
    },
  })
}
