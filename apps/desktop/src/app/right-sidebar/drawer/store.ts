/**
 * Drawer-owned state: the document the Document tab is reading.
 *
 * Preview targets are the app's one description of a file on disk (kind,
 * label, language, how it should render), so the document viewer reuses them
 * instead of inventing a second file-description type — and readers that
 * already know how to show a target (`LocalFilePreview`) work unchanged.
 */

import { atom } from 'nanostores'

import { normalizeOrLocalPreviewTarget } from '@/lib/local-preview'
import type { PreviewTarget } from '@/store/preview'
import { selectRightDrawerTab } from '@/store/right-drawer-tab'
import { $focusedWorkspaceCwd } from '@/store/session-states'

export const $drawerDocumentTarget = atom<null | PreviewTarget>(null)

export function setDrawerDocument(target: null | PreviewTarget): void {
  $drawerDocumentTarget.set(target)
}

const MARKDOWN_FILE = /\.(md|mdx|markdown)$/i

/** Files the Document tab opens instead of the Browser. */
export function isMarkdownPath(path: string): boolean {
  return MARKDOWN_FILE.test(path.split(/[?#]/, 1)[0] ?? path)
}

/** Read a Markdown file in the Document tab. */
export async function openDrawerDocument(path: string): Promise<void> {
  const target = await normalizeOrLocalPreviewTarget(path, $focusedWorkspaceCwd.get() || undefined)

  if (!target) {
    throw new Error(`Could not preview ${path}`)
  }

  setDrawerDocument(target)
  selectRightDrawerTab('document')
}
