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
| Bitkin™ | Bitsocial node | `127.0.0.1:9138` | `npm install -g @bitsocial/bitsocial-cli`, then `bitsocial daemon` |
| MeetRightHere™ | LiveKit | `127.0.0.1:7880` | `brew install livekit`; `livekit-server --dev` (the app's own command) |
| MESH™ | MESH node | `127.0.0.1:12000` | none bundled — paste your node's command |
| Holons™ | holons-api | `127.0.0.1:3000` | none bundled — paste your server's command |
| Murmur™ | libp2p peers | — | nothing to install; it needs a relay or a neighbour |

Bitkin's start command puts npm's global prefix on `PATH` first: a prefix outside the login shell's
`PATH` (Homebrew and nvm layouts) is the usual reason an installed `bitsocial` reads as missing.

## Behaviour that matters

- Commands run detached through `/bin/sh -lc`, exactly like `plugins/social-apps`' `/bash` endpoint, so
  an install or a server outlives the HTTP request that asked for it.
- **Stop only ends a process this page started.** A service launched elsewhere — Meet's Start it, a
  daemon in a terminal — is reported as running and left alone, because a pid we did not record is not
  a process we can identify.
- Installing does not block the page: the row goes `starting…`, polls until the port answers, and shows
  the command's log if it does not.
