import { cn } from '../lib/utils'

// The Bitkin sprite: a rounded square head with two pill eyes, in the same
// 64-unit geometry the desktop app's BrandMark and the app icon use. The
// installer has no theme system, so it always draws the light squircle.
const HEAD = 'M18 7h28c8 0 12 4 12 12v26c0 8-4 12-12 12H18c-8 0-12-4-12-12V19C6 11 10 7 18 7Z'
const HEAD_LEFT = 6
const HEAD_TOP = 7
const HEAD_WIDTH = 52
const HEAD_HEIGHT = 50
const MARK_WIDTH = (660 / 1024) * 64
const SCALE = MARK_WIDTH / HEAD_WIDTH
const OFFSET_X = (64 - MARK_WIDTH) / 2 - HEAD_LEFT * SCALE
const OFFSET_Y = (64 - HEAD_HEIGHT * SCALE) / 2 - HEAD_TOP * SCALE
const PLATE = '#ffffff'

export function BrandMark({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span className={cn('inline-flex size-14 shrink-0', className)} {...props}>
      <svg aria-hidden="true" className="size-full" viewBox="0 0 64 64">
        <rect fill={PLATE} height="64" rx="15" width="64" />
        <g transform={`translate(${OFFSET_X.toFixed(4)} ${OFFSET_Y.toFixed(4)}) scale(${SCALE.toFixed(5)})`}>
          <path d={HEAD} fill="#000000" />
          <rect fill={PLATE} height="19" rx="3.5" width="7" x="21" y="23" />
          <rect fill={PLATE} height="19" rx="3.5" width="7" x="36" y="23" />
        </g>
      </svg>
    </span>
  )
}
