import { expect, test } from '@playwright/test'
import { adminClient } from './seed'

const message = { name: 'Pat Lee', email: 'pat@example.com', company: 'Lee Paper', message: 'We would like a quote for 2-ply tissue.' }

// A different caller address per test so the hourly limits never collide.
let n = 0
function callerIp() {
  n += 1
  return `203.0.113.${(Date.now() + n) % 250}`
}

test.describe('contact us', () => {
  test.beforeAll(async () => {
    // Start each run with empty rate-limit counters (they last an hour).
    const { error } = await adminClient().from('rate_limit_buckets').delete().like('key', 'contact:%')
    expect(error).toBeNull()
  })

  test('the home page has a Contact link that opens the form', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Contact' }).click()
    await expect(page).toHaveURL(/\/contact$/)
    await expect(page.getByRole('heading', { name: 'Contact us' })).toBeVisible()
  })

  test('the form asks for what is missing and sends nothing', async ({ page }) => {
    let sent = false
    page.on('request', (r) => {
      if (r.url().includes('/api/contact')) sent = true
    })
    await page.goto('/contact')
    await page.getByRole('button', { name: 'Send message' }).click()
    await expect(page.getByText('Please enter your name.')).toBeVisible()
    await expect(page.getByText('Please enter a valid email address.')).toBeVisible()
    await expect(page.getByText(/at least 10 characters/)).toBeVisible()
    expect(sent).toBe(false)
  })

  test('a filled-in form is accepted and the visitor sees a thank-you', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': callerIp() })
    await page.goto('/contact')
    await page.getByLabel('Your name').fill(message.name)
    await page.getByLabel('Email').fill(message.email)
    await page.getByLabel(/Company/).fill(message.company)
    await page.getByLabel('How can we help?').fill(message.message)
    await page.getByRole('button', { name: 'Send message' }).click()
    await expect(page.getByText('Thank you, your message is on its way.')).toBeVisible()
    await expect(page.getByText('We will reply to pat@example.com.')).toBeVisible()
  })

  test('the endpoint refuses bad input', async ({ request }) => {
    const res = await request.post('/api/contact', { data: { name: '', email: 'nope', message: 'hi' }, headers: { 'x-forwarded-for': callerIp() } })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(Object.keys(body.fields).sort()).toEqual(['email', 'message', 'name'])
  })

  test('a bot that fills the hidden field is quietly ignored (and not counted)', async ({ request }) => {
    const ip = callerIp()
    for (let i = 0; i < 8; i++) {
      const res = await request.post('/api/contact', { data: { ...message, website: 'http://spam.test' }, headers: { 'x-forwarded-for': ip } })
      expect(res.status()).toBe(200)
    }
    // none of those used up this address's allowance
    const real = await request.post('/api/contact', { data: message, headers: { 'x-forwarded-for': ip } })
    expect(real.status()).toBe(200)
  })

  test('one address can send only five messages an hour', async ({ request }) => {
    const ip = callerIp()
    for (let i = 0; i < 5; i++) {
      const res = await request.post('/api/contact', { data: message, headers: { 'x-forwarded-for': ip } })
      expect(res.status(), `message ${i + 1}`).toBe(200)
    }
    const sixth = await request.post('/api/contact', { data: message, headers: { 'x-forwarded-for': ip } })
    expect(sixth.status()).toBe(429)
    // a different address is unaffected
    const other = await request.post('/api/contact', { data: message, headers: { 'x-forwarded-for': callerIp() } })
    expect(other.status()).toBe(200)
  })

  test('oversized and malformed requests are refused', async ({ request }) => {
    const big = await request.post('/api/contact', { data: { ...message, message: 'x'.repeat(30_000) } })
    expect(big.status()).toBe(413)
    const junk = await request.post('/api/contact', { data: 'not json', headers: { 'content-type': 'application/json' } })
    expect(junk.status()).toBe(400)
  })
})
