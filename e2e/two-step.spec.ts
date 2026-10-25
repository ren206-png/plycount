import { expect, test } from '@playwright/test'
import { expectOnDashboard, signIn, signOut } from './helpers'
import { PASSWORD, anonClient, seedCompany, type Seeded } from './seed'
import { totpCode } from './totp'

// The authenticator-app sign-in, end to end: turn it on, sign out, and check that
// the password alone no longer gets in (neither through the pages nor the database).
test.describe.configure({ mode: 'serial' })

test.describe('two-step sign-in', () => {
  let co: Seeded
  let secret = ''
  test.beforeAll(async () => {
    co = await seedCompany('mfa')
  })

  test('the owner turns it on with a code from an authenticator app', async ({ page }) => {
    await signIn(page, co.email)
    await expectOnDashboard(page)
    await expect(page.getByText('Turn on two-step sign-in')).toBeVisible() // the reminder banner

    await page.goto('/dashboard/settings/security')
    await page.getByRole('button', { name: 'Set up two-step sign-in' }).click()
    await expect(page.getByAltText(/QR code/i)).toBeVisible()
    secret = (await page.locator('span.font-mono').innerText()).trim()
    expect(secret.length).toBeGreaterThan(10)

    await page.getByPlaceholder('123456').fill(totpCode(secret))
    await page.getByRole('button', { name: 'Turn on' }).click()
    await expect(page.getByText('You will be asked for a code')).toBeVisible()
  })

  test('the password alone no longer gets into the app', async ({ page }) => {
    await signIn(page, co.email)
    await expect(page.getByRole('heading', { name: 'Enter your code' })).toBeVisible()
    // Even typing the address by hand: the dashboard sends them back to the code screen.
    await page.goto('/dashboard/quotes')
    await expect(page).toHaveURL(/\/login\?mfa=1/)
    await expect(page.getByRole('heading', { name: 'Enter your code' })).toBeVisible()
  })

  test('a password-only session sees no company data through the database either', async () => {
    const client = anonClient()
    const { error } = await client.auth.signInWithPassword({ email: co.email, password: PASSWORD })
    expect(error).toBeNull()
    const customers = await client.from('customers').select('id')
    expect(customers.data ?? []).toHaveLength(0) // seeded with one; the half-signed-in session sees none
    const products = await client.from('products').select('id')
    expect(products.data ?? []).toHaveLength(0)
  })

  test('a wrong code is refused, the right code signs in', async ({ page }) => {
    await signIn(page, co.email)
    await expect(page.getByRole('heading', { name: 'Enter your code' })).toBeVisible()

    await page.locator('#mfa-code').fill('000000')
    await page.getByRole('button', { name: 'Verify and sign in' }).click()
    await expect(page.getByText(/code did not work/i)).toBeVisible()
    await expect(page).toHaveURL(/\/login/)

    await page.locator('#mfa-code').fill(totpCode(secret))
    await page.getByRole('button', { name: 'Verify and sign in' }).click()
    await expectOnDashboard(page)
    await expect(page.getByText('Turn on two-step sign-in')).toHaveCount(0) // reminder is gone
    await signOut(page)
  })
})
