// JSX lives here (not in the route handlers) so the API routes stay plain .ts files.
import { pdf } from '@react-pdf/renderer'
import { InvoiceDocument, type InvoicePdfData } from './InvoiceDocument'

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

export async function renderInvoicePdfBuffer(data: InvoicePdfData): Promise<Buffer> {
  const stream = await pdf(<InvoiceDocument data={data} />).toBuffer()
  return streamToBuffer(stream)
}
