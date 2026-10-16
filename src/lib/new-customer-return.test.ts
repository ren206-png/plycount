import { describe, expect, it } from 'vitest'
import { afterCustomerCreatedPath, customerFromSearch, newCustomerFromQuoteHref } from './new-customer-return'

const ID = '69e588a5-cbfe-4100-8806-43534c089f77'

describe('new customer from a quote', () => {
  it('links to the customer form with the quote page as the return path', () => {
    expect(newCustomerFromQuoteHref()).toBe('/dashboard/customers/new?next=%2Fdashboard%2Fquotes%2Fnew')
  })

  it('returns to the new quote with the customer selected', () => {
    expect(afterCustomerCreatedPath('?next=%2Fdashboard%2Fquotes%2Fnew', ID)).toBe(`/dashboard/quotes/new?customer=${ID}`)
  })

  it('goes to the customer list when there is no return path', () => {
    expect(afterCustomerCreatedPath('', ID)).toBe('/dashboard/customers')
  })

  it('ignores any other return path', () => {
    for (const next of ['https://evil.example', '//evil.example', '/dashboard/orders', '/dashboard/quotes/new/../x']) {
      expect(afterCustomerCreatedPath(`?next=${encodeURIComponent(next)}`, ID)).toBe('/dashboard/customers')
    }
  })

  it('only accepts a real id for the preselected customer', () => {
    expect(customerFromSearch(`?customer=${ID}`)).toBe(ID)
    expect(customerFromSearch('?customer=nope')).toBeNull()
    expect(customerFromSearch('')).toBeNull()
  })
})
