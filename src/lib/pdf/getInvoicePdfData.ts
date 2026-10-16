// ============================================================
// Shared server-side loader for the invoice PDF, used by the download route
// and the send route so they cannot disagree about what the customer sees.
// Runs under the signed-in user's access rules (admins only see invoices).
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js'
import { dueDateFor } from '@/lib/invoicing'
import type { InvoicePdfData } from './InvoiceDocument'

export interface InvoiceForSend {
  invoiceId: string
  organizationId: string
  status: string
  /** Set for invoices that were already sent; computed for a first send. */
  issueDate: string
  dueDate: string
  alreadySent: boolean
}

export async function getInvoicePdfData(
  supabase: SupabaseClient,
  invoiceId: string,
  today: string
): Promise<{ data: InvoicePdfData; customerEmail: string | null; invoice: InvoiceForSend } | { error: string }> {
  const { data: invoice, error: invoiceError } = await supabase.from('invoices').select('*').eq('id', invoiceId).single()
  if (invoiceError || !invoice) return { error: 'Invoice not found.' }
  if (invoice.status === 'void') return { error: 'This invoice has been voided.' }

  const { data: lines, error: linesError } = await supabase
    .from('invoice_lines')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('created_at')
  if (linesError) return { error: linesError.message }
  if (!lines || lines.length === 0) return { error: 'Invoice has no line items.' }

  const { data: order, error: orderError } = await supabase.from('orders').select('*').eq('id', invoice.order_id).single()
  if (orderError || !order) return { error: 'Order not found.' }

  const { data: customer, error: customerError } = await supabase.from('customers').select('*').eq('id', order.customer_id).single()
  if (customerError || !customer) return { error: 'Customer not found.' }

  const { data: org, error: orgError } = await supabase.from('organizations').select('*').eq('id', invoice.organization_id).single()
  if (orgError || !org) return { error: 'Organization not found.' }

  const { data: orderLines, error: orderLinesError } = await supabase
    .from('order_lines')
    .select('id, product_id')
    .in('id', Array.from(new Set(lines.map((l) => l.order_line_id))))
  if (orderLinesError) return { error: orderLinesError.message }

  const productIds = Array.from(new Set((orderLines ?? []).map((ol) => ol.product_id)))
  const { data: products, error: productsError } = await supabase.from('products').select('*').in('id', productIds)
  if (productsError) return { error: productsError.message }

  const { data: payments, error: paymentsError } = await supabase
    .from('invoice_payments')
    .select('amount')
    .eq('invoice_id', invoiceId)
  if (paymentsError) return { error: paymentsError.message }

  const productForLine = (orderLineId: string) => {
    const ol = orderLines?.find((x) => x.id === orderLineId)
    return ol ? products?.find((p) => p.id === ol.product_id) : undefined
  }

  const total = lines.reduce((sum, l) => sum + l.qty_invoiced * l.unit_price, 0)
  const amountPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0)

  const alreadySent = invoice.status === 'sent' || invoice.status === 'paid'
  const issueDate: string = invoice.issue_date ?? today
  const dueDate: string = invoice.due_date ?? dueDateFor(issueDate, customer.credit_terms)

  return {
    data: {
      organizationName: org.name,
      invoiceNumber: invoice.invoice_number,
      issueDate,
      dueDate,
      creditTerms: customer.credit_terms,
      customerName: customer.name,
      customerContactName: customer.contact_name,
      total,
      amountPaid,
      lines: lines.map((l) => {
        const product = productForLine(l.order_line_id)
        return {
          skuCode: product?.sku_code ?? '—',
          productName: product?.name ?? '—',
          qty: l.qty_invoiced,
          unitPrice: l.unit_price,
          unitOfMeasure: product?.unit_of_measure ?? 'each',
        }
      }),
    },
    customerEmail: customer.contact_email,
    invoice: {
      invoiceId: invoice.id,
      organizationId: invoice.organization_id,
      status: invoice.status,
      issueDate,
      dueDate,
      alreadySent,
    },
  }
}
