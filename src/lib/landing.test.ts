import { describe, expect, it } from 'vitest'
import {
  FAQS,
  HERO_H1,
  HERO_SUBHEAD,
  OG_DESCRIPTION,
  OG_TITLE,
  PAGE_DESCRIPTION,
  PAGE_TITLE,
  PRIMARY_KEYWORD,
  TITLE_SUFFIX,
  faqJsonLd,
  organizationJsonLd,
  softwareJsonLd,
  toJsonLdString,
} from './landing'
import { SITE_URL } from './site'
import robots from '@/app/robots'
import sitemap from '@/app/sitemap'

const words = (s: string) => s.trim().split(/\s+/).length

describe('landing page SEO rules', () => {
  it('has a title tag of at most 60 characters with the primary keyword first', () => {
    const fullTitle = PAGE_TITLE + TITLE_SUFFIX
    expect(fullTitle.length).toBeLessThanOrEqual(60)
    expect(PAGE_TITLE.toLowerCase().startsWith('contract pricing software')).toBe(true)
  })

  it('has a meta description of 140 to 155 characters', () => {
    expect(PAGE_DESCRIPTION.length).toBeGreaterThanOrEqual(140)
    expect(PAGE_DESCRIPTION.length).toBeLessThanOrEqual(155)
  })

  it('keeps the H1 different from the title tag but with the primary keyword', () => {
    expect(HERO_H1).not.toBe(PAGE_TITLE)
    expect(HERO_H1.toLowerCase()).toContain(PRIMARY_KEYWORD)
  })

  it('uses the primary keyword in the first 100 words of body copy', () => {
    const opening = `${HERO_H1} ${HERO_SUBHEAD}`.split(/\s+/).slice(0, 100).join(' ').toLowerCase()
    expect(opening).toContain(PRIMARY_KEYWORD)
  })

  it('has social metadata of sensible length', () => {
    expect(OG_TITLE.length).toBeLessThanOrEqual(70)
    expect(OG_DESCRIPTION.length).toBeGreaterThan(60)
    expect(OG_DESCRIPTION.length).toBeLessThanOrEqual(200)
  })

  it('gives the featured-snippet question a 40 to 60 word direct answer', () => {
    const snippet = FAQS[0]
    expect(snippet.question.toLowerCase()).toContain('contract pricing software for paper converters')
    expect(words(snippet.answer)).toBeGreaterThanOrEqual(40)
    expect(words(snippet.answer)).toBeLessThanOrEqual(60)
  })
})

describe('structured data', () => {
  it('describes the app as a web business application with no invented price or rating', () => {
    const data = softwareJsonLd() as Record<string, unknown>
    expect(data['@type']).toBe('SoftwareApplication')
    expect(data.applicationCategory).toBe('BusinessApplication')
    expect(data.operatingSystem).toBe('Web')
    expect(data.url).toBe(SITE_URL)
    expect(data).not.toHaveProperty('offers')
    expect(data).not.toHaveProperty('aggregateRating')
  })

  it('mirrors every visible FAQ in the FAQPage data', () => {
    const data = faqJsonLd()
    expect(data['@type']).toBe('FAQPage')
    expect(data.mainEntity).toHaveLength(FAQS.length)
    expect(data.mainEntity[0].name).toBe(FAQS[0].question)
    expect(data.mainEntity[0].acceptedAnswer.text).toBe(FAQS[0].answer)
  })

  it('names the organization at the site URL', () => {
    expect(organizationJsonLd()).toMatchObject({ '@type': 'Organization', name: 'PlyCount', url: SITE_URL })
  })

  it('cannot be used to break out of the script tag', () => {
    const out = toJsonLdString({ text: '</script><script>alert(1)</script>' })
    expect(out).not.toContain('</script>')
    expect(out).toContain('\\u003c/script>')
    expect(JSON.parse(out).text).toBe('</script><script>alert(1)</script>')
  })
})

describe('crawler files', () => {
  it('lists only the public landing page in the sitemap', () => {
    expect(sitemap().map((e) => e.url)).toEqual([SITE_URL])
  })

  it('keeps crawlers out of the private app and points at the sitemap', () => {
    const r = robots()
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules
    const disallow = ([] as string[]).concat(rule.disallow ?? [])
    for (const p of ['/dashboard', '/portal', '/api/', '/login', '/pending', '/staff/']) {
      expect(disallow).toContain(p)
    }
    expect(rule.allow).toBe('/')
    expect(r.sitemap).toBe(`${SITE_URL}/sitemap.xml`)
  })
})
