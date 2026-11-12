/* MeetRightHere — a Canvas App for video meetings on an open stack (WebRTC through a LiveKit SFU).
 *
 * Browser-only ESM. The only dependency is livekit-client, loaded from a pinned CDN URL when
 * you join. Styles are scoped under `.mt`; text is always set with textContent. Your name,
 * room and server addresses are kept in this browser's localStorage.
 *
 * Join tokens come from a small server you run (see token-server.mjs) so the LiveKit API
 * secret never reaches the browser.
 */

const STORAGE_KEY = "meet:v1";
const UI_KEY = "meet:v1:ui";

/**
 * Every legal and licence string of the About tab, in one place for review.
 * The notice wording is copied from src/constants/brand-notice.ts (same text as the Apps page).
 * TERMS and PRIVACY are DRAFTS that only state facts about what this code does; counsel must review them,
 * and each [placeholder] must be filled in with real information before release.
 */
export const LEGAL_TEXT = {
  appName: "MeetRightHere™",
  version: "0.1.0", // keep in step with canvas-extension.json
  copyright: "© 2026 Artec, Paul Bloch, Modern Telepathy Inc and Automic Intelligence Holdings. All rights reserved.",
  marks: "Tower™, Commons™, Kosmos™, Kamiji™, Bitkin™, Holons™, Hangout™, MESH™ and DocTransit™ are trademarks of Artec, Paul Bloch, Modern Telepathy Inc and Automic Intelligence Holdings.",
  dated: "Notice dated October 30, 2026.",
  logos: "The Kamiji, Kosmos and Artec marks shown in the Built with row are marks of their owners named above. WebRTC and LiveKit are names and marks of their respective owners; this app is not endorsed by them.",
  licencesNote: "Third-party components this app uses. A licence marked “licence not verified” could not be read from this repository: check the project’s own licence file before release.",
  draft: "Draft for review: not legal advice. Have counsel review before public release.",
  terms: [
    ["Status", "[Effective date: add before release]. MeetRightHere is preview software (Coming Soon, December 2026). Features may change or be removed before launch."],
    ["Who these terms are with", "[Operator name and contact email: add before release]."],
    ["Use of the app", "You may use MeetRightHere to hold video calls through a LiveKit server that you or your host runs. Do not use it to break the law, to harass or deceive others, to record people without the consent the law requires, or to attack, overload or probe servers you do not control."],
    ["Your server and your content", "Calls, chat and screen shares travel between participants through the LiveKit server address you configure. You are responsible for that server, for the people you invite and for what is said or shown in your calls."],
    ["Third-party services", "The app may load code or images from third-party hosts (see the Privacy section) and can link to mail, SMS, WhatsApp or GitHub services at your request. Those services have their own terms and privacy policies, which apply to your use of them."],
    ["No warranty", "MeetRightHere is provided “as is” and “as available”, without warranty of any kind, express or implied, including fitness for a particular purpose, availability, call quality or security. Preview software may contain errors and may change at any time."],
    ["Limitation of liability", "[Limitation of liability clause: to be completed by counsel]."],
    ["Marks and copyright", "The notices on the About tab apply. Nothing here grants a licence to the marks."],
    ["Governing law", "[Governing law and venue: add before release]."],
    ["Changes", "[Process for changing these terms: add before release]."],
  ],
  privacy: [
    ["Status", "[Effective date: add before release]. [Contact email for privacy questions: add before release]."],
    ["Summary", "MeetRightHere runs in your browser. It has no accounts and its code contains no analytics or telemetry. The app’s authors do not receive your data through the app."],
    ["Stored in this browser", "Local storage key “meet:v1” holds your display name, last room, LiveKit server address, token endpoint, API key, API secret, MeetRightHere folder path, public share address and your contacts (name, email, phone, GitHub handle and note, from what you add or import from a CSV, vCard or GitHub). Key “meet:v1:ui” remembers whether Advanced setup is open. Keys “grip:meet:contacts” and “grip:meet:chat” remember column widths. Chat messages are kept in memory only and are gone when you leave or reload. Imported contact files are read in the browser and never uploaded by the app."],
    ["Where the data goes", "When you join, the app connects to the LiveKit server you configured and sends your camera, microphone, screen share, chat messages and your display name and room name to it, and through it to the other participants. If a token endpoint is set, the app requests it (GET with the room and your display name) to receive a join token; otherwise the browser signs a token itself with the API key and secret in Settings. Whoever runs those servers can see that traffic; read their policies."],
    ["Other network connections", "To work, the page loads the livekit-client library (version 2.15.0) from cdn.jsdelivr.net when you press Join, the qrcode-generator library (version 1.4.4) from cdn.jsdelivr.net when a QR code is shown, and small technology logos from cdn.simpleicons.org in the Built with row; those hosts can see your IP address and browser details. The app probes your LiveKit server and token endpoint to show their status. If you import people from GitHub, it requests api.github.com for the repository or pull request you name, using the GitHub token your local OpenHands Agent Server holds when there is one, otherwise public data only. If you press Start, the app asks your local OpenHands Agent Server to run the server command on this machine. Email, SMS, WhatsApp and system share actions open those apps only when you click them."],
    ["Voice features", "If you turn on the agent’s voice listening, the app uses your browser’s speech recognition. Depending on the browser, audio may be sent to the browser vendor’s service for transcription; see your browser’s policy. Spoken agent replies use your browser’s speech synthesis. The built-in agent replies are generated in the page and are not sent anywhere."],
    ["Your choices and deleting data", "Use your browser’s site-data controls (clear site data or local storage for this page) to delete everything the app stores. The app has no separate Reset button. Leaving a call ends the connection to the LiveKit server; retention on that server is up to its operator."],
    ["Children, regions and security", "[Age limits, regional rights and legal bases: to be completed by counsel before release]. The API secret is stored in plain text in browser local storage when you use browser-signed tokens; use a token endpoint instead for anything other than local testing."],
    ["Changes", "[Process for notifying changes: add before release]."],
  ],
  licences: [
    { name: "livekit-client", version: "2.15.0", licence: "licence not verified here", where: "Loaded at runtime from https://cdn.jsdelivr.net/npm/livekit-client@2.15.0/dist/livekit-client.esm.mjs; not in this repository" },
    { name: "LiveKit server", version: "v1.13.11 (tested)", licence: "Apache 2.0 (as stated in this app’s README)", where: "https://github.com/livekit/livekit; you install and run it separately" },
    { name: "qrcode-generator", version: "1.4.4", licence: "licence not verified here", where: "Loaded at runtime from https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm; not in this repository" },
    { name: "livekit-server-sdk", version: "latest at install", licence: "licence not verified here", where: "Optional: installed by you for token-server.mjs (npm i livekit-server-sdk); not bundled" },
    { name: "Simple Icons (WebRTC, LiveKit logos)", version: "n/a", licence: "licence not verified here", where: "Images fetched from https://cdn.simpleicons.org" },
    { name: "Kamiji, Kosmos and Artec marks", version: "n/a", licence: "marks of their owners (see the notice above); not open-licensed", where: "Drawn from public/logos/ and the shared splash footer in this repository" },
    { name: "vitest and jsdom", version: "5.0.0 and 30.0.1", licence: "MIT (read from package.json in this repository)", where: "https://github.com/vitest-dev/vitest, https://github.com/jsdom/jsdom; development only, not shipped" },
  ],
};

const LIVEKIT_URL = "https://cdn.jsdelivr.net/npm/livekit-client@2.15.0/dist/livekit-client.esm.mjs";

export const DEFAULTS = { name: "", room: "standup", serverUrl: "ws://127.0.0.1:7880", tokenUrl: "", apiKey: "devkey", apiSecret: "secret", folder: "" };

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const textBytes = (t) => new TextEncoder().encode(t);

/** A LiveKit join token (HS256 JWT) signed in the browser. Only for a local `livekit-server --dev`
 *  with its published dev key: a real deployment mints tokens on a server. */
