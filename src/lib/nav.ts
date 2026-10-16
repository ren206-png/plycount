// ============================================================
// Dashboard sidebar and page-access rules, by role.
//
//   platform admin  everything, plus Account approvals (under Overview)
//   org admin       everything except approvals
//   staff           "sales basics": view customers, products, price books and
//                   orders; create, edit and email quotes. No costs, margins,
//                   cost inputs, billing, integrations or approvals.
//
// This is the UI half only. The database (RLS) is what actually enforces
// staff limits (see migration 016); these rules just keep the app from
// showing pages and buttons a staff login cannot use.
// ============================================================
export interface NavItem {
  href: string
  label: string
}

export interface AccessFlags {
  isPlatformAdmin: boolean
  isOrgAdmin: boolean
}

export const APPROVALS_HREF = '/dashboard/admin/approvals'

const ALL_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/customers', label: 'Customers' },
  { href: '/dashboard/products', label: 'Products (SKUs)' },
  { href: '/dashboard/cost-inputs', label: 'Cost Inputs' },
  { href: '/dashboard/import', label: 'Import data' },
  { href: '/dashboard/price-books', label: 'Price Books' },
  { href: '/dashboard/quotes', label: 'Quotes' },
  { href: '/dashboard/orders', label: 'Orders' },
  { href: '/dashboard/production-losses', label: 'Damaged goods' },
  { href: '/dashboard/margin-alerts', label: 'Margin Alerts' },
  { href: '/dashboard/margin', label: 'Margin Dashboard' },
  { href: '/dashboard/settings/billing', label: 'Billing' },
  { href: '/dashboard/settings/integrations', label: 'Integrations' },
]

const STAFF_HREFS = new Set([
  '/dashboard',
  '/dashboard/customers',
  '/dashboard/products',
  '/dashboard/price-books',
  '/dashboard/quotes',
  '/dashboard/orders',
])

// Pages (and everything under them) that only admins may open.
const ADMIN_ONLY_PREFIXES = [
  '/dashboard/cost-inputs',
  '/dashboard/import',
  '/dashboard/production-losses',
  '/dashboard/margin-alerts',
  '/dashboard/margin',
  '/dashboard/settings',
  '/dashboard/customers/', // new + edit forms; staff use the list only
  '/dashboard/products/',
  '/dashboard/price-books/new',
  '/dashboard/orders/new',
]

export function buildNav(flags: AccessFlags): NavItem[] {
  if (!flags.isOrgAdmin) return ALL_NAV.filter((i) => STAFF_HREFS.has(i.href))
  if (!flags.isPlatformAdmin) return ALL_NAV
  const [overview, ...rest] = ALL_NAV
  return [overview, { href: APPROVALS_HREF, label: 'Account approvals' }, ...rest]
}

export function canAccessPath(pathname: string, flags: AccessFlags): boolean {
  if (pathname === APPROVALS_HREF || pathname.startsWith('/dashboard/admin')) return flags.isPlatformAdmin
  if (flags.isOrgAdmin) return true
  return !ADMIN_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(p.endsWith('/') ? p : p + '/'))
}
