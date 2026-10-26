// ============================================================
// POST /api/contact — the public "Contact us" form on plycounts.com.
// No login, so it defends itself: a hidden field only bots fill in, a per-address
// and an overall hourly limit (check_rate_limit), strict validation, and, once
// TURNSTILE_SECRET_KEY is set, a Cloudflare challenge. The message is emailed
// to CONTACT_TO_EMAIL, or to the platform administrator when that is not set,
// with Reply-To set to the sender so answering is one click.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit/server'
import { clientIp, contactSubject, contactText, validateContact } from '@/lib/contact'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 20_000

async function challengePassed(token: unknown, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true // not configured yet: the other protections still apply
  if (typeof token !== 'string' || !token) return false
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    })
    const body = (await res.json()) as { success?: boolean }
    return body.success === true
  } catch (err) {
    console.error('[contact] captcha check failed', err)
    return false
  }
}

async function recipient(): Promise<string | null> {
  if (process.env.CONTACT_TO_EMAIL) return process.env.CONTACT_TO_EMAIL
  const { data } = await createAdminClient()
    .from('user_profiles')
    .select('email')
    .eq('role', 'platform_admin')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  return data?.email ?? null
}

export async function POST(req: NextRequest) {
  const text = await req.text()
  if (text.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'That message is too large.' }, { status: 413 })
  }
  let body: Record<string, unknown>
  try {
    body = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  // Bots fill in every field, including the one people never see. Pretend it worked.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return NextResponse.json({ ok: true })
  }

  const parsed = validateContact(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: 'Please check the highlighted fields.', fields: parsed.errors }, { status: 400 })
  }

  const ip = clientIp(req.headers)
  const withinIpLimit = await checkRateLimit(`contact:ip:${ip}`, 5, 3600)
  // Only an address that is within its own limit counts toward the site-wide one;
  // otherwise a single caller could use up everyone's allowance by being refused.
  const withinOverallLimit = withinIpLimit && (await checkRateLimit('contact:all', 60, 3600))
  if (!withinIpLimit || !withinOverallLimit) {
    return NextResponse.json({ error: 'Too many messages just now. Please try again later.' }, { status: 429 })
  }

  if (!(await challengePassed(body.captchaToken, ip))) {
    return NextResponse.json({ error: 'Please complete the check and try again.' }, { status: 400 })
  }

  // Test runs (browser tests) exercise everything except the actual email.
  if (process.env.CONTACT_DRY_RUN === '1') {
    return NextResponse.json({ ok: true })
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Messages cannot be sent right now. Please try again later.' }, { status: 501 })
  }
  const to = await recipient()
  if (!to) {
    console.error('[contact] no recipient: set CONTACT_TO_EMAIL or have an active platform admin')
    return NextResponse.json({ error: 'Messages cannot be sent right now. Please try again later.' }, { status: 501 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const fromAddress = process.env.RESEND_FROM_EMAIL || 'quotes@plycount.app'
  const { error } = await resend.emails.send({
    from: `PlyCount website <${fromAddress}>`,
    to,
    replyTo: parsed.data.email,
    subject: contactSubject(parsed.data),
    text: contactText(parsed.data, ip),
  })
  if (error) {
    console.error('[contact] send failed', error.message)
    return NextResponse.json({ error: 'We could not send your message. Please try again in a minute.' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
