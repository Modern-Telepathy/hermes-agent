import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Tip } from '@/components/ui/tooltip'

/** The session-search toggle that sits beside the filter menu. */
export function SidebarSearchToggle({
  ariaLabel,
  className,
  onToggle,
  open
}: {
  ariaLabel: string
  className?: string
  onToggle: () => void
  open: boolean
}) {
  return (
    <div className="grid size-6 place-items-center">
      <Tip label={ariaLabel}>
        <Button
          aria-expanded={open}
          aria-label={ariaLabel}
          className={className}
          onClick={onToggle}
          size="icon-xs"
          variant="ghost"
        >
          <Codicon name="search" size="0.75rem" />
        </Button>
      </Tip>
    </div>
  )
}
