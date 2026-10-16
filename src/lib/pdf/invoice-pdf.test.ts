import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { renderInvoicePdfBuffer } from './renderInvoicePdf'
import type { InvoicePdfData } from './InvoiceDocument'

const sample: InvoicePdfData = {
  organizationName: 'Renco Enterprise',
  invoiceNumber: 'INV-0007',
  issueDate: '2026-10-15',
  dueDate: '2026-11-14',
  creditTerms: 'Net 30',
  customerName: 'Northside Distributors',
  customerContactName: 'Alex Morgan',
  total: 1245.5,
  amountPaid: 400,
  lines: [
    { skuCode: 'TT2-96-STD', productName: '2-Ply Standard Bath Tissue', qty: 100, unitPrice: 9.8, unitOfMeasure: 'case' },
    { skuCode: 'PT-HWT-6', productName: 'Hardwound Paper Towel', qty: 12, unitPrice: 24.625, unitOfMeasure: 'case' },
  ],
}

describe('invoice PDF', () => {
  it('renders a real PDF document', async () => {
    const buffer = await renderInvoicePdfBuffer(sample)
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
    expect(buffer.length).toBeGreaterThan(1500)
    // Lets a person look at the result: INVOICE_PDF_OUT=/tmp/x.pdf npx vitest run invoice-pdf
    if (process.env.INVOICE_PDF_OUT) writeFileSync(process.env.INVOICE_PDF_OUT, buffer)
  }, 30_000)
})
