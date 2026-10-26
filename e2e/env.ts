// Settings for the browser tests. These are Supabase's well-known LOCAL demo
// keys (the same on every machine, valid only for `supabase start`); they open
// nothing on the hosted project.
export const E2E_PORT = 3100
export const LOCAL_SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54521'
export const LOCAL_ANON_KEY =
  process.env.E2E_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
export const LOCAL_SERVICE_KEY =
  process.env.E2E_SUPABASE_SERVICE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

/** Environment for the app under test. No captcha, email or payment keys on purpose. */
export const E2E_APP_ENV: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: LOCAL_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: LOCAL_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: LOCAL_SERVICE_KEY,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: '',
  NEXT_PUBLIC_SENTRY_DSN: '',
  CONTACT_DRY_RUN: '1', // the contact form does everything except send the email
  NEXT_DIST_DIR: '.next-e2e',
}
