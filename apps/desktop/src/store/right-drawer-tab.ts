/**
 * WHICH TAB THE RIGHT DRAWER IS SHOWING.
 *
 * The drawer is the app's right-hand tool panel — Console, Browser, Folders,
 * Changes, Usage, Document. The selection is presentation state owned by this
 * window's renderer (two windows on one profile may look at different tabs),
 * so it lives here rather than in the backend.
 *
 * The drawer occupies the file browser's tree pane id (`files`): ⌘J, the
 * titlebar button, `focus_pane` and every reveal path already address that
 * panel, and the drawer is what that panel now is.
 */

import { persistentAtom } from '@/lib/persisted'

/** Tab order in the drawer's strip. */
export const RIGHT_DRAWER_TABS = ['console', 'browser', 'files', 'changes', 'usage', 'document'] as const

export type RightDrawerTab = (typeof RIGHT_DRAWER_TABS)[number]

export function isRightDrawerTab(value: unknown): value is RightDrawerTab {
  return typeof value === 'string' && (RIGHT_DRAWER_TABS as readonly string[]).includes(value)
}

export const RIGHT_DRAWER_STORAGE_KEY = 'hermes.desktop.rightDrawerTab.v1'

export const $rightDrawerTab = persistentAtom<RightDrawerTab>(RIGHT_DRAWER_STORAGE_KEY, 'files', {
  decode: raw => (isRightDrawerTab(raw) ? raw : 'files'),
  encode: tab => tab
})

/** The tree pane the drawer occupies: the file browser's id, kept so ⌘J, the
 *  titlebar button and every reveal path keep addressing the same panel. */
export const RIGHT_DRAWER_PANE_ID = 'files'

export function selectRightDrawerTab(tab: RightDrawerTab): void {
  if ($rightDrawerTab.get() !== tab) {
    $rightDrawerTab.set(tab)
  }
}
