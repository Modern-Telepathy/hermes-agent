import { useStore } from '@nanostores/react'

import { LocalFilePreview } from '@/app/chat/right-rail/preview-file'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { useI18n } from '@/i18n'
import { displayPath } from '@/lib/display-path'
import { $previewReloadRequest } from '@/store/preview'

import { EmptyState } from '../index'

import { $drawerDocumentTarget, setDrawerDocument } from './store'

/**
 * The drawer's Document tab: a reader for Markdown in the workspace. Opening a
 * `.md` file from Folders lands here (see `RightDrawer`), and `LocalFilePreview`
 * brings the rendered/source switch, live reloads and the same link handling
 * the preview pane uses — a document is a preview with somewhere to read it.
 */
export function DocumentTab() {
  const { t } = useI18n()
  const r = t.rightSidebar.drawer
  const target = useStore($drawerDocumentTarget)
  const reloadKey = useStore($previewReloadRequest)

  if (!target) {
    return <EmptyState body={r.documentEmptyBody} title={r.documentEmptyTitle} />
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex h-7 shrink-0 items-center gap-1.5 border-b border-(--ui-stroke-quaternary) px-2.5">
        <Codicon className="shrink-0 text-(--ui-text-quaternary)" name="book" size="0.8125rem" />
        <span
          className="min-w-0 flex-1 truncate font-mono text-[0.66rem] text-(--ui-text-secondary)"
          title={displayPath(target.path || target.url)}
        >
          {displayPath(target.path || target.label)}
        </span>
        <Button
          aria-label={r.documentClose}
          onClick={() => setDrawerDocument(null)}
          size="icon-xs"
          variant="ghost"
        >
          <Codicon name="close" size="0.8125rem" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <LocalFilePreview onClose={() => setDrawerDocument(null)} reloadKey={reloadKey} target={target} />
      </div>
    </div>
  )
}
