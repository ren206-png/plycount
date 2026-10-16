'use client'

import { useEffect, useRef } from 'react'
import { TURNSTILE_SITE_KEY } from '@/lib/turnstile'

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string
  reset: (widgetId?: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let scriptPromise: Promise<void> | null = null

function loadTurnstile(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.turnstile) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const el = document.createElement('script')
      el.src = SCRIPT_SRC
      el.async = true
      el.onload = () => resolve()
      el.onerror = () => {
        scriptPromise = null
        reject(new Error('Could not load the Cloudflare Turnstile script.'))
      }
      document.head.appendChild(el)
    })
  }
  return scriptPromise
}

interface Props {
  /** Called with a fresh single-use token, or null when it expires or errors. */
  onToken: (token: string | null) => void
  /** Increment to clear the widget and ask for a new challenge (tokens are single-use). */
  resetSignal?: number
}

export function TurnstileWidget({ onToken, resetSignal = 0 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return
    let cancelled = false
    loadTurnstile()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'dark',
          callback: (token: string) => onToken(token),
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null),
        })
      })
      .catch(() => onToken(null))
    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current)
      widgetIdRef.current = null
    }
  }, [onToken])

  useEffect(() => {
    if (resetSignal > 0 && widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current)
      onToken(null)
    }
  }, [resetSignal, onToken])

  if (!TURNSTILE_SITE_KEY) return null
  return <div ref={containerRef} />
}
