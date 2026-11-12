# Kamiji avatar — dashboard plugin

A live Kamiji in the dashboard chat. Imported from the Hermes **WebUI** extension at
`kamiji/integrations/hermes-webui` (`dist/kamiji-avatar/`, built 2026-10-25) and re-hosted on the
dashboard's own plugin system, because the dashboard is not the WebUI: its chat is the embedded
`hermes --tui` PTY (`web/AGENTS.md`), so there is no `.role-icon.assistant` DOM node to upgrade.

## What moved, what was rewritten

| Piece | Status |
|---|---|
| `dist/kamiji-runtime.js` (813 KB, `<kamiji-avatar>` + three.js 0.186.1, shadow DOM, WebGL with a lettered fallback slot) | **imported unchanged** |
| `dist/assets/kamiji.glb` + 15 prop GLBs | **imported unchanged** (CC BY-NC 4.0, see `dist/LICENSE-ASSETS.txt`) |
| `extension/kamiji-adapter.js` (MutationObserver over the WebUI message list, `window.EventSource` wrapper) | **rewritten**: the dashboard renders the transcript in the terminal, so the adapter's seam does not exist here |
| Status source | **rewritten** to the dashboard's real one: `/api/events?channel=<chat channel>`, the fan-out of the PTY child's dispatcher emits (`tui_gateway/event_publisher.py` → `/api/pub` → `/api/events`) |

The channel id is owned by `web/src/pages/ChatPage.tsx` and is not in the DOM, so the dashboard
plugin SDK gained one generic accessor, `SDK.chat` (`web/src/lib/active-chat.ts`), rather than the
plugin reaching into React internals.

## Event → Kamiji status

Kamiji protocol v1 statuses (`KamijiAvatar.STATUSES`): `idle`, `running`, `paused`, `waiting`,
`finished`, `error`, `stuck`.

| Dashboard event | Status |
|---|---|
| `message.start`, `thinking.delta`, `reasoning.delta`, `tool.start`, `tool.complete`, `tool.generating`, `status.update` | `running` (brief hold after the last one) |
| `connection.request`, `notification.show` | `waiting` |
| `message.complete` (`status` absent/ok) | `finished` for `ttl`, then `idle` |
| `message.complete` with `status: "error"`, `error` | `error` until the next activity |

## Licence

Code (this plugin, the adapter rewrite, the runtime): MIT. Model and prop assets: **CC BY-NC 4.0** —
non-commercial use only; commercial use needs the Kamiji Premium Licence. That is why nothing here
goes upstream to Hermes.

Kamiji is a trademark of Artec / Paul Bloch / Modern Telepathy Inc / Automic Intelligence Holdings.
