// ============================================================
// Copy and SEO metadata for the public landing page (/). Kept in one place
// so the page, the structured data and the tests all read the same text, and
// so the SEO rules (title <= 60 chars, description 140-155, a 40-60 word
// direct answer for the featured-snippet FAQ) are enforced by landing.test.ts.
//
// Only claim what the app actually does. Gaps (no mobile app, no bill-of-
// materials costing) are stated plainly in the FAQ.
// ============================================================
import { SITE_NAME, SITE_URL } from './site'

export const PRIMARY_KEYWORD = 'contract pricing software for paper converters'

// The root layout's title template appends " | PlyCount".
export const PAGE_TITLE = 'Contract Pricing Software for Paper Converters'
export const TITLE_SUFFIX = ` | ${SITE_NAME}`

export const PAGE_DESCRIPTION =
  'PlyCount picks the right contract or volume price for every customer, SKU and quantity, and shows live margin on each quote line. Protect your margin.'

export const OG_TITLE = 'PlyCount: contract pricing and live margin for paper converters'
export const OG_DESCRIPTION =
  'Stop pulp-cost spikes from quietly eating your margin. Contract and volume pricing, live margin on every quote line, and quote-to-invoice in one place.'

export const HERO_H1 = 'Contract pricing software for paper converters that protects your margin'
export const HERO_SUBHEAD =
  'PlyCount is contract pricing software for paper converters. It finds the right contract or volume price for every customer, SKU and quantity, and shows your live margin before the quote goes out.'

export const PAIN_POINTS = [
  'A contract signed in spring still quotes at spring prices when the fall pulp and freight bills arrive.',
  'Customer contracts and volume tiers live in spreadsheets that drift out of date, so the wrong tier gets quoted.',
  'Reps cannot see margin while they quote, so the leak only shows up months later in the P&L.',
]

export const FEATURES = [
  {
    title: 'Contract and volume pricing, resolved for you',
    body: 'Build a price book per customer with effective dates and quantity tiers. When a rep adds a SKU and a quantity, PlyCount picks the contract price, falls back to your list book, and handles tier boundaries the same way every time.',
  },
  {
    title: 'Live margin on every quote line',
    body: 'Enter cost per SKU: raw material, packaging, labor and freight. The quote builder shows unit cost, per-line margin and blended margin as you price, and flags any line under 15% in red.',
  },
  {
    title: 'Margin alerts when cost moves',
    body: 'Every quote snapshots the cost at the moment it is built, so a later cost change never rewrites the margin you saw. Margin Guard then flags price-book lines that fall under 15% after a cost change, so you can review or reprice them.',
  },
]

export const MORE_FEATURES = [
  {
    title: 'Quote to order to invoice',
    body: 'Email a branded PDF quote, convert it to an order in one step, track partial fulfillment, and create invoices for what has shipped.',
  },
  {
    title: 'QuickBooks Online and Xero',
    body: 'Push invoices to QuickBooks Online or Xero. One provider is connected per company at a time.',
  },
  {
    title: 'Customer portal',
    body: 'Give each customer a read-only login to their own quotes, orders and invoices. They never see your costs.',
  },
  {
    title: 'Roles and an audit trail',
    body: 'Owners and administrators see costs and margins. Sales staff quote without them. Price changes and quote-to-order conversions are logged.',
  },
]

export const STEPS = [
  { title: 'Add customers and SKUs', body: 'Distributors, institutions and wholesalers, with ply, GSM, roll length, sheet count and case pack.' },
  { title: 'Enter cost per SKU', body: 'Raw material, packaging, labor and freight, with effective dates so you can see cost history.' },
  { title: 'Build price books', body: 'Contract or volume pricing per customer, with quantity tiers and start and end dates.' },
  { title: 'Quote with live margin', body: 'Add lines, see price and margin together, then email the quote or convert it to an order.' },
]

export const COMPARISON_ROWS = [
  { topic: 'Customer contracts and volume tiers', spreadsheet: 'Manual lookups, easy to pick the wrong tier', plycount: 'Resolved automatically per customer, SKU and quantity' },
  { topic: 'Margin while quoting', spreadsheet: 'Worked out separately, or after the fact', plycount: 'Shown on every line and for the whole quote' },
  { topic: 'Cost changes after a quote', spreadsheet: 'Linked cells silently change old quotes', plycount: 'Cost is snapshotted when the quote is built' },
  { topic: 'Who can see costs', spreadsheet: 'Anyone with the file', plycount: 'Owners and administrators only' },
  { topic: 'Price change history', spreadsheet: 'Usually none', plycount: 'Price-book changes and conversions are logged' },
  { topic: 'Quote, order and invoice', spreadsheet: 'Retyped into other systems', plycount: 'One flow, with QuickBooks Online and Xero sync' },
]

export const FAQS = [
  {
    question: 'What is contract pricing software for paper converters?',
    // Direct-answer paragraph (40-60 words) aimed at the featured snippet.
    answer:
      'Contract pricing software for paper converters stores each customer’s negotiated prices and volume tiers, picks the right price for a given SKU and quantity, and compares it with current unit cost. PlyCount does this inside the quote builder, so reps see margin before a quote goes out.',
  },
  {
    question: 'How does PlyCount protect my margin when pulp or freight costs change?',
    answer:
      'You enter cost per SKU with effective dates. Each quote snapshots the cost when it is built, so later changes never rewrite the margin you quoted. Margin Guard flags price-book lines that drop under 15% after a cost change so you can review or reprice them.',
  },
  {
    question: 'Can I control who sees costs and margins?',
    answer:
      'Yes. Costs and margins are visible only to owners and administrators. Sales staff can build and email quotes without seeing them, and customers using the portal see only their own quotes, orders and invoices, never your costs.',
  },
  {
    question: 'Does PlyCount work with QuickBooks or Xero?',
    answer:
      'Yes. You can push invoices to QuickBooks Online or Xero. One accounting provider is connected per company at a time.',
  },
  {
    question: 'Is there a mobile app or a bill-of-materials costing engine?',
    answer:
      'Not yet. PlyCount is a web app focused on pricing, margin and quoting. Cost is entered per SKU rather than calculated from a bill of materials, and there is no offline or mobile mode.',
  },
  {
    question: 'How do I get access?',
    answer:
      'Access is by approval. Existing users sign in. Factory staff can request access, and the administrator approves each request before anything is visible.',
  },
]

export function softwareJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    url: SITE_URL,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: PAGE_DESCRIPTION,
    featureList: [...FEATURES, ...MORE_FEATURES].map((f) => f.title),
  }
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
  }
}

export function faqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }
}

// JSON placed inside a <script> tag must not be able to close it.
export function toJsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
