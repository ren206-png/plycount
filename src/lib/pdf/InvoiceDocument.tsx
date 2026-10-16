// ============================================================
// Customer-facing invoice PDF. Like the quote PDF it never includes cost or
// margin. Rendered server-side only (Node runtime), never in the browser.
// ============================================================
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

export interface InvoicePdfLine {
  skuCode: string
  productName: string
  qty: number
  unitPrice: number
  unitOfMeasure: string
}

export interface InvoicePdfData {
  organizationName: string
  invoiceNumber: string
  issueDate: string
  dueDate: string
  creditTerms: string | null
  customerName: string
  customerContactName: string | null
  lines: InvoicePdfLine[]
  total: number
  amountPaid: number
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1f2937' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  orgName: { fontSize: 18, fontWeight: 700 },
  docTitle: { fontSize: 20, fontWeight: 700, color: '#1c4130', textAlign: 'right' },
  meta: { textAlign: 'right', color: '#6b7280', marginTop: 4 },
  section: { marginBottom: 16 },
  label: { color: '#6b7280', fontSize: 9, textTransform: 'uppercase', marginBottom: 2 },
  value: { fontSize: 11 },
  table: { marginTop: 12, borderTop: '1 solid #e5e7eb' },
  tableRow: { flexDirection: 'row', borderBottom: '1 solid #e5e7eb', paddingVertical: 6 },
  tableHeaderRow: { flexDirection: 'row', borderBottom: '1 solid #1f2937', paddingVertical: 6, fontWeight: 700 },
  colSku: { width: '20%' },
  colName: { width: '35%' },
  colQty: { width: '15%', textAlign: 'right' },
  colPrice: { width: '15%', textAlign: 'right' },
  colTotal: { width: '15%', textAlign: 'right' },
  sumRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 },
  sumLabel: { width: 110, textAlign: 'right', marginRight: 18, color: '#6b7280' },
  sumValue: { width: 80, textAlign: 'right' },
  dueRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, paddingTop: 8, borderTop: '1 solid #1f2937' },
  dueLabel: { width: 110, textAlign: 'right', marginRight: 18, fontWeight: 700, fontSize: 12 },
  dueValue: { width: 80, textAlign: 'right', fontWeight: 700, fontSize: 12 },
  footer: { marginTop: 40, fontSize: 9, color: '#6b7280' },
})

const money = (n: number) => `$${n.toFixed(2)}`
// Unit prices can have more than two decimals ($24.625); show them in full so
// quantity times price visibly equals the amount.
const unitMoney = (n: number) => `$${n.toFixed(4).replace(/0{1,2}$/, '')}`
const day = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })

export function InvoiceDocument({ data }: { data: InvoicePdfData }) {
  const balance = Math.max(0, Math.round((data.total - data.amountPaid) * 100) / 100)
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.orgName}>{data.organizationName}</Text>
          <View>
            <Text style={styles.docTitle}>INVOICE</Text>
            <Text style={styles.meta}>{data.invoiceNumber}</Text>
            <Text style={styles.meta}>Issued: {day(data.issueDate)}</Text>
            <Text style={styles.meta}>Due: {day(data.dueDate)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Bill to</Text>
          <Text style={styles.value}>{data.customerName}</Text>
          {data.customerContactName && <Text style={styles.value}>{data.customerContactName}</Text>}
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.colSku}>SKU</Text>
            <Text style={styles.colName}>Product</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colPrice}>Unit price</Text>
            <Text style={styles.colTotal}>Amount</Text>
          </View>
          {data.lines.map((l, i) => (
            <View style={styles.tableRow} key={i}>
              <Text style={styles.colSku}>{l.skuCode}</Text>
              <Text style={styles.colName}>{l.productName}</Text>
              <Text style={styles.colQty}>{l.qty} {l.unitOfMeasure}</Text>
              <Text style={styles.colPrice}>{unitMoney(l.unitPrice)}</Text>
              <Text style={styles.colTotal}>{money(l.qty * l.unitPrice)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sumRow}>
          <Text style={styles.sumLabel}>Total</Text>
          <Text style={styles.sumValue}>{money(data.total)}</Text>
        </View>
        {data.amountPaid > 0 && (
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>Paid to date</Text>
            <Text style={styles.sumValue}>-{money(data.amountPaid)}</Text>
          </View>
        )}
        <View style={styles.dueRow}>
          <Text style={styles.dueLabel}>Balance due</Text>
          <Text style={styles.dueValue}>{money(balance)}</Text>
        </View>

        <Text style={styles.footer}>
          {data.creditTerms ? `Terms: ${data.creditTerms}. ` : ''}Please pay by {day(data.dueDate)} and quote{' '}
          {data.invoiceNumber} with your payment. Thank you for your business.
        </Text>
      </Page>
    </Document>
  )
}
