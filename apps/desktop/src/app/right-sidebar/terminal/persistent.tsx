import { useStore } from '@nanostores/react'
import { atom } from 'nanostores'
import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { isElementInHiddenPane, PANE_HIDDEN_ATTR } from '@/components/pane-shell/pane-visibility'
import { $layoutTree } from '@/components/pane-shell/tree/store'
import { markRightPanePerf } from '@/debug/right-pane-events'
import { createRendererLoopPauseController } from '@/lib/renderer-loop-pause'
import { $paneStates } from '@/store/panes'

import { ensureTerminal } from './terminals'
import { TerminalWorkspace } from './workspace'

/**
 * One xterm Terminal mounted at the layout root and CSS-overlayed onto
 * whichever `<TerminalSlot />` is active. Moving the host DOM detaches xterm's
 * WebGL renderer (it observes its own attachment) and resets the screen, so
 * the host stays put and we chase the slot's bounding rect with position:fixed.
 */

// Every mounted slot, in mount order — the terminal pane's and the drawer's
// Console tab both render one. The xterm host chases the slot that is actually
// laid out: a hidden tab (`display: none`) has no client rects and is skipped,
// so switching drawer tabs moves the overlay to the visible surface instead of
// leaving it over a hidden one.
const $slots = atom<readonly HTMLElement[]>([])

/** Bumped when something outside the DOM changes which slot is on screen (a
 *  drawer tab switch); the host re-picks the visible slot. */
const $slotRevision = atom(0)

export function refreshTerminalSlot(): void {
  $slotRevision.set($slotRevision.get() + 1)
}

const SLOT_CLASS = 'relative flex min-h-0 min-w-0 flex-1 flex-col'

export function TerminalSlot({ className = SLOT_CLASS }: { className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = ref.current

    if (!el) {
      return
    }

    $slots.set([...$slots.get().filter(slot => slot !== el), el])

    return () => {
      $slots.set($slots.get().filter(slot => slot !== el))
    }
  }, [])

  return <div className={className} data-terminal-slot="" ref={ref} />
}

interface PersistentTerminalProps {
  onAddSelectionToChat: (text: string, label?: string) => void
}

interface Rect {
  hidden: boolean
  top: number
  left: number
  width: number
  height: number
}

const sameRect = (a: Rect | null, b: Rect) =>
  !!a && a.hidden === b.hidden && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height

