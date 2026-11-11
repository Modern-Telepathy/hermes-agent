import { Typography } from "@nous-research/ui/ui/components/typography/index";
import { useEffect, useState } from "react";

import { useI18n } from "@/i18n";
import type { StatusResponse } from "@/lib/api";
import { cn } from "@/lib/utils";
import { getSlotEntries, onSlotRegistered, PluginSlot } from "@/plugins";

/**
 * Host for the `footer-left` / `footer-right` plugin slots.
 *
 * The bar itself carries no built-in content any more — the version and the
 * Nous Research link moved into the settings card, where they sit next to the
 * rest of the shell chrome. It renders only when a plugin has claimed one of
 * the slots, so an install without footer plugins gets no empty strip above
 * the auth widget.
 */
function hasFooterContent(): boolean {
  return (
    getSlotEntries("footer-left").length + getSlotEntries("footer-right").length > 0
  );
}

/**
 * The shell's version and org line, rendered as the bottom row of the settings
 * card. It used to be the sidebar footer's default cells; the footer now exists
 * only for plugins, so the two live here with the rest of the chrome.
 */
export function SidebarOrgMeta({ status }: { status: StatusResponse | null }) {
  const { t } = useI18n();

  return (
    <>
      <Typography className="font-mono-ui text-xs tabular-nums text-text-tertiary lowercase">
        {status?.version != null ? `v${status.version}` : "—"}
      </Typography>

      <a
        href="https://nousresearch.com"
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "font-sans text-display text-xs text-midground",
          "inline-flex items-center min-h-[24px]",
          "transition-opacity hover:opacity-90",
          "focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-midground/40",
        )}
      >
        {t.app.footer.org}
      </a>
    </>
  );
}

export function SidebarFooter() {
  const [claimed, setClaimed] = useState(hasFooterContent);

  useEffect(
    () => onSlotRegistered(() => setClaimed(hasFooterContent())),
    [],
  );

  if (!claimed) return null;

  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-t border-current/10 px-5 py-2.5">
      <PluginSlot name="footer-left" />
      <PluginSlot name="footer-right" />
    </div>
  );
}
