import { cn } from '@/lib/utils'
import { useTheme } from '@/themes'

// The Bitkin sprite, in the 64-unit geometry the canvas app draws and the dock
// icon carries: a rounded square head with two pill eyes. Drawn rather than
// shipped as a PNG so the badge is the icon at any size and follows the theme.
const HEAD = 'M18 7h28c8 0 12 4 12 12v26c0 8-4 12-12 12H18c-8 0-12-4-12-12V19C6 11 10 7 18 7Z'
const HEAD_LEFT = 6
const HEAD_TOP = 7
const HEAD_WIDTH = 52
const HEAD_HEIGHT = 50
// The mark covers the same share of the 64-unit tile as it does of the 1024 icon.
const MARK_WIDTH = (660 / 1024) * 64
const SCALE = MARK_WIDTH / HEAD_WIDTH
const OFFSET_X = (64 - MARK_WIDTH) / 2 - HEAD_LEFT * SCALE
const OFFSET_Y = (64 - HEAD_HEIGHT * SCALE) / 2 - HEAD_TOP * SCALE
// Plate and ink per appearance: white/black, then #0d1117/white like the icon.
const PLATE_LIGHT = '#ffffff'
const PLATE_DARK = '#0d1117'

// Brand badge: the app icon's squircle, theme-aware. Size via className
// (default size-14).
export function BrandMark({ className, ...props }: React.ComponentProps<'span'>) {
  const { renderedMode } = useTheme()
  const dark = renderedMode === 'dark'
  const plate = dark ? PLATE_DARK : PLATE_LIGHT
  const ink = dark ? PLATE_LIGHT : '#000000'

  return (
    <span className={cn('inline-flex size-14 shrink-0', className)} {...props}>
      <svg aria-hidden="true" className="size-full" viewBox="0 0 64 64">
        <rect fill={plate} height="64" rx="15" width="64" />
        <g transform={`translate(${OFFSET_X.toFixed(4)} ${OFFSET_Y.toFixed(4)}) scale(${SCALE.toFixed(5)})`}>
          <path d={HEAD} fill={ink} />
          <rect fill={plate} height="19" rx="3.5" width="7" x="21" y="23" />
          <rect fill={plate} height="19" rx="3.5" width="7" x="36" y="23" />
        </g>
      </svg>
    </span>
  )
}
