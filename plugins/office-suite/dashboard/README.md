# Office suite — Kosmos Suite and DocTransit on the Hermes dashboard

The five Kosmos Suite apps and DocTransit, ported from `OpenHands/canvas-apps` (MIT) to the
dashboard's plugin system.

| Tab | App | Bundle | What it edits |
|---|---|---|---|
| Docs | `apps/suite-docs` | 1.42 MB | `suite/docs/**/*.md` — rich text, wikilinks, sheet embeds, docx/odt/html in/out |
| Sheets | `apps/suite-sheets` | 1.15 MB | `suite/sheets/*.csv`, `*.sheet.json` — formulas, charts, xlsx/ods/csv in/out |
| Slides | `apps/suite-slides` | 318 KB | `suite/slides/**/*.md` — decks, presenter mode, pptx/html/pdf out |
| Notes | `apps/suite-notes` | 865 KB | `suite/notes/**/*.md` — vault, backlinks, graph, daily notes |
| Calendar | `apps/suite-calendar` | 275 KB | `suite/calendar/**`, `suite/tasks/**` — events, tasks, ICS |
| DocTransit | `apps/doctransit` | 175 KB | nothing local: e-signature over api.doctransit.com |

Each `dist/apps/<id>/extension.js` is the **committed Canvas App bundle**, copied with its
`canvas-extension.json` and icon. The apps are activated the way Agent Canvas activates them,
`activate(host)` with host API version `1`.

## Where the files live

`<hermes home>/workspace/project/suite` — the path the suite's own `CONTRACT.md` names as the
default, so a Hermes agent finds it by convention (`$SUITE_ROOT` also works with the suite CLI).
Nothing is stored in a database: the apps are editors over plain files, and an agent editing them
with ordinary file tools is picked up by the apps' pollers within a couple of seconds.

## What changed from Canvas

- **Filesystem.** Canvas reaches its Agent Server through
  `POST /api/bash/execute_bash_command` plus `/api/file/*`. Hermes has no Agent Server, so
  `dist/host.js` installs a `workspace-fs` adapter (list/stat/read/compare-and-swap write/mkdir/
  move/remove, with a `mtime_ns:size` version token) backed by `plugin_api.py` instead of
  emulating a shell.
- **Adapter seam.** The kit's `connectSuite` prefers `globalThis.__SUITE_SHARED_ADAPTER__` over
  `host.agentServer` — the seam Canvas uses for its all-apps harness — so the shim sets it before
  a bundle mounts. Two one-line patches in the vendored bundles report that adapter as a real
  workspace instead of the mock one; the copied source tree is untouched upstream.
- **Agent actions.** Notes' "Ask the agent" and Calendar's automations call `/api/conversations`
  and `/api/automation/*` on the Agent Server. The host answers with a clear error, so those
  surfaces fall back to their own copy-prompt/not-connected states.
- **New Chat.** DocTransit registers two create actions (New document, New contract). Hermes has
  no New Chat menu, so its tab renders them as a toolbar instead.

## Licence

The app bundles are MIT (`canvas-apps/LICENSE`). DocTransit uses the DocTransit mark and wordmark;
"Hangout", "Kosmos", "DocTransit" and related names are trademarks of their owners.
