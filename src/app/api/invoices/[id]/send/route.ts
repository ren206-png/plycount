// ============================================================
// POST /api/invoices/:id/send — emails the invoice PDF to the customer's
// contact email through Resend. The first send also turns a draft into a sent
// invoice and sets its issue date and due date (from the customer's credit
// terms, 30 days when they cannot be read). Sending again just re-emails it.
// Admins only, under the same access rules as the rest of the app.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/auth/roles'
import { checkRateLimit } from '@/lib/rate-limit/server'
import { getInvoicePdfData } from '@/lib/pdf/getInvoicePdfData'
import { renderInvoicePdfBuffer } from '@/lib/pdf/renderInvoicePdf'

export const runtime = 'nodejs'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: 'Email delivery is not configured yet (RESEND_API_KEY missing). Download the PDF and send it manually for now.' },
      { status: 501 }
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id, role')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!profile || !isAdminRole(profile.role)) {
    return NextResponse.json({ error: 'Only an administrator can send invoices.' }, { status: 403 })
  }

  const withinLimit = await checkRateLimit(`invoice-send:${profile.organization_id}`, 60, 3600)
  if (!withinLimit) {
    return NextResponse.json({ error: 'Too many invoices emailed recently. Try again in a while.' }, { status: 429 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const result = await getInvoicePdfData(supabase, id, today)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 404 })

  if (!result.customerEmail) {
    return NextResponse.json(
      { error: 'This customer has no contact email on file — add one before sending.' },
      { status: 400 }
    )
  }

  const { data: d, invoice } = result
  const buffer = await renderInvoicePdfBuffer(d)
  const resend = new Resend(process.env.RESEND_API_KEY)
  const fromAddress = process.env.RESEND_FROM_EMAIL || 'quotes@plycount.app'
  const owed = Math.max(0, Math.round((d.total - d.amountPaid) * 100) / 100)

  const { error: sendError } = await resend.emails.send({
    from: `${d.organizationName} <${fromAddress}>`,
    to: result.customerEmail,
    subject: `Invoice ${d.invoiceNumber} from ${d.organizationName}`,
    text:
      `Hi${d.customerContactName ? ` ${d.customerContactName}` : ''},\n\n` +
      `Please find invoice ${d.invoiceNumber} from ${d.organizationName} attached.\n\n` +
      `Amount due: $${owed.toFixed(2)}\nDue date: ${d.dueDate}` +
      `${d.creditTerms ? `\nTerms: ${d.creditTerms}` : ''}\n\n` +
      `Please quote ${d.invoiceNumber} with your payment. Thank you for your business.`,
    attachments: [{ filename: `${d.invoiceNumber}.pdf`, content: buffer }],
  })
  if (sendError) return NextResponse.json({ error: sendError.message }, { status: 502 })

  if (!invoice.alreadySent) {
    const { error: statusError } = await supabase
      .from('invoices')
      .update({ status: 'sent', issue_date: invoice.issueDate, due_date: invoice.dueDate, sent_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'draft')
    if (statusError) {
      return NextResponse.json(
        { error: `Email sent, but failed to mark the invoice as sent: ${statusError.message}` },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ ok: true, invoiceNumber: d.invoiceNumber, dueDate: d.dueDate })
}