export async function signToken({ key, secret, room, identity, ttlSeconds = 7200, now = Date.now() }) {
  const sec = Math.floor(now / 1000);
  const head = b64url(textBytes(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = b64url(textBytes(JSON.stringify({
    iss: key, sub: identity, name: identity, nbf: sec - 10, exp: sec + ttlSeconds,
    video: { roomJoin: true, room, canPublish: true, canSubscribe: true, canPublishData: true },
  })));
  const k = await crypto.subtle.importKey("raw", textBytes(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, textBytes(`${head}.${body}`)));
  return `${head}.${body}.${b64url(sig)}`;
}

/** The http(s) address of a LiveKit websocket URL, where the server answers a plain GET. */
export const httpUrl = (wsUrl) => String(wsUrl).trim().replace(/^ws(s?):/i, "http$1:");

/** Is a LiveKit server answering at this address? */
export async function probeLivekit(fetchFn, serverUrl) {
  try {
    const res = await fetchFn(httpUrl(serverUrl), { mode: "no-cors" });
    return { ok: true, note: res.type === "opaque" || res.ok ? "Server is answering." : `Answered ${res.status}.` };
  } catch {
    return { ok: false, note: "Nothing answered. Start the server, or the page is blocked from reaching it." };
  }
}

/** Does the token endpoint hand out a token? */
export async function probeToken(fetchFn, tokenUrl) {
  if (!tokenUrl) return { ok: true, note: "Built in: MeetRightHere signs dev tokens itself (local server only)." };
  try {
    const res = await fetchFn(`${tokenUrl}?room=probe&identity=probe`);
    if (!res.ok) return { ok: false, note: `Answered ${res.status}.` };
    const body = await res.json();
    return body && body.token ? { ok: true, note: "Token endpoint works." } : { ok: false, note: "Answered, but without a token." };
  } catch {
    return { ok: false, note: "Nothing answered. Start the token server, or the page is blocked from reaching it." };
  }
}

/** What the browser reports about camera and microphone access. */
export async function probeMedia(nav = globalThis.navigator) {
  if (!nav?.mediaDevices?.enumerateDevices) return { ok: false, note: "This page cannot reach camera or microphone devices." };
  try {
    const devices = await nav.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === "videoinput").length;
    const mics = devices.filter((d) => d.kind === "audioinput").length;
    return cams || mics ? { ok: true, note: `${cams} camera${cams === 1 ? "" : "s"}, ${mics} microphone${mics === 1 ? "" : "s"} found. Use Test to grant access.` } : { ok: false, note: "No camera or microphone found." };
  } catch (err) {
    return { ok: false, note: String(err?.message || err) };
  }
}

/** The commands MeetRightHere needs running, with the folder the token server lives in. */
export const startCommands = (folder) => ({
  livekit: { label: "LiveKit server", command: "command -v livekit-server >/dev/null || brew install livekit; livekit-server --dev", cwd: folder || undefined, install: "brew install livekit" },
  token: { label: "Token server", command: "node token-server.mjs", cwd: folder || undefined, install: "npm i livekit-server-sdk" },
});

/** A room or display name the token server will accept. */
export const cleanName = (v) => String(v || "").replace(/[^\w .-]/g, "").trim().slice(0, 64);

/** Columns for a grid of n tiles: 1, 2, then roughly square. */
export const gridColumns = (n) => (n <= 1 ? 1 : n <= 4 ? 2 : Math.min(6, Math.ceil(Math.sqrt(n))));

/** Chat travels as small JSON blobs over LiveKit data messages. */
export const encodeChat = (text) => new TextEncoder().encode(JSON.stringify({ t: "chat", text: String(text).slice(0, 2000) }));
export function decodeChat(bytes) {
  try {
    const msg = JSON.parse(new TextDecoder().decode(bytes));
    return msg && msg.t === "chat" && typeof msg.text === "string" ? msg.text : null;
  } catch { return null; }
}

export const initials = (name) => String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";

const slug = (v) => cleanName(v).toLowerCase().replace(/\s+/g, "-");

/** The room two people share for a direct call, the same from either side. */
export const directRoom = (a, b) => `call-${[slug(a), slug(b)].sort().join("-")}`.slice(0, 64);

/** Split CSV text into rows, honouring quoted fields. */
function csvRows(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some((x) => x.trim())) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

/** Contacts from a CSV with a header row (Name or First/Last name, Email, Phone, as Google and Outlook export). */
export function parseCsv(text) {
  const [head, ...body] = csvRows(String(text || ""));
  if (!head) return [];
  const col = (...names) => head.findIndex((h) => names.includes(h.trim().toLowerCase()));
  const iName = col("name", "full name", "display name");
  const iFirst = col("first name", "given name", "first");
  const iLast = col("last name", "family name", "last");
  const iEmail = head.findIndex((h) => /e-?mail/i.test(h) && !/type|label/i.test(h));
  const iPhone = head.findIndex((h) => /phone|mobile/i.test(h) && !/type|label/i.test(h));
  return body.map((r) => {
    const at = (i) => (i >= 0 ? (r[i] || "").trim() : "");
    const name = at(iName) || [at(iFirst), at(iLast)].filter(Boolean).join(" ") || at(iEmail).split("@")[0];
    return { name: cleanName(name), email: at(iEmail), phone: at(iPhone) };
  }).filter((c) => c.name);
}

/** Contacts from vCard (.vcf) text. */
export function parseVcf(text) {
  return String(text || "").split(/BEGIN:VCARD/i).slice(1).map((card) => {
    const get = (key) => (card.match(new RegExp(`^${key}[^:\\r\\n]*:(.*)$`, "im")) || [])[1]?.trim() || "";
    const n = get("N").split(";");
    const name = get("FN") || [n[1], n[0]].filter(Boolean).join(" ").trim();
    return { name: cleanName(name), email: get("EMAIL"), phone: get("TEL") };
  }).filter((c) => c.name);
}

/** Parse pasted or uploaded contacts, as vCard when it looks like one, otherwise CSV. */
export const parseContacts = (text) => (/BEGIN:VCARD/i.test(text) ? parseVcf(text) : parseCsv(text));

/** The GitHub token OpenHands already holds for the connected account (the local Agent Server's secrets), or "" for public data only. */
export async function connectedGithubToken(request) {
  try {
    const listed = await request({ path: "/api/settings/secrets" });
    const names = (Array.isArray(listed) ? listed : listed?.secrets || []).map((x) => (typeof x === "string" ? x : x.name));
    const match = ["GITHUB_TOKEN", "GH_TOKEN", "github"].find((n) => names.includes(n));
    if (!match) return "";
    const value = await request({ path: `/api/settings/secrets/${encodeURIComponent(match)}` });
    return typeof value === "string" ? value.trim() : String(value?.value || "").trim();
  } catch {
    return "";
  }
}

/** owner/repo (and a PR number) from "owner/repo", "owner/repo#12" or a github.com repo or pull URL. */
export function parseGithubRef(text) {
  const t = String(text || "").trim();
  const url = t.match(/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/pull\/(\d+))?(?:[/?#].*)?$/i);
  if (url) return { owner: url[1], repo: url[2], pr: url[3] ? Number(url[3]) : null };
  const short = t.match(/^([\w.-]+)\/([\w.-]+?)(?:#(\d+))?$/);
  return short ? { owner: short[1], repo: short[2], pr: short[3] ? Number(short[3]) : null } : null;
}

/** People on a repo (its top contributors) or a pull request (author, reviewers, commenters, committers). */
export async function fetchGithubPeople(fetchFn, ref, { token = "", limit = 40 } = {}) {
  const base = `https://api.github.com/repos/${ref.owner}/${ref.repo}`;
  const headers = { accept: "application/vnd.github+json", ...(token ? { authorization: `Bearer ${token}` } : {}) };
  const get = async (path) => {
    const res = await fetchFn(path.startsWith("http") ? path : `https://api.github.com${path}`, { headers });
    if (!res.ok) throw new Error(res.status === 404 ? "Not found (private repos need a token)" : res.status === 403 ? "GitHub rate limit reached. Add a token or try later." : `GitHub answered ${res.status}`);
    return res.json();
  };
  const logins = new Map();
  const add = (u, role) => { if (u && u.login && u.type !== "Bot" && !/\[bot\]$/.test(u.login) && !logins.has(u.login)) logins.set(u.login, role); };
  if (ref.pr) {
    const [pr, reviews, comments, commits] = await Promise.all([get(`${base}/pulls/${ref.pr}`), get(`${base}/pulls/${ref.pr}/reviews?per_page=100`), get(`${base}/issues/${ref.pr}/comments?per_page=100`), get(`${base}/pulls/${ref.pr}/commits?per_page=100`)]);
    add(pr.user, "PR author");
    (pr.requested_reviewers || []).forEach((u) => add(u, "Requested reviewer"));
    reviews.forEach((r) => add(r.user, "Reviewer"));
    comments.forEach((c) => add(c.user, "Commenter"));
    commits.forEach((c) => add(c.author, "Committer"));
  } else {
    (await get(`${base}/contributors?per_page=${limit}`)).forEach((u) => add(u, "Contributor"));
  }
  const people = await Promise.all([...logins.entries()].slice(0, limit).map(async ([login, role]) => {
    const profile = await get(`/users/${login}`).catch(() => ({}));
    return { name: cleanName(profile.name || login), email: profile.email || "", github: login, note: role };
  }));
  return people.filter((p) => p.name);
}

/** Add incoming contacts to the book, skipping anyone already there by email or name. */
export function mergeContacts(book, incoming, source = "import") {
  const keysOf = (c) => [c.email && c.email.toLowerCase(), c.github && `gh:${c.github.toLowerCase()}`, c.name.toLowerCase()].filter(Boolean);
  const seen = new Set(book.flatMap(keysOf));
  const added = [];
  incoming.forEach((c) => {
    const keys = keysOf(c);
    if (keys.some((k) => seen.has(k))) return;
    keys.forEach((k) => seen.add(k));
    added.push({ id: `c${Date.now().toString(36)}${added.length}${book.length}`, name: c.name, email: c.email || "", phone: c.phone || "", github: c.github || "", note: c.note || "", source });
  });
  return { book: [...book, ...added], added: added.length };
}

const WORDS_A = ["amber", "brisk", "calm", "dusty", "eager", "fuzzy", "gentle", "happy", "jolly", "kind", "lucky", "mellow", "nimble", "plucky", "quiet", "rapid", "sunny", "witty"];
const WORDS_B = ["otter", "falcon", "maple", "comet", "harbor", "lantern", "meadow", "pebble", "river", "sparrow", "thistle", "willow", "badger", "cedar", "ember", "fjord"];

/** A short room code people can say out loud, like "amber-otter-42". */
export function randomRoomCode(rand = Math.random) {
  const pick = (list) => list[Math.floor(rand() * list.length)];
  return `${pick(WORDS_A)}-${pick(WORDS_B)}-${10 + Math.floor(rand() * 90)}`;
}

const QR_URL = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm";

/** Draw a QR code for text as an inline SVG; null when the encoder cannot load. */
export async function qrSvg(text) {
  try {
    const mod = globalThis.__meetQr || (await import(/* @vite-ignore */ QR_URL));
    const qr = (mod.default || mod)(0, "M");
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    const cells = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) cells.push(`M${c + 4} ${r + 4}h1v1h-1z`);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${n + 8} ${n + 8}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "QR code for the room link");
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("width", String(n + 8)); bg.setAttribute("height", String(n + 8)); bg.setAttribute("fill", "#fff");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", cells.join("")); path.setAttribute("fill", "#000");
    svg.append(bg, path);
    return svg;
  } catch { return null; }
}

/** The link that opens MeetRightHere on a room: this page with ?room= set. */
export function inviteLink(href, room, server = {}) {
  const url = new URL(href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("room", room);
  // Remote invitees cannot use this browser's localhost defaults, so a server that is
  // reachable from elsewhere travels in the link. Only addresses, never a key or secret.
  const lk = validServerUrl(server.serverUrl, ["ws:", "wss:"]);
  const tok = validServerUrl(server.tokenUrl, ["http:", "https:"]);
  if (lk && !isLocalOnly(lk)) url.searchParams.set("lk", lk);
  if (tok && !isLocalOnly(tok)) url.searchParams.set("tok", tok);
  return url.toString();
}

/** The URL as a string when it parses, uses one of the schemes, and carries no credentials; else "". */
export function validServerUrl(value, protocols) {
  try {
    const u = new URL(String(value || "").trim());
    return protocols.includes(u.protocol) && !u.username && !u.password ? u.toString() : "";
  } catch { return ""; }
}

/** Reads ?room=, ?lk= and ?tok= from an invite link; anything invalid is dropped. */
export function parseInvite(search) {
  const q = new URLSearchParams(search || "");
  const room = cleanName(q.get("room"));
  return { room, serverUrl: validServerUrl(q.get("lk"), ["ws:", "wss:"]), tokenUrl: validServerUrl(q.get("tok"), ["http:", "https:"]) };
}

/** Quiet hints for the lobby about what will stop a remote call from working. */
export function lobbyWarnings({ pageUrl, serverUrl, tokenUrl = "" }) {
  const out = [];
  let page = null;
  try { page = new URL(pageUrl); } catch { /* not a web page */ }
  const server = String(serverUrl || "").trim();
  const serverLocal = isLocalOnly(server) || isLocalOnly(`ws://${server}`);
  const serverValid = !!validServerUrl(server, ["ws:", "wss:"]);
  const web = page && (page.protocol === "http:" || page.protocol === "https:");
  if (page?.protocol === "https:" && /^ws:\/\//i.test(server) && !serverLocal) out.push("This page is https, so the browser will block ws://. Use a wss:// server.");
  if (web && page.protocol !== "https:" && !isLocalOnly(page.href)) out.push("Camera and microphone need https or localhost.");
  if (web && !isLocalOnly(page.href) && serverLocal) out.push("This points at your own computer. Ask the host for their LiveKit server and token endpoint, or open their invite link.");
  if (!String(tokenUrl || "").trim() && serverValid && !serverLocal) out.push("No token endpoint: the browser will sign its own token with the key in Settings. Use a token endpoint for anything other than local testing.");
  return out;
}

/** True when the link only opens on this computer (localhost, loopback or a .local name). */
export function isLocalOnly(href) {
  try {
    const h = new URL(href).hostname;
    return h === "localhost" || h === "::1" || h === "[::1]" || /^127\./.test(h) || h.endsWith(".localhost");
  } catch { return false; }
}

/** The address invite links are built from: the public address if one is set, else this page. */
export function shareBaseUrl(shareBase, pageHref) {
  const raw = String(shareBase || "").trim();
  if (!raw) return pageHref;
  try { return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).toString(); } catch { return pageHref; }
}

export const inviteMessage = (host, room, link) => ({
  subject: `${host || "A teammate"} invited you to a video call`,
  body: `${host || "A teammate"} invited you to join "${room}".\n\nJoin here: ${link}\n\nEnter your name in the lobby and press Join.`,
});

/** A mailto: link that puts everyone in Bcc, so invitees do not see each other's addresses. */
export const mailtoLink = (emails, { subject, body }) =>
  `mailto:?bcc=${emails.map(encodeURIComponent).join(",")}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

/** An sms: link that opens the phone's messaging app with the invite filled in. */
export const smsLink = (phones, { body }) => `sms:${phones.map((x) => x.replace(/[^\d+]/g, "")).filter(Boolean).join(",")}?&body=${encodeURIComponent(body)}`;

export const whatsappLink = ({ body }) => `https://wa.me/?text=${encodeURIComponent(body)}`;

/** Simulated call used by "Preview the UI": people, a scripted chat and feed events. */
export const DEMO_PEOPLE = [
  { name: "Ada", kind: "human", role: "Product lead" },
  { name: "Grace", kind: "agent", role: "Code reviewer", model: "Claude Sonnet 5.5" },
  { name: "Linus", kind: "agent", role: "Builder", model: "Claude Opus 5.5" },
  { name: "Margaret", kind: "human", role: "Designer" },
];
export const DEMO_NAMES = DEMO_PEOPLE.map((p) => p.name);

/** Human or agent, with role and model, from a LiveKit participant (metadata is JSON {kind, role, model}). */
export function participantInfo(participant) {
  let meta = {};
  try { meta = JSON.parse(participant?.metadata || "{}") || {}; } catch { meta = {}; }
  const agent = meta.kind === "agent" || participant?.kind === 4;
  return { kind: agent ? "agent" : "human", role: String(meta.role || (agent ? "Agent" : "")), model: agent ? String(meta.model || "") : "" };
}
export const DEMO_SCRIPT = [
  { kind: "event", text: "Ada joined" },
  { from: "Ada", text: "Morning! Can everyone hear me?" },
  { kind: "event", text: "Grace joined" },
  { from: "Grace", text: "Loud and clear. Sharing the board in a sec." },
  { kind: "event", text: "Grace started sharing their screen" },
  { from: "Linus", text: "The new feed styles look great." },
  { kind: "event", text: "Margaret joined" },
  { from: "Margaret", text: "Sorry I'm late, what did I miss?" },
  { from: "Ada", text: "We're walking through conversations and the feed." },
];

/**
 * The agent's replies. Local and rule-based for now: it acknowledges what it heard.
 * Swap this for a call into a live agent conversation to give it a real brain.
 */
export function agentReply(heard) {
  const text = String(heard || "").trim();
  if (!text) return "";
  if (/\b(hello|hi|hey)\b/i.test(text)) return "Hi, I'm here and listening.";
  if (/\b(summar|recap|notes)\b/i.test(text)) return "I'll write up the notes when the call ends.";
  if (/\?$/.test(text)) return `Good question. I heard: ${text.slice(0, 120)}`;
  return `Got it: ${text.slice(0, 120)}`;
}

/** Which speech features this browser offers (the desktop app may offer neither). */
export function speechSupport(win = globalThis) {
  return { listen: Boolean(win.SpeechRecognition || win.webkitSpeechRecognition), speak: Boolean(win.speechSynthesis && win.SpeechSynthesisUtterance) };
}

const loadLivekit = () => globalThis.__meetLivekit || import(/* @vite-ignore */ LIVEKIT_URL);

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

/** The app's display name. The machine id stays "meet". */
export const APP_NAME = "MeetRightHere";

/** The logo: the word "Meet" followed by an ellipsis of three glowing plasma dots (decorative). */
export function wordmark() {
  const wrap = el("span", "wordmark");
  wrap.setAttribute("aria-hidden", "true");
  const word = el("span", "wm-word", "Meet");
  word.append(el("sup", "wm-tm", "\u2122"));
  wrap.append(word);
  const dots = el("span", "wm-dots");
  for (let i = 0; i < 3; i++) {
    const d = el("span", "pdot");
    d.style.setProperty("--i", String(i));
    dots.append(d);
  }
  wrap.append(dots);
  return wrap;
}

const BRAND_MASKS = {
  kamiji: "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%20276%20118%22%3E%3Cg%20fill=%22none%22%20stroke=%22%23000%22%20stroke-width=%2218%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22%3E%3Cpath%20d=%22M18%2024V82M46%2024L20%2054M28%2050L48%2082%22/%3E%3Ccircle%20cx=%2280%22%20cy=%2264%22%20r=%2216%22/%3E%3Cpath%20d=%22M96%2048V82%22/%3E%3Cpath%20d=%22M120%2048V82M120%2060Q120%2048%20134%2048Q148%2048%20148%2062V82M148%2062Q148%2048%20162%2048Q176%2048%20176%2062V82%22/%3E%3Cpath%20d=%22M198%2048V82M198%2026V26%22/%3E%3Cpath%20d=%22M224%2048V86Q224%2098%20210%2098M224%2026V26%22/%3E%3Cpath%20d=%22M250%2048V82M250%2026V26%22/%3E%3C/g%3E%3C/svg%3E",
  kosmos: "data:image/svg+xml;charset=utf-8,%3Csvg%20id=%22Layer_1%22%20data-name=%22Layer%201%22%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%20405.3%2082.71%22%3E%3Cdefs%3E%3Cstyle%3E%20.cls-1%20%7B%20fill:%20%23ffffff;%20%7D%20%3C/style%3E%3C/defs%3E%3Cpath%20class=%22cls-1%22%20d=%22M79.81,54.47c-2.27-3.14-3.59-7.14-3.59-11.73,0-11.39,8.05-19.17,18.75-19.17,5.44,0,10.18,2.02,13.54,5.49,2.77-3.32,28.03-25.97,31.05-29.06-24.12,19.01-35.79,11.75-44.59,11.75-18.92,0-32.79,13.18-32.79,30.99,0,8.04,2.84,15.14,7.69,20.51%22/%3E%3Cpath%20class=%22cls-1%22%20d=%22M111.85,33.96c1.19,2.57,1.86,5.52,1.86,8.77,0,11.38-8.05,19.17-18.75,19.17-4.03,0-7.67-1.1-10.66-3.09-3.54,2.54-21.13,20.86-24.29,23.89,18.2-10.53,26.87-8.99,34.95-8.99,18.83,0,32.79-13.1,32.79-30.99,0-6.58-2.16-12.99-5.7-18.17l-10.2,9.4Z%22/%3E%3Cpath%20class=%22cls-1%22%20d=%22M137.56,66.79l4.71-10.44c5.05,3.68,12.58,6.25,19.77,6.25,8.22,0,11.56-2.74,11.56-6.42,0-11.21-34.84-3.51-34.84-25.77,0-10.19,8.22-18.66,25.25-18.66,7.53,0,15.24,1.8,20.8,5.31l-4.28,10.53c-5.56-3.17-11.3-4.71-16.61-4.71-8.22,0-11.39,3.08-11.39,6.85,0,11.04,34.84,3.42,34.84,25.42,0,10.02-8.3,18.58-25.42,18.58-9.5,0-19.09-2.83-24.4-6.93Z%22/%3E%3Cpath%20class=%22cls-1%22%20d=%22M254.75,72.7l-.09-35.95-17.63,29.62h-6.25l-17.55-28.85v35.18h-13.01V12.78h11.47l22.43,37.24,22.09-37.24h11.39l.17,59.92h-13.01Z%22/%3E%3Cpath%20class=%22cls-1%22%20d=%22M280.39,42.78c0-17.81,13.87-30.99,32.79-30.99s32.79,13.1,32.79,30.99-13.95,30.99-32.79,30.99-32.79-13.18-32.79-30.99ZM331.93,42.78c0-11.39-8.05-19.17-18.75-19.17s-18.75,7.79-18.75,19.17,8.05,19.17,18.75,19.17,18.75-7.79,18.75-19.17Z%22/%3E%3Cpath%20class=%22cls-1%22%20d=%22M355.48,66.84l4.71-10.44c5.05,3.68,12.58,6.25,19.77,6.25,8.22,0,11.56-2.74,11.56-6.42,0-11.21-34.84-3.51-34.84-25.77,0-10.19,8.22-18.66,25.25-18.66,7.53,0,15.24,1.8,20.8,5.31l-4.28,10.53c-5.56-3.17-11.3-4.71-16.61-4.71-8.22,0-11.39,3.08-11.39,6.85,0,11.04,34.84,3.42,34.84,25.42,0,10.02-8.3,18.58-25.42,18.58-9.5,0-19.09-2.83-24.4-6.93Z%22/%3E%3Cpath%20class=%22cls-1%22%20d=%22M13.78,39.15V12.78H0v59.92h13.78v-15.15l.03-.03%22/%3E%3Cpolygon%20class=%22cls-1%22%20points=%2228.22%2042.74%2056.22%2072.7%2038.43%2072.7%2019.09%2052.01%2013.81%2046.36%2010.43%2042.74%2013.78%2039.15%2013.81%2039.12%2038.43%2012.78%2056.22%2012.78%2031.06%2039.7%2028.22%2042.74%22/%3E%3C/svg%3E",
  artec: "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%20174%2076%22%3E%3Cmask%20id=%22a%22%20maskUnits=%22userSpaceOnUse%22%20x=%220%22%20y=%220%22%20width=%22174%22%20height=%2276%22%3E%3Crect%20width=%22174%22%20height=%2276%22%20fill=%22%23fff%22/%3E%3Cpath%20d=%22M128.79%2031.06V44.53L138.79%2040.17V44.81L124.54%2051.02V24.57L138.79%2030.78V35.42L128.79%2031.06ZM108.79%2022.34V35.68H116.29V39.93H108.79V53.26L118.79%2048.9V53.53L104.54%2059.74V15.85L118.79%2022.06V26.7L108.79%2022.34ZM98.79%2013.33V17.98L88.79%2013.61V66.62L86.67%2067.54L84.54%2066.62V13.61L74.54%2017.97V13.33L86.67%208.04004L98.79%2013.33ZM65.83%2035.05L68.79%2033.75V15.84L54.54%2022.06V53.53L58.79%2055.38V38.11L61.91%2036.74L69.61%2060.11L72.45%2061.34H72.74V61.48L74.84%2062.39L65.83%2035.05ZM64.54%2030.96L58.79%2033.47V24.84L64.54%2022.33V30.96ZM34.54%2030.78V44.81L38.79%2046.66V42.07H44.54V49.17L48.79%2051.02V24.57L34.54%2030.78ZM44.54%2037.82H38.79V33.56L44.54%2031.05V37.82Z%22%20fill=%22%23fff%22/%3E%3C/mask%3E%3Cpath%20d=%22M86.67%200L0%2037.81L86.68%2075.11L173.35%2037.31L86.67%200Z%22%20fill=%22%23fff%22%20mask=%22url(%23a)%22/%3E%3C/svg%3E",
};

// ─── "Built with" rail: small logos of the open technology an app is built on (convention for every app) ──
export const TECH = {
  webrtc: { name: "WebRTC", url: "https://webrtc.org", slug: "webrtc" },
  livekit: { name: "LiveKit", url: "https://livekit.io", slug: "livekit" },
  nostr: { name: "Nostr", url: "https://nostr.com" },
  github: { name: "GitHub", url: "https://github.com", slug: "github" },
  openhands: { name: "OpenHands", url: "https://openhands.dev" },
  // Our own marks: shown as theme-coloured masks, not links (no external URL to credit).
  kamiji: { name: "Kamiji", brand: true, w: 47, h: 20 },
  kosmos: { name: "Kosmos", brand: true, w: 78, h: 16 },
  artec: { name: "Artec", brand: true, w: 46, h: 20 },
};

/** A small row of linked logos with the name on hover. A logo that cannot load falls back to the name's first letter. */
export function techRail(ids) {
  const rail = el("div", "techrail");
  rail.setAttribute("role", "list");
  rail.setAttribute("aria-label", "Built with");
  rail.append(el("span", "techlabel", "Built with"));
  ids.map((id) => TECH[id]).filter(Boolean).forEach((t) => {
    if (t.brand) {
      const m = el("span", "tech brandmark");
      m.title = t.name;
      m.setAttribute("aria-label", t.name);
      m.setAttribute("role", "listitem");
      const ink = el("span", "brandink");
      ink.setAttribute("aria-hidden", "true");
      ink.style.width = `${t.w}px`; ink.style.height = `${t.h}px`;
      ink.style.setProperty("-webkit-mask-image", `url("${BRAND_MASKS[t.name.toLowerCase()]}")`);
      ink.style.setProperty("mask-image", `url("${BRAND_MASKS[t.name.toLowerCase()]}")`);
      m.append(ink);
      rail.append(m);
      return;
    }
    const a = el("a", "tech");
    a.href = t.url; a.target = "_blank"; a.rel = "noopener noreferrer";
    a.title = t.name;
    a.setAttribute("aria-label", t.name);
    a.setAttribute("role", "listitem");
    const mono = el("span", "techmono", t.name[0]);
    if (t.slug) {
      const img = document.createElement("img");
      img.alt = ""; img.width = 14; img.height = 14;
      img.src = `https://cdn.simpleicons.org/${t.slug}/9a9a9a`;
      img.addEventListener("error", () => img.replaceWith(mono));
      a.append(img);
    } else a.append(mono);
    rail.append(a);
  });
  return rail;
}

/**
 * Drag handles for the outer columns of a page's grid (a left list and/or a right panel).
 *
 * `columns` is a list of `{ el, edge, min, max, initial, label }`: `el` is the column's element,
 * `edge` is "left" for a column on the left side (its handle sits on its right edge) or "right"
 * for one on the right side. The app's CSS must read each width from a variable, for example
 * `grid-template-columns: var(--grip-0, 300px) minmax(0, 1fr) var(--grip-1, 280px)`, where the
 * number is the column's position in the `columns` list. Widths are saved per `storageKey`.
 * Call `refresh()` after the app shows or hides a column; call `dispose()` on unmount.
 */
function gripColumns({ grid, columns, storageKey, centerMin = 320, narrowQuery = "(max-width: 720px)" }) {
  const win = grid.ownerDocument.defaultView || globalThis;
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const saved = (() => {
    try { return JSON.parse(win.localStorage.getItem(storageKey) || "{}") || {}; } catch { return {}; }
  })();
  const widths = columns.map((c, i) => (Number.isFinite(saved[i]) ? clamp(saved[i], c.min, c.max) : c.initial));
  const handles = [];
  const cleanups = [];

  const narrow = () => Boolean(win.matchMedia && win.matchMedia(narrowQuery).matches);
  const shown = (i) => !narrow() && columns[i].el.isConnected && win.getComputedStyle(columns[i].el).display !== "none";
  const save = () => { try { win.localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(widths.map((w, i) => [i, w])))); } catch { /* storage unavailable */ } };
  // The widest a column may get while the middle keeps `centerMin` and the other grips keep their widths.
  const limit = (i) => {
    const total = grid.clientWidth;
    if (!total) return columns[i].max;
    const others = widths.reduce((sum, w, j) => (j !== i && shown(j) ? sum + w : sum), 0);
    return clamp(total - others - centerMin, columns[i].min, columns[i].max);
  };

  function apply() {
    columns.forEach((c, i) => {
      if (narrow()) grid.style.removeProperty(`--grip-${i}`);
      else grid.style.setProperty(`--grip-${i}`, `${widths[i]}px`);
      const h = handles[i];
      h.hidden = !shown(i);
      h.setAttribute("aria-valuenow", String(Math.round(widths[i])));
      h.setAttribute("aria-valuemax", String(Math.round(limit(i))));
    });
  }

  function set(i, width, persist = true) {
    widths[i] = clamp(Math.round(width), columns[i].min, limit(i));
    apply();
    if (persist) save();
  }

  columns.forEach((c, i) => {
    const h = grid.ownerDocument.createElement("div");
    h.className = `grip grip-${c.edge}`;
    h.dataset.grip = String(i);
    h.setAttribute("role", "separator");
    h.setAttribute("aria-orientation", "vertical");
    h.setAttribute("aria-label", `Resize ${c.label || "column"}`);
    h.setAttribute("aria-valuemin", String(c.min));
    h.tabIndex = 0;
    h.style[c.edge === "left" ? "left" : "right"] = `var(--grip-${i}, ${c.initial}px)`;
    const dir = c.edge === "left" ? 1 : -1;
    let startX = 0;
    let startW = 0;
    const move = (e) => { set(i, startW + dir * (e.clientX - startX), false); };
    const up = () => {
      grid.classList.remove("gripping");
      h.classList.remove("on");
      grid.ownerDocument.removeEventListener("pointermove", move);
      grid.ownerDocument.removeEventListener("pointerup", up);
      save();
    };
    h.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      startX = e.clientX;
      startW = widths[i];
      grid.classList.add("gripping");
      h.classList.add("on");
      grid.ownerDocument.addEventListener("pointermove", move);
      grid.ownerDocument.addEventListener("pointerup", up);
    });
    h.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 64 : 16;
      const grow = (e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0) * dir;
      if (grow) set(i, widths[i] + grow * step);
      else if (e.key === "Home") set(i, c.min);
      else if (e.key === "End") set(i, limit(i));
      else return;
      e.preventDefault();
    });
    h.addEventListener("dblclick", () => set(i, c.initial));
    cleanups.push(() => { grid.ownerDocument.removeEventListener("pointermove", move); grid.ownerDocument.removeEventListener("pointerup", up); h.remove(); });
    handles.push(h);
    grid.append(h);
  });

  win.addEventListener("resize", apply);
  cleanups.push(() => win.removeEventListener("resize", apply));
  apply();
  return { refresh: apply, widths: () => [...widths], dispose: () => cleanups.forEach((fn) => fn()) };
}

