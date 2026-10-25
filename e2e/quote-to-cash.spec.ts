import { expect, test } from '@playwright/test'
import { expectOnDashboard, signIn } from './helpers'
import { seedCompany, type Seeded } from './seed'

// The money path the factory lives on: quote, order, fulfil, invoice, get paid.
test.describe('quote to cash', () => {
  let co: Seeded
  test.beforeAll(async () => {
    co = await seedCompany('cash')
  })

  test('a quote becomes an order, an invoice and a paid invoice', async ({ page }) => {
    await signIn(page, co.email)
    await expectOnDashboard(page)

    // 1. Quote: 10 cases at a hand-typed $12.50 (no price book in this company).
    await page.goto('/dashboard/quotes/new')
    await page.locator('select').first().selectOption({ label: co.customerName })
    await page.locator('select').nth(1).selectOption({ label: `${co.sku} — ${co.productName}` })
    await page.locator('input[type=number]').first().fill('10')
    await page.getByRole('button', { name: 'Add line' }).click()
    const price = page.locator('table input[type=number]').first()
    await expect(price).toBeVisible()
    await price.fill('12.5')
    await expect(page.locator('tfoot')).toContainText('$125.00')
    await page.getByRole('button', { name: 'Save quote as draft' }).click()
    await expect(page.getByRole('heading', { name: `Quote for ${co.customerName}` })).toBeVisible()

    // 2. Order
    await page.getByRole('button', { name: 'Convert to order' }).click()
    await expect(page.getByRole('heading', { name: `Order for ${co.customerName}` })).toBeVisible()

    // 3. Fulfil all 10 cases, then bill them
    const fulfilled = page.locator('tbody input[type=number]').first()
    await fulfilled.fill('10')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Fulfillment updated')).toBeVisible()
    await page.getByRole('button', { name: 'Create draft invoice for fulfilled qty' }).click()
    await expect(page.getByText('Draft invoice created')).toBeVisible()
    await page.getByRole('link', { name: /^INV-\d+/ }).first().click()

    // 4. Invoice: send (without emailing), then record the full payment
    await expect(page.getByRole('heading', { name: /^INV-\d+/ })).toBeVisible()
    await page.getByRole('button', { name: 'Mark as sent (without emailing)' }).click()
    await expect(page.getByText('Marked as sent')).toBeVisible()
    await page.getByRole('button', { name: 'Full balance' }).click()
    await page.getByRole('button', { name: 'Record payment' }).click()
    await expect(page.getByText('Payment recorded')).toBeVisible()
    await expect(page.getByText('Paid', { exact: true }).first()).toBeVisible()
  })
})
