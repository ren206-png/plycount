import { expect, type Page } from '@playwright/test'
import { PASSWORD } from './seed'

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto('/login')
  await page.locator('input[type=email]').fill(email)
  await page.locator('input[type=password]').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

export async function expectOnDashboard(page: Page) {
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByRole('link', { name: 'Quotes', exact: true })).toBeVisible()
}

export async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).filter({ visible: true }).first().click()
  await expect(page).toHaveURL(/\/login/)
}