/** CSS for the handles; add it to the app's stylesheet and make the grid `position: relative`. */
const GRIP_CSS = `
.grip { position: absolute; top: 0; bottom: 0; width: 11px; z-index: 6; cursor: col-resize; touch-action: none; outline: 0; }
.grip-left { transform: translateX(-50%); }
.grip-right { transform: translateX(50%); }
.grip::after { content: ""; position: absolute; top: 0; bottom: 0; left: 50%; width: 2px; margin-left: -1px; border-radius: 2px; background: transparent; transition: background .12s; }
.grip:hover::after, .grip:focus-visible::after, .grip.on::after { background: var(--oh-color-primary, #7c9dff); }
.gripping { user-select: none; cursor: col-resize; }
.gripping * { pointer-events: none; }
.gripping .grip { pointer-events: auto; }
@media (max-width: 720px) { .grip { display: none; } }
`;

const CSS = `
.mt { --mt-bg: var(--oh-color-base, #171717); --mt-panel: var(--oh-color-base-secondary, #212121); --mt-text: var(--oh-foreground, #eee);
  --mt-muted: var(--oh-muted, #9a9a9a); --mt-border: var(--oh-border-subtle, #3a3a3a); --mt-contrast: var(--oh-contrast, #fff); --mt-on-contrast: var(--oh-contrast-foreground, #111); --mt-danger: #ef4444; --mt-danger-solid: #dc2626; --mt-ok: #34d399; --mt-warn: #f59e0b;
  box-sizing: border-box; color: var(--mt-text); background: var(--mt-bg); font: 14px/1.45 system-ui, sans-serif; height: 100%; min-height: 480px; overflow: hidden; position: relative; display: grid; grid-template-columns: var(--grip-0, 260px) minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto; }
.mt [hidden] { display: none !important; }
.mt.nonav { grid-template-columns: minmax(0, 1fr); }
.mt.nonav .main { grid-column: 1; }
.mt .main { grid-column: 2; grid-row: 2; min-width: 0; min-height: 0; display: flex; flex-direction: column; position: relative; }
.mt .canvasrail { position: absolute; left: 12px; bottom: 12px; z-index: 4; pointer-events: none; border-radius: 999px; background: color-mix(in srgb, var(--mt-bg) 55%, transparent); max-width: calc(100% - 24px); }
.mt .canvasrail .techrail { padding: 6px 12px; }
.mt .tip { position: fixed; z-index: 50; pointer-events: none; padding: 4px 8px; border-radius: 6px; background: var(--mt-contrast); color: var(--mt-on-contrast); font-size: 12px; font-weight: 500; line-height: 1.3; white-space: nowrap; }
.mt > .grip { top: var(--hud-top, 48px); bottom: var(--hud-bottom, 44px); }
.mt :is(button, a, input, [tabindex]):focus-visible { outline: 2px solid var(--oh-color-primary, #7c9dff); outline-offset: 2px; }
.mt .hud { grid-column: 1 / -1; display: flex; align-items: center; gap: 10px 12px; flex-wrap: wrap; padding: 6px 12px; background: var(--mt-panel); color: var(--mt-text); min-width: 0; }
.mt .hudtop { grid-row: 1; border-bottom: 1px solid var(--mt-border); min-height: 48px; display: grid; grid-template-columns: minmax(max-content, 1fr) minmax(120px, 420px) minmax(max-content, 1fr); align-items: center; position: relative; z-index: 5; }
.mt .hudleft, .mt .hudright { display: flex; align-items: center; gap: 10px 12px; min-width: 0; }
.mt .hudleft { justify-self: start; }
.mt .hudright { justify-self: end; }
.mt .hudsearch { position: relative; min-width: 0; display: flex; align-items: center; justify-content: center; }
.mt .searchfield { position: relative; flex: 1; min-width: 0; }
.mt .searchfield input { width: 100%; padding-left: 36px; background: var(--mt-bg); color: var(--mt-text); }
.mt .searchfield .fieldicon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: var(--mt-muted); pointer-events: none; z-index: 1; }
.mt .searchfield input::placeholder { color: var(--mt-muted); opacity: 1; }
.mt .hudsearch > .searchtoggle { display: none; }
.mt .searchpop { position: absolute; top: 100%; left: 50%; transform: translateX(-50%); width: min(340px, calc(100vw - 16px)); padding-top: 8px; z-index: 20; }
.mt .searchfield input { min-width: 0; }
.mt .popbody { background: var(--mt-bg); color: var(--mt-text); border: 1px solid var(--mt-border); border-radius: 12px; padding: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.35); display: grid; gap: 10px; }
.mt .popmsg { margin: 0; font-size: 13px; color: var(--mt-text); }
.mt .popacts { display: flex; gap: 8px; flex-wrap: wrap; }
.mt .popbtn { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 10px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid var(--mt-border); }
.mt .popbtn svg { width: 16px; height: 16px; }
.mt .popprimary, .mt .popprimary:hover, .mt .popprimary:focus, .mt .popprimary:focus-visible, .mt .popprimary:active, .mt .popprimary:disabled { background: var(--mt-contrast); color: var(--mt-on-contrast); border-color: var(--mt-contrast); }
.mt .popprimary:hover { filter: brightness(.92); }
.mt .popsecondary, .mt .popsecondary:focus, .mt .popsecondary:focus-visible, .mt .popsecondary:active, .mt .popsecondary:disabled { background: var(--mt-panel); color: var(--mt-text); }
.mt .popsecondary:hover { background: var(--mt-panel); color: var(--mt-contrast); border-color: var(--mt-muted); }
.mt .poplist { padding: 6px; gap: 2px; max-height: 320px; overflow: auto; }
.mt .popopt { display: flex; align-items: center; gap: 10px; padding: 6px; border-radius: 10px; cursor: pointer; color: var(--mt-text); background: transparent; }
.mt .popopt:hover, .mt .popopt[aria-selected="true"] { background: var(--mt-panel); color: var(--mt-contrast); }
.mt .popopt .cav { width: 30px; height: 30px; font-size: 12px; }
.mt .hudbottom { grid-row: 3; border-top: 1px solid var(--mt-border); min-height: 44px; display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; }
.mt .hudbrand { font-size: 17px; line-height: 1; display: inline-flex; align-items: center; }
.mt .hudbrand .wordmark { font-size: 1em; }
.mt .hudstatus { display: inline-flex; min-width: 0; }
/* The server status chip: a pill in the tone's tint, height matching the action buttons. Text is near-white or near-black on the mix, well above 4.5:1. */
.mt .hudchip { position: relative; --chip: var(--mt-muted); display: inline-flex; align-items: center; gap: 6px; height: 34px; box-sizing: border-box; margin: 0; padding: 0 12px; border: 1px solid color-mix(in srgb, var(--chip) 45%, var(--mt-border)); border-radius: 999px; background: color-mix(in srgb, var(--chip) 14%, var(--mt-bg)); color: var(--mt-text); font: 500 12px/1 system-ui, sans-serif; white-space: nowrap; }
.mt button.hudchip { cursor: pointer; }
.mt button.hudchip:hover { background: color-mix(in srgb, var(--chip) 24%, var(--mt-bg)); }
.mt .hudchip.on { --chip: var(--mt-ok); }
.mt .hudchip.bad { --chip: var(--mt-danger); }
.mt .hudchip.checking { --chip: var(--mt-warn); }
.mt .hudchip .pres { width: 8px; height: 8px; border-radius: 50%; background: var(--chip); flex: none; }
.mt .hudchip.checking .pres { animation: hudchip-pulse 1.4s ease-in-out infinite; }
@keyframes hudchip-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
@media (prefers-reduced-motion: reduce) { .mt .hudchip.checking .pres { animation: none; } }
.mt .advanced { display: grid; gap: 6px; }
.mt .advtoggle { justify-self: start; display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; color: var(--mt-text); padding: 4px 6px; margin-left: -6px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; }
.mt .advtoggle:hover { background: var(--mt-raised, rgba(255,255,255,.08)); color: var(--mt-contrast); }
.mt .advtoggle .chev { width: 14px; height: 14px; transition: transform .15s; }
.mt .advtoggle[aria-expanded="true"] .chev { transform: rotate(90deg); }
.mt .advpanel { display: grid; gap: 8px; }
.mt .advpanel[hidden] { display: none !important; }
@media (prefers-reduced-motion: reduce) { .mt .advtoggle .chev { transition: none; } }
.mt .hudspacer { flex: 1; min-width: 0; }
.mt .hudtop .mhead { padding: 0; border: 0; background: transparent; grid-auto-flow: column; align-items: baseline; gap: 8px; font-size: 13px; min-width: 0; }
.mt .hudactions { display: flex; align-items: center; gap: 6px; }
.mt .hudbottom .hudend { grid-column: 3; justify-self: end; display: flex; gap: 6px; }
.mt .hudbottom .callbar { grid-column: 2; justify-content: center; flex-wrap: wrap; gap: 8px; min-width: 0; }
.mt .hudbottom .callbar:empty { display: none; }
.mt .views { display: inline-flex; gap: 6px; }
@media (max-width: 640px) {
  .mt .hud { padding: 6px 8px; gap: 6px 8px; }
  .mt .hudtop { display: flex; flex-wrap: wrap; }
  .mt .hudleft { flex: 1 1 auto; }
  .mt .hudsearch { order: 2; flex: 0 0 auto; }
  .mt .hudright { order: 3; }
  .mt .hudsearch > .searchtoggle { display: grid; }
  .mt .hudsearch:not(.open) .searchfield { display: none; }
  .mt .hudsearch.open { order: 4; flex: 1 0 100%; gap: 6px; }
  .mt .hudchip { width: 34px; padding: 0; justify-content: center; }
  .mt .hudchip .stxt { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .mt .hudbottom { grid-template-columns: minmax(0, 1fr) auto; }
  .mt .hudbottom .callbar { grid-column: 1; grid-row: 1; }
  .mt .hudbottom .hudend { grid-column: 2; grid-row: 1; }
  .mt .hudtop .mhead small { display: none; }
}
@media (max-width: 520px) {
  .mt .canvasrail .techlabel, .mt .canvasrail .tech:not(.brandmark) { display: none; }
}
.mt .nav { grid-column: 1; grid-row: 2; min-width: 0; background: transparent; display: flex; flex-direction: column; min-height: 0; }
.mt .navtop { padding: 10px 12px; display: grid; gap: 10px; }
.mt .navhead { display: flex; gap: 6px; align-items: center; font-weight: 400; color: var(--mt-contrast); }
.mt .newroom { flex: none; min-width: 0; height: 34px; padding: 0 14px; border: 0; border-radius: 10px; background: var(--mt-contrast); color: var(--mt-on-contrast); font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap; }
.mt .newroom:hover, .mt .newroom:focus-visible, .mt .newroom:active, .mt .newroom:disabled { background: var(--mt-contrast); color: var(--mt-on-contrast); }
.mt .newroom:hover { filter: brightness(.92); }
.mt .navicon { flex: none; width: 34px; height: 34px; border: 0; border-radius: 10px; background: transparent; color: var(--mt-muted); display: grid; place-items: center; cursor: pointer; }
.mt .navicon:hover, .mt .navicon[aria-pressed="true"] { background: var(--mt-raised, rgba(255,255,255,.08)); color: var(--mt-contrast); }
.mt .navicon svg { width: 18px; height: 18px; }
.mt .clist { flex: 1; overflow: auto; padding: 6px; }
.mt .cgroup { margin: 10px 6px 2px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--mt-muted); }
.mt .contact { width: 100%; display: flex; align-items: center; gap: 10px; text-align: left; border: 0; background: transparent; border-radius: 10px; padding: 6px; cursor: pointer; }
.mt .contact:hover, .mt .contact[aria-current="true"] { background: var(--mt-panel); }
.mt .cav { position: relative; width: 34px; height: 34px; flex: none; border-radius: 50%; display: grid; place-items: center; font-size: 13px; font-weight: 600; background: var(--mt-border); }
.mt .cav .pres { position: absolute; right: -1px; bottom: -1px; width: 10px; height: 10px; border-radius: 50%; background: var(--mt-muted); border: 2px solid var(--mt-bg); }
.mt .cav .pres.on { background: var(--mt-ok); }
.mt .ctext { min-width: 0; display: grid; }
.mt .cname { font-weight: 600; color: var(--mt-contrast); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mt .csub { display: block; font-size: 12px; font-weight: 400; color: var(--mt-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mt .mini { white-space: nowrap; border: 1px solid var(--mt-border); background: var(--mt-panel); border-radius: 8px; padding: 3px 10px; font-size: 12px; cursor: pointer; }
.mt .importbox { display: grid; gap: 8px; min-width: 0; }
.mt .importbox > * { min-width: 0; max-width: 100%; width: 100%; }
.mt .importbox input[type="file"] { font-size: 12px; padding: 6px; }
.mt .importbox textarea { min-height: 90px; resize: vertical; padding: 8px; border-radius: 10px; border: 1px solid var(--mt-border); background: var(--mt-panel); color: var(--mt-text); font: 12px ui-monospace, monospace; }
.mt .invitebox { margin: 0 auto 12px; width: min(460px, 100%); display: grid; gap: 8px; padding: 12px; border: 1px solid var(--mt-border); border-radius: 12px; background: var(--mt-panel); }
.mt .invitelist { max-height: 160px; overflow: auto; display: grid; gap: 2px; }
.mt .invitelist label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--mt-text); }
.mt .inviteacts { display: flex; flex-wrap: wrap; gap: 6px; }
.mt .sharetabs { display: flex; gap: 4px; }
.mt .sharetabs .mini[aria-pressed="true"] { background: var(--mt-contrast); color: var(--mt-on-contrast); border-color: var(--mt-contrast); }
.mt .bigcode { font: 600 22px ui-monospace, monospace; text-align: center; color: var(--mt-contrast); padding: 10px; border: 1px dashed var(--mt-border); border-radius: 10px; user-select: all; }
.mt .qrbox { width: 200px; height: 200px; margin: 0 auto; border-radius: 8px; overflow: hidden; background: #fff; display: grid; place-items: center; }
.mt .qrbox svg { width: 100%; height: 100%; }
.mt .modal.settingsmodal { width: min(1040px, 100%); height: min(620px, 100%); display: flex; flex-direction: column; overflow: hidden; gap: 12px; }
.mt .settingsmodal .modalfoot { flex: none; align-items: center; }
.mt .settingsmodal .modalfoot button { height: auto; align-self: center; }
.mt .setlayout { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 24px; min-height: 0; flex: 1; }
.mt .settabs { display: flex; flex-direction: column; gap: 4px; align-content: start; }
.mt .settab, .mt .settab:focus, .mt .settab:active { text-align: left; border: 0; border-radius: 10px; padding: 8px 12px; background: transparent; color: var(--mt-text); font-size: 14px; cursor: pointer; }
.mt .settab:hover, .mt .settab[aria-selected="true"] { background: var(--mt-panel); color: var(--mt-contrast); }
.mt .settab[aria-selected="true"] { font-weight: 600; }
.mt .setpanel { overflow: auto; min-height: 0; display: grid; gap: 12px; align-content: start; padding: 2px 4px 2px 2px; }
.mt .setpanel h4 { margin: 6px 0 0; font-size: 13px; color: var(--mt-contrast); }
.mt .note.doc { margin: 0; color: var(--mt-text); }
.mt .doclist { margin: 0; padding-left: 18px; display: grid; gap: 4px; font-size: 13px; color: var(--mt-text); }
.mt .codebox { display: flex; gap: 8px; align-items: center; justify-content: space-between; border: 1px solid var(--mt-border); border-radius: 10px; background: var(--mt-panel); padding: 8px 10px; }
.mt .codebox code { font: 12px ui-monospace, monospace; color: var(--mt-text); overflow-wrap: anywhere; min-width: 0; }
.mt .mini, .mt .mini:hover, .mt .mini:focus, .mt .mini:active { color: var(--mt-text); }
.mt .abouthead { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.mt .legalbox { border: 1px solid var(--mt-border); border-radius: 10px; padding: 8px 12px; display: grid; gap: 8px; }
.mt .legalbox summary { cursor: pointer; font-weight: 600; color: var(--mt-contrast); }
.mt .legalbox > .mini { justify-self: start; }
.mt .draftflag { margin: 0; padding: 6px 10px; border-radius: 8px; border: 1px solid var(--mt-border); color: var(--mt-contrast); font-size: 12px; font-weight: 600; }
.mt .licences { border-collapse: collapse; font-size: 12px; color: var(--mt-text); display: block; overflow-x: auto; }
.mt .licences th, .mt .licences td { border-bottom: 1px solid var(--mt-border); padding: 4px 8px; text-align: left; vertical-align: top; }
.mt .licences th { color: var(--mt-contrast); }
@media (max-width: 640px) { .mt .setlayout { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); gap: 8px; } .mt .settabs { flex-direction: row; overflow-x: auto; } }
.mt .scrim { position: absolute; inset: 0; z-index: 10; background: rgba(0,0,0,.55); display: grid; place-items: center; padding: 16px; }
.mt .modal { width: min(520px, 100%); max-height: 100%; overflow: auto; background: var(--mt-bg); border: 1px solid var(--mt-border); border-radius: 16px; padding: 18px; display: grid; gap: 12px; }
.mt .modal h2 { margin: 0; font-size: 18px; font-weight: 600; color: var(--mt-contrast); }
.mt .modal h3 { margin: 6px 0 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--mt-muted); }
.mt .check { display: flex; gap: 10px; align-items: flex-start; padding: 8px 10px; border: 1px solid var(--mt-border); border-radius: 10px; background: var(--mt-panel); }
.mt .check .pres { margin-top: 5px; width: 10px; height: 10px; flex: none; border-radius: 50%; background: var(--mt-muted); }
.mt .check .pres.on { background: var(--mt-ok); }
.mt .check .pres.bad { background: var(--mt-danger); }
.mt .check .grow { flex: 1; min-width: 0; display: grid; }
.mt .check code { font: 12px ui-monospace, monospace; color: var(--mt-muted); overflow-wrap: anywhere; }
.mt .modalfoot { display: flex; justify-content: flex-end; gap: 8px; }
.mt .techrail { flex: none; display: flex; align-items: center; gap: 8px; padding: 8px 12px; color: var(--mt-muted); font-size: 11px; }
.mt .techlabel { letter-spacing: .06em; text-transform: uppercase; }
.mt .tech { width: 22px; height: 22px; border-radius: 6px; display: grid; place-items: center; color: inherit; text-decoration: none; opacity: .8; }
.mt .tech:hover { opacity: 1; background: color-mix(in srgb, currentColor 12%, transparent); }
.mt .brandmark { width: auto; height: 24px; opacity: 1; color: var(--mt-muted); cursor: default; }
.mt .brandmark:hover { color: var(--mt-contrast); background: transparent; }
.mt .brandink { display: block; background: currentColor; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; -webkit-mask-size: contain; mask-size: contain; }
.mt .tech img { width: 14px; height: 14px; display: block; }
.mt .techmono { font-weight: 700; font-size: 11px; }
.mt .callbar { display: flex; align-items: center; gap: 10px; justify-content: center; }
@media (max-width: 520px) { .mt { grid-template-columns: minmax(0, 1fr); } .mt .nav { display: none; } .mt .main { grid-column: 1; } }
.mt *, .mt *::before, .mt *::after { box-sizing: border-box; }
.mt button { font: inherit; color: inherit; }
.mt .lobby { margin: auto; width: min(420px, 92%); display: grid; gap: 10px; }
.mt .lobby h1 { margin: 0 0 4px; font-size: 22px; font-weight: 600; letter-spacing: -.01em; color: var(--mt-contrast); }
.mt .wordmark { display: inline-flex; align-items: baseline; font-size: 2em; letter-spacing: -.01em; }
.mt .wordmark .wm-word { color: var(--mt-contrast); white-space: nowrap; }
.mt .wordmark .wm-tm { margin-left: .06em; font-size: .34em; font-weight: 400; line-height: 0; vertical-align: super; color: var(--mt-contrast); opacity: .85; }
.mt .wm-dots { display: inline-flex; align-items: center; gap: .2em; margin-left: -.08em; }
.mt .pdot { --c: #a78bfa; --glow: rgba(167, 139, 250, .75); position: relative; top: 0; width: .24em; height: .24em; border-radius: 50%;
  background: radial-gradient(circle at 50% 50%, #fff 0, #fff 14%, var(--c) 58%, color-mix(in srgb, var(--c) 55%, #000) 100%);
  box-shadow: 0 0 .22em .04em var(--c), 0 0 .6em .14em var(--glow); animation: pdot-wave 1.6s ease-in-out infinite, pdot-hue 9s linear infinite; animation-delay: calc(var(--i) * .2s), calc(var(--i) * -3s); }
.mt .pdot:nth-child(2) { --c: #22d3ee; --glow: rgba(34, 211, 238, .7); }
.mt .pdot:nth-child(3) { --c: #e879f9; --glow: rgba(232, 121, 249, .75); }
@keyframes pdot-wave { 0%, 100% { transform: scale(.8); opacity: .75; } 40% { transform: scale(1.25); opacity: 1; } }
@keyframes pdot-hue { to { filter: hue-rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .mt .pdot { animation: none; transform: none; opacity: 1; } }
.mt .lobbystage { max-width: 960px; margin: auto; display: flex; align-items: center; justify-content: center; gap: 56px; padding: 24px; flex-wrap: wrap; width: 100%; box-sizing: border-box; }
.mt .lobbystage .lobby { margin: 0; flex: 0 1 420px; }
.mt .lobbyart { flex: 0 1 340px; display: grid; gap: 14px; justify-items: center; }
.mt .lobbyart .callart { width: 100%; height: auto; display: block; }
.mt .lobbyart .fluxkamiji { width: 160px; height: 160px; margin-top: -26px; }
@media (max-width: 900px) { .mt .lobbyart { display: none; } }
.mt label { display: grid; gap: 4px; font-size: 12px; color: var(--mt-muted); }
.mt input { padding: 8px 12px; border-radius: 10px; font-size: 14px; border: 1px solid var(--mt-border); background: var(--mt-panel); color: var(--mt-text); font: inherit; }
.mt .primary { border: 0; border-radius: 10px; background: var(--mt-contrast); color: var(--mt-on-contrast); padding: 10px 16px; font-weight: 600; cursor: pointer; }
.mt .primary:disabled { opacity: .5; cursor: default; }
.mt .lobbyshare { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 40px; margin: 0; padding: 0 16px; border: 1px solid var(--mt-border); border-radius: 10px; background: var(--mt-panel); color: var(--mt-text); font: inherit; font-weight: 500; cursor: pointer; }
.mt .lobbyshare .ico { width: 18px; height: 18px; flex: none; }
.mt .lobbyshare:hover { border-color: var(--mt-muted); }
.mt .lobbyshare:focus-visible { outline: 2px solid var(--mt-contrast); outline-offset: 2px; }
.mt .note { color: var(--mt-muted); font-size: 12px; margin: 0; }
.mt .err { color: var(--mt-danger); font-size: 13px; margin: 0; }
.mt .meeting { flex: 1; min-height: 0; position: relative; display: grid; grid-template-columns: minmax(0, 1fr) var(--grip-0, 300px); }
.mt .stage { min-width: 0; padding: 12px; overflow: auto; }
.mt .grid { display: grid; gap: 8px; height: 100%; align-content: center; }
.mt .tile { position: relative; background: var(--mt-panel); border: 1px solid var(--mt-border); border-radius: 12px; overflow: hidden; aspect-ratio: 16 / 9; display: grid; place-items: center; }
.mt .tile.speaking { border-color: var(--mt-ok); box-shadow: 0 0 0 2px var(--mt-ok); }
.mt .tile video { width: 100%; height: 100%; object-fit: cover; background: #000; }
.mt .tile.screen video { object-fit: contain; }
.mt .avatar { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; font-size: 22px; font-weight: 600; background: var(--mt-border); }
.mt .label { position: absolute; left: 10px; bottom: 10px; max-width: calc(100% - 20px); box-sizing: border-box; display: flex; flex-direction: column; gap: 1px; padding: 6px 12px 6px 10px; border-radius: 12px; border: 1px solid rgba(255,255,255,.1); border-left: 3px solid rgba(255,255,255,.35); background: rgba(14,14,16,.55); -webkit-backdrop-filter: blur(10px) saturate(1.3); backdrop-filter: blur(10px) saturate(1.3); color: #fff; font-size: 13px; font-weight: 600; line-height: 1.25; letter-spacing: -.005em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; box-shadow: 0 2px 10px rgba(0,0,0,.28); }
.mt .tile[data-kind="agent"] .label { border-left-color: var(--mt-accent, #8b6cff); }
.mt .label.muted::after { content: " · muted"; color: var(--mt-danger); }
.mt .chat { min-width: 0; border-left: 1px solid var(--mt-border); display: flex; flex-direction: column; min-height: 0; }
.mt .chatlog { flex: 1; overflow: auto; padding: 10px; display: grid; gap: 6px; align-content: start; }
.mt .tile.screen { display: block; padding: 0; }
.mt .miniapp { position: absolute; inset: 0; display: flex; flex-direction: column; background: #151515; font: 10px/1.35 ui-monospace, monospace; color: #cfcfcf; }
.mt .mabar { display: flex; align-items: center; gap: 4px; padding: 4px 8px; background: #222; border-bottom: 1px solid #333; }
.mt .mabar i { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
.mt .mabar span { margin-left: 6px; color: #9a9a9a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mt .mabody { flex: 1; display: flex; min-height: 0; }
.mt .maside { width: 22%; padding: 6px; display: grid; gap: 3px; align-content: start; background: #1b1b1b; border-right: 1px solid #2a2a2a; }
.mt .maside span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 2px 5px; border-radius: 4px; color: #9a9a9a; }
.mt .maside span.on { background: #2e2e2e; color: #fff; }
.mt .mamain { flex: 1; padding: 6px 8px; display: grid; gap: 5px; align-content: start; min-width: 0; }
.mt .machat p { margin: 0 0 3px; padding: 3px 6px; border-radius: 6px; }
.mt .machat .you { background: #2a2a2a; width: fit-content; max-width: 90%; }
.mt .machat .bot { color: #b9b9b9; }
.mt .madiff { margin: 0; padding: 4px 6px; border-radius: 6px; background: #101010; border: 1px solid #2a2a2a; overflow: hidden; font: inherit; }
.mt .madiff .add { color: #4ade80; }
.mt .madiff .del { color: #f87171; }
.mt .maprog { height: 4px; border-radius: 2px; background: #2a2a2a; overflow: hidden; }
.mt .maprog b { display: block; height: 100%; width: 40%; background: #7c5cff; animation: mt-prog 3.2s ease-in-out infinite; }
@keyframes mt-prog { 0% { width: 10%; } 70% { width: 90%; } 100% { width: 10%; } }
.mt .tile .badge { position: absolute; top: 10px; left: 10px; display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; line-height: 1; padding: 5px 9px 5px 8px; border-radius: 999px; border: 1px solid rgba(255,255,255,.12); background: rgba(14,14,16,.55); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); color: rgba(255,255,255,.82); }
.mt .tile .badge::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.55); }
.mt .tile .badge.agent { background: color-mix(in srgb, var(--mt-accent, #6d4aff) 55%, rgba(14,14,16,.6)); border-color: color-mix(in srgb, var(--mt-accent, #8b6cff) 70%, transparent); color: #fff; }
.mt .tile .badge.agent::before { background: #fff; box-shadow: 0 0 6px 1px rgba(255,255,255,.7); }
.mt .tile .label .sub { display: block; overflow: hidden; text-overflow: ellipsis; font-size: 11px; opacity: .68; font-weight: 400; letter-spacing: 0; }
.mt .tile canvas.tilekami { width: 130px; height: 130px; }
.mt .tile.big { grid-column: 1 / -1; }
.mt .tile.big canvas.tilekami { width: 190px; height: 190px; }
.mt .views { display: inline-flex; gap: 4px; }
.mt .meeting > .views { position: absolute; top: 12px; right: calc(var(--grip-0, 300px) + 14px); z-index: 4; padding: 4px; gap: 4px; border-radius: 999px; border: 1px solid rgba(255,255,255,.1); background: rgba(14,14,16,.55); -webkit-backdrop-filter: blur(10px) saturate(1.3); backdrop-filter: blur(10px) saturate(1.3); box-shadow: 0 2px 10px rgba(0,0,0,.28); }
.mt .meeting > .views .ctl.iconctl { width: 34px; height: 34px; border-color: transparent; background: transparent; }
.mt .meeting > .views .ctl.iconctl .ico { width: 18px; height: 18px; }
.mt .meeting > .views .ctl[aria-pressed="true"] { background: var(--mt-contrast); color: var(--mt-on-contrast); }
.mt .meeting > .views .ctl[aria-pressed="false"]:hover { background: rgba(255,255,255,.1); }
.mt .tile.agent .avatar { background: var(--mt-accent, #6d4aff); color: #fff; }
.mt .evt { font-size: 12px; text-align: center; color: var(--mt-muted, #888); padding: 2px 0; }
.mt .msg b { font-weight: 600; color: var(--mt-contrast); }
.mt .mhead { flex: none; display: grid; gap: 0; padding: 12px 16px; border-bottom: 1px solid var(--mt-border); font-weight: 600; color: var(--mt-contrast); background: var(--mt-bg); }
.mt .mhead small { font-size: 12px; font-weight: 400; color: var(--mt-muted); }
.mt .chatform { display: flex; gap: 6px; padding: 8px; border-top: 1px solid var(--mt-border); }
.mt .chatform input { flex: 1; min-width: 0; }
.mt .bar { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 8px; }
.mt .ctl { border: 1px solid var(--mt-border); background: var(--mt-panel); border-radius: 999px; padding: 8px 16px; cursor: pointer; }
.mt .ctl { display: inline-flex; align-items: center; gap: 8px; }
.mt .ctl .ico { width: 18px; height: 18px; flex: none; }
.mt .ctl.iconctl { width: 44px; height: 44px; padding: 0; border-radius: 50%; justify-content: center; gap: 0; flex: none; }
.mt .ctl.iconctl .ico { width: 20px; height: 20px; }
.mt .views .ctl[aria-pressed="false"] { background: var(--mt-panel); border-color: var(--mt-border); color: inherit; }
.mt .views .ctl[aria-pressed="true"] { background: var(--mt-contrast); color: var(--mt-on-contrast); }
.mt .ctl.offdanger[aria-pressed="false"] { background: var(--mt-danger-solid); border-color: var(--mt-danger-solid); color: #fff; }
.mt .ctl.ondanger[aria-pressed="true"] { background: var(--mt-danger-solid); border-color: var(--mt-danger-solid); color: #fff; }
.mt .ctl.leave { background: var(--mt-danger-solid); border-color: var(--mt-danger-solid); color: #fff; }
@media (max-width: 560px) { .mt .meeting { grid-template-columns: minmax(0, 1fr); } .mt .chat { display: none; } }
` + GRIP_CSS;

