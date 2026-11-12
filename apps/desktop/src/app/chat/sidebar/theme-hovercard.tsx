import { useStore } from '@nanostores/react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { $themeCorners, MAX_CORNER_RADIUS, MIN_CORNER_RADIUS, setThemeCorner } from '@/store/theme-corners'
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

const ROW = 'flex items-center justify-between gap-3 text-[0.75rem] text-(--ui-text-secondary)'

const FIELD =
  'h-7 rounded-md border border-(--ui-stroke-tertiary) bg-(--ui-bg-input) px-2 text-[0.75rem] text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring'

/** One labelled number field: empty means "follow the theme". */
function NumberSetting({
  label,
  max,
  min,
  onChange,
  placeholder,
  suffix,
  value
}: {
  label: string
  max: number
  min: number
  onChange: (value: number) => void
  placeholder?: string
  suffix?: string
  value: null | number
}) {
  return (
    <label className={ROW}>
      <span className="min-w-0 truncate">{label}</span>
      <span className="flex items-center gap-1">
        <input
          className={cn(FIELD, 'w-14 text-right')}
          max={max}
          min={min}
          onChange={event => {
            const next = Number(event.target.value)

            if (Number.isFinite(next)) {
              onChange(next)
            }
          }}
          placeholder={placeholder}
          type="number"
          value={value ?? ''}
        />
        {suffix && <span className="text-(--ui-text-tertiary)">{suffix}</span>}
      </span>
    </label>
  )
}

function Switch({ checked, label, onChange }: { checked: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <label className="flex items-center gap-2">
      <input checked={checked} className="size-3.5 accent-(--dt-primary-solid)" onChange={e => onChange(e.target.checked)} type="checkbox" />
      <span className="text-[0.6875rem] text-(--ui-text-tertiary)">{label}</span>
    </label>
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
  const fontScaled = zoom !== 100

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
        className="w-80 space-y-3"
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
            className={cn(FIELD, 'w-24')}
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
            className={cn(FIELD, 'max-w-44')}
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

        <label className={ROW}>
          <span>Accent</span>
          <span className="flex items-center gap-2">
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
              Theme
            </Button>
          </span>
        </label>

        <NumberSetting
          label="Button corners"
          max={MAX_CORNER_RADIUS}
          min={MIN_CORNER_RADIUS}
          onChange={value => setThemeCorner('button', value)}
          placeholder="Auto"
          suffix="px"
          value={corners.button}
        />
        <NumberSetting
          label="Component corners"
          max={MAX_CORNER_RADIUS}
          min={MIN_CORNER_RADIUS}
          onChange={value => setThemeCorner('container', value)}
          placeholder="Auto"
          suffix="px"
          value={corners.container}
        />

        <div className={ROW}>
          <span>Font size</span>
          <span className="flex items-center gap-2">
            <Switch
              checked={fontScaled}
              label={fontScaled ? 'On' : 'Off'}
              onChange={on => setZoomPercent(on ? 110 : 100)}
            />
            <NumberSetting
              label=""
              max={200}
              min={50}
              onChange={value => setZoomPercent(value)}
              suffix="%"
              value={zoom}
            />
          </span>
        </div>

        <div className={ROW}>
          <span>Row padding</span>
          <span className="flex items-center gap-2">
            <Switch
              checked={padding.enabled}
              label={padding.enabled ? 'On' : 'Off'}
              onChange={on => setThemePadding({ enabled: on })}
            />
            <NumberSetting
              label=""
              max={THEME_PADDING_MAX}
              min={THEME_PADDING_MIN}
              onChange={value => setThemePadding({ enabled: true, px: value })}
              suffix="px"
              value={padding.px}
            />
          </span>
        </div>

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
