// ============================================================
// Dashboard sidebar. The platform admin also gets "Account approvals",
// placed right under Overview (not buried at the bottom) because new
// signups are locked out until they are approved there.
// ============================================================
export interface NavItem {
  href: string
  label: string
}

export const APPROVALS_HREF = '/dashboard/admin/approvals'

const BASE_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/customers', label: 'Customers' },
  { href: '/dashboard/products', label: 'Products (SKUs)' },
  { href: '/dashboard/cost-inputs', label: 'Cost Inputs' },
  { href: '/dashboard/price-books', label: 'Price Books' },
  { href: '/dashboard/quotes', label: 'Quotes' },
  { href: '/dashboard/orders', label: 'Orders' },
  { href: '/dashboard/margin-alerts', label: 'Margin Alerts' },
  { href: '/dashboard/margin', label: 'Margin Dashboard' },
  { href: '/dashboard/settings/billing', label: 'Billing' },
  { href: '/dashboard/settings/integrations', label: 'Integrations' },
]

export function buildNav(isPlatformAdmin: boolean): NavItem[] {
  if (!isPlatformAdmin) return BASE_NAV
  const [overview, ...rest] = BASE_NAV
  return [overview, { href: APPROVALS_HREF, label: 'Account approvals' }, ...rest]
}
