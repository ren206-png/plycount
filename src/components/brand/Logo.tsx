import { cn } from '@/lib/utils'
import { markSvg } from '@/lib/brand'
import { SITE_NAME } from '@/lib/site'

// The mark on its own. Decorative when it sits next to the name; give it a
// `label` when it stands alone.
export function LogoMark({
  uid = 'pc',
  size = 32,
  label,
  className,
}: {
  uid?: string
  size?: number
  label?: string
  className?: string
}) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('inline-flex shrink-0', className)}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: markSvg(uid, size) }}
    />
  )
}

// Mark plus the PlyCount name. `tone` is the page it sits on: "dark" pages get
// white text, "light" pages get the deep brand green.
export function Logo({
  uid,
  size = 32,
  tone = 'dark',
  className,
}: {
  uid?: string
  size?: number
  tone?: 'dark' | 'light'
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark uid={uid} size={size} />
      <span
        className={cn(
          'font-semibold tracking-tight',
          tone === 'dark' ? 'text-white' : 'text-brand-700'
        )}
        style={{ fontSize: Math.round(size * 0.62) }}
      >
        {SITE_NAME}
      </span>
    </span>
  )
}
