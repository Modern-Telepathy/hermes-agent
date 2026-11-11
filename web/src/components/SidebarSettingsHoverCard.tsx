import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Settings2 } from "lucide-react";
import { Button } from "@nous-research/ui/ui/components/button";
import { cn } from "@/lib/utils";

const WIDTH = 272;

/**
 * The sidebar's settings surface: the System block, the gateway actions and the
 * theme / language pickers live in this card so the rail keeps only this trigger
 * and the drawer toggle.
 *
 * It opens on hover or focus (a hovercard, not a menu), then pins as soon as the
 * pointer enters it or a control inside is pressed: the pickers open their own
 * listboxes in a body portal, so closing on mouse-leave would unmount them the
 * moment the pointer travelled onto the menu. Outside press or Escape closes it.
 */
export function SidebarSettingsHoverCard({
  children,
  collapsed = false,
  footer,
  label,
}: SidebarSettingsHoverCardProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ bottom: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const pinnedRef = useRef(false);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const close = useCallback(() => {
    clearCloseTimer();
    pinnedRef.current = false;
    setOpen(false);
  }, [clearCloseTimer]);

  const scheduleClose = useCallback(
    (force = false) => {
      if (pinnedRef.current && !force) return;
      clearCloseTimer();
      closeTimerRef.current = window.setTimeout(() => {
        pinnedRef.current = false;
        closeTimerRef.current = null;
        setOpen(false);
      }, 180);
    },
    [clearCloseTimer],
  );

  const show = useCallback(() => {
    clearCloseTimer();
    const trigger = triggerRef.current;
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      setAnchor({
        bottom: window.innerHeight - rect.top + 8,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - WIDTH - 8)),
      });
    }
    setOpen(true);
  }, [clearCloseTimer]);

  useEffect(() => clearCloseTimer, [clearCloseTimer]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (cardRef.current?.contains(target)) return;
      // A picker's listbox is portalled to <body> so it can escape the panel; its
      // options must not read as an outside press.
      if (target.closest?.('[role="listbox"]')) return;
      close();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, close]);

  return (
    <div
      ref={triggerRef}
      className="relative w-fit"
      onMouseEnter={show}
      onMouseLeave={() => scheduleClose()}
    >
      <Button
        ghost
        size="icon"
        onClick={() => (open ? close() : show())}
        onFocus={show}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={label}
        className={cn(
          "text-text-secondary hover:text-midground",
          collapsed && "hover:bg-transparent",
        )}
        title={label}
      >
        <Settings2 aria-hidden className="h-4 w-4" />
      </Button>

      {open &&
        anchor &&
        createPortal(
          <div
            ref={cardRef}
            aria-label={label}
            className={cn(
              "fixed z-[100] flex flex-col",
              "border border-current/20 bg-background-base/95",
              "shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)]",
            )}
            onMouseEnter={() => {
              clearCloseTimer();
              pinnedRef.current = true;
            }}
            onMouseLeave={() => scheduleClose(true)}
            onPointerDownCapture={() => {
              pinnedRef.current = true;
            }}
            style={{
              bottom: anchor.bottom,
              left: anchor.left,
              width: WIDTH,
              maxHeight: "70dvh",
            }}
          >
            <div className="border-b border-current/20 px-5 py-2">
              <span className="font-sans text-display text-xs text-text-tertiary">
                {label}
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

            {footer && (
              <div className="flex items-center gap-1 border-t border-current/20 px-2 py-1.5">
                {footer}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

interface SidebarSettingsHoverCardProps {
  children: ReactNode;
  collapsed?: boolean;
  footer?: ReactNode;
  label: string;
}
