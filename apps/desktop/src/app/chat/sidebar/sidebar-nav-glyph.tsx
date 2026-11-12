import type * as React from 'react'

import { Codicon } from '@/components/ui/codicon'
import { cn } from '@/lib/utils'
import type { NavIconOverride } from '@/store/sidebar-nav-icons'

/** Ink that stays legible on both the dark and light palette swatches. */
export function navIconForeground(background: string): string {
  const raw = background.replace('#', '')
  const hex = raw.length === 3 ? raw.split('').map(char => char + char).join('') : raw
  const red = Number.parseInt(hex.slice(0, 2), 16)
  const green = Number.parseInt(hex.slice(2, 4), 16)
  const blue = Number.parseInt(hex.slice(4, 6), 16)

  return (red * 299 + green * 587 + blue * 114) / 1000 > 150 ? '#111827' : '#ffffff'
}

export function SidebarNavGlyph({
  children,
  override,
  size = 'sm'
}: {
  children?: React.ReactNode
  override?: NavIconOverride
  size?: 'lg' | 'sm'
}) {
  if (!override) {
    return <>{children}</>
  }

  const large = size === 'lg'
  const background = override.background

  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden leading-none',
        large ? 'size-10 text-2xl' : 'size-4 text-[0.8125rem]'
      )}
      style={
        background
          ? {
              backgroundColor: background,
              borderRadius: `${override.radius}%`,
              color: navIconForeground(background)
            }
          : undefined
      }
    >
      {override.kind === 'emoji' ? (
        <span className="leading-none">{override.value}</span>
      ) : (
        <Codicon name={override.value} size={large ? '1.5rem' : '0.8125rem'} />
      )}
    </span>
  )
}
