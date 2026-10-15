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

const CTA_PRIMARY =
  'rounded-md bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2'
const CTA_SECONDARY =
  'rounded-md border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-800 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2'

export default function HomePage() {
  return (
    <div className="scroll-smooth bg-white text-gray-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLdString(softwareJsonLd()) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLdString(organizationJsonLd()) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLdString(faqJsonLd()) }} />

      <header className="border-b border-gray-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold tracking-tight text-brand-700">
            {SITE_NAME}
          </Link>
          <nav aria-label="Main" className="flex items-center gap-6 text-sm font-medium text-gray-600">
            <a href="#features" className="hidden hover:text-gray-900 sm:inline">Features</a>
            <a href="#how-it-works" className="hidden hover:text-gray-900 sm:inline">How it works</a>
            <a href="#faq" className="hidden hover:text-gray-900 sm:inline">FAQ</a>
            <Link href="/login" className="rounded-md bg-brand-600 px-4 py-2 text-white hover:bg-brand-700">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section aria-labelledby="hero-heading" className="bg-brand-50">
          <div className="mx-auto max-w-4xl px-6 py-20 text-center sm:py-28">
            <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-brand-600">
              For tissue and paper converters
            </p>
            <h1 id="hero-heading" className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {HERO_H1}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-600">{HERO_SUBHEAD}</p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/login" className={CTA_PRIMARY}>
                Sign in to PlyCount
              </Link>
              <Link href="/staff/join" className={CTA_SECONDARY}>
                Factory staff? Request access
              </Link>
            </div>
            <p className="mt-6 text-sm text-gray-500">
              Costs stay private: your sales staff and your customers never see them.
            </p>
          </div>
        </section>

        {/* Pain */}
        <section aria-labelledby="problem-heading" className="mx-auto max-w-4xl px-6 py-16">
          <h2 id="problem-heading" className="text-3xl font-bold tracking-tight">
            Pulp costs move. Your price book doesn&rsquo;t.
          </h2>
          <ul className="mt-8 space-y-4">
            {PAIN_POINTS.map((p) => (
              <li key={p} className="flex gap-3 text-lg leading-relaxed text-gray-700">
                <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Features */}
        <section id="features" aria-labelledby="features-heading" className="bg-gray-50">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 id="features-heading" className="text-3xl font-bold tracking-tight">
              Contract pricing software for paper converters, built for how you quote
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {FEATURES.map((f) => (
                <article key={f.title} className="rounded-lg border border-gray-200 bg-white p-6">
                  <h3 className="text-lg font-semibold text-gray-900">{f.title}</h3>
                  <p className="mt-3 leading-relaxed text-gray-600">{f.body}</p>
                </article>
              ))}
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {MORE_FEATURES.map((f) => (
                <article key={f.title} className="rounded-lg border border-gray-200 bg-white p-5">
                  <h3 className="font-semibold text-gray-900">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{f.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" aria-labelledby="how-heading" className="mx-auto max-w-5xl px-6 py-16">
          <h2 id="how-heading" className="text-3xl font-bold tracking-tight">How PlyCount works</h2>
          <ol className="mt-10 grid gap-6 sm:grid-cols-2">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-gray-900">{s.title}</h3>
                  <p className="mt-1 leading-relaxed text-gray-600">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Comparison */}
        <section aria-labelledby="compare-heading" className="bg-gray-50">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <h2 id="compare-heading" className="text-3xl font-bold tracking-tight">
              PlyCount vs. spreadsheets for converter pricing
            </h2>
            <div className="mt-8 overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">What you need</th>
                    <th scope="col" className="px-4 py-3">Spreadsheets</th>
                    <th scope="col" className="px-4 py-3 text-brand-700">PlyCount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {COMPARISON_ROWS.map((r) => (
                    <tr key={r.topic}>
                      <th scope="row" className="px-4 py-3 font-medium text-gray-900">{r.topic}</th>
                      <td className="px-4 py-3 text-gray-600">{r.spreadsheet}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{r.plycount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" aria-labelledby="faq-heading" className="mx-auto max-w-3xl px-6 py-16">
          <h2 id="faq-heading" className="text-3xl font-bold tracking-tight">Frequently asked questions</h2>
          <dl className="mt-8 space-y-8">
            {FAQS.map((f) => (
              <div key={f.question}>
                <dt>
                  <h3 className="text-lg font-semibold text-gray-900">{f.question}</h3>
                </dt>
                <dd className="mt-2 leading-relaxed text-gray-600">{f.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Final CTA */}
        <section aria-labelledby="cta-heading" className="bg-brand-700">
          <div className="mx-auto max-w-3xl px-6 py-16 text-center">
            <h2 id="cta-heading" className="text-3xl font-bold tracking-tight text-white">
              See your real margin before the next quote goes out
            </h2>
            <p className="mt-4 text-brand-100">
              Access is by approval. Existing users sign in; factory staff can request access and the
              administrator approves each request.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/login"
                className="rounded-md bg-white px-6 py-3 text-base font-semibold text-brand-700 hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-700"
              >
                Sign in
              </Link>
              <Link
                href="/staff/join"
                className="rounded-md border border-white/60 px-6 py-3 text-base font-semibold text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Request staff access
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-gray-500 sm:flex-row">
          <p>&copy; {new Date().getFullYear()} {SITE_NAME}. Contract pricing and margin software for paper converters.</p>
          <nav aria-label="Footer" className="flex gap-5">
            <Link href="/login" className="hover:text-gray-800">Sign in</Link>
            <Link href="/staff/join" className="hover:text-gray-800">Request staff access</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
