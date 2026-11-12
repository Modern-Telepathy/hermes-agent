import { useStore } from '@nanostores/react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { controlVariants } from '@/components/ui/control'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  $themeCorners,
  clampCornerRadius,
  type CornerKind,
  MAX_CORNER_RADIUS,
  MIN_CORNER_RADIUS,
  setThemeCorner,
  THEME_CORNER_VARS
} from '@/store/theme-corners'
import {
  $themePadding,
  resetThemePadding,
  setThemePadding,
  THEME_PADDING_MAX,
  THEME_PADDING_MIN
} from '@/store/theme-padding'
import { $zoomPercent, setZoomPercent } from '@/store/zoom'
import { committedTheme, useTheme } from '@/themes/context'
import { ownAccent, persistAccent } from '@/themes/persist-accent'

const ROW = 'flex min-h-7 items-center justify-between gap-3 text-[0.75rem] text-(--ui-text-secondary)'

// One column for every value, so the numbers under each other line up instead
// of drifting with the label lengths.
const VALUE_WIDTH = 'w-[4.75rem]'

const SELECT = cn(controlVariants({ size: 'xs' }), 'cursor-pointer')

/** The radius the theme is painting right now, so turning an override on starts
 *  from the look already on screen instead of a made-up number. */
function themeRadius(kind: CornerKind): number {
  const probe = document.createElement('div')

  probe.style.cssText = `position:absolute;width:0;height:0;visibility:hidden;border-radius:var(${THEME_CORNER_VARS[kind]})`
  document.body.appendChild(probe)

  const radius = Number.parseFloat(getComputedStyle(probe).borderTopLeftRadius)

  probe.remove()

  return clampCornerRadius(Number.isFinite(radius) ? radius : MIN_CORNER_RADIUS)
}

/**
 * One appearance row: label, the on/off slider that owns the override, and the
 * value that slider enables. Off means "follow the theme", which is why the
 * value is disabled rather than merely dimmed — a stale number must not read as
 * the setting in force.
 */
function OverrideRow({
  enabled,
  label,
  max,
  min,
  onChange,
  onToggle,
  placeholder,
  suffix,
  value
}: {
  enabled: boolean
  label: string
  max: number
  min: number
  onChange: (value: number) => void
  onToggle: (on: boolean) => void
  placeholder?: string
  suffix: string
  value: null | number
}) {
  return (
    <div className={ROW}>
      <span className="min-w-0 truncate">{label}</span>
      <span className="flex shrink-0 items-center gap-2">
        <Switch aria-label={label} checked={enabled} onCheckedChange={onToggle} size="xs" />
        <Input
          aria-label={`${label} value`}
          className="text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          containerClassName={VALUE_WIDTH}
          disabled={!enabled}
          max={max}
          min={min}
          onChange={event => {
            // Clearing the field is how you start typing a new number; it is
            // not a request to set 0.
            if (event.target.value.trim() === '') {
              return
            }

            const next = Number(event.target.value)

            if (Number.isFinite(next)) {
              onChange(next)
            }
          }}
          placeholder={placeholder}
          size="xs"
          // A unit on an empty field reads as "Auto px"; the unit belongs to a
          // number, so it only shows once there is one.
          suffix={value === null ? undefined : suffix}
          type="number"
          value={value ?? ''}
        />
      </span>
    </div>
  )
}

/**
 * The palette hover card: the appearance knobs that are cheap to reach and
 * expensive to go find in Settings. Ordered theme → accent → corners → scale →
 * padding, the order in which they change how the app reads as a whole.
 */
