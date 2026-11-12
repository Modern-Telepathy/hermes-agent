# Local services

The social apps run in the dashboard but talk to servers on the machine they open on. Each app reports
its own outage from inside its tab; this plugin is where the server is actually installed, started and
stopped, so setup does not mean reading five different banners.

One row per service: the endpoint the app dials, a live `running` pill (a TCP probe of that port), the
exact command that installs and starts it with a copy button each, **Install** / **Start** / **Stop**,
the log the command wrote, a link into the app that needs it, and — for a service with no bundled
installer — a command field that runs whatever you paste.

## Services

| App | Service | Endpoint | Install / start |
|---|---|---|---|
| Bitkin™ | Bitsocial node | `127.0.0.1:9138` | `npm install -g --prefix "$HOME/.local" @bitsocial/bitsocial-cli`, then `bitsocial daemon` |
| MeetRightHere™ | LiveKit | `127.0.0.1:7880` | `brew install livekit`; `livekit-server --dev` (the app's own command) |
| MESH™ | MESH node | `127.0.0.1:12000` | none bundled — paste your node's command |
| Holons™ | holons-api | `127.0.0.1:3000` | none bundled — paste your server's command |
| Murmur™ | libp2p peers | — | nothing to install; it needs a relay or a neighbour |

Bitkin's commands pin npm's prefix to `$HOME/.local`: npm's own global prefix resolves to
`/usr/local` on a no-prefix install, which needs root (`EACCES`), and the login `PATH` does not always
carry the prefix npm actually used. Install and start therefore agree on one user-writable place, and
`installed` is detected on `PATH` or in that prefix.

The daemon also pins a Node version, because it needs a window the shell default rarely lands in:
22.15-25. Below 22.15 its bundled undici calls `zlib.createZstdDecompress` at import (undefined, so
`Cannot read properties of undefined (reading 'bind')`); above 25 its native sqlite module refuses
with `NODE_MODULE_VERSION`. Both commands run the same picker — the first installed nvm Node that
satisfies both — and install rebuilds `better-sqlite3` for that ABI, so the pair always agrees.

## Behaviour that matters

- Commands run detached through `/bin/sh -lc`, exactly like `plugins/social-apps`' `/bash` endpoint, so
  an install or a server outlives the HTTP request that asked for it.
- **Stop only ends a process this page started.** A service launched elsewhere — Meet's Start it, a
  daemon in a terminal — is reported as running and left alone, because a pid we did not record is not
  a process we can identify.
- Installing does not block the page: the row goes `starting…`, polls until the port answers, and shows
  the command's log if it does not.
