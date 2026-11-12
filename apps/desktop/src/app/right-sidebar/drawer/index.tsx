import { useStore } from '@nanostores/react'
import { type KeyboardEvent, type ReactNode, useEffect, useState } from 'react'

import { Codicon } from '@/components/ui/codicon'
import { useI18n } from '@/i18n'
import { normalizeOrLocalPreviewTarget } from '@/lib/local-preview'
import { cn } from '@/lib/utils'
import { notifyError } from '@/store/notifications'
import { openPreview } from '@/store/preview'
import { $reviewOpen, $reviewScopeCwd, $reviewScopeTarget, openReview } from '@/store/review'
import { $rightDrawerTab, RIGHT_DRAWER_TABS, type RightDrawerTab, selectRightDrawerTab } from '@/store/right-drawer-tab'
import { $focusedWorkspaceCwd } from '@/store/session-states'

import { RightSidebarPane } from '../index'
import { ReviewPane } from '../review'
import { refreshTerminalSlot } from '../terminal/persistent'

import { BrowserTab } from './browser'
import { ConsoleTab } from './console'
import { DocumentTab } from './document'
import { isMarkdownPath, openDrawerDocument } from './store'
import { UsageTab } from './usage'

/**
 * THE RIGHT DRAWER — the OpenHands-shaped tool panel.
 *
 * One panel, one strip, six standing tabs: Console (the terminals), Browser
 * (pages and file previews, which dock into this zone), Folders (the project
 * tree), Changes (the git diff), Usage (context + session spend) and Document
 * (a Markdown reader). The panel lives in the file browser's tree pane, so ⌘J,
 * the titlebar button and every reveal path still open it — only the shape
 * inside changed.
 *
 * Tabs stay MOUNTED once visited (`DrawerPanel` hides them instead of
 * unmounting): a terminal keeps its PTY, the tree keeps its scroll position and
 * a document keeps its read cache. Bodies are visited lazily so a drawer that
 * has never shown the console never boots xterm.
 */

const TAB_ICONS: Record<RightDrawerTab, string> = {
  browser: 'globe',
  changes: 'diff',
  console: 'terminal',
  document: 'book',
  files: 'files',
  usage: 'pulse'
}

const tabElementId = (tab: RightDrawerTab) => `right-drawer-tab-${tab}`
const panelElementId = (tab: RightDrawerTab) => `right-drawer-panel-${tab}`

const TAB_CLASS =
  'inline-flex h-6 shrink-0 items-center gap-1.5 rounded px-1.5 text-[0.7rem] font-medium transition-colors [-webkit-app-region:no-drag] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring'

export function DrawerTabStrip({ active, onSelect }: { active: RightDrawerTab; onSelect: (tab: RightDrawerTab) => void }) {
  const { t } = useI18n()
  const r = t.rightSidebar.drawer

  // Roving focus: one tab stop for the strip, arrows move within it — the same
  // contract as every other tablist in the app.
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = RIGHT_DRAWER_TABS.indexOf(active)
    const last = RIGHT_DRAWER_TABS.length - 1

    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % RIGHT_DRAWER_TABS.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + RIGHT_DRAWER_TABS.length) % RIGHT_DRAWER_TABS.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null

    if (next === null) {
      return
    }

    event.preventDefault()
    const tab = RIGHT_DRAWER_TABS[next]

    onSelect(tab)
    window.requestAnimationFrame(() => document.getElementById(tabElementId(tab))?.focus())
  }

  return (
    <div
      aria-label={r.aria}
      className="flex h-8 shrink-0 items-center gap-0.5 overflow-x-auto overflow-y-hidden border-b border-(--ui-stroke-quaternary) px-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
    >
      {RIGHT_DRAWER_TABS.map(tab => {
        const selected = tab === active

        return (
          <button
            aria-controls={panelElementId(tab)}
            aria-selected={selected}
            className={cn(
              TAB_CLASS,
              selected
                ? 'bg-(--chrome-action-hover) text-foreground'
                : 'text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover) hover:text-foreground'
            )}
            id={tabElementId(tab)}
            key={tab}
            onClick={() => onSelect(tab)}
            onKeyDown={handleKeyDown}
            role="tab"
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            <Codicon name={TAB_ICONS[tab]} size="0.8125rem" />
            <span className="truncate">{r[tab]}</span>
          </button>
        )
      })}
    </div>
  )
}

