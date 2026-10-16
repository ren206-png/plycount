// Lets "New quote" send the user to create a customer and come back with that
// customer already selected. Only this one internal return path is honoured, so
// the `next` query value can never be used as an open redirect.
import { isUUID } from '@/lib/utils'

export const NEW_QUOTE_PATH = '/dashboard/quotes/new'

export function newCustomerFromQuoteHref(): string {
  return `/dashboard/customers/new?next=${encodeURIComponent(NEW_QUOTE_PATH)}`
}

export function afterCustomerCreatedPath(search: string, customerId: string): string {
  const next = new URLSearchParams(search).get('next')
  return next === NEW_QUOTE_PATH && isUUID(customerId)
    ? `${NEW_QUOTE_PATH}?customer=${customerId}`
    : '/dashboard/customers'
}

export function customerFromSearch(search: string): string | null {
  const id = new URLSearchParams(search).get('customer')
  return id && isUUID(id) ? id : null
}
