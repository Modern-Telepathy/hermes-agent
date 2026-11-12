import { useStore } from '@nanostores/react'
import { useEffect, useMemo, useState } from 'react'

import type { SidebarNavItem } from '@/app/types'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import {
  $sidebarNavIcons,
  type NavIconKind,
  type NavIconOverride,
  setSidebarNavIcon
} from '@/store/sidebar-nav-icons'

import { NAV_ICON_LIBRARY } from './nav-icon-library'
import { SidebarNavGlyph } from './sidebar-nav-glyph'

const EMOJI_CHOICES = [
  '✨',
  '🤖',
  '🧠',
  '🛠️',
  '🧩',
  '💬',
  '📁',
  '🕒',
  '🚀',
  '🔮',
  '🎨',
  '📚',
  '🔍',
  '⚙️',
  '🌙',
  '☀️',
  '🔥',
  '💡',
  '🛰️',
  '🧪',
  '📊',
  '🗂️',
  '🎯',
  '🪄'
] as const

// Shared with the profile rail's visual language: saturated mid-tone fills
// that keep both dark and white ink readable.
const BACKGROUND_SWATCHES = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#84cc16',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#d946ef',
  '#ec4899'
] as const

const CUSTOM_HEX = /^#[0-9a-f]{6}$/i

const humanIconName = (name: string) => name.replace(/-/g, ' ')