export function ThemeHovercard() {
  const theme = useTheme()
  const corners = useStore($themeCorners)
  const padding = useStore($themePadding)
  const zoom = useStore($zoomPercent)
  const [accent, setAccent] = useState(() => ownAccent())
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentTheme = committedTheme().name
  const themes = (theme.availableThemes ?? []) as { name?: string }[]

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <span
        onMouseEnter={() => {
          if (closeTimer.current) {
            clearTimeout(closeTimer.current)
            closeTimer.current = null
          }

          setOpen(true)
        }}
        onMouseLeave={() => {
          closeTimer.current = setTimeout(() => setOpen(false), 220)
        }}
      >
        <PopoverTrigger asChild>
        <Button
          aria-label="Appearance"
          className="size-6 shrink-0 [-webkit-app-region:no-drag]"
          size="icon-xs"
          variant="ghost"
        >
          <Codicon name="symbol-color" size="0.75rem" />
        </Button>
        </PopoverTrigger>
      </span>
      <PopoverContent
        align="end"
        className="w-80 space-y-2.5"
        onMouseEnter={() => {
          if (closeTimer.current) {
            clearTimeout(closeTimer.current)
            closeTimer.current = null
          }
        }}
        onMouseLeave={() => {
          closeTimer.current = setTimeout(() => setOpen(false), 220)
        }}
        side="bottom"
      >
        <div className="text-[0.6875rem] font-medium text-(--ui-text-secondary)">Appearance</div>

        <label className={ROW}>
          <span>Mode</span>
          <select
            className={cn(SELECT, 'w-28')}
            onChange={event => theme.setMode(event.target.value as 'dark' | 'light' | 'system')}
            value={theme.mode}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </label>

        <label className={ROW}>
          <span>Theme</span>
          <select
            className={cn(SELECT, 'w-36')}
            onChange={event => theme.setTheme(event.target.value)}
            value={currentTheme}
          >
            {themes.map(entry => {
              const name = String(entry.name ?? '')

              return name ? (
                <option key={name} value={name}>
                  {name.replace(/-/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())}
                </option>
              ) : null
            })}
          </select>
        </label>

        <div className={ROW}>
          <span>Accent</span>
          <span className="flex shrink-0 items-center gap-2">
            <input
              aria-label="Primary accent"
              className="size-6 cursor-pointer rounded-md border border-(--ui-stroke-tertiary) bg-transparent p-0"
              onChange={event => {
                setAccent(event.target.value)
                persistAccent(event.target.value)
              }}
              type="color"
              value={accent}
            />
            <Button
              className="h-6 px-1.5 text-[0.6875rem]"
              onClick={() => {
                setAccent(ownAccent())
                persistAccent(null)
              }}
              size="sm"
              variant="ghost"
            >
              Use theme
            </Button>
          </span>
        </div>

        <div className="border-t border-(--ui-stroke-tertiary)" />

        <OverrideRow
          enabled={corners.button !== null}
          label="Button corners"
          max={MAX_CORNER_RADIUS}
          min={MIN_CORNER_RADIUS}
          onChange={value => setThemeCorner('button', value)}
          onToggle={on => setThemeCorner('button', on ? themeRadius('button') : null)}
          placeholder="Auto"
          suffix="px"
          value={corners.button}
        />
        <OverrideRow
          enabled={corners.container !== null}
          label="Component corners"
          max={MAX_CORNER_RADIUS}
          min={MIN_CORNER_RADIUS}
          onChange={value => setThemeCorner('container', value)}
          onToggle={on => setThemeCorner('container', on ? themeRadius('container') : null)}
          placeholder="Auto"
          suffix="px"
          value={corners.container}
        />
        <OverrideRow
          enabled={zoom !== 100}
          label="Font size"
          max={200}
          min={50}
          onChange={value => setZoomPercent(value)}
          onToggle={on => setZoomPercent(on ? 110 : 100)}
          suffix="%"
          value={zoom}
        />
        <OverrideRow
          enabled={padding.enabled}
          label="Row padding"
          max={THEME_PADDING_MAX}
          min={THEME_PADDING_MIN}
          onChange={value => setThemePadding({ enabled: true, px: value })}
          onToggle={on => setThemePadding({ enabled: on })}
          suffix="px"
          value={padding.px}
        />

        <div className="flex items-center justify-between border-t border-(--ui-stroke-tertiary) pt-2">
          <Button
            className="h-7 px-2 text-[0.6875rem]"
            onClick={() => {
              resetThemePadding()
              setThemeCorner('button', null)
              setThemeCorner('container', null)
              setZoomPercent(100)
              persistAccent(null)
              setAccent(ownAccent())
            }}
            size="sm"
            variant="ghost"
          >
            Reset
          </Button>
          <span className="text-[0.625rem] text-(--ui-text-quaternary)">Saved automatically</span>
        </div>
      </PopoverContent>
    </Popover>
  )
}
