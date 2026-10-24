// ============================================================
// Two-step sign-in (authenticator app code) helpers.
//
// A signed-in session has an "assurance level": aal1 = password only,
// aal2 = password plus the code. An account that turned two-step sign-in on
// must reach aal2 before it gets into the app. The database enforces the same
// rule (migration 022); these helpers keep the pages and the middleware in
// step with it.
// ============================================================

/** Where the middleware sends a half-signed-in visitor to enter the code. */
export const MFA_LOGIN_PATH = '/login'
export const MFA_PARAM = 'mfa'

interface FactorLike {
  factor_type?: string
  status?: string
}

/** Number of authenticator-app factors the account has finished setting up. */
export function verifiedFactorCount(factors: readonly FactorLike[] | null | undefined): number {
  return (factors ?? []).filter((f) => f.status === 'verified' && (f.factor_type ?? 'totp') === 'totp').length
}

/**
 * True when the person typed a password but still owes the code: they have
 * two-step sign-in on and this session has not passed it yet. An unfinished
 * enrolment (no verified factor) never blocks anyone.
 */
export function needsSecondStep(input: {
  factors: readonly FactorLike[] | null | undefined
  currentLevel: string | null | undefined
}): boolean {
  return verifiedFactorCount(input.factors) > 0 && input.currentLevel !== 'aal2'
}

/** Keeps only the digits, at most six, so "123 456" and pasted text both work. */
export function cleanCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6)
}

export function isCompleteCode(code: string): boolean {
  return /^\d{6}$/.test(code)
}

/** /login?mfa=1&redirect=<where they were going> */
export function mfaLoginUrl(returnTo: string): string {
  const params = new URLSearchParams({ [MFA_PARAM]: '1' })
  if (returnTo && returnTo !== '/') params.set('redirect', returnTo)
  return `${MFA_LOGIN_PATH}?${params.toString()}`
}

export const SECURITY_HREF = '/dashboard/settings/security'
