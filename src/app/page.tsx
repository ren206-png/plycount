import type { Metadata } from 'next'
import Link from 'next/link'
import {
  COMPARISON_ROWS,
  FAQS,
  FEATURES,
  HERO_H1,
  HERO_SUBHEAD,
  MORE_FEATURES,
  OG_DESCRIPTION,
  OG_TITLE,
  PAGE_DESCRIPTION,
  PAGE_TITLE,
  PAIN_POINTS,
  STEPS,
  TITLE_SUFFIX,
  faqJsonLd,
  organizationJsonLd,
  softwareJsonLd,
  toJsonLdString,
} from '@/lib/landing'
import { SITE_NAME, SITE_URL } from '@/lib/site'
import { Logo } from '@/components/brand/Logo'

// Next.js does not apply the root layout's title template to the page in the same
// folder, so the brand suffix is added explicitly (57 characters in total).
export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE + TITLE_SUFFIX },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: OG_TITLE,
    description: OG_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: OG_TITLE,
    description: OG_DESCRIPTION,
  },
  robots: { index: true, follow: true },
}

const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0c0b]'
const PILL_LIGHT = `inline-flex items-center justify-center rounded-full bg-gradient-to-b from-white to-gray-300 px-6 py-3 text-sm font-semibold text-gray-900 shadow-[0_0_0_1px_rgba(255,255,255,0.35),0_10px_40px_rgba(255,255,255,0.12)] transition hover:to-white ${FOCUS}`
const PILL_GLASS = `inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10 ${FOCUS}`
const PANEL = 'rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02]'
const GLASS = 'rounded-2xl border border-white/10 bg-[#141816]/90 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur'

const TICKER = [
  'Contract pricing',
  'Volume tiers',
  'Live margin',
  'Margin alerts',
  'PDF quotes',
  'Orders and invoices',
  'QuickBooks Online',
  'Xero',
  'Customer portal',
  'Damaged goods log',
  'Audit trail',
]

const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

// Example numbers used only inside the illustrations below.
const SAMPLE_LINES = [
  { sku: 'TP-2PLY-96', qty: 4000, price: 9.8, cost: 7.9 },
  { sku: 'PT-HWT-6', qty: 1200, price: 24.5, cost: 17.6 },
  { sku: 'NK-1PLY-3M', qty: 800, price: 31.2, cost: 28.1 },
]

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-amber-200/90">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-300" />
      {children}
    </p>
  )
}

function ExampleTag() {
  return <span className="text-[10px] font-medium uppercase tracking-widest text-gray-500">Example data</span>
}

function QuoteMockup() {
  const total = SAMPLE_LINES.reduce((s, l) => s + l.qty * l.price, 0)
  const cost = SAMPLE_LINES.reduce((s, l) => s + l.qty * l.cost, 0)
  const blended = ((total - cost) / total) * 100
  return (
    <div className={`${GLASS} w-full p-4 text-left sm:p-5`} aria-hidden="true">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Quote for Northside Distributors</p>
          <p className="text-xs text-gray-400">Priced from: Contract book</p>
        </div>
        <ExampleTag />
      </div>
      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-xs sm:text-sm">
          <thead className="bg-white/5 text-left text-[10px] uppercase tracking-wider text-gray-400">
            <tr>
              <th className="px-3 py-2 font-medium">SKU</th>
              <th className="px-3 py-2 font-medium">Qty</th>
              <th className="px-3 py-2 font-medium">Price</th>
              <th className="px-3 py-2 text-right font-medium">Margin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-gray-200">
            {SAMPLE_LINES.map((l) => {
              const m = ((l.price - l.cost) / l.price) * 100
              const low = m < 15
              return (
                <tr key={l.sku}>
                  <td className="px-3 py-2 font-mono text-[11px] text-gray-300">{l.sku}</td>
                  <td className="px-3 py-2">{l.qty.toLocaleString()}</td>
                  <td className="px-3 py-2">{money(l.price)}</td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${low ? 'bg-red-500/15 text-red-300' : 'bg-emerald-500/15 text-emerald-300'}`}
                    >
                      {m.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-gray-400">Quote total</p>
          <p className="text-2xl font-semibold text-white">{money(total)}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wider text-gray-400">Blended margin</p>
          <p className="text-2xl font-semibold text-emerald-300">{blended.toFixed(1)}%</p>
        </div>
      </div>
    </div>
  )
}

function PriceBookMockup() {
  return (
    <div className={`${GLASS} p-4 text-left`} aria-hidden="true">
      <p className="text-xs font-semibold text-white">Price book: Northside</p>
      <p className="mb-3 text-[11px] text-gray-400">Contract · effective Jan 1</p>
      {[
        ['1 – 999', '$10.40'],
        ['1,000 – 4,999', '$10.10'],
        ['5,000+', '$9.80'],
      ].map(([tier, price], i) => (
        <div key={tier} className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${i === 2 ? 'bg-amber-300/10 text-amber-100' : 'text-gray-300'}`}>
          <span>{tier}</span>
          <span className="font-semibold">{price}</span>
        </div>
      ))}
    </div>
  )
}

