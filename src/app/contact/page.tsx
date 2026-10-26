import type { Metadata } from 'next'
import Link from 'next/link'
import { AUTH_LINK, AuthShell } from '@/components/auth/AuthShell'
import { ContactForm } from '@/components/contact/ContactForm'

export const metadata: Metadata = {
  title: 'Contact us',
  description: 'Questions about PlyCount, contract pricing and margin software for paper converters? Send us a message and we will get back to you.',
  alternates: { canonical: '/contact' },
  robots: { index: true, follow: true },
}

export default function ContactPage() {
  return (
    <AuthShell
      title="Contact us"
      subtitle="Questions about PlyCount, or want to see it in action? Send us a message and we will get back to you."
      footer={
        <>
          <Link href="/" className={AUTH_LINK}>Home</Link>
          {' · '}
          <Link href="/login" className={AUTH_LINK}>Sign in</Link>
        </>
      }
    >
      <ContactForm />
    </AuthShell>
  )
}