// ─── The lobby picture: a call in progress, and a Flux Kamiji looking on ──
const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(parent, tag, attrs) {
  const n = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, String(v)));
  parent.append(n);
  return n;
}

/** A conference call as a picture: four video tiles with a character in each, and the call controls. */
function callGraphic() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 320 220");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "A video call with four people");
  svg.setAttribute("class", "callart");
  svgEl(svg, "rect", { x: 1, y: 1, width: 318, height: 218, rx: 18, fill: "#1b1b1f", stroke: "#34343a" });
  const tiles = [
    [14, 14, "#8B5CF6", true], [164, 14, "#2FBF71", false],
    [14, 88, "#EC4899", false], [164, 88, "#2D9CF0", false],
  ];
  tiles.forEach(([x, y, fill, speaking]) => {
    svgEl(svg, "rect", { x, y, width: 142, height: 66, rx: 12, fill: "#26262c", stroke: speaking ? "#a78bfa" : "#2f2f36", "stroke-width": speaking ? 2 : 1 });
    svgEl(svg, "rect", { x: x + 53, y: y + 11, width: 36, height: 38, rx: 13, fill });
    svgEl(svg, "rect", { x: x + 62, y: y + 22, width: 5, height: 13, rx: 2.5, fill: "#1a0f33" });
    svgEl(svg, "rect", { x: x + 75, y: y + 22, width: 5, height: 13, rx: 2.5, fill: "#1a0f33" });
  });
  // a person sharing a screen along the bottom
  svgEl(svg, "rect", { x: 14, y: 162, width: 292, height: 8, rx: 4, fill: "#2f2f36" });
  svgEl(svg, "rect", { x: 14, y: 162, width: 168, height: 8, rx: 4, fill: "#a78bfa", opacity: 0.7 });
  // controls: mic, camera, screen, leave
  [[112, "#3a3a42"], [142, "#3a3a42"], [172, "#3a3a42"], [208, "#ef4444"]].forEach(([cx, fill]) => {
    svgEl(svg, "circle", { cx, cy: 196, r: 11, fill });
  });
  svgEl(svg, "rect", { x: 108, y: 189, width: 8, height: 12, rx: 4, fill: "none", stroke: "#e5e5e5", "stroke-width": 1.5 });
  svgEl(svg, "rect", { x: 136, y: 191, width: 12, height: 9, rx: 2, fill: "none", stroke: "#e5e5e5", "stroke-width": 1.5 });
  svgEl(svg, "rect", { x: 166, y: 190, width: 12, height: 9, rx: 1.5, fill: "none", stroke: "#e5e5e5", "stroke-width": 1.5 });
  svgEl(svg, "path", { d: "M203 198h10", stroke: "#fff", "stroke-width": 2, "stroke-linecap": "round" });
  return svg;
}