function AlertMockup() {
  return (
    <div className={`${GLASS} p-4 text-left`} aria-hidden="true">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-red-400" />
        <p className="text-xs font-semibold text-white">Margin alert</p>
      </div>
      <p className="mt-2 text-xs text-gray-300">NK-1PLY-3M fell to 9.9% after a freight increase.</p>
      <p className="mt-1 text-[11px] text-gray-500">Review or reprice</p>
    </div>
  )
}

function ResolveVisual() {
  const steps = [
    ['Customer', 'Northside Distributors'],
    ['Price book', 'Contract, effective Jan 1'],
    ['Quantity tier', '5,000 and up'],
  ]
  return (
    <div className="flex h-full flex-col justify-center gap-3 p-6 sm:p-10" aria-hidden="true">
      {steps.map(([k, v], i) => (
        <div key={k} className={`${GLASS} flex items-center justify-between px-4 py-3`} style={{ marginLeft: `${i * 18}px` }}>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-500">{k}</p>
            <p className="text-sm text-gray-100">{v}</p>
          </div>
          <span className="text-emerald-300">✓</span>
        </div>
      ))}
      <div className="ml-[54px] rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-amber-200/70">Price used</p>
        <p className="text-2xl font-semibold text-amber-100">$9.80</p>
      </div>
      <div className="text-right"><ExampleTag /></div>
    </div>
  )
}

