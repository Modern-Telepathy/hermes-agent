# Social apps — Canvas Apps hosted in the Hermes dashboard

The six social experiences from `FraterCCCLXIII/canvas-apps`, running unchanged on the dashboard's
plugin system:

| Tab | App | Bundle | Protocol |
|---|---|---|---|
| Hangout™ | `apps/hangout` | 212 KB | Nostr · WebRTC |
| Bitkin™ | `apps/bitsocial-hangout` | 227 KB | Plebbit RPC · IPFS |
| MESH™ | `apps/mesh-hangout` | 275 KB | MESH protocol · Ed25519 |
| Holons™ | `apps/holons-hangout` | 190 KB | Matrix |
| Murmur™ | `apps/murmur` | 1.6 MB | libp2p · IPFS |
| MeetRightHere™ | `apps/meet` | 146 KB | WebRTC · LiveKit |

Each `dist/apps/<name>/extension.js` is the **committed Canvas App bundle**, copied byte for byte
with its `canvas-extension.json` and icon, and activated the way Agent Canvas activates them,
`activate(host)` with host API version `1`. One local patch exists — see "Starting a node" below;
every other bundle is untouched.

## Starting a node (Bitkin)

Bitkin's RPC endpoint is a local Bitsocial daemon, so "can't reach the node" is a setup step rather
than an error. Its settings card now carries the two commands (`npm install -g
@bitsocial/bitsocial-cli`, then `bitsocial daemon`, which listens on `ws://localhost:9138`) with a
copy button each, a **Start a node** button that runs the daemon through `host.agentServer`'s
`start_bash_command` — the same Canvas path Meet uses — and then polls the socket for 20s, a
**Check again** button, and the CLI docs link. `activate()` passes the host into `mount()` for that;
the sidebar's connection banner links to the same card. Carrying the patch upstream keeps this
vendored copy honest.

## The host shim

`dist/index.js` implements the whole surface the six apps use (verified by grepping `host.<name>`
in every bundle): `apiVersion`, `registerPage`, `navigate`, `isConnected`, `addEventListener` /
`removeEventListener` for pointer events, and `agentServer`.

## Agent Server adapter

Hangout and Meet speak the OpenHands Agent Server API. Hermes has no Agent Server, so
`host.agentServer.request()` translates the four calls those apps make:

| Agent Server call | Hermes side |
|---|---|
| `GET /api/conversations/search` | `GET /api/sessions?limit=40` (Hermes sessions → conversations) |
| `GET /api/conversations/{id}/events/search` | `GET /api/sessions/{id}/messages` (messages → `MessageEvent`s) |
| `POST /api/conversations/{id}/events` (`run: true`) | `POST /api/plugins/social-apps/send` → `hermes --resume <id> -z <text>` |
| `POST /api/bash/start_bash_command` | `POST /api/plugins/social-apps/bash` (Meet's meeting server) |

The send path is a **real Hermes turn in that same session**, not a chat imitation: the backend runs
the documented one-shot CLI against the resumed session and returns the reply. Verified end to end:
`reply: 'SOCIAL_OK' | exit: 0`.

Hangout's "Sign in →" screen is its own local onboarding step (it writes `hangout:v1` to
localStorage); after it, the dashboard's sessions appear as live agents ("8 agents · 8 live").

## What still needs infrastructure

- **Bitkin** wants a Plebbit RPC node (`ws://localhost:9138`), **MESH** a MESH node, **Holons** a
  Matrix homeserver, **Murmur** libp2p peers. Until those exist the apps run their seeded/demo data
  and log `ERR_CONNECTION_REFUSED`.
- **Meet** starts its meeting server through `start_bash_command`, which needs the LiveKit/media
  binary installed locally.

## Licence

The app bundles are MIT (see `canvas-apps/LICENSE`). "Hangout", "Bitkin", "MESH", "Holons", "Murmur",
"MeetRightHere" and "Kamiji" are trademarks of Artec, Paul Bloch, Modern Telepathy Inc and Automic
Intelligence Holdings; the trademark notice ships in each bundle.