/** A small living Flux: a wobbling body whose colours drift, with pill eyes that blink. */
/** A small stand-in for a shared screen: the app someone is working on, with a chat, a diff and a progress bar. */
export function miniAppScreen() {
  const win = el("div", "miniapp");
  const bar = el("div", "mabar");
  ["#ff5f57", "#febc2e", "#28c840"].forEach((c) => { const d = el("i"); d.style.background = c; bar.append(d); });
  bar.append(el("span", "", "OpenHands · Add bottom grip to pull up conversations"));
  const body = el("div", "mabody");
  const side = el("div", "maside");
  ["New Chat", "Apps", "Factory", "Feed", APP_NAME].forEach((t, i) => side.append(el("span", i === 4 ? "on" : "", t)));
  const main = el("div", "mamain");
  const chat = el("div", "machat");
  chat.append(el("p", "you", "can you add a grip at the bottom of the list?"), el("p", "bot", "Adding a ReorderGrip below the conversation list…"));
  const diff = el("pre", "madiff");
  [["-", "const rows = conversations;"], ["+", "const rows = useGrip(conversations);"], ["+", "<ReorderGrip onDrag={pullUp} />"]].forEach(([sign, line]) => diff.append(el("span", sign === "+" ? "add" : "del", `${sign} ${line}\n`)));
  const prog = el("div", "maprog");
  prog.append(el("b"));
  main.append(chat, diff, prog);
  body.append(side, main);
  win.append(bar, body);
  return win;
}

const ICONS = {
  mic: ["M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z", "M19 10v2a7 7 0 0 1-14 0v-2", "M12 19v3"],
  micOff: ["M2 2l20 20", "M9 9v3a3 3 0 0 0 5.1 2.1", "M15 9.3V5a3 3 0 0 0-5.9-.6", "M19 10v2a7 7 0 0 1-.8 3.2", "M5 10v2a7 7 0 0 0 11.2 5.6", "M12 19v3"],
  camera: ["m16 13 5.2 3.5a.5.5 0 0 0 .8-.4V7.9a.5.5 0 0 0-.8-.4L16 11", "M3 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"],
  cameraOff: ["M2 2l20 20", "M7 6h6a2 2 0 0 1 2 2v3", "M15 15v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2", "m16 13 5.2 3.5a.5.5 0 0 0 .8-.4V7.9a.5.5 0 0 0-.8-.4L16 11"],
  screen: ["M3 4h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z", "M8 21h8", "M12 17v4"],
  share: ["M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7", "M16 6l-4-4-4 4", "M12 2v13"],
  agent: ["M12 8V4H8", "M6 8h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z", "M2 14h2", "M20 14h2", "M15 13v2", "M9 13v2"],
  listen: ["M6 8.5a6 6 0 0 1 12 0c0 3.5-3 4.5-3 7.5a3 3 0 0 1-6 0"],
  volume: ["M11 5 6 9H2v6h4l5 4V5Z", "M15.5 8.5a5 5 0 0 1 0 7", "M19 5a9 9 0 0 1 0 14"],
  volumeOff: ["M11 5 6 9H2v6h4l5 4V5Z", "M22 9l-6 6", "M16 9l6 6"],
  leave: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"],
  grid: ["M3 3h7v7H3Z", "M14 3h7v7h-7Z", "M3 14h7v7H3Z", "M14 14h7v7h-7Z"],
  avatars: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z", "M8 14s1.5 2 4 2 4-2 4-2", "M9 9h.01", "M15 9h.01"],
  speaker: ["M3 3h18v12H3Z", "M3 19h5", "M10 19h4", "M16 19h5"],
  send: ["M22 2 11 13", "M22 2l-7 20-4-9-9-4 20-7Z"],
  close: ["M18 6 6 18", "M6 6l12 12"],
};

/** Puts a line icon before a button's label. */
function withIcon(button, name) {
  const svg = document.createElementNS(SVG_NS, "svg");
  [["viewBox", "0 0 24 24"], ["fill", "none"], ["stroke", "currentColor"], ["stroke-width", "1.8"], ["stroke-linecap", "round"], ["stroke-linejoin", "round"], ["aria-hidden", "true"], ["class", "ico"]].forEach(([k, v]) => svg.setAttribute(k, v));
  (ICONS[name] || []).forEach((d) => svgEl(svg, "path", { d }));
  button.prepend(svg);
  return button;
}

/** A stable colour shift per name, so each person gets their own Kamiji. */
export const kamijiHue = (name) => ([...String(name || "")].reduce((a, c) => a + c.charCodeAt(0), 0) * 47) % 360;

