import { expect, test } from '@playwright/test'
import { expectOnDashboard, signIn, signOut } from './helpers'
import { seedCompany, type Seeded } from './seed'

test.describe('signing in and out', () => {
  let co: Seeded
  test.beforeAll(async () => {
    co = await seedCompany('signin')
  })

  test('a signed-out visitor is sent to the sign-in page', async ({ page }) => {
    await page.goto('/dashboard/quotes')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard%2Fquotes/)
  })

  test('a wrong password is refused and nothing opens', async ({ page }) => {
    await signIn(page, co.email, 'not-the-password')
    await expect(page.getByText(/invalid login credentials/i)).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('the right password opens the dashboard, and signing out closes it again', async ({ page }) => {
    await signIn(page, co.email)
    await expectOnDashboard(page)
    await signOut(page)
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('the pages carry the security headers', async ({ page }) => {
    const res = await page.goto('/login')
    const h = res!.headers()
    expect(h['x-frame-options']).toBe('DENY')
    expect(h['x-content-type-options']).toBe('nosniff')
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'")
  })
})