export function PersistentTerminal({ onAddSelectionToChat }: PersistentTerminalProps) {
  const slots = useStore($slots)
  const slotRevision = useStore($slotRevision)
  const paneStates = useStore($paneStates)
  const layoutTree = useStore($layoutTree)
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const [rect, setRect] = useState<Rect | null>(null)
  const [ready, setReady] = useState(false)

  // Two surfaces can hold a slot at once (the terminal pane and the drawer's
  // Console tab), and only one of them is laid out at a time. Pick the slot
  // that is on screen; fall back to the newest one so a hidden pane still
  // settles its visibility state.
  useLayoutEffect(() => {
    const laidOut = slots.filter(element => element.isConnected && element.getClientRects().length > 0)

    setSlot(laidOut[laidOut.length - 1] ?? slots[slots.length - 1] ?? null)
  }, [layoutTree, paneStates, slotRevision, slots])

  // VS Code parity: once a terminal surface has ever been on screen, keep the
  // terminals mounted — and their shells alive — even while hidden. Hiding the
  // surface just collapses the slot, so the overlay below goes invisible;
  // nothing is torn down. Only an explicit per-tab close kills a PTY.
  //
  // `ready` means a slot has real dimensions, so the first mount can never
  // start a shell at 0×0 (a collapsed terminal rail and a hidden drawer tab
  // both report no size) — whichever surface the user opens first is the one
  // that boots xterm.
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (ready) {
      setMounted(true)
      ensureTerminal()
    }
  }, [ready])

  useLayoutEffect(() => {
    if (!slot) {
      setRect(null)

      return
    }

    let prev: Rect | null = null
    let frame = 0
    let stopped = false
    let pendingReason = 'initial'
    let pauseController: ReturnType<typeof createRendererLoopPauseController> | null = null

    const rendererPaused = () => pauseController?.isPaused() ?? document.visibilityState === 'hidden'

    const cancelFrame = () => {
      if (frame !== 0) {
        window.cancelAnimationFrame(frame)
        frame = 0
      }
    }

    // Visibility is CORRECTNESS, not perf. The rect chase below forces layout,
    // so it stays gated on the renderer pause — but `hidden` is a cheap
    // attribute walk, and skipping it while paused strands the overlay over a
    // tab the user has already switched away from: the terminal keeps covering
    // the chat, opaque and pointer-interactive, until something refocuses the
    // window. Sample it on every wake, paused or not.
    const syncHidden = () => {
      const hidden = isElementInHiddenPane(slot)

      if (prev && prev.hidden !== hidden) {
        prev = { ...prev, hidden }
        setRect(prev)
      }
    }

    const measure = (reason: string): boolean => {
      if (rendererPaused()) {
        syncHidden()

        return false
      }

      markRightPanePerf('terminal-measure', reason)
      const r = slot.getBoundingClientRect()
      // floor top/left + ceil right/bottom: overlay always covers the slot's
      // full pixel footprint, so half-pixel rects can't leak page bg through.
      const top = Math.floor(r.top)
      const left = Math.floor(r.left)

      // Inactive keep-alive panes deliberately retain the same rect as the
      // foreground pane, so visibility must be sampled independently.
      const next: Rect = {
        hidden: isElementInHiddenPane(slot),
        top,
        left,
        width: Math.ceil(r.right) - left,
        height: Math.ceil(r.bottom) - top
      }

      if (!sameRect(prev, next)) {
        prev = next
        setRect(next)

        if (next.width > 0 && next.height > 0) {
          setReady(true)
        }

        return true
      }

      return false
    }

    const scheduleMeasure = (reason = 'unknown') => {
      if (stopped) {
        return
      }

      // Paused: no frame is coming (and none is wanted — the rect chase is the
      // expensive half). Still settle visibility synchronously so a tab switch
      // while the window is unfocused can't leave the overlay stranded.
      if (rendererPaused()) {
        syncHidden()

        return
      }

      if (frame !== 0) {
        return
      }

      pendingReason = reason
      frame = window.requestAnimationFrame(() => {
        frame = 0
        const reason = pendingReason

        if (measure(reason)) {
          scheduleMeasure('settle')
        }
      })
    }

    const handleVisibilityChange = () => {
      if (rendererPaused()) {
        cancelFrame()
        syncHidden()

        return
      }

      scheduleMeasure('visibility')
    }

    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            scheduleMeasure('resize-observer')
          })

    const positionObserver =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver(() => {
            scheduleMeasure('ancestor-mutation')
          })

    pauseController = createRendererLoopPauseController(handleVisibilityChange, { pauseWhenUnfocused: true })

    if (measure('initial')) {
      scheduleMeasure('settle')
    }

    observer?.observe(slot)

    const handleScroll = () => scheduleMeasure('scroll')
    const scrollTargets: Array<HTMLElement | Window> = [window]
    window.addEventListener('scroll', handleScroll)

    for (let node: HTMLElement | null = slot; node; node = node.parentElement) {
      positionObserver?.observe(node, {
        attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'data-state', PANE_HIDDEN_ATTR],
        attributes: true,
        childList: true,
        subtree: false
      })
      // Scroll does not bubble. Listen only on the slot's own ancestor chain,
      // so a transcript/file-tree/xterm viewport scroll elsewhere cannot wake
      // terminal positioning.
      node.addEventListener('scroll', handleScroll)
      scrollTargets.push(node)
    }

    // Nested layout-tree and pane-state commits can move the slot without
    // changing its own size. Subscribe to the actual layout authorities instead
    // of observing every descendant mutation under every ancestor (chat stream
    // and file-tree updates are unrelated and used to wake this tracker).
    const unsubscribeLayout = $layoutTree.listen(() => scheduleMeasure('layout-tree'))
    const unsubscribePanes = $paneStates.listen(() => scheduleMeasure('pane-state'))

    const handleResize = () => scheduleMeasure('window-resize')

    window.addEventListener('resize', handleResize)

    return () => {
      stopped = true
      cancelFrame()
      observer?.disconnect()
      positionObserver?.disconnect()
      unsubscribeLayout()
      unsubscribePanes()
      window.removeEventListener('resize', handleResize)
      scrollTargets.forEach(target => target.removeEventListener('scroll', handleScroll))
      pauseController?.dispose()
    }
  }, [slot])

  const visible = Boolean(rect && !rect.hidden && rect.width > 0 && rect.height > 0)

  const style: CSSProperties = {
    position: 'fixed',
    top: rect?.top ?? 0,
    left: rect?.left ?? 0,
    width: rect?.width ?? 0,
    height: rect?.height ?? 0,
    display: 'flex',
    flexDirection: 'column',
    visibility: visible ? 'visible' : 'hidden',
    // Electron may keep xterm's WebGL canvas visually composited after an
    // ancestor becomes visibility:hidden. Opacity clears that compositor layer
    // while preserving the mounted DOM, terminal dimensions, and live PTY.
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? 'auto' : 'none',
    zIndex: 4,
    // Match the live skin surface so the header strip (transparent) and body
    // read as one cohesive pane instead of revealing a near-black slab behind.
    backgroundColor: 'var(--ui-terminal-surface-background)',
    contain: 'layout size paint'
  }

  // Defer the FIRST mount until the pane is open and the slot has real dims —
  // booting xterm/node-pty at 0×0 starts the shell at 80×24 and spawns a visible
  // conhost on Windows. After that `mounted` latches: shells persist while hidden.
  return (
    <div aria-hidden={!visible} data-persistent-terminal="" style={style}>
      {mounted && <TerminalWorkspace onAddSelectionToChat={onAddSelectionToChat} />}
    </div>
  )
}