export function NavIconEditor({
  item,
  label,
  onClose
}: {
  item: null | SidebarNavItem
  label: string
  onClose: () => void
}) {
  const { t } = useI18n()
  const s = t.sidebar.navIconEditor
  const overrides = useStore($sidebarNavIcons)
  const [mode, setMode] = useState<NavIconKind>('icon')
  const [emoji, setEmoji] = useState('✨')
  const [icon, setIcon] = useState('symbol-color')
  const [background, setBackground] = useState<null | string>(null)
  const [radius, setRadius] = useState(24)
  const [iconQuery, setIconQuery] = useState('')
  const [customOpen, setCustomOpen] = useState(false)
  const [customColor, setCustomColor] = useState('#6366f1')

  useEffect(() => {
    if (!item) {
      return
    }

    const current = $sidebarNavIcons.get()[item.id]

    setMode(current?.kind ?? 'icon')
    setEmoji(current?.kind === 'emoji' ? current.value : '✨')
    setIcon(current?.kind === 'icon' ? current.value : (item.iconName ?? 'symbol-color'))
    setBackground(current?.background ?? null)
    setRadius(current?.radius ?? 24)
    setIconQuery('')
    setCustomOpen(false)
  }, [item])

  const filteredIcons = useMemo(() => {
    const query = iconQuery.trim().toLowerCase()

    return query ? NAV_ICON_LIBRARY.filter(name => name.includes(query)) : NAV_ICON_LIBRARY
  }, [iconQuery])

  if (!item) {
    return null
  }

  const value = mode === 'emoji' ? emoji.trim() : icon
  const draft: NavIconOverride = { background, kind: mode, radius, value }
  const existing = overrides[item.id]
  const customValid = CUSTOM_HEX.test(customColor)

  const save = () => {
    if (!value) {
      return
    }

    setSidebarNavIcon(item.id, draft)
    onClose()
  }

  const reset = () => {
    setSidebarNavIcon(item.id, null)
    onClose()
  }

  return (
    <Dialog onOpenChange={next => !next && onClose()} open>
      <DialogContent bodyClassName="gap-4" className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{s.title}</DialogTitle>
          <DialogDescription>{s.description}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-control-background) p-3">
          <SidebarNavGlyph override={draft} size="lg" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">{label}</div>
            <div className="text-xs text-(--ui-text-tertiary)">
              {mode === 'emoji' ? s.emoji : humanIconName(icon)}
            </div>
          </div>
        </div>

        <div className="flex w-fit rounded-md border border-(--ui-stroke-secondary) p-0.5">
          {(['emoji', 'icon'] as const).map(next => (
            <button
              aria-pressed={mode === next}
              className={cn(
                'rounded px-3 py-1 text-xs font-medium transition-colors',
                mode === next
                  ? 'bg-(--ui-control-active-background) text-foreground'
                  : 'text-(--ui-text-tertiary) hover:text-foreground'
              )}
              key={next}
              onClick={() => setMode(next)}
              type="button"
            >
              {next === 'emoji' ? s.emoji : s.icons}
            </button>
          ))}
        </div>

        {mode === 'emoji' ? (
          <div className="grid gap-2">
            <input
              aria-label={s.emoji}
              className="h-9 w-full rounded-md border border-(--ui-stroke-secondary) bg-transparent px-2.5 text-sm outline-hidden focus:border-(--theme-primary)"
              maxLength={32}
              onChange={event => setEmoji(event.target.value)}
              placeholder={s.emojiPlaceholder}
              value={emoji}
            />
            <div className="grid grid-cols-8 gap-1 sm:grid-cols-12">
              {EMOJI_CHOICES.map(choice => (
                <button
                  aria-label={choice}
                  aria-pressed={emoji === choice}
                  className={cn(
                    'flex size-9 items-center justify-center rounded-md text-lg transition-colors hover:bg-(--ui-control-hover-background)',
                    emoji === choice && 'bg-(--ui-control-active-background) ring-1 ring-(--theme-primary)'
                  )}
                  key={choice}
                  onClick={() => setEmoji(choice)}
                  type="button"
                >
                  {choice}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-2">
            <input
              aria-label={s.searchIcons}
              className="h-9 w-full rounded-md border border-(--ui-stroke-secondary) bg-transparent px-2.5 text-sm outline-hidden focus:border-(--theme-primary)"
              onChange={event => setIconQuery(event.target.value)}
              placeholder={s.searchIcons}
              value={iconQuery}
            />
            <div className="grid max-h-48 grid-cols-8 gap-1 overflow-y-auto rounded-md border border-(--ui-stroke-tertiary) p-2 sm:grid-cols-12">
              {filteredIcons.map(name => (
                <button
                  aria-label={humanIconName(name)}
                  aria-pressed={icon === name}
                  className={cn(
                    'flex size-8 items-center justify-center rounded-md text-(--ui-text-secondary) transition-colors hover:bg-(--ui-control-hover-background) hover:text-foreground',
                    icon === name && 'bg-(--ui-control-active-background) text-foreground ring-1 ring-(--theme-primary)'
                  )}
                  key={name}
                  onClick={() => setIcon(name)}
                  title={humanIconName(name)}
                  type="button"
                >
                  <Codicon name={name} size="1rem" />
                </button>
              ))}
              {filteredIcons.length === 0 && (
                <div className="col-span-full py-4 text-center text-xs text-(--ui-text-tertiary)">{s.noIcons}</div>
              )}
            </div>
          </div>
        )}

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">{s.background}</span>
            <span className="text-[0.6875rem] text-(--ui-text-tertiary)">
              {background ?? s.none}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              aria-label={s.none}
              aria-pressed={background === null}
              className={cn(
                'flex size-7 items-center justify-center rounded-full text-(--ui-text-tertiary) transition hover:bg-(--ui-control-hover-background) hover:text-foreground',
                background === null && 'bg-(--ui-control-active-background) text-foreground ring-1 ring-(--theme-primary)'
              )}
              onClick={() => setBackground(null)}
              title={s.none}
              type="button"
            >
              <Codicon name="circle-slash" size="0.875rem" />
            </button>
            {BACKGROUND_SWATCHES.map(swatch => (
              <button
                aria-label={swatch}
                aria-pressed={background === swatch}
                className="size-7 rounded-full transition-transform hover:scale-110"
                key={swatch}
                onClick={() => setBackground(swatch)}
                style={{
                  backgroundColor: swatch,
                  boxShadow:
                    background === swatch
                      ? '0 0 0 2px var(--ui-bg-elevated), 0 0 0 3.5px currentColor'
                      : undefined
                }}
                title={swatch}
                type="button"
              />
            ))}
            <Popover
              onOpenChange={next => {
                setCustomOpen(next)

                if (next) {
                  setCustomColor(background ?? '#6366f1')
                }
              }}
              open={customOpen}
            >
              <PopoverTrigger asChild>
                <Button size="sm" type="button" variant="outline">
                  {s.custom}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 p-3">
                <div className="grid gap-2">
                  <span className="text-xs font-medium text-foreground">{s.customColor}</span>
                  <div className="flex items-center gap-2">
                    <input
                      aria-label={s.customColor}
                      className="size-9 shrink-0 cursor-pointer rounded-md border border-(--ui-stroke-secondary) bg-transparent"
                      onChange={event => setCustomColor(event.target.value)}
                      type="color"
                      value={customValid ? customColor : '#6366f1'}
                    />
                    <input
                      aria-label={s.customColor}
                      className="h-9 min-w-0 flex-1 rounded-md border border-(--ui-stroke-secondary) bg-transparent px-2 font-mono text-xs uppercase outline-hidden focus:border-(--theme-primary)"
                      maxLength={7}
                      onChange={event => setCustomColor(event.target.value)}
                      value={customColor}
                    />
                  </div>
                  <Button
                    disabled={!customValid}
                    onClick={() => {
                      setBackground(customColor.toLowerCase())
                      setCustomOpen(false)
                    }}
                    size="sm"
                    type="button"
                  >
                    {s.apply}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <label className="flex items-center gap-3 pt-1">
            <span className="shrink-0 text-xs text-(--ui-text-tertiary)">{s.cornerRadius}</span>
            <input
              aria-label={s.cornerRadius}
              className="h-1.5 min-w-0 flex-1 cursor-pointer accent-(--theme-primary)"
              disabled={background === null}
              max={50}
              min={0}
              onChange={event => setRadius(Number(event.target.value))}
              type="range"
              value={radius}
            />
            <span className="w-8 text-right text-[0.6875rem] tabular-nums text-(--ui-text-tertiary)">
              {radius}%
            </span>
          </label>
        </div>

        <DialogFooter>
          {existing && (
            <Button className="mr-auto" onClick={reset} type="button" variant="text">
              {s.reset}
            </Button>
          )}
          <Button onClick={onClose} type="button" variant="ghost">
            {t.common.cancel}
          </Button>
          <Button disabled={!value} onClick={save} type="button">
            {t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
