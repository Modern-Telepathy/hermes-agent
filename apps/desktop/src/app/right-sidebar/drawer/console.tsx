/** The drawer's Console tab: the live terminals (shells + agent processes),
 *  hosted by the app-wide persistent xterm overlay. `TerminalPaneChrome` is the
 *  same slot + tab rail the terminal pane renders, so the drawer and the
 *  terminal panel are two views of one set of PTYs. */
import { TerminalPaneChrome } from '../terminal/chrome'

export function ConsoleTab() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <TerminalPaneChrome />
    </div>
  )
}