function MarginVisual() {
  const rows = [
    { sku: 'TP-2PLY-96', m: 19.4 },
    { sku: 'PT-HWT-6', m: 28.2 },
    { sku: 'NK-1PLY-3M', m: 9.9 },
    { sku: 'FC-2PLY-100', m: 22.7 },
  ]
  return (
    <div className="flex h-full flex-col justify-center p-6 sm:p-10" aria-hidden="true">
      <div className={`${GLASS} p-5`}>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Margin by line</p>
          <ExampleTag />
        </div>
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.sku}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-mono text-gray-300">{r.sku}</span>
                <span className={r.m < 15 ? 'font-semibold text-red-300' : 'text-gray-200'}>{r.m.toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div
                  className={`h-2 rounded-full ${r.m < 15 ? 'bg-red-400' : 'bg-gradient-to-r from-emerald-500 to-amber-300'}`}
                  style={{ width: `${Math.min(r.m * 3, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-gray-500">Lines under 15% show in red.</p>
      </div>
    </div>
  )
}

function AlertsVisual() {
  const items = [
    ['Freight up 8%', 'NK-1PLY-3M now 9.9%', 'bg-red-400'],
    ['Pulp price change', 'TP-2PLY-96 now 14.2%', 'bg-red-400'],
    ['Cost updated', 'PT-HWT-6 still 28.2%', 'bg-emerald-400'],
  ]
  return (
    <div className="flex h-full flex-col justify-center gap-3 p-6 sm:p-10" aria-hidden="true">
      {items.map(([a, b, dot]) => (
        <div key={a} className={`${GLASS} flex items-center gap-3 px-4 py-3`}>
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
          <div>
            <p className="text-sm text-gray-100">{a}</p>
            <p className="text-xs text-gray-400">{b}</p>
          </div>
        </div>
      ))}
      <div className="text-right"><ExampleTag /></div>
    </div>
  )
}

const VISUALS = [<ResolveVisual key="r" />, <MarginVisual key="m" />, <AlertsVisual key="a" />]

export default function HomePage() {
  return (
    <div className="relative overflow-x-clip scroll-smooth bg-[#0a0c0b] text-gray-100">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLdString(softwareJsonLd()) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLdString(organizationJsonLd()) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLdString(faqJsonLd()) }} />

      {/* Hero background: a soft spotlight and a grid floor */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[900px] overflow-hidden">
        <div className="lp-glow absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(52,140,100,0.55),rgba(52,140,100,0)_70%)] blur-2xl" />
        <div className="lp-glow absolute -top-32 left-[18%] h-[360px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(240,180,90,0.35),rgba(240,180,90,0)_70%)] blur-2xl" style={{ animationDelay: '-3s' }} />
        <div className="lp-grid-floor absolute inset-x-[-10%] top-[300px] h-[620px]" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent to-[#0a0c0b]" />
      </div>

      <header className="relative z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-6">
          <Link href="/" aria-label={`${SITE_NAME} home`} className={`rounded-lg ${FOCUS}`}>
            <Logo uid="hdr" size={34} tone="dark" />
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-8 text-sm text-gray-300 md:flex">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#how-it-works" className="hover:text-white">How it works</a>
            <a href="#compare" className="hover:text-white">Compare</a>
            <a href="#faq" className="hover:text-white">FAQ</a>
            <Link href="/contact" className="hover:text-white">Contact</Link>
          </nav>
          <Link href="/login" className={PILL_LIGHT}>Sign in</Link>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section aria-labelledby="hero-heading" className="mx-auto max-w-5xl px-5 pt-10 text-center sm:px-6 sm:pt-16">
          <div className="lp-rise" style={{ ['--d' as string]: '0.05s' }}>
            <Eyebrow>For tissue and paper converters</Eyebrow>
          </div>
          <h1
            id="hero-heading"
            className="lp-rise mt-6 bg-gradient-to-b from-white to-gray-400 bg-clip-text text-4xl font-semibold leading-[1.08] tracking-tight text-transparent sm:text-6xl"
            style={{ ['--d' as string]: '0.15s' }}
          >
            {HERO_H1}
          </h1>
          <p
            className="lp-rise mx-auto mt-6 max-w-2xl text-base leading-relaxed text-gray-300 sm:text-lg"
            style={{ ['--d' as string]: '0.3s' }}
          >
            {HERO_SUBHEAD}
          </p>
          <div
            className="lp-rise mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
            style={{ ['--d' as string]: '0.45s' }}
          >
            <Link href="/login" className={PILL_LIGHT}>Sign in to PlyCount</Link>
            <Link href="/staff/join" className={PILL_GLASS}>Factory staff? Request access</Link>
          </div>
          <p className="lp-rise mt-5 text-sm text-gray-400" style={{ ['--d' as string]: '0.55s' }}>
            Costs stay private: your sales staff and your customers never see them.
          </p>

          {/* Product peek */}
          <div className="lp-rise relative mx-auto mt-14 max-w-3xl pb-4" style={{ ['--d' as string]: '0.7s' }}>
            <div className="lp-float absolute -left-24 top-24 hidden w-52 -rotate-3 lg:block" style={{ ['--d' as string]: '-2s' }}>
              <PriceBookMockup />
            </div>
            <div className="lp-float absolute -right-24 top-40 hidden w-52 rotate-3 lg:block" style={{ ['--d' as string]: '-4s' }}>
              <AlertMockup />
            </div>
            <div className="relative mx-auto max-w-xl">
              <QuoteMockup />
            </div>
          </div>
        </section>

        {/* Ticker of what is in the product */}
        <section aria-label="What PlyCount covers" className="mt-16 border-y border-white/5 py-6">
          <div
            className="lp-marquee overflow-hidden"
            style={{ WebkitMaskImage: 'linear-gradient(to right, transparent, black 12%, black 88%, transparent)', maskImage: 'linear-gradient(to right, transparent, black 12%, black 88%, transparent)' }}
          >
            <ul className="lp-marquee-track gap-10 pr-10">
              {[...TICKER, ...TICKER].map((t, i) => (
                <li
                  key={`${t}-${i}`}
                  aria-hidden={i >= TICKER.length ? true : undefined}
                  className="flex shrink-0 items-center gap-10 text-lg font-medium text-gray-400"
                >
                  {t}
                  <span aria-hidden="true" className="h-1 w-1 rounded-full bg-amber-300/70" />
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Pain */}
        <section aria-labelledby="problem-heading" className="mx-auto max-w-6xl px-5 py-24 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 id="problem-heading" className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              Pulp costs move. Your price book doesn&rsquo;t.
            </h2>
            <p className="mt-4 text-gray-400">Three ways margin quietly leaks out of a converter&rsquo;s quotes.</p>
          </div>
          <ul className="mt-12 grid gap-5 md:grid-cols-3">
            {PAIN_POINTS.map((p, i) => (
              <li key={p} className={`${PANEL} p-6`}>
                <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-300/30 bg-amber-300/10 text-sm font-semibold text-amber-200">
                  {i + 1}
                </span>
                <p className="mt-5 leading-relaxed text-gray-200">{p}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Feature panels */}
        <section id="features" aria-labelledby="features-heading" className="mx-auto max-w-6xl px-5 pb-8 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 id="features-heading" className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              Contract pricing software for paper converters, built for how you quote
            </h2>
          </div>
          <div className="mt-14 space-y-6">
            {FEATURES.map((f, i) => (
              <article key={f.title} className={`${PANEL} grid overflow-hidden md:grid-cols-2`}>
                <div className={`flex flex-col justify-center p-8 sm:p-12 ${i % 2 === 1 ? 'md:order-2' : ''}`}>
                  <h3 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{f.title}</h3>
                  <p className="mt-4 leading-relaxed text-gray-300">{f.body}</p>
                </div>
                <div className={`relative min-h-[300px] border-t border-white/5 bg-[radial-gradient(ellipse_at_center,rgba(52,140,100,0.18),transparent_70%)] md:border-t-0 ${i % 2 === 1 ? 'md:order-1 md:border-r' : 'md:border-l'} md:border-white/5`}>
                  {VISUALS[i]}
                </div>
              </article>
            ))}
          </div>

          {/* More features */}
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
            {MORE_FEATURES.map((f, i) => (
              <article key={f.title} className={`${PANEL} p-6 ${i < 2 ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
                <h3 className="font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" aria-labelledby="how-heading" className="mx-auto max-w-6xl px-5 py-24 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 id="how-heading" className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">How PlyCount works</h2>
            <p className="mt-4 text-gray-400">From your first SKU to a quote with margin you can trust.</p>
          </div>
          <ol className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className={`${PANEL} relative p-6`}>
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-amber-200 to-amber-400 text-base font-bold text-gray-900 shadow-[0_0_30px_rgba(240,180,90,0.35)]"
                >
                  {i + 1}
                </span>
                <h3 className="mt-5 font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Comparison */}
        <section id="compare" aria-labelledby="compare-heading" className="mx-auto max-w-5xl px-5 pb-24 sm:px-6">
          <h2 id="compare-heading" className="text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            PlyCount vs. spreadsheets for converter pricing
          </h2>
          <div className={`${PANEL} mt-10 overflow-x-auto`}>
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-gray-400">
                <tr>
                  <th scope="col" className="px-5 py-4 font-medium">What you need</th>
                  <th scope="col" className="px-5 py-4 font-medium">Spreadsheets</th>
                  <th scope="col" className="px-5 py-4 font-medium text-amber-200">PlyCount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {COMPARISON_ROWS.map((r) => (
                  <tr key={r.topic}>
                    <th scope="row" className="px-5 py-4 font-medium text-white">{r.topic}</th>
                    <td className="px-5 py-4 text-gray-400">{r.spreadsheet}</td>
                    <td className="px-5 py-4 font-medium text-gray-100">{r.plycount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" aria-labelledby="faq-heading" className="mx-auto max-w-3xl px-5 pb-24 sm:px-6">
          <h2 id="faq-heading" className="text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Frequently asked questions
          </h2>
          <div className="mt-10 space-y-3">
            {FAQS.map((f) => (
              <details key={f.question} className={`${PANEL} group px-6 py-5`}>
                <summary className="flex list-none items-center justify-between gap-4 text-left [&::-webkit-details-marker]:hidden">
                  <h3 className="text-base font-semibold text-white sm:text-lg">{f.question}</h3>
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 text-gray-300 transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-4 leading-relaxed text-gray-300">{f.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section aria-labelledby="cta-heading" className="relative mx-auto max-w-6xl px-5 pb-24 sm:px-6">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0e1210] px-6 py-20 text-center sm:py-28">
            <div aria-hidden="true" className="lp-glow absolute left-1/2 top-0 h-[380px] w-[780px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[radial-gradient(closest-side,rgba(52,140,100,0.6),rgba(52,140,100,0)_70%)] blur-2xl" />
            <div aria-hidden="true" className="lp-float absolute left-6 top-8 hidden w-52 -rotate-6 opacity-80 xl:block"><AlertMockup /></div>
            <div aria-hidden="true" className="lp-float absolute bottom-8 right-6 hidden w-52 rotate-6 opacity-80 xl:block" style={{ ['--d' as string]: '-3s' }}><PriceBookMockup /></div>
            <div className="relative mx-auto max-w-2xl">
              <h2 id="cta-heading" className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                See your real margin before the next quote goes out
              </h2>
              <p className="mt-5 text-gray-300">
                Access is by approval. Existing users sign in; factory staff can request access and the
                administrator approves each request.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/login" className={PILL_LIGHT}>Sign in</Link>
                <Link href="/staff/join" className={PILL_GLASS}>Request staff access</Link>
                <Link href="/contact" className={PILL_GLASS}>Contact us</Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-gray-500 sm:flex-row sm:px-6">
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Logo uid="ftr" size={26} tone="dark" />
            <p>&copy; {new Date().getFullYear()} {SITE_NAME}. Contract pricing and margin software for paper converters.</p>
          </div>
          <nav aria-label="Footer" className="flex gap-5">
            <Link href="/login" className="hover:text-gray-200">Sign in</Link>
            <Link href="/staff/join" className="hover:text-gray-200">Request staff access</Link>
            <Link href="/contact" className="hover:text-gray-200">Contact us</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