function fluxKamiji({ hueOffset = 0, talking = () => false, label = "A Flux Kamiji" } = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = "fluxkamiji";
  canvas.width = 240;
  canvas.height = 240;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", label);
  const ctx = canvas.getContext ? canvas.getContext("2d") : null;
  if (!ctx) return canvas;
  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const W = 240;
  const draw = (ms) => {
    const t = ms / 1000;
    ctx.clearRect(0, 0, W, W);
    const R = 76 + Math.sin(t * 1.4) * 3 + (talking() ? Math.sin(t * 16) * 4 : 0);
    const hue = 250 + hueOffset + Math.sin(t * 0.5) * 70;
    const g = ctx.createRadialGradient(W / 2 - 24, W / 2 - 30, 10, W / 2, W / 2, R + 30);
    g.addColorStop(0, `hsl(${hue + 80} 90% 68%)`);
    g.addColorStop(0.55, `hsl(${hue} 85% 60%)`);
    g.addColorStop(1, `hsl(${hue - 60} 80% 52%)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let i = 0; i <= 72; i += 1) {
      const a = (i / 72) * Math.PI * 2;
      const r = R + Math.sin(a * 3 + t * 1.7) * 5 + Math.sin(a * 5 - t * 1.2) * 3;
      const x = W / 2 + Math.cos(a) * r;
      const y = W / 2 + Math.sin(a) * r;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.fill();
    // two motes that drift out and back
    [0, 1].forEach((k) => {
      const a = t * 0.6 + k * 3.1;
      const d = R + 22 + Math.sin(t * 0.9 + k) * 10;
      ctx.fillStyle = `hsl(${hue + 140 + k * 70} 85% 65%)`;
      ctx.beginPath();
      ctx.arc(W / 2 + Math.cos(a) * d, W / 2 + Math.sin(a) * d, 7 - k * 2, 0, Math.PI * 2);
      ctx.fill();
    });
    // pill eyes, looking a little toward the call, blinking now and then
    const blink = Math.sin(t * 0.8) > 0.985 ? 0.12 : 1;
    const look = Math.sin(t * 0.7) * 6;
    ctx.fillStyle = "#1a0f33";
    [-24, 24].forEach((dx) => {
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(W / 2 + dx + look - 8, W / 2 - 26, 16, 46 * blink, 8);
      else ctx.rect(W / 2 + dx + look - 8, W / 2 - 26, 16, 46 * blink);
      ctx.fill();
    });
  };
  const frame = (ms) => {
    if (!canvas.isConnected && ms > 200) return;
    draw(ms);
    if (!still) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return canvas;
}

/** The lobby: the form, with the call picture and a Flux Kamiji beside it. */
function svgChevron() {
  const svg = document.createElementNS(SVG_NS, "svg");
  [["viewBox", "0 0 24 24"], ["fill", "none"], ["stroke", "currentColor"], ["stroke-width", "2"], ["stroke-linecap", "round"], ["stroke-linejoin", "round"], ["aria-hidden", "true"], ["class", "chev"]].forEach(([k, v]) => svg.setAttribute(k, v));
  svgEl(svg, "path", { d: "m9 6 6 6-6 6" });
  return svg;
}

/** The call-preview picture (no longer shown in the lobby; kept for reuse). */
export function lobbyArt() {
  const art = el("div", "lobbyart");
  art.setAttribute("aria-hidden", "true");
  art.append(callGraphic(), fluxKamiji());
  return art;
}

export function activate(host) {
  if (host.apiVersion !== "1") throw new Error("MeetRightHere requires Canvas host API 1.");
  return host.registerPage("meet", ({ container }) => mount(container, host));
}

function mount(container, host) {
  const root = el("div", "mt");
  container.append(el("style", "", CSS), root);
  let disposed = false;
  let lk = null;
  let room = null;
  let grips = [];
  // One shared tooltip for the icon-only call controls. Its text is the button's aria-label; it appears after a short delay on hover or focus.
  const tip = el("div", "tip");
  tip.id = "meet-tip";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  let tipTimer = 0;
  let tipOwner = null;
  const hideTip = () => {
    clearTimeout(tipTimer);
    tip.hidden = true;
    tipOwner?.removeAttribute("aria-describedby");
    tipOwner = null;
  };
  const placeTip = (btn) => {
    tip.style.left = "0px";
    tip.style.top = "0px";
    const r = btn.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const vw = document.documentElement.clientWidth || window.innerWidth || 0;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - t.width / 2), vw ? vw - t.width - 8 : Infinity);
    const above = r.top - t.height - 8;
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(above >= 8 ? above : r.bottom + 8)}px`;
  };
  const showTip = (btn) => {
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => {
      if (disposed || !btn.isConnected) return;
      tipOwner?.removeAttribute("aria-describedby");
      tipOwner = btn;
      btn.setAttribute("aria-describedby", tip.id);
      tip.textContent = btn.getAttribute("aria-label") || "";
      tip.hidden = false;
      placeTip(btn);
    }, 300);
  };
  const attachTip = (btn) => {
    btn.addEventListener("mouseenter", () => showTip(btn));
    btn.addEventListener("mouseleave", hideTip);
    btn.addEventListener("focus", () => showTip(btn));
    btn.addEventListener("blur", hideTip);
  };
  root.addEventListener("keydown", (ev) => { if (ev.key === "Escape") hideTip(); });
  const regrip = (specs) => {
    grips.forEach((g) => g.dispose());
    grips = specs.map(([grid, column, key]) => gripColumns({ grid, columns: [column], storageKey: `grip:meet:${key}` }));
  };

  const saved = (() => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") }; } catch { return { ...DEFAULTS }; } })();
  const state = { ...saved, contacts: Array.isArray(saved.contacts) ? saved.contacts : [], query: "", picked: "", settings: false, ghRef: "", serverUp: null, starting: false, serverNote: "", checks: {}, runNote: {}, invite: false, shareTab: "link", invitees: [], inviteNote: "", importing: false, importText: "", importNote: "", phase: "lobby", view: "grid", agent: false, listen: true, voice: true, agentTalking: false, demo: false, demoTimer: null, speaker: 0, error: "", mic: true, cam: true, screen: false, chat: [], draft: "" };
  try {
    const invite = parseInvite(location.search);
    if (invite.room) { state.room = invite.room; state.invitedTo = invite.room; }
    // Server settings from the link fill the lobby only; persist() keeps the saved ones until Join.
    if (invite.room && (invite.serverUrl || invite.tokenUrl)) {
      state.inviteServer = { serverUrl: saved.serverUrl, tokenUrl: saved.tokenUrl };
      if (invite.serverUrl) state.serverUrl = invite.serverUrl;
      if (invite.tokenUrl) state.tokenUrl = invite.tokenUrl;
    }
  } catch { /* no location */ }
  // "Advanced setup" accordion: open when the user left it open, or when a saved/invited value is not the default.
  const storedOpen = (() => { try { return JSON.parse(localStorage.getItem(UI_KEY) || "{}").advancedOpen === true; } catch { return false; } })();
  state.advancedOpen = storedOpen || state.serverUrl !== DEFAULTS.serverUrl || Boolean(String(state.tokenUrl || "").trim()) || Boolean(state.inviteServer);
  const persistUi = () => { try { localStorage.setItem(UI_KEY, JSON.stringify({ advancedOpen: state.advancedOpen })); } catch { /* storage unavailable */ } };
  const persist = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: state.name, room: state.room, serverUrl: (state.inviteServer || state).serverUrl, tokenUrl: (state.inviteServer || state).tokenUrl, apiKey: state.apiKey, apiSecret: state.apiSecret, folder: state.folder, shareBase: state.shareBase, contacts: state.contacts })); } catch { /* storage unavailable */ }
  };

  const inMeeting = () => new Set(room && state.phase === "meeting" ? [...room.remoteParticipants.values()].map((p) => p.identity.toLowerCase()) : []);

  function contactRow(c, here) {
    const b = el("button", "contact");
    b.type = "button";
    b.setAttribute("aria-current", String(state.picked === c.id));
    const av = el("span", "cav", initials(c.name));
    const pres = el("span", `pres${here ? " on" : ""}`);
    pres.title = here ? "In this meeting" : "Not in this meeting";
    av.append(pres);
    const text = el("span", "ctext");
    text.append(el("span", "cname", c.name), el("span", "csub", here ? "In this meeting" : c.email || c.phone || (c.github ? `@${c.github}${c.note ? ` · ${c.note}` : ""}` : "Contact")));
    b.append(av, text);
    b.addEventListener("click", () => { state.picked = c.id; if (state.phase === "lobby") { state.room = directRoom(state.name || "me", c.name); } render(); });
    return b;
  }

  function renderNav() {
    const list = root.querySelector(".clist");
    if (!list) return;
    list.replaceChildren();
    const q = state.query.trim().toLowerCase();
    const here = inMeeting();
    const shown = state.contacts.filter((c) => !q || [c.name, c.email, c.phone].some((v) => String(v || "").toLowerCase().includes(q)));
    const online = shown.filter((c) => here.has(c.name.toLowerCase()));
    const rest = shown.filter((c) => !here.has(c.name.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
    if (online.length) { list.append(el("div", "cgroup", `In this meeting · ${online.length}`)); online.forEach((c) => list.append(contactRow(c, true))); }
    if (rest.length) { list.append(el("div", "cgroup", `Team · ${rest.length}`)); rest.forEach((c) => list.append(contactRow(c, false))); }
    if (!shown.length) list.append(el("p", "note", state.contacts.length ? "No contacts match." : "No contacts yet. Import a Google or Outlook CSV, or a .vcf file."));
  }

  function createRoom() {
    if (state.phase === "joining") return;
    if (room) leave();
    state.room = randomRoomCode();
    state.invitedTo = "";
    state.picked = "";
    state.invite = true;
    state.shareTab = "link";
    persist();
    if (cleanName(state.name)) join_(); else render();
  }

  async function runChecks() {
    state.checks = { livekit: { note: "Checking…" }, token: { note: "Checking…" }, media: { note: "Checking…" } };
    renderSettings();
    const [livekit, token, media] = await Promise.all([probeLivekit(fetch, state.serverUrl), probeToken(fetch, state.tokenUrl), probeMedia()]);
    state.checks = { livekit, token, media };
    renderSettings();
  }

  async function testMedia() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach((t) => t.stop());
      state.checks = { ...state.checks, media: { ok: true, note: "Camera and microphone access granted." } };
    } catch (err) {
      state.checks = { ...state.checks, media: { ok: false, note: `Blocked: ${err?.message || err}. If MeetRightHere runs inside a sandboxed frame, open it in its own tab.` } };
    }
    renderSettings();
  }

  async function detectServer() {
    const r = await probeLivekit(fetch, state.serverUrl);
    if (disposed) return r.ok;
    state.serverUp = r.ok;
    if (state.phase === "lobby") render();
    return r.ok;
  }

  async function startServer() {
    state.starting = true; state.serverNote = "Starting…"; render();
    try {
      await host.agentServer.request({ method: "POST", path: "/api/bash/start_bash_command", body: { command: startCommands("").livekit.command } });
      for (let i = 0; i < 12 && !disposed; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        if (await detectServer()) { state.starting = false; state.serverNote = ""; render(); return; }
      }
      state.serverNote = "Started, but it isn't answering yet. Open Settings, then Check again.";
    } catch (err) {
      state.serverNote = `Could not start it from here (${err?.message || err}). Run: ${startCommands("").livekit.command}`;
    }
    state.starting = false;
    render();
  }

  async function startProcess(key) {
    const spec = startCommands(state.folder)[key];
    if (key === "token" && spec.cwd == null) { state.runNote = { ...state.runNote, [key]: "Set the MeetRightHere folder first so the command runs in the right place." }; renderSettings(); return; }
    try {
      await host.agentServer.request({ method: "POST", path: "/api/bash/start_bash_command", body: spec.cwd ? { command: spec.command, cwd: spec.cwd } : { command: spec.command } });
      state.runNote = { ...state.runNote, [key]: "Started. Press Check again in a few seconds." };
    } catch (err) {
      state.runNote = { ...state.runNote, [key]: `Could not start it from here (${err?.message || err}). Run it yourself: ${spec.command}` };
    }
    renderSettings();
  }

  /** Add one person, or bring in many at once. */
  function addContactsModal() {
    const scrim = el("div", "scrim");
    const close = () => { state.importing = false; render(); };
    scrim.addEventListener("click", (ev) => { if (ev.target === scrim) close(); });
    const modal = el("div", "modal");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-label", "Add contacts");
    modal.append(el("h2", "", "Add contacts"));
    const tabs = el("div", "sharetabs");
    [["person", "Person"], ["bulk", "Bulk import"]].forEach(([id, label]) => {
      const t = el("button", "mini", label);
      t.type = "button";
      t.setAttribute("aria-pressed", String((state.addTab || "person") === id));
      t.addEventListener("click", () => { state.addTab = id; state.importNote = ""; render(); });
      tabs.append(t);
    });
    modal.append(tabs);
    if ((state.addTab || "person") === "person") {
      const draft = state.draft || (state.draft = { name: "", email: "", phone: "" });
      [["Name", "name", "text"], ["Email", "email", "email"], ["Phone", "phone", "tel"]].forEach(([label, key, type]) => {
        const wrap = el("label", "", label);
        const input = el("input");
        input.type = type;
        input.value = draft[key];
        input.addEventListener("input", () => { draft[key] = input.value; });
        wrap.append(input);
        modal.append(wrap);
      });
      const add = el("button", "primary", "Add contact");
      add.type = "button";
      add.addEventListener("click", () => {
        if (!draft.name.trim()) { state.importNote = "Enter a name."; render(); return; }
        const { book, added } = mergeContacts(state.contacts, [{ name: draft.name.trim(), email: draft.email.trim(), phone: draft.phone.trim() }]);
        state.contacts = book;
        state.importNote = added ? `Added ${draft.name.trim()}.` : "That person is already in your contacts.";
        if (added) { state.draft = { name: "", email: "", phone: "" }; persist(); }
        render();
      });
      modal.append(add);
    } else {
      const box = el("div", "importbox");
    const area = el("textarea");
    area.placeholder = "Paste CSV (Name, Email, Phone) or vCard text";
    area.setAttribute("aria-label", "Contacts to import");
    area.value = state.importText;
    area.addEventListener("input", () => { state.importText = area.value; });
    const file = el("input");
    file.type = "file";
    file.accept = ".csv,.vcf,text/csv,text/vcard";
    file.setAttribute("aria-label", "Contacts file");
    file.addEventListener("change", async () => { const f = file.files?.[0]; if (f) { state.importText = await f.text(); area.value = state.importText; } });
    const go = el("button", "primary", "Import");
    go.type = "button";
    go.addEventListener("click", () => {
      const found = parseContacts(state.importText);
      const { book, added } = mergeContacts(state.contacts, found);
      state.contacts = book;
      state.importNote = found.length ? `Added ${added} of ${found.length} (skipped duplicates).` : "No contacts found in that text.";
      if (added) { state.importText = ""; persist(); }
      render();
    });
    box.append(area, file, go);
    const gh = el("input");
    gh.type = "text";
    gh.name = "meet-github-ref";
    gh.autocomplete = "off";
    gh.setAttribute("data-1p-ignore", "true");
    gh.setAttribute("data-lpignore", "true");
    gh.placeholder = "GitHub repo or PR, e.g. OpenHands/OpenHands#123";
    gh.setAttribute("aria-label", "GitHub repo or pull request");
    gh.value = state.ghRef;
    gh.addEventListener("input", () => { state.ghRef = gh.value; });
    const ghGo = el("button", "mini", "Import from GitHub");
    ghGo.type = "button";
    ghGo.addEventListener("click", async () => {
      const ref = parseGithubRef(state.ghRef);
      if (!ref) { state.importNote = "Enter owner/repo, owner/repo#12, or a GitHub repo or pull request URL."; render(); return; }
      state.importNote = "Fetching people from GitHub…"; render();
      try {
        const token = await connectedGithubToken((req) => host.agentServer.request(req));
        const people = await fetchGithubPeople(fetch, ref, { token });
        const { book, added } = mergeContacts(state.contacts, people, "github");
        state.contacts = book;
        state.importNote = `Added ${added} of ${people.length} from ${ref.owner}/${ref.repo}${ref.pr ? `#${ref.pr}` : ""}.`;
        if (added) persist();
      } catch (err) { state.importNote = String(err?.message || err); }
      render();
    });
    box.append(gh, ghGo, el("p", "note", "Uses the GitHub account connected to OpenHands when there is one; otherwise public repos and PRs only."));
    if (state.importNote) box.append(el("p", "note", state.importNote));
      modal.append(box);
    }
    if (state.importNote) modal.append(el("p", "note", state.importNote));
    const foot = el("div", "modalfoot");
    const done = el("button", "mini", "Done");
    done.type = "button";
    done.addEventListener("click", close);
    foot.append(done);
    modal.append(foot);
    scrim.append(modal);
    return scrim;
  }

  const SETTINGS_TABS = [["settings", "Settings"], ["help", "Help"], ["about", "About"]];

  /** A paragraph-per-sentence-group builder: text only, never markup. */
  const para = (text) => el("p", "note doc", text);

  /** A terminal command in a code box with a Copy button. */
  function codeBlock(text, label = "Copy") {
    const box = el("div", "codebox");
    box.append(el("code", "", text));
    const b = el("button", "mini", label);
    b.type = "button";
    b.setAttribute("aria-label", `${label} command`);
    b.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(text); b.textContent = "Copied"; } catch { b.textContent = "Select and copy"; }
      setTimeout(() => { b.textContent = label; }, 1500);
    });
    box.append(b);
    return box;
  }

  function helpPanel() {
    const out = [];
    const sec = (title, ...nodes) => { out.push(el("h3", "", title), ...nodes); };
    const list = (items) => { const ul = el("ul", "doclist"); items.forEach((t) => ul.append(el("li", "", t))); return ul; };
    const cmds = startCommands(state.folder);
    sec("1. Start the meeting server",
      para("Calls go through a LiveKit server on this machine. Press Start in Settings, under Detect, or Start it in the lobby, and MeetRightHere runs this command through the OpenHands Agent Server. You can also run it in a terminal:"),
      codeBlock(cmds.livekit.command),
      para(`If LiveKit is missing, the command installs it with Homebrew (${cmds.livekit.install}). A token server is only needed when you set a Token endpoint:`),
      codeBlock(cmds.token.command),
      para(`It needs ${cmds.token.install} once, in the MeetRightHere folder.`));
    sec("2. Join or create a room",
      list(["Enter your name and a room name or code, then press Join. Names use letters, numbers, spaces, dots, dashes and underscores (up to 64).", "+ New room in the top bar makes a random room code and opens Share; if your name is set it joins right away.", "Preview the UI (demo) shows a call with sample people without a server."]));
    sec("3. Invite people",
      list(["Press Share (lobby or call) for the invite link, a QR code, Email, SMS and WhatsApp (and the system share sheet when your browser has one).", "Set a Public address in Share when other people reach this page at a different address.", "Links carry the LiveKit server and token endpoint only when they are not local-only. API keys and secrets are never put in a link."]));
    sec("4. In a call",
      list(["Mic, Camera and Share screen toggle what you send. Leave ends the call.", "View modes in the top bar: Grid, Avatars and Speaker.", "Chat is in the side panel; messages travel over LiveKit and are not stored.", "Invite agent adds a built-in assistant that replies in chat. Agent listens uses your browser’s speech recognition and Agent speaks uses its speech synthesis, where the browser supports them. Remove agent ends it."]));
    sec("5. Contacts",
      list(["The person-plus button in the top bar opens Add contacts: Person adds one name, email and phone; Bulk import takes pasted CSV or vCard text, a .csv or .vcf file (Google or Outlook CSV), or a GitHub repo or pull request.", "Search contacts in the top bar. On the start page, pick someone with the arrow keys and Enter to set up a call with them; with no contacts, the search offers Add contact and Import."]));
    sec("6. Advanced setup",
      para("In the lobby, Advanced setup holds the LiveKit server and Token endpoint fields. It opens by itself when either differs from the defaults. API key, secret and folder are in the Settings tab."));
    sec("7. Privacy",
      para("Media and chat go to the LiveKit server you configured, not to us. See the About tab for what is stored and which services are contacted."));
    sec("8. Troubleshooting",
      list(["Server not running: press Start, run the command above, or check the LiveKit server address.", "Camera or microphone blocked: they need https or localhost and your permission. Use Test in Settings; if the app is inside a sandboxed frame, open it in its own tab.", "Token problems: check the Token endpoint in Settings and press Check again. Leave it empty only for local testing.", "An https page cannot open a ws:// server; use wss://."]));
    sec("9. Keyboard",
      list(["Search contacts: Arrow Up and Down, Enter to choose, Esc to close.", "Settings, Help and About tabs: Arrow keys, Home and End. Esc closes this window.", "Column edges: focus a handle and use Left and Right (Shift for larger steps), Home and End."]));
    return out;
  }

  function aboutPanel() {
    const out = [];
    const L = LEGAL_TEXT;
    const hero = el("div", "abouthead");
    hero.append(wordmark(), el("span", "note", `${L.appName} version ${L.version}`));
    out.push(hero);
    const open = (key) => (state.legalOpen || {})[key] === true;
    const disclosure = (key, title, textOf, body) => {
      const d = document.createElement("details");
      d.className = "legalbox";
      d.open = open(key);
      d.addEventListener("toggle", () => { state.legalOpen = { ...(state.legalOpen || {}), [key]: d.open }; });
      const sum = document.createElement("summary");
      sum.textContent = title;
      d.append(sum, ...body);
      const copy = el("button", "mini", "Copy text");
      copy.type = "button";
      copy.setAttribute("aria-label", `Copy ${title} text`);
      copy.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(textOf()); copy.textContent = "Copied"; } catch { copy.textContent = "Select and copy"; }
        setTimeout(() => { copy.textContent = "Copy text"; }, 1500);
      });
      d.append(copy);
      return d;
    };
    const sections = (rows) => rows.flatMap(([h, t]) => [el("h4", "", h), para(t)]);
    const flat = (rows) => rows.map(([h, t]) => `${h}\n${t}`).join("\n\n");
    const notice = [L.copyright, L.marks, L.dated, L.logos];
    out.push(disclosure("notice", "Copyright and trademark notice", () => notice.join("\n\n"), notice.map(para)));
    const table = el("table", "licences");
    const head = el("tr");
    ["Component", "Version", "Licence", "Source"].forEach((h) => { const th = el("th", "", h); th.scope = "col"; head.append(th); });
    table.append(head);
    L.licences.forEach((r) => { const tr = el("tr"); [r.name, r.version, r.licence, r.where].forEach((v) => tr.append(el("td", "", v))); table.append(tr); });
    const licText = () => [L.licencesNote, ...L.licences.map((r) => `${r.name} ${r.version}: ${r.licence}. ${r.where}`)].join("\n");
    out.push(disclosure("licences", "Licences", licText, [para(L.licencesNote), table]));
    out.push(disclosure("terms", "Terms of service (draft)", () => `${L.draft}\n\n${flat(L.terms)}`, [el("p", "draftflag", L.draft), ...sections(L.terms)]));
    out.push(disclosure("privacy", "Privacy policy (draft)", () => `${L.draft}\n\n${flat(L.privacy)}`, [el("p", "draftflag", L.draft), ...sections(L.privacy)]));
    return out;
  }

  function settingsFields() {
    const out = [el("h3", "", "Configure")];
    [["LiveKit server", "serverUrl"], ["API key (dev mode: devkey)", "apiKey"], ["API secret (dev mode: secret)", "apiSecret"], ["Token endpoint (leave empty to sign tokens here)", "tokenUrl"], ["MeetRightHere folder (only for a custom token server)", "folder"]].forEach(([label, key]) => {
      const wrap = el("label", "", label);
      const input = el("input");
      input.value = state[key];
      input.addEventListener("input", () => { state[key] = input.value; persist(); });
      wrap.append(input);
      out.push(wrap);
    });
    out.push(el("h3", "", "Detect"));
    const rows = el("div", "checks");
    rows.style.display = "grid"; rows.style.gap = "6px";
    [["livekit", "LiveKit server"], ["token", "Token server"], ["media", "Camera and microphone"]].forEach(([key, label]) => {
      const c = state.checks[key];
      const row = el("div", "check");
      row.append(el("span", `pres${c ? (c.ok === true ? " on" : c.ok === false ? " bad" : "") : ""}`));
      const grow = el("div", "grow");
      grow.append(el("span", "", label), el("span", "note", c ? c.note : "Not checked yet."));
      if (key !== "media" && c && c.ok === false) {
        const spec = startCommands(state.folder)[key];
        grow.append(el("code", "", `${spec.command}   (install: ${spec.install})`));
      }
      row.append(grow);
      if (key === "media") { const t = el("button", "mini", "Test"); t.type = "button"; t.addEventListener("click", testMedia); row.append(t); }
      else if (key === "token" && !state.tokenUrl.trim()) { /* built in, nothing to start */ }
      else { const b = el("button", "mini", "Start"); b.type = "button"; b.title = `Runs ${startCommands(state.folder)[key].command} on this machine through the Agent Server`; b.addEventListener("click", () => startProcess(key)); row.append(b); }
      if (state.runNote[key]) grow.append(el("span", "note", state.runNote[key]));
      rows.append(row);
    });
    out.push(rows);
    return out;
  }

  function settingsModal() {
    const tab = SETTINGS_TABS.some(([id]) => id === state.settingsTab) ? state.settingsTab : "settings";
    const close = () => { state.settings = false; render(); };
    const scrim = el("div", "scrim");
    scrim.addEventListener("click", (ev) => { if (ev.target === scrim) close(); });
    scrim.addEventListener("keydown", (ev) => { if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); close(); } });
    const modal = el("div", "modal settingsmodal");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "MeetRightHere settings");
    modal.append(el("h2", "", "MeetRightHere settings"));
    const layout = el("div", "setlayout");
    const tabs = el("div", "settabs");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-orientation", "vertical");
    tabs.setAttribute("aria-label", "Settings sections");
    const select = (id) => { state.settingsTab = id; renderSettings(); root.querySelector('.settabs [aria-selected="true"]')?.focus(); };
    SETTINGS_TABS.forEach(([id, label]) => {
      const t = el("button", "settab", label);
      t.type = "button";
      t.id = `meet-tab-${id}`;
      t.setAttribute("role", "tab");
      t.setAttribute("aria-selected", String(id === tab));
      t.setAttribute("aria-controls", "meet-tabpanel");
      t.tabIndex = id === tab ? 0 : -1;
      t.addEventListener("click", () => select(id));
      t.addEventListener("keydown", (ev) => {
        const ids = SETTINGS_TABS.map(([x]) => x);
        const at = ids.indexOf(id);
        const next = ev.key === "ArrowDown" || ev.key === "ArrowRight" ? ids[(at + 1) % ids.length]
          : ev.key === "ArrowUp" || ev.key === "ArrowLeft" ? ids[(at + ids.length - 1) % ids.length]
          : ev.key === "Home" ? ids[0] : ev.key === "End" ? ids[ids.length - 1] : null;
        if (next) { ev.preventDefault(); select(next); }
      });
      tabs.append(t);
    });
    const panel = el("div", "setpanel");
    panel.id = "meet-tabpanel";
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", `meet-tab-${tab}`);
    panel.tabIndex = 0;
    panel.append(...(tab === "help" ? helpPanel() : tab === "about" ? aboutPanel() : settingsFields()));
    layout.append(tabs, panel);
    modal.append(layout);
    const foot = el("div", "modalfoot");
    const check = el("button", "mini", "Check again");
    check.type = "button";
    check.addEventListener("click", () => { if (state.settingsTab && state.settingsTab !== "settings") { state.settingsTab = "settings"; renderSettings(); } runChecks(); });
    const done = el("button", "primary", "Done");
    done.type = "button";
    done.addEventListener("click", close);
    foot.append(check, done);
    modal.append(foot);
    scrim.append(modal);
    return scrim;
  }

  function renderSettings() {
    const old = root.querySelector(".scrim");
    if (old) old.replaceWith(settingsModal());
  }

  function svgIcon(paths) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    paths.forEach((d) => svgEl(svg, "path", { d }));
    return svg;
  }

  function hudIcon(title, paths, onClick, pressed) {
    const b = el("button", "navicon");
    b.type = "button";
    b.title = title;
    b.setAttribute("aria-label", title);
    if (pressed !== undefined) b.setAttribute("aria-pressed", String(pressed));
    b.append(svgIcon(paths));
    b.addEventListener("click", onClick);
    return b;
  }

  const USER_PLUS = ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z", "M19 8v6", "M22 11h-6"];
  const DOWNLOAD = ["M12 4v11", "m7 10 5 5 5-5", "M5 20h14"];

  function openSettings() {
    state.settings = true; state.settingsTab = "settings"; render();
    root.querySelector(".settabs [aria-selected=\"true\"]")?.focus();
    if (!Object.keys(state.checks).length) runChecks();
  }

  /** The slim bar across the top of the window: brand, search, then the server status chip and the main actions on the right. */
  function hudTop(extra = []) {
    const bar = el("header", "hud hudtop");
    bar.setAttribute("aria-label", "MeetRightHere toolbar");
    const brand = el("div", "hudbrand");
    brand.append(wordmark());
    // The chip is a button only when Settings can fix it (server not running); it opens Settings > Settings, where Detect has Start.
    const status = el("div", "hudstatus");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const down = state.serverUp === false;
    const tone = down ? "bad" : state.serverUp ? "on" : "checking";
    const text = down ? "Server not running" : state.serverUp ? "Server ready" : "Checking server";
    const chip = down ? el("button", `hudchip ${tone}`) : el("span", `hudchip ${tone}`);
    if (down) {
      chip.type = "button";
      chip.title = "Server not running. Open Settings to start it.";
      chip.addEventListener("click", openSettings);
    } else chip.title = text;
    chip.append(el("span", "pres"), el("span", "stxt", text));
    status.append(chip);
    const head = el("div", "hudactions navhead");
    const make = el("button", "newroom", "+ New room");
    make.type = "button";
    make.addEventListener("click", createRoom);
    head.append(
      make,
      hudIcon(state.importing ? "Close" : "Add contacts", USER_PLUS, () => { state.importing = !state.importing; render(); }, state.importing),
      hudIcon("Settings", ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"], openSettings),
    );
    const left = el("div", "hudleft");
    left.append(brand, ...extra.filter((n) => n && !n.classList.contains("views")));
    const right = el("div", "hudright");
    right.append(...extra.filter((n) => n && n.classList.contains("views")), status, head);
    bar.append(left, searchBox(), right);
    return bar;
  }

  /** The slim bar across the bottom: the call controls centred, share on the right. */
  function hudBottom(controls, end) {
    const bar = el("footer", "hud hudbottom");
    const mid = el("div", "callbar");
    if (controls) mid.append(controls);
    const right = el("div", "hudend");
    if (end) right.append(end);
    bar.append(mid, right);
    return bar;
  }

  /** The Built with row, pinned over the bottom-left of the main area where the videos (or the lobby) are. */
  function canvasRail() {
    const wrap = el("div", "canvasrail");
    wrap.append(techRail(["kamiji", "kosmos", "artec", "webrtc", "livekit"]));
    return wrap;
  }

  /** The contacts column (call view only): just the list. The search field lives in the top bar. */
  function navCol() {
    const nav = el("div", "nav");
    nav.append(el("div", "clist"));
    return nav;
  }

  const matchContacts = (query) => {
    const q = String(query || "").trim().toLowerCase();
    return state.contacts.filter((c) => !q || [c.name, c.email, c.phone].some((v) => String(v || "").toLowerCase().includes(q)));
  };

  function pickContact(c) {
    state.picked = c.id;
    state.query = "";
    if (state.phase === "lobby") state.room = directRoom(state.name || "me", c.name);
    render();
  }

  function openAddContacts(tab) {
    state.addTab = tab;
    state.importNote = "";
    state.importing = true;
    render();
  }

  /**
   * The search field, centred in the top bar. With no contacts (or no match) a hovercard explains and offers Add contact / Import;
   * on the start page, with contacts, focusing or typing opens a keyboard-navigable results list.
   */
  function searchBox() {
    const wrap = el("div", `hudsearch${state.searchOpen ? " open" : ""}`);
    const toggle = hudIcon("Search", ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z", "m21 21-4.3-4.3"], () => {
      state.searchOpen = !state.searchOpen;
      wrap.classList.toggle("open", state.searchOpen);
      toggle.setAttribute("aria-expanded", String(state.searchOpen));
      if (state.searchOpen) input.focus();
    });
    toggle.classList.add("searchtoggle");
    toggle.setAttribute("aria-expanded", String(Boolean(state.searchOpen)));
    const field = el("div", "searchfield");
    const glyph = svgIcon(["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z", "m21 21-4.3-4.3"]);
    glyph.classList.add("fieldicon");
    const input = el("input");
    input.id = "meet-search";
    input.type = "search";
    input.placeholder = "Search contacts";
    input.setAttribute("aria-label", "Search contacts");
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.autocomplete = "off";
    input.value = state.query;
    const pop = el("div", "searchpop");
    pop.hidden = true;
    field.append(glyph, input, pop);
    wrap.append(toggle, field);

    // Kept on state so a re-render (for example when the server probe answers) does not close the card or drop focus.
    const ui = state.searchUi || (state.searchUi = { hover: false, focus: false, dismissed: false, active: -1, sig: "", timer: 0 });
    ui.sig = "";
    const mode = () => {
      if (!state.contacts.length) return "empty";
      if (state.query.trim() && !matchContacts(state.query).length) return "nomatch";
      return state.phase === "lobby" ? "results" : "none";
    };
    const visibleMode = () => {
      const m = mode();
      if (ui.dismissed || m === "none") return "none";
      if (m === "results") return ui.focus ? m : "none";
      return ui.hover || ui.focus ? m : "none";
    };
    const clamp = () => {
      pop.style.transform = "";
      const r = pop.getBoundingClientRect();
      if (!r.width) return;
      const vw = document.documentElement.clientWidth || window.innerWidth || 0;
      let dx = 0;
      if (r.left < 8) dx = 8 - r.left; else if (vw && r.right > vw - 8) dx = vw - 8 - r.right;
      if (dx) pop.style.transform = `translateX(calc(-50% + ${Math.round(dx)}px))`;
    };
    const markActive = () => {
      const opts = [...pop.querySelectorAll('[role="option"]')];
      opts.forEach((o, i) => { o.setAttribute("aria-selected", String(i === ui.active)); });
      if (opts[ui.active]) { input.setAttribute("aria-activedescendant", opts[ui.active].id); opts[ui.active].scrollIntoView?.({ block: "nearest" }); }
      else input.removeAttribute("aria-activedescendant");
    };
    const buildCard = (m) => {
      const body = el("div", "popbody");
      body.setAttribute("role", "dialog");
      body.setAttribute("aria-label", "Contacts");
      body.id = "meet-search-card";
      const msg = el("p", "popmsg", m === "nomatch" ? "No contacts match" : "No contacts yet. Import a Google or Outlook CSV, or a .vcf file.");
      msg.id = "meet-search-msg";
      const acts = el("div", "popacts");
      const add = el("button", "popbtn popprimary");
      add.type = "button";
      add.append(svgIcon(USER_PLUS), document.createTextNode("Add contact"));
      add.addEventListener("click", () => openAddContacts("person"));
      const imp = el("button", "popbtn popsecondary");
      imp.type = "button";
      imp.append(svgIcon(DOWNLOAD), document.createTextNode("Import"));
      imp.addEventListener("click", () => openAddContacts("bulk"));
      acts.append(add, imp);
      body.append(msg, acts);
      pop.replaceChildren(body);
      pop.className = "searchpop card";
      input.setAttribute("aria-describedby", "meet-search-msg");
      input.removeAttribute("aria-controls");
    };
    const buildList = () => {
      const found = matchContacts(state.query).sort((x, y) => x.name.localeCompare(y.name)).slice(0, 50);
      const list = el("div", "popbody poplist");
      list.setAttribute("role", "listbox");
      list.setAttribute("aria-label", "Contacts");
      list.id = "meet-search-list";
      found.forEach((c, i) => {
        const o = el("div", "popopt");
        o.id = `meet-search-opt-${i}`;
        o.setAttribute("role", "option");
        o.setAttribute("aria-selected", "false");
        o.append(el("span", "cav", initials(c.name)));
        const text = el("span", "ctext");
        text.append(el("span", "cname", c.name), el("span", "csub", c.email || c.phone || (c.github ? `@${c.github}` : "Contact")));
        o.append(text);
        o.addEventListener("mousedown", (ev) => ev.preventDefault());
        o.addEventListener("click", () => pickContact(c));
        o.addEventListener("mousemove", () => { if (ui.active !== i) { ui.active = i; markActive(); } });
        list.append(o);
      });
      pop.replaceChildren(list);
      pop.className = "searchpop results";
      input.removeAttribute("aria-describedby");
      input.setAttribute("aria-controls", list.id);
    };
    const sync = () => {
      const m = visibleMode();
      if (m === "none") {
        pop.hidden = true;
        pop.replaceChildren();
        ui.sig = "";
        input.setAttribute("aria-expanded", "false");
        ["aria-describedby", "aria-controls", "aria-activedescendant"].forEach((a) => input.removeAttribute(a));
        return;
      }
      const sig = `${m}|${state.query}|${state.contacts.length}`;
      if (sig !== ui.sig) {
        ui.sig = sig;
        ui.active = -1;
        if (m === "results") buildList(); else buildCard(m);
      }
      pop.hidden = false;
      input.setAttribute("aria-expanded", m === "results" ? "true" : "false");
      clamp();
      markActive();
    };

    input.addEventListener("input", () => { state.query = input.value; ui.dismissed = false; renderNav(); sync(); });
    wrap.addEventListener("mouseenter", () => { clearTimeout(ui.timer); ui.hover = true; ui.dismissed = false; sync(); });
    wrap.addEventListener("mouseleave", () => { clearTimeout(ui.timer); ui.timer = setTimeout(() => { ui.hover = false; sync(); }, 150); });
    wrap.addEventListener("focusin", () => { if (!ui.focus) { ui.focus = true; ui.dismissed = false; } sync(); });
    wrap.addEventListener("focusout", (ev) => { if (ev.relatedTarget && wrap.contains(ev.relatedTarget)) return; ui.focus = false; sync(); });
    queueMicrotask(() => { if (ui.focus && !disposed && input.isConnected && !state.importing && !state.settings) input.focus({ preventScroll: true }); sync(); });
    wrap.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && !pop.hidden) { ev.preventDefault(); ev.stopPropagation(); ui.dismissed = true; sync(); return; }
      if (ev.target !== input) return;
      const count = pop.querySelectorAll('[role="option"]').length;
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        if (pop.hidden && mode() === "results") { ev.preventDefault(); ui.dismissed = false; ui.focus = true; sync(); }
        if (!count) return;
        ev.preventDefault();
        ui.active = ev.key === "ArrowDown" ? (ui.active + 1) % count : (ui.active <= 0 ? count - 1 : ui.active - 1);
        markActive();
      } else if (ev.key === "Enter" && count) {
        ev.preventDefault();
        const found = matchContacts(state.query).sort((x, y) => x.name.localeCompare(y.name)).slice(0, 50);
        const pick = found[ui.active >= 0 ? ui.active : (found.length === 1 ? 0 : -1)];
        if (pick) pickContact(pick);
      }
    });
    return wrap;
  }

  function invitePanel() {
    const link = inviteLink(shareBaseUrl(state.shareBase, location.href), cleanName(state.room) || DEFAULTS.room, { serverUrl: state.serverUrl, tokenUrl: state.tokenUrl });
    const msg = inviteMessage(state.name, cleanName(state.room), link);
    const picked = state.contacts.filter((c) => state.invitees.includes(c.id));
    const box = el("div", "invitebox");
    box.append(el("b", "", "Share this room"));
    const tabs = el("div", "sharetabs");
    [["link", "Link"], ["code", "Code"], ["qr", "QR code"], ["people", "People"]].forEach(([id, label]) => {
      const t = el("button", "mini", label);
      t.type = "button";
      t.setAttribute("aria-pressed", String(state.shareTab === id));
      t.addEventListener("click", () => { state.shareTab = id; render(); });
      tabs.append(t);
    });
    box.append(tabs);
    const list = el("div", "invitelist");
    state.contacts.forEach((c) => {
      const row = el("label");
      const cb = el("input");
      cb.type = "checkbox";
      cb.checked = state.invitees.includes(c.id);
      cb.addEventListener("change", () => { state.invitees = cb.checked ? [...state.invitees, c.id] : state.invitees.filter((x) => x !== c.id); render(); });
      row.append(cb, document.createTextNode(`${c.name}${c.email ? ` · ${c.email}` : ""}`));
      list.append(row);
    });
    if (!state.contacts.length) list.append(el("p", "note", "Import contacts to invite a group, or just copy the link."));
    const linkField = el("input");
    linkField.readOnly = true;
    linkField.value = link;
    linkField.setAttribute("aria-label", "Invite link");
    const acts = el("div", "inviteacts");
    const act = (label, fn) => { const b = el("button", "mini", label); b.type = "button"; b.addEventListener("click", fn); acts.append(b); return b; };
    const note = (t) => { state.inviteNote = t; const n = box.querySelector(".invitenote"); if (n) n.textContent = t; };
    act("Copy link", async () => { try { await navigator.clipboard.writeText(link); note("Link copied."); } catch { linkField.select(); note("Press Cmd/Ctrl+C to copy the link."); } });
    act(picked.length ? `Email ${picked.length}` : "Email", () => {
      const emails = picked.map((c) => c.email).filter(Boolean);
      if (!emails.length) { note(picked.length ? "None of the selected contacts has an email." : "Select people to email, or copy the link."); return; }
      const a = el("a");
      a.href = mailtoLink(emails, msg);
      a.click();
      note(`Opened your mail app with ${emails.length} recipient${emails.length === 1 ? "" : "s"} in Bcc${emails.length < picked.length ? `; ${picked.length - emails.length} had no email` : ""}.`);
    });
    act("SMS", () => {
      const phones = picked.map((c) => c.phone).filter(Boolean);
      if (!phones.length) { note(picked.length ? "None of the selected contacts has a phone number." : "Select people to text, or copy the link."); return; }
      const a = el("a");
      a.href = smsLink(phones, msg);
      a.click();
      note(`Opened your messages app for ${phones.length} number${phones.length === 1 ? "" : "s"}.`);
    });
    if (navigator.share) act("Share…", () => navigator.share({ title: msg.subject, text: msg.body, url: link }).catch(() => {}));
    act("WhatsApp", () => window.open(whatsappLink(msg), "_blank", "noopener"));
    const copy = async (text, done) => { try { await navigator.clipboard.writeText(text); note(done); } catch { note("Select the text and copy it."); } };
    if (state.shareTab === "code") {
      const code = cleanName(state.room) || DEFAULTS.room;
      box.append(el("div", "bigcode", code), el("p", "note", "Anyone can type this code into the Room field and press Join."));
      const row = el("div", "inviteacts");
      const b = el("button", "mini", "Copy code"); b.type = "button"; b.addEventListener("click", () => copy(code, "Code copied.")); row.append(b);
      box.append(row);
    } else if (state.shareTab === "qr") {
      const holder = el("div", "qrbox", "Loading…");
      box.append(holder, el("p", "note", "Point a phone camera at it to open this room."));
      qrSvg(link).then((svg) => { if (holder.isConnected || !disposed) holder.replaceChildren(...(svg ? [svg] : [document.createTextNode("QR unavailable offline")])); });
    } else if (state.shareTab === "people") {
      box.append(list, acts);
    } else {
      box.append(linkField, acts);
    }
    if (state.shareTab === "link" || state.shareTab === "qr") {
      const pub = el("input");
      pub.placeholder = "Public address, e.g. meet.example.com or your tunnel URL";
      pub.setAttribute("aria-label", "Public address for invite links");
      pub.value = state.shareBase || "";
      pub.addEventListener("change", () => { state.shareBase = pub.value.trim(); persist(); render(); });
      box.append(pub);
      if (isLocalOnly(link)) box.append(el("p", "err", "This link only opens on this computer. Set a public address above (a tunnel or your network address) so other people can use it."));
    }
    box.append(el("p", "note invitenote", state.inviteNote));
    return box;
  }

  function inviteToggle() {
    const b = iconButton(state.invite ? "Close invite link" : "Share invite link", state.invite ? "close" : "share");
    b.setAttribute("aria-pressed", String(state.invite));
    b.addEventListener("click", () => { state.invite = !state.invite; state.inviteNote = ""; render(); });
    return b;
  }

  /** The lobby's Share control: a full-width text button, no tooltip (the visible label is enough). */
  function lobbyShareToggle() {
    const b = el("button", "lobbyshare", state.invite ? "Close invite link" : "Share invite link");
    b.type = "button";
    withIcon(b, state.invite ? "close" : "share");
    b.setAttribute("aria-pressed", String(state.invite));
    b.addEventListener("click", () => { state.invite = !state.invite; state.inviteNote = ""; render(); });
    return b;
  }

  /** A real disclosure: a button with aria-expanded/aria-controls above a panel hidden with [hidden]. The fields stay mounted. */
  function advanced() {
    const wrap = el("div", "advanced");
    const btn = el("button", "advtoggle", "Advanced setup");
    btn.type = "button";
    btn.id = "meet-advanced-toggle";
    btn.setAttribute("aria-controls", "meet-advanced-panel");
    btn.setAttribute("aria-expanded", String(state.advancedOpen));
    btn.prepend(svgChevron());
    const panel = el("div", "advpanel");
    panel.id = "meet-advanced-panel";
    panel.setAttribute("role", "group");
    panel.setAttribute("aria-labelledby", btn.id);
    panel.hidden = !state.advancedOpen;
    panel.append(field("LiveKit server", "serverUrl"), field("Token endpoint", "tokenUrl"));
    btn.addEventListener("click", () => {
      state.advancedOpen = !state.advancedOpen;
      btn.setAttribute("aria-expanded", String(state.advancedOpen));
      panel.hidden = !state.advancedOpen;
      persistUi();
    });
    wrap.append(btn, panel);
    return wrap;
  }

  function field(label, key, type = "text") {
    const wrap = el("label", "", label);
    const input = el("input");
    input.type = type;
    input.value = state[key];
    input.addEventListener("input", () => { state[key] = input.value; });
    wrap.append(input);
    return wrap;
  }

  function lobby() {
    const box = el("form", "lobby");
    const who = state.contacts.find((c) => c.id === state.picked);
    const title = el("h1");
    if (who) title.textContent = `Call ${who.name}`;
    else { title.setAttribute("aria-label", APP_NAME); title.append(wordmark()); }
    box.append(title, field("Your name", "name"), field("Room or code", "room"));
    // The server status card holds the server fields, below its text.
    const card = el("div", "check");
    card.append(el("span", `pres${state.serverUp === false ? " bad" : state.serverUp ? " on" : ""}`));
    const grow = el("div", "grow");
    grow.append(
      el("span", "", state.serverUp === false ? "The meeting server isn't running" : state.serverUp ? "The meeting server is running" : "Checking the meeting server…"),
      el("span", "note", state.serverUp === false ? (state.serverNote || "Start it to join calls on this machine.") : "Calls on this machine go through this server."),
      advanced(),
    );
    card.append(grow);
    if (state.serverUp === false) {
      const go = el("button", "mini", state.starting ? "Starting…" : "Start it");
      go.type = "button";
      go.disabled = state.starting;
      go.addEventListener("click", startServer);
      card.append(go);
    }
    box.append(card);
    if (state.invitedTo) box.append(el("p", "note", `You were invited to "${state.invitedTo}". Enter your name and join.`));
    if (state.inviteServer) box.append(el("p", "note", "Server settings came from the invite link."));
    lobbyWarnings({ pageUrl: location.href, serverUrl: state.serverUrl, tokenUrl: state.tokenUrl }).forEach((w) => box.append(el("p", "note warn", w)));
    if (state.error) box.append(el("p", "err", state.error));
    const join = el("button", "primary", state.phase === "joining" ? "Joining…" : "Join");
    join.type = "submit";
    join.disabled = state.phase === "joining";
    box.append(join);
    const demo = el("button", "mini", "Preview the UI (demo)");
    demo.type = "button";
    demo.addEventListener("click", startDemo);
    box.append(demo);
    box.append(lobbyShareToggle());
    if (state.invite) box.append(invitePanel());
    box.append(el("p", "note", "MeetRightHere runs on a LiveKit server on this machine. If it is not running, use Start it above, or open Settings."));
    box.addEventListener("submit", (ev) => { ev.preventDefault(); join_(); });
    return box;
  }

  async function join_() {
    const name = cleanName(state.name);
    const roomName = cleanName(state.room);
    if (!name || !roomName) { state.error = "Enter your name and a room."; render(); return; }
    state.name = name; state.room = roomName; state.error = ""; state.phase = "joining";
    state.inviteServer = null;
    persist(); render();
    try {
      let token;
      if (state.tokenUrl.trim()) {
        const res = await fetch(`${state.tokenUrl}?room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(name)}`);
        if (!res.ok) throw new Error(`Token endpoint answered ${res.status}`);
        ({ token } = await res.json());
      } else {
        token = await signToken({ key: state.apiKey, secret: state.apiSecret, room: roomName, identity: name });
      }
      lk = await loadLivekit();
      if (disposed) return;
      room = new lk.Room({ adaptiveStream: true, dynacast: true });
      const refresh = () => { if (!disposed) { renderHead(); renderStage(); renderNav(); } };
      Object.values({ a: "ParticipantConnected", b: "ParticipantDisconnected", c: "TrackSubscribed", d: "TrackUnsubscribed", e: "TrackMuted", f: "TrackUnmuted", g: "LocalTrackPublished", h: "LocalTrackUnpublished", i: "ActiveSpeakersChanged" })
        .forEach((ev) => room.on(lk.RoomEvent[ev], refresh));
      room.on(lk.RoomEvent.DataReceived, (bytes, participant) => {
        const text = decodeChat(bytes);
        if (text == null) return;
        state.chat.push({ from: participant?.identity || "Someone", text });
        renderChat();
      });
      room.on(lk.RoomEvent.Disconnected, () => { if (!disposed && state.phase === "meeting") leave(); });
      await room.connect(state.serverUrl, token);
      await Promise.allSettled([room.localParticipant.setMicrophoneEnabled(true), room.localParticipant.setCameraEnabled(true)]);
      state.phase = "meeting"; state.mic = true; state.cam = true; state.screen = false; state.chat = [];
      render();
    } catch (err) {
      room?.disconnect();
      room = null;
      state.phase = "lobby";
      state.error = `Could not join: ${err?.message || err}`;
      state.advancedOpen = true; // the server and token endpoint fields live there; show them
      render();
    }
  }

  let recognition = null;

  function stopListening() {
    const r = recognition;
    recognition = null;
    try { r?.stop(); } catch { /* already stopped */ }
  }

  function agentSay(text) {
    if (!text) return;
    state.chat.push({ from: "Agent", text });
    renderChat();
    const sup = speechSupport();
    if (state.voice && sup.speak) {
      const u = new globalThis.SpeechSynthesisUtterance(text);
      u.onstart = () => { state.agentTalking = true; renderStage(); };
      u.onend = () => { state.agentTalking = false; renderStage(); };
      globalThis.speechSynthesis.speak(u);
    }
  }

  function hear(text, via) {
    state.chat.push({ from: via === "voice" ? "You (voice)" : "You", text });
    renderChat();
    if (state.agent) setTimeout(() => { if (!disposed && state.agent) agentSay(agentReply(text)); }, 500);
  }

  function startListening() {
    stopListening();
    if (!state.agent || !state.listen) return;
    const Rec = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
    if (!Rec) { state.error = "Voice listening isn't available here. Type to the agent instead."; return; }
    const r = new Rec();
    recognition = r;
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
        if (ev.results[i].isFinal) hear(String(ev.results[i][0].transcript || "").trim(), "voice");
      }
    };
    r.onerror = (ev) => {
      state.error = ev.error === "not-allowed" ? "Allow microphone access to let the agent listen." : "The agent can't listen right now. Type to it instead.";
      stopListening();
      render();
    };
    r.onend = () => { if (recognition === r && state.agent && state.listen && !disposed) { try { r.start(); } catch { /* restarting */ } } };
    try { r.start(); } catch { /* already started */ }
  }

  function inviteAgent() {
    state.agent = true;
    state.chat.push({ kind: "event", text: "Agent joined" });
    startListening();
    render();
    setTimeout(() => { if (!disposed && state.agent) agentSay("Hi, I'm here. I can listen and talk, or you can type to me."); }, 400);
  }

  function removeAgent() {
    state.agent = false;
    stopListening();
    globalThis.speechSynthesis?.cancel();
    state.agentTalking = false;
    state.chat.push({ kind: "event", text: "Agent left" });
    render();
  }

  function stopDemo() {
    clearInterval(state.demoTimer);
    state.demoTimer = null;
    state.demo = false;
  }

  function startDemo() {
    state.demo = true; state.phase = "meeting"; state.error = ""; state.mic = true; state.cam = true; state.screen = false;
    state.chat = []; state.speaker = 0;
    if (!state.name) state.name = "You";
    let step = 0;
    render();
    state.demoTimer = setInterval(() => {
      if (disposed) { stopDemo(); return; }
      state.speaker = (state.speaker + 1) % (DEMO_PEOPLE.length + 1);
      if (step < DEMO_SCRIPT.length) { state.chat.push(DEMO_SCRIPT[step]); step += 1; renderChat(); }
      renderStage();
    }, 2200);
  }

  function leave() {
    stopDemo();
    state.agent = false;
    stopListening();
    globalThis.speechSynthesis?.cancel();
    room?.disconnect();
    room = null;
    state.phase = "lobby";
    render();
  }

  function tileFor(participant, source, label) {
    const pub = participant.getTrackPublication?.(source);
    const track = pub?.track;
    const isScreen = source === lk.Track.Source.ScreenShare;
    const tile = el("div", `tile${isScreen ? " screen" : ""}${participant.isSpeaking && !isScreen ? " speaking" : ""}`);
    if (track && !pub.isMuted) {
      const video = track.attach();
      video.muted = true;
      tile.append(video);
    } else {
      tile.append(el("div", "avatar", initials(participant.identity)));
    }
    const mic = participant.getTrackPublication?.(lk.Track.Source.Microphone);
    const muted = !isScreen && (!mic || mic.isMuted);
    labelFor(tile, label, isScreen ? { kind: "human", role: "", model: "" } : participantInfo(participant), muted ? " muted" : "");
    tile.dataset.name = participant.identity || label;
    return tile;
  }

  /** A name pill with the role (and model, for agents) under it, plus a Human/Agent badge on the tile. */
  function labelFor(tile, text, info, extraClass = "") {
    const label = el("span", `label${extraClass}`, text);
    const sub = [info.role, info.model].filter(Boolean).join(" · ");
    if (sub) label.append(el("small", "sub", sub));
    tile.dataset.kind = info.kind;
    tile.append(el("span", `badge ${info.kind}`, info.kind === "agent" ? "Agent" : "Human"), label);
  }

  /** Applies the view mode: Kamiji avatars in place of initials/video, and the speaker layout. */
  function applyView(tiles) {
    tiles.forEach((tile) => {
      if (tile.classList.contains("screen")) return;
      const agent = tile.classList.contains("agent");
      if (state.view === "grid" && !agent) return;
      const name = tile.dataset.name || "";
      const kami = fluxKamiji({ hueOffset: agent ? 140 : kamijiHue(name), talking: () => tile.classList.contains("speaking"), label: `${name}'s Kamiji` });
      kami.classList.add("tilekami");
      const old = tile.querySelector("video, .avatar");
      if (old) old.replaceWith(kami); else tile.prepend(kami);
    });
    if (state.view !== "speaker") return tiles;
    const people = tiles.filter((t) => !t.classList.contains("screen"));
    const lead = tiles.find((t) => t.classList.contains("screen")) || people.find((t) => t.classList.contains("speaking")) || people[0];
    if (!lead) return tiles;
    lead.classList.add("big");
    return [lead, ...tiles.filter((t) => t !== lead)];
  }

  function setGrid(grid, tiles) {
    const ordered = applyView(tiles);
    const cols = state.view === "speaker" ? Math.max(1, ordered.length - 1) : gridColumns(ordered.length);
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    grid.append(...ordered);
  }

  function agentTile() {
    const tile = el("div", `tile agent${state.agentTalking ? " speaking" : ""}`);
    tile.dataset.name = "Agent";
    tile.append(el("div", "avatar", "AI"));
    labelFor(tile, state.listen ? "Agent · listening" : "Agent", { kind: "agent", role: "Assistant", model: "Built-in replies" });
    return tile;
  }

  function renderDemoStage(grid) {
    grid.replaceChildren();
    const people = [...DEMO_PEOPLE, { name: `${state.name} (you)`, kind: "human", role: "Host" }];
    const tiles = people.map((person, i) => {
      const tile = el("div", `tile${i === state.speaker && !state.agentTalking ? " speaking" : ""}`);
      tile.dataset.name = person.name;
      tile.append(el("div", "avatar", initials(person.name)));
      labelFor(tile, person.name, person);
      return tile;
    });
    if (state.agent) tiles.push(agentTile());
    if (state.chat.some((m) => m.text === "Grace started sharing their screen")) {
      const screen = el("div", "tile screen");
      screen.append(miniAppScreen());
      labelFor(screen, "Grace, screen", { kind: "agent", role: "Code reviewer", model: "Claude Sonnet 5.5" });
      tiles.unshift(screen);
    }
    setGrid(grid, tiles);
  }

  function renderStage() {
    const grid = root.querySelector(".grid");
    if (grid && state.demo) { renderDemoStage(grid); return; }
    if (!grid || !room) return;
    grid.replaceChildren();
    const people = [room.localParticipant, ...room.remoteParticipants.values()];
    const tiles = [];
    people.forEach((p) => {
      const mine = p === room.localParticipant;
      if (p.getTrackPublication(lk.Track.Source.ScreenShare)) tiles.push(tileFor(p, lk.Track.Source.ScreenShare, `${p.identity}${mine ? " (you)" : ""}, screen`));
      tiles.push(tileFor(p, lk.Track.Source.Camera, `${p.identity}${mine ? " (you)" : ""}`));
    });
    if (state.agent) tiles.push(agentTile());
    setGrid(grid, tiles);
    // remote audio must be attached somewhere to play
    room.remoteParticipants.forEach((p) => {
      const audio = p.getTrackPublication(lk.Track.Source.Microphone)?.track;
      if (audio && !root.querySelector(`audio[data-id="${p.identity}"]`)) {
        const a = audio.attach();
        a.dataset.id = p.identity;
        root.append(a);
      }
    });
  }

  function renderChat() {
    const log = root.querySelector(".chatlog");
    if (!log) return;
    log.replaceChildren(...state.chat.map((m) => { if (m.kind === "event") return el("div", "evt", m.text); const row = el("div", "msg"); row.append(el("b", "", `${m.from}: `), document.createTextNode(m.text)); return row; }));
    log.scrollTop = log.scrollHeight;
  }

  /** An icon-only call control. Its label is the accessible name and the tooltip text; extra classes go on the button. */
  function iconButton(label, icon, extra = "") {
    const b = el("button", `ctl iconctl${extra ? ` ${extra}` : ""}`);
    b.type = "button";
    b.setAttribute("aria-label", label);
    withIcon(b, icon);
    attachTip(b);
    return b;
  }

  /** labels: [label while on, label while off]. The toggle reports its state with aria-pressed. tone: "offdanger" paints it red while off (muted), "ondanger" while on (sharing). */
  function control(labels, key, onChange, icons = [], tone = "offdanger") {
    const b = iconButton(labels[state[key] ? 0 : 1], state[key] ? icons[0] : (icons[1] || icons[0]), tone);
    b.setAttribute("aria-pressed", String(state[key]));
    b.addEventListener("click", async () => {
      state[key] = !state[key];
      try { await onChange(state[key]); } catch (err) { state[key] = !state[key]; state.error = String(err?.message || err); }
      render();
    });
    return b;
  }

  function meeting() {
    const wrap = el("div", "meeting");
    const stage = el("div", "stage");
    if (state.invite) stage.append(invitePanel());
    stage.append(el("div", "grid"));
    const chat = el("div", "chat");
    const form = el("form", "chatform");
    const input = el("input");
    input.placeholder = "Message the room";
    input.setAttribute("aria-label", "Message the room");
    input.value = state.draft;
    input.addEventListener("input", () => { state.draft = input.value; });
    const send = withIcon(el("button", "ctl", "Send"), "send");
    send.type = "submit";
    form.append(input, send);
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const text = state.draft.trim();
      if (!text || (!room && !state.demo)) return;
      if (room) room.localParticipant.publishData(encodeChat(text), { reliable: true });
      state.draft = ""; input.value = "";
      hear(text, "text");
    });
    chat.append(el("div", "chatlog"), form);
    wrap.append(stage, chat);

    const bar = el("div", "bar");
    const lp = () => room.localParticipant;
    const live = (fn) => (on) => (state.demo ? undefined : fn(on));
    bar.append(
      control(["Mute microphone", "Unmute microphone"], "mic", live((on) => lp().setMicrophoneEnabled(on)), ["mic", "micOff"]),
      control(["Turn camera off", "Turn camera on"], "cam", live((on) => lp().setCameraEnabled(on)), ["camera", "cameraOff"]),
      control(["Stop sharing", "Share screen"], "screen", live((on) => lp().setScreenShareEnabled(on)), ["screen"], "ondanger"),
    );
    const views = el("div", "views");
    [["grid", "Grid"], ["avatars", "Avatars"], ["speaker", "Speaker"]].forEach(([id, label]) => {
      const b = iconButton(label, id);
      b.setAttribute("aria-pressed", String(state.view === id));
      b.addEventListener("click", () => { state.view = id; render(); });
      views.append(b);
    });
    if (!state.agent) {
      const ia = iconButton("Invite agent", "agent");
      ia.addEventListener("click", inviteAgent);
      bar.append(ia);
    } else {
      const sup = speechSupport();
      const lis = control(["Stop agent listening", "Start agent listening"], "listen", (on) => { if (on) startListening(); else stopListening(); }, ["listen"]);
      if (!sup.listen) lis.setAttribute("aria-description", "Voice listening isn't supported in this window; type to the agent.");
      bar.append(lis, control(["Mute agent voice", "Unmute agent voice"], "voice", (on) => { if (!on) globalThis.speechSynthesis?.cancel(); }, ["volume", "volumeOff"]));
      const rm = iconButton("Remove agent", "close");
      rm.addEventListener("click", removeAgent);
      bar.append(rm);
    }
    const out = iconButton("Leave", "leave", "leave");
    out.addEventListener("click", leave);
    bar.append(out);
    if (state.error) bar.append(el("span", "err", state.error));
    return [wrap, bar, views, inviteToggle()];
  }

  function fillHead(mh) {
    const n = (state.demo ? DEMO_PEOPLE.length + 1 : (room ? room.remoteParticipants.size : 0) + 1) + (state.agent ? 1 : 0);
    mh.replaceChildren(el("span", "", state.demo ? "Demo call" : state.room), el("small", "", `${n} ${n === 1 ? "person" : "people"} · ${state.name}`));
  }

  function renderHead() {
    const mh = root.querySelector(".mhead");
    if (mh) fillHead(mh);
  }

  function render() {
    if (disposed) return;
    fitRoot();
    root.replaceChildren();
    root.append(tip);
    hideTip();
    const main = el("div", "main");
    const inCall = state.phase === "meeting" && (room || state.demo);
    // The contacts column shows only in a call with at least one contact; with none, the empty-state guidance lives in the search hovercard.
    const nav = inCall && state.contacts.length ? navCol() : null;
    root.classList.toggle("nonav", !nav);
    const specs = nav ? [[root, { el: nav, edge: "left", min: 200, max: 480, initial: 260, label: "contacts" }, "contacts"]] : [];
    if (inCall) {
      const mh = el("div", "mhead");
      fillHead(mh);
      const [wrap, bar, views, share] = meeting();
      main.append(wrap);
      wrap.append(canvasRail(), views);
      root.append(hudTop([mh]),...(nav ? [nav] : []), main, hudBottom(bar, share));
      specs.push([wrap, { el: wrap.querySelector(".chat"), edge: "right", min: 200, max: 480, initial: 300, label: "chat" }, "chat"]);
      renderStage();
      renderChat();
    } else {
      {
        const stage = el("div", "lobbystage");
        stage.append(lobby());
        main.append(stage);
      }
      main.append(canvasRail());
      root.append(hudTop(), main, hudBottom());
    }
    regrip(specs);
    renderNav();
    syncHud();
    if (state.settings) root.append(settingsModal());
    if (state.importing) root.append(addContactsModal());
  }

  /** Tell the column handles how tall the two HUD bars are, so they only span the middle. */
  function syncHud() {
    const t = root.querySelector(".hudtop");
    const b = root.querySelector(".hudbottom");
    if (t?.offsetHeight) root.style.setProperty("--hud-top", `${t.offsetHeight}px`);
    if (b?.offsetHeight) root.style.setProperty("--hud-bottom", `${b.offsetHeight}px`);
  }

  /** Fill the visible page below wherever the host put us (hosts may not give a definite height). */
  function fitRoot() {
    const top = Math.max(0, root.getBoundingClientRect().top);
    root.style.height = `${Math.max(480, (window.innerHeight || 800) - top)}px`;
  }
  const onWinResize = () => { if (!disposed) { fitRoot(); syncHud(); } };
  window.addEventListener("resize", onWinResize);
  const roFit = typeof ResizeObserver === "function" && container.parentElement ? new ResizeObserver(onWinResize) : null;
  roFit?.observe(container.parentElement || container);

  render();
  detectServer();
  return () => { disposed = true; clearTimeout(tipTimer); window.removeEventListener("resize", onWinResize); roFit?.disconnect(); grips.forEach((g) => g.dispose()); stopDemo(); stopListening(); globalThis.speechSynthesis?.cancel(); room?.disconnect(); root.remove(); };
}
