// ============================================================
// Cloudflare Turnstile (CAPTCHA) helpers.
//
// The widget is only shown when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set, so
// the app works unchanged until Turnstile is configured. Verification
// happens on Supabase's side (Authentication -> Attack Protection ->
// CAPTCHA protection, with the Turnstile *secret* key): the token the
// widget produces is passed to supabase.auth.signInWithPassword / signUp
// as options.captchaToken and Supabase rejects requests without a valid one.
// ============================================================
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''

/** True when forms must wait for a solved challenge before submitting. */
export function captchaRequired(siteKey: string = TURNSTILE_SITE_KEY): boolean {
  return siteKey.length > 0
}

/** The `options` fragment to merge into Supabase auth calls. */
export function captchaOptions(token: string | null | undefined): { captchaToken?: string } {
  return token ? { captchaToken: token } : {}
}
