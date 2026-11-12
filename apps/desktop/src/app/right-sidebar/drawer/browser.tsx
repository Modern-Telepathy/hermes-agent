import { useStore } from '@nanostores/react'
import { type FormEvent, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { selectRightRailTab } from '@/store/layout'
import { $dockedVisiblePreviewTabs, newBrowserTab, openPreview } from '@/store/preview'

import { EmptyState } from '../index'

/**
 * The drawer's Browser tab. Pages (and file previews) are preview tabs, and
 * preview panes dock into this drawer's zone — so this tab is the browser's
 * start page: open an address, or jump to a page that is already open. Each
 * open page is its own tab in the strip beside this one.
 */

/** Type a bare host and we still get somewhere: `example.com` is https,
 *  while `localhost:3000` (the thing people type while developing) is http —
 *  an https attempt against a dev server fails in a way that looks like the
 *  app is broken. A scheme the user typed is always respected. */
export function normalizeAddress(raw: string): null | string {
  const value = raw.trim()

  if (!value) {
    return null
  }

  // A scheme the user typed, not the colon a host:port happens to contain
  // (`localhost:3000` is a host below, not a `localhost` scheme).
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) || /^(about|data|file|javascript|mailto):/i.test(value)) {
    return value
  }

  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(value)) {
    return `http://${value}`
  }

  return `https://${value}`
}

function addressLabel(url: string): string {
  try {
    return new URL(url).host || url
  } catch {
    return url
  }
}

export function BrowserTab() {
  const { t } = useI18n()
  const r = t.rightSidebar.drawer
  const tabs = useStore($dockedVisiblePreviewTabs)
  const [address, setAddress] = useState('')

  const open = (raw: string) => {
    const url = normalizeAddress(raw)

    if (!url) {
      return
    }

    setAddress('')
    openPreview({ kind: 'url', label: addressLabel(url), source: url, url })
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    open(address)
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <form className="flex shrink-0 items-center gap-1 px-2 py-1.5" onSubmit={handleSubmit}>
        <div className="flex h-6 min-w-0 flex-1 items-center gap-1.5 rounded border border-(--ui-stroke-quaternary) bg-(--ui-bg-elevated) px-1.5 focus-within:border-(--ui-stroke-secondary)">
          <Codicon className="shrink-0 text-(--ui-text-quaternary)" name="globe" size="0.75rem" />
          <input
            aria-label={r.browserAddress}
            className="min-w-0 flex-1 bg-transparent text-[0.7rem] text-foreground outline-none placeholder:text-(--ui-text-quaternary)"
            onChange={event => setAddress(event.target.value)}
            placeholder={r.browserAddressPlaceholder}
            spellCheck={false}
            value={address}
          />
        </div>
        <Button aria-label={r.browserOpen} disabled={!address.trim()} size="icon-xs" type="submit" variant="ghost">
          <Codicon name="arrow-right" size="0.8125rem" />
        </Button>
      </form>

      {tabs.length === 0 ? (
        <EmptyState body={r.browserEmptyBody} title={r.browserEmptyTitle} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-1.5 pb-2">
          <div className="px-1 py-1 text-[0.62rem] font-medium uppercase tracking-wide text-(--ui-text-quaternary)">
            {r.browserTabs}
          </div>
          <ul className="flex flex-col">
            {tabs.map(tab => (
              <li key={tab.id}>
                <button
                  className={cn(
                    'flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[0.7rem] text-(--ui-text-secondary)',
                    'hover:bg-(--chrome-action-hover) hover:text-foreground'
                  )}
                  onClick={() => selectRightRailTab(tab.id)}
                  type="button"
                >
                  <Codicon
                    className="shrink-0 text-(--ui-text-quaternary)"
                    name={tab.target.kind === 'url' ? 'globe' : 'file-text'}
                    size="0.75rem"
                  />
                  <span className="truncate">{tab.target.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="shrink-0 border-t border-(--ui-stroke-quaternary) p-1.5">
        <Button className="w-full justify-start gap-1.5" onClick={() => newBrowserTab()} size="xs" variant="ghost">
          <Codicon name="add" size="0.75rem" />
          {r.browserNewTab}
        </Button>
      </div>
    </div>
  )
}