function DrawerPanel({ active, children, tab }: { active: boolean; children: ReactNode; tab: RightDrawerTab }) {
  return (
    <div
      aria-labelledby={tabElementId(tab)}
      className={cn('min-h-0 min-w-0 flex-1 flex-col', active ? 'flex' : 'hidden')}
      id={panelElementId(tab)}
      role="tabpanel"
      tabIndex={-1}
    >
      {children}
    </div>
  )
}

/** Files keep their project-tree affordances but drop the titlebar padding the
 *  standing sidebar carried — the panel already owns that band. */
const EMBEDDED_ASIDE = 'flex min-h-0 min-w-0 flex-1 [&>aside]:h-full [&>aside]:w-full [&>aside]:pt-0'

export function RightDrawer() {
  const { t } = useI18n()
  const r = t.rightSidebar
  const active = useStore($rightDrawerTab)
  const [visited, setVisited] = useState<ReadonlySet<RightDrawerTab>>(() => new Set([$rightDrawerTab.get()]))

  useEffect(() => {
    setVisited(previous => (previous.has(active) ? previous : new Set(previous).add(active)))

    // Changes and Console bring their own data: Changes is the review pane
    // (⌘G's target) and Console has to hand the persistent xterm host its
    // slot once the tab is actually on screen.
    if (active === 'changes' && !$reviewOpen.get()) {
      openReview($reviewScopeCwd.get(), $reviewScopeTarget.get())
    }

    if (active === 'console') {
      refreshTerminalSlot()
    }
  }, [active])

  const previewFile = async (path: string) => {
    try {
      const preview = await normalizeOrLocalPreviewTarget(path, $focusedWorkspaceCwd.get() || undefined)

      if (!preview) {
        throw new Error(r.couldNotPreview(path))
      }

      openPreview(preview)
    } catch (error) {
      notifyError(error, r.previewUnavailable)
    }
  }

  // A Markdown file opens in the reader; everything else keeps the existing
  // preview pipeline (Browser tab / preview pane).
  const activateFile = (path: string) => {
    if (isMarkdownPath(path)) {
      void openDrawerDocument(path).catch(error => notifyError(error, r.previewUnavailable))

      return
    }

    void previewFile(path)
  }

  return (
    <aside
      aria-label={r.drawer.aria}
      className="relative flex h-full w-full min-w-0 flex-col overflow-hidden bg-(--ui-sidebar-surface-background) text-(--ui-text-tertiary)"
    >
      <DrawerTabStrip active={active} onSelect={selectRightDrawerTab} />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <DrawerPanel active={active === 'console'} tab="console">
          {visited.has('console') && <ConsoleTab />}
        </DrawerPanel>

        <DrawerPanel active={active === 'browser'} tab="browser">
          {visited.has('browser') && <BrowserTab />}
        </DrawerPanel>

        <DrawerPanel active={active === 'files'} tab="files">
          {visited.has('files') && (
            <div className={EMBEDDED_ASIDE}>
              <RightSidebarPane onActivateFile={activateFile} onActivateFolder={path => void previewFile(path)} />
            </div>
          )}
        </DrawerPanel>

        <DrawerPanel active={active === 'changes'} tab="changes">
          {visited.has('changes') && (
            <div className={EMBEDDED_ASIDE}>
              <ReviewPane embedded />
            </div>
          )}
        </DrawerPanel>

        <DrawerPanel active={active === 'usage'} tab="usage">
          {visited.has('usage') && <UsageTab />}
        </DrawerPanel>

        <DrawerPanel active={active === 'document'} tab="document">
          {visited.has('document') && <DocumentTab />}
        </DrawerPanel>
      </div>
    </aside>
  )
}
