/* MESH — the Hangout / Team Chat experience on a MESH protocol node.
 *
 * MESH = Modular Extensible Social Hybrid Protocol: Ed25519 identities, a signed content
 * DAG, composable moderation attestations and deterministic feeds. This Canvas App is a
 * dependency-free browser client for a MESH node (the HTTP API of app/server/main.py, v1.1,
 * and app/server/server_v2.py, v2.0, in holon-protocol/mesh-protocol).
 *
 * Mapping: feed / timeline = channels, content = messages (replies via reply_to),
 * entities = members (people and AI agents), attestations = moderation badges.
 *
 * Browser-only ESM. Text is always set with textContent. When no node is reachable (or when
 * you choose it) a Demo mode with in-memory sample data takes over, and the header says so.
 */

const STORAGE_KEY = "mesh-hangout:v1";
const DEFAULT_NODE = "http://localhost:12000";

// ─── Orb avatars (the Kamiji-style wisp: a flat blob with two pill eyes) ─────────────────

const BLOBS = [
  { id: "violet", fill: "#8B5CF6" }, { id: "blue", fill: "#2D9CF0" }, { id: "green", fill: "#2FBF71" },
  { id: "teal", fill: "#19B5A5" }, { id: "brown", fill: "#8A5A3C" }, { id: "orange", fill: "#F5760A" },
  { id: "red", fill: "#EF4444" }, { id: "pink", fill: "#EC4899" }, { id: "indigo", fill: "#5B5BF0" },
];
const ORB_PATHS = [
  "M32 6C45 5 58 15 58 31C58 47 46 58 31 58C17 58 6 47 6 32C6 17 18 7 32 6Z",
  "M30 5C44 4 59 17 58 33C57 48 44 59 30 58C16 57 5 46 6 31C7 17 17 6 30 5Z",
  "M34 6C47 8 58 19 57 34C56 49 43 58 29 57C15 56 6 44 7 29C8 15 21 4 34 6Z",
];
const SVG_NS = "http://www.w3.org/2000/svg";

/** The MESH mark, from the Modern Telepathy Relay and MESH product page (public/projects/relay/logo.svg). */
const MESH_LOGO = "data:image/svg+xml;utf8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2024%2024%22%20fill=%22none%22%20stroke=%22%23ffffff%22%20stroke-width=%222%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22%3E%3Cpath%20d=%22M12%203.5%2019.4%207.75v8.5L12%2020.5%204.6%2016.25v-8.5Z%22/%3E%3Cpath%20d=%22M12%203.5v17M4.6%207.75l14.8%208.5M19.4%207.75%204.6%2016.25%22/%3E%3Ccircle%20cx=%2212%22%20cy=%2212%22%20r=%221.6%22%20fill=%22%23ffffff%22/%3E%3C/svg%3E";

function orbSvg(blob, index) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("data-style", "orb");
  const delay = `${-((index * 7 + 3) % 53) / 10}s`;
  const add = (parent, tag, attrs) => {
    const n = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, String(v)));
    parent.append(n);
    return n;
  };
  add(svg, "circle", { cx: 32, cy: 33, r: 31, fill: blob.fill, opacity: 0.16, class: "orb-halo" });
  const body = add(svg, "g", { class: "orb-body" });
  body.style.animationDelay = delay;
  add(body, "path", { d: ORB_PATHS[index % ORB_PATHS.length], fill: blob.fill });
  const look = add(body, "g", { class: "orb-look" });
  look.style.animationDelay = delay;
  const blink = add(look, "g", { class: "orb-blink" });
  blink.style.animationDelay = delay;
  [21, 36].forEach((x) => add(blink, "rect", { class: "pill-eye", x, y: 23, width: 7, height: 19, rx: 3.5, fill: "#1a0f33" }));
  return svg;
}

const KAMIJI_STROKES = ["M18 24V82M46 24L20 54M28 50L48 82", "M96 48V82", "M120 48V82M120 60Q120 48 134 48Q148 48 148 62V82M148 62Q148 48 162 48Q176 48 176 62V82", "M198 48V82M198 26V26", "M224 48V86Q224 98 210 98M224 26V26", "M250 48V82M250 26V26"];
const KOSMOS_PATHS = [
  "M79.81,54.47c-2.27-3.14-3.59-7.14-3.59-11.73,0-11.39,8.05-19.17,18.75-19.17,5.44,0,10.18,2.02,13.54,5.49,2.77-3.32,28.03-25.97,31.05-29.06-24.12,19.01-35.79,11.75-44.59,11.75-18.92,0-32.79,13.18-32.79,30.99,0,8.04,2.84,15.14,7.69,20.51",
  "M111.85,33.96c1.19,2.57,1.86,5.52,1.86,8.77,0,11.38-8.05,19.17-18.75,19.17-4.03,0-7.67-1.1-10.66-3.09-3.54,2.54-21.13,20.86-24.29,23.89,18.2-10.53,26.87-8.99,34.95-8.99,18.83,0,32.79-13.1,32.79-30.99,0-6.58-2.16-12.99-5.7-18.17l-10.2,9.4Z",
  "M137.56,66.79l4.71-10.44c5.05,3.68,12.58,6.25,19.77,6.25,8.22,0,11.56-2.74,11.56-6.42,0-11.21-34.84-3.51-34.84-25.77,0-10.19,8.22-18.66,25.25-18.66,7.53,0,15.24,1.8,20.8,5.31l-4.28,10.53c-5.56-3.17-11.3-4.71-16.61-4.71-8.22,0-11.39,3.08-11.39,6.85,0,11.04,34.84,3.42,34.84,25.42,0,10.02-8.3,18.58-25.42,18.58-9.5,0-19.09-2.83-24.4-6.93Z",
  "M254.75,72.7l-.09-35.95-17.63,29.62h-6.25l-17.55-28.85v35.18h-13.01V12.78h11.47l22.43,37.24,22.09-37.24h11.39l.17,59.92h-13.01Z",
  "M280.39,42.78c0-17.81,13.87-30.99,32.79-30.99s32.79,13.1,32.79,30.99-13.95,30.99-32.79,30.99-32.79-13.18-32.79-30.99ZM331.93,42.78c0-11.39-8.05-19.17-18.75-19.17s-18.75,7.79-18.75,19.17,8.05,19.17,18.75,19.17,18.75-7.79,18.75-19.17Z",
  "M355.48,66.84l4.71-10.44c5.05,3.68,12.58,6.25,19.77,6.25,8.22,0,11.56-2.74,11.56-6.42,0-11.21-34.84-3.51-34.84-25.77,0-10.19,8.22-18.66,25.25-18.66,7.53,0,15.24,1.8,20.8,5.31l-4.28,10.53c-5.56-3.17-11.3-4.71-16.61-4.71-8.22,0-11.39,3.08-11.39,6.85,0,11.04,34.84,3.42,34.84,25.42,0,10.02-8.3,18.58-25.42,18.58-9.5,0-19.09-2.83-24.4-6.93Z",
  "M13.78,39.15V12.78H0v59.92h13.78v-15.15l.03-.03M28.22,42.74 56.22,72.7H38.43L19.09,52.01 13.81,46.36 10.43,42.74 13.78,39.15 38.43,12.78H56.22L31.06,39.7Z",
];

// Artec logo (two-tone: a diamond with the letters cut out), painted with the host contrast colour so it reads in light and dark themes.
const ARTEC_DIAMOND = "M86.67 0L0 37.81L86.68 75.11L173.35 37.31L86.67 0Z";
const ARTEC_LETTERS = "M128.79 31.06V44.53L138.79 40.17V44.81L124.54 51.02V24.57L138.79 30.78V35.42L128.79 31.06ZM108.79 22.34V35.68H116.29V39.93H108.79V53.26L118.79 48.9V53.53L104.54 59.74V15.85L118.79 22.06V26.7L108.79 22.34ZM98.79 13.33V17.98L88.79 13.61V66.62L86.67 67.54L84.54 66.62V13.61L74.54 17.97V13.33L86.67 8.04004L98.79 13.33ZM65.83 35.05L68.79 33.75V15.84L54.54 22.06V53.53L58.79 55.38V38.11L61.91 36.74L69.61 60.11L72.45 61.34H72.74V61.48L74.84 62.39L65.83 35.05ZM64.54 30.96L58.79 33.47V24.84L64.54 22.33V30.96ZM34.54 30.78V44.81L38.79 46.66V42.07H44.54V49.17L48.79 51.02V24.57L34.54 30.78ZM44.54 37.82H38.79V33.56L44.54 31.05V37.82Z";
let artecSeq = 0;
function artecLogo() {
  const id = `artec-mask-${++artecSeq}`;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 174 76");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Artec");
  const title = document.createElementNS(SVG_NS, "title");
  title.textContent = "Artec";
  const mask = document.createElementNS(SVG_NS, "mask");
  mask.setAttribute("id", id);
  mask.setAttribute("maskUnits", "userSpaceOnUse");
  ["x:0", "y:0", "width:174", "height:76"].forEach((kv) => mask.setAttribute(...kv.split(":")));
  const bg = document.createElementNS(SVG_NS, "rect");
  ["x:0", "y:0", "width:174", "height:76", "fill:#fff"].forEach((kv) => bg.setAttribute(...kv.split(":")));
  const cut = document.createElementNS(SVG_NS, "path");
  cut.setAttribute("d", ARTEC_LETTERS);
  cut.setAttribute("fill", "#000");
  mask.append(bg, cut);
  const diamond = document.createElementNS(SVG_NS, "path");
  diamond.setAttribute("d", ARTEC_DIAMOND);
  diamond.setAttribute("fill", "currentColor");
  diamond.setAttribute("mask", `url(#${id})`);
  diamond.setAttribute("aria-hidden", "true");
  svg.append(title, mask, diamond);
  const span = el("span", "plogo artec");
  span.append(svg);
  return span;
}

function logoSvg(viewBox, label, paths, stroke) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", label);
  const title = document.createElementNS(SVG_NS, "title");
  title.textContent = label;
  svg.append(title);
  paths.forEach((d) => {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    path.setAttribute("aria-hidden", "true");
    if (stroke) Object.entries({ fill: "none", stroke: "currentColor", "stroke-width": stroke, "stroke-linecap": "round", "stroke-linejoin": "round" }).forEach(([k, v]) => path.setAttribute(k, v));
    else path.setAttribute("fill", "currentColor");
    svg.append(path);
  });
  return svg;
}

export function blobSvg(blobId) {
  const blob = BLOBS.find((b) => b.id === blobId) || BLOBS[0];
  return orbSvg(blob, BLOBS.indexOf(blob));
}

export function hashOf(text) {
  let h = 0;
  const s = String(text);
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** The orb for an entity: tinted deterministically from its id, so it is stable across nodes. */
export const blobIdFor = (entityId) => BLOBS[hashOf(entityId) % BLOBS.length].id;

// ─── MESH crypto and canonicalisation (verified against implementations/mesh/crypto.py) ───

const textEncoder = new TextEncoder();

export const bytesToHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
export function hexToBytes(hex) {
  if (typeof hex !== "string" || hex.length % 2 || /[^0-9a-f]/i.test(hex)) throw new Error("Invalid hex");
  return Uint8Array.from(hex.match(/../g) || [], (h) => parseInt(h, 16));
}
const b64urlToBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

const subtle = () => globalThis.crypto?.subtle;

function pyString(s) {
  // Python json.dumps(ensure_ascii=True): everything outside 0x20-0x7e becomes \uXXXX (lowercase),
  // astral characters as surrogate pairs (which is exactly how JS iterates UTF-16 code units).
  let out = '"';
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    const ch = s[i];
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\b") out += "\\b";
    else if (ch === "\f") out += "\\f";
    else if (c < 0x20 || c > 0x7e) out += `\\u${c.toString(16).padStart(4, "0")}`;
    else out += ch;
  }
  return `${out}"`;
}

// Python sorts str keys by code point; JS default sort is by UTF-16 unit, which differs for astral keys.
const compareCodePoints = (a, b) => {
  const x = Array.from(a, (c) => c.codePointAt(0));
  const y = Array.from(b, (c) => c.codePointAt(0));
  for (let i = 0; i < Math.min(x.length, y.length); i += 1) if (x[i] !== y[i]) return x[i] - y[i];
  return x.length - y.length;
};

/**
 * Deterministic JSON, byte-identical to Python's
 * `json.dumps(obj, sort_keys=True, separators=(',', ':')).encode('utf-8')`.
 * Caveat: JS numbers have no int/float distinction, so 1.0 serialises as `1` (Python: `1.0`).
 * MESH payloads that get signed contain strings, ints, booleans and null only.
 */
export function canonicalJson(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return pyString(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Non-finite number is not canonicalisable");
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort(compareCodePoints);
    return `{${keys.map((k) => `${pyString(k)}:${canonicalJson(value[k])}`).join(",")}}`;
  }
  throw new Error(`Cannot canonicalise ${typeof value}`);
}
export const canonicalBytes = (value) => textEncoder.encode(canonicalJson(value));

export async function sha256Hex(data) {
  const bytes = typeof data === "string" ? textEncoder.encode(data) : data;
  return bytesToHex(new Uint8Array(await subtle().digest("SHA-256", bytes)));
}

/** ent:<sha256(raw public key)[:32]> — generate_entity_id() in primitives/protocol. */
export const entityIdFor = async (publicKey) => `ent:${(await sha256Hex(publicKey)).slice(0, 32)}`;
/** sha256(canonical_json(content_dict))[:48] — main.py generate_content_id (v1.1 node). */
export const contentIdV1 = async (contentDict) => (await sha256Hex(canonicalBytes(contentDict))).slice(0, 48);
/** sha256("source:kind:target")[:32] — generate_link_id. */
export const linkIdFor = async (source, kind, target) => (await sha256Hex(`${source}:${kind}:${target}`)).slice(0, 32);
/** sha256("issuer:subject:type")[:32] — protocol.py generate_attestation_id (v2 node). */
export const attestationIdFor = async (issuer, subject, type) => (await sha256Hex(`${issuer}:${subject}:${type}`)).slice(0, 32);

/** True when this browser's WebCrypto can generate and sign with Ed25519 keys (probed each call; cheap). */
export async function ed25519Supported() {
  try {
    const pair = await subtle().generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
    const sig = await subtle().sign({ name: "Ed25519" }, pair.privateKey, textEncoder.encode("probe"));
    return sig.byteLength === 64;
  } catch { return false; }
}

/** True when WebCrypto can do X25519 (needed to publish an `encryption_key` for v2 end-to-end encrypted DMs). */
export async function x25519Supported() {
  try {
    const pair = await subtle().generateKey({ name: "X25519" }, true, ["deriveBits"]);
    return (await subtle().exportKey("raw", pair.publicKey)).byteLength === 32;
  } catch { return false; }
}

/** A fresh X25519 key pair: private JWK to keep, raw 32-byte public key as hex for `encryption_key`. */
export async function generateEncryptionKey() {
  const pair = await subtle().generateKey({ name: "X25519" }, true, ["deriveBits"]);
  const jwk = await subtle().exportKey("jwk", pair.privateKey);
  const raw = new Uint8Array(await subtle().exportKey("raw", pair.publicKey));
  return { jwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, d: jwk.d }, publicKeyHex: bytesToHex(raw) };
}

/** Validates a stored X25519 private JWK and returns { jwk, publicKeyHex }. */
export async function encryptionKeyFromJwk(jwk) {
  await subtle().importKey("jwk", jwk, { name: "X25519" }, false, ["deriveBits"]);
  return { jwk, publicKeyHex: bytesToHex(b64urlToBytes(jwk.x)) };
}

/** Wraps a private JWK as an identity: entity id, hex public key, and a hex-signature function. `enc` is the optional X25519 pair. */
export async function identityFromJwk(jwk, enc = null) {
  if (!jwk || jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || !jwk.x || !jwk.d) throw new Error("Not an Ed25519 private key (expected a JWK with kty OKP, crv Ed25519, x and d)");
  const key = await subtle().importKey("jwk", jwk, { name: "Ed25519" }, false, ["sign"]);
  const publicKey = b64urlToBytes(jwk.x);
  const signBytes = async (bytes) => bytesToHex(new Uint8Array(await subtle().sign({ name: "Ed25519" }, key, bytes)));
  return {
    jwk,
    enc,
    publicKeyHex: bytesToHex(publicKey),
    entityId: await entityIdFor(publicKey),
    /** Signs a UTF-8 string (the auth challenge) and returns a 128-char hex signature. */
    sign: (message) => signBytes(textEncoder.encode(message)),
    /** Signs canonical_json(obj without `sig`) and returns obj with `sig` (hex) — sign_object() in crypto.py. */
    async signObject(obj) {
      const { sig: _drop, ...rest } = obj;
      return { ...rest, sig: await signBytes(canonicalBytes(rest)) };
    },
  };
}

export async function generateIdentity({ encryption = true } = {}) {
  const pair = await subtle().generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const jwk = await subtle().exportKey("jwk", pair.privateKey);
  let enc = null;
  if (encryption) { try { enc = await generateEncryptionKey(); } catch { enc = null; } }
  return identityFromJwk({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, d: jwk.d }, enc);
}

/** The portable backup format: { mesh_hangout_identity: 1, ed25519: <JWK>, x25519: <JWK|null>, handle, name }. */
export function exportBundle(stored) {
  return JSON.stringify({ mesh_hangout_identity: 1, ed25519: stored.jwk, x25519: stored.enc || null, handle: stored.handle || null, name: stored.name || null }, null, 2);
}

/** Accepts the bundle above or a bare Ed25519 private JWK (the format older versions exported). */
export async function importBundle(text) {
  let data;
  try { data = JSON.parse(String(text || "").trim()); } catch { throw new Error("That is not valid JSON. Paste the full exported key."); }
  const edJwk = data?.ed25519 || data;
  const pick = (j) => (j ? { kty: j.kty, crv: j.crv, x: j.x, d: j.d } : null);
  const ed = pick(edJwk);
  let enc = null;
  if (data?.x25519) { try { enc = (await encryptionKeyFromJwk(pick(data.x25519))).jwk; } catch { enc = null; } }
  const identity = await identityFromJwk(ed, enc ? await encryptionKeyFromJwk(enc) : null);
  return { identity, stored: { jwk: ed, enc, handle: data?.handle || null, name: data?.name || null } };
}

/** Verifies a hex signature over canonical_json(obj without `sig`) — verify_object_signature(). */
export async function verifyObject(obj, publicKeyHex) {
  try {
    const key = await subtle().importKey("raw", hexToBytes(publicKeyHex), { name: "Ed25519" }, false, ["verify"]);
    const { sig, ...rest } = obj;
    return await subtle().verify({ name: "Ed25519" }, key, hexToBytes(sig), canonicalBytes(rest));
  } catch { return false; }
}

// ─── Small helpers ────────────────────────────────────────────────────────────────────────

/** Servers emit datetime.utcnow().isoformat() (naive, no zone); treat those as UTC. */
export function parseTs(iso) {
  if (!iso) return null;
  const s = String(iso);
  const d = new Date(/(Z|[+-]\d\d:?\d\d)$/.test(s) ? s : `${s}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function shortTime(iso, now = new Date()) {
  const d = parseTs(iso);
  if (!d) return "";
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86_400_000;
  if (d.getTime() >= startOfToday) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (d.getTime() >= startOfToday - day) return "Yesterday";
  if (d.getTime() >= startOfToday - 6 * day) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function normalizeNodeUrl(input) {
  let s = String(input || "").trim();
  if (!s) throw new Error("Enter a node URL");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `http://${s}`;
  const u = new URL(s);
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Node URL must be http(s)");
  return `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
}

const shortId = (id) => (String(id || "").startsWith("ent:") ? `ent:${String(id).slice(4, 10)}…` : String(id || "").slice(0, 10));

/** Content bodies are a string (plain posts) or an object (`{text}` for DMs, structured posts). */
export function bodyText(body) {
  if (body === null || body === undefined) return "";
  if (typeof body === "string") return body;
  if (typeof body === "object") return typeof body.text === "string" ? body.text : typeof body.content === "string" ? body.content : JSON.stringify(body);
  return String(body);
}

// ─── Moderation labels (attestations) ─────────────────────────────────────────────────────

/** AttestationType in protocol.py. `tone` drives the badge colour; `hide` types fold the message by default. */
export const LABEL_TYPES = {
  spam: { tone: "bad", text: "Spam", hide: true },
  nsfw: { tone: "bad", text: "NSFW", hide: true },
  harassment: { tone: "bad", text: "Harassment", hide: true },
  misleading: { tone: "warn", text: "Misleading", hide: false },
  verified: { tone: "ok", text: "Verified", hide: false },
  trusted: { tone: "ok", text: "Trusted", hide: false },
  bot: { tone: "info", text: "Bot", hide: false },
};
export const MESSAGE_LABELS = ["spam", "nsfw", "misleading", "harassment"];

export function normalizeLabel(raw) {
  const type = String(raw?.type || "");
  let claim = raw?.claim;
  if (typeof claim === "string") { try { claim = JSON.parse(claim); } catch { claim = {}; } }
  return { id: raw?.id || `${raw?.issuer}:${type}`, type, issuer: raw?.issuer || "", claim: claim && typeof claim === "object" ? claim : {}, confidence: raw?.confidence ?? 1, revoked: Boolean(raw?.revoked) };
}

// ─── Normalisation of node payloads ───────────────────────────────────────────────────────

export function normalizeEntity(raw) {
  const profile = raw?.profile && typeof raw.profile === "object" ? raw.profile : {};
  const id = raw?.id || raw?.entity_id || "";
  const handle = raw?.handle || null;
  const kind = raw?.kind || "user";
  return {
    id, handle, kind, profile,
    name: profile.name || (handle ? `@${handle}` : shortId(id)),
    agent: kind === "bot" || profile.agent === true || profile.kind === "agent",
    bio: profile.bio || "",
    encryptionKey: raw?.encryption_key || null,
  };
}

export function normalizeContent(raw) {
  const profile = raw?.author_profile && typeof raw.author_profile === "object" ? raw.author_profile : {};
  const handle = raw?.author_handle || null;
  return {
    id: raw?.id,
    author: raw?.author,
    authorHandle: handle,
    authorName: raw?.author_name || profile.name || (handle ? `@${handle}` : null),
    authorAgent: profile.agent === true || profile.kind === "agent",
    kind: raw?.kind || "post",
    body: bodyText(raw?.body),
    replyTo: raw?.reply_to || null,
    createdAt: raw?.created_at || null,
    likeCount: raw?.like_count || 0,
    likedByMe: Boolean(raw?.liked_by_me),
    groupId: raw?.group_id || null,
    replyCount: raw?.reply_count || 0,
    labels: (raw?.moderation_labels || []).map(normalizeLabel),
    media: Array.isArray(raw?.media) ? raw.media : [],
  };
}

// ─── MESH node client ────────────────────────────────────────────────────────────────────

export class MeshError extends Error {
  constructor(message, { status = 0, detail = "" } = {}) {
    super(message);
    this.name = "MeshError";
    this.status = status;
    this.detail = detail;
  }
}

export function normalizeGroup(raw) {
  const profile = raw?.profile && typeof raw.profile === "object" ? raw.profile : {};
  return {
    id: raw?.id || "",
    name: raw?.name || profile.name || "Untitled group",
    description: raw?.description || profile.description || "",
    owner: raw?.owner || profile.owner || "",
    access: raw?.access || profile.access || "public",
    memberCount: raw?.member_count ?? raw?.memberCount ?? (Array.isArray(raw?.members) ? raw.members.length : 0),
    isMember: Boolean(raw?.is_member ?? raw?.isMember),
  };
}

/**
 * HTTP client for a MESH node. Every path below was checked against the Python servers:
 *   v1.1 (main.py)        v2.0 (server_v2.py)
 * Authenticated calls carry the session token as the `?token=` query parameter (FastAPI `Query`).
 */
export class MeshClient {
  constructor(baseUrl, { fetch: fetchImpl, timeoutMs = 6000, token = "" } = {}) {
    this.baseUrl = normalizeNodeUrl(baseUrl);
    this.fetchImpl = fetchImpl || ((...args) => globalThis.fetch(...args));
    this.timeoutMs = timeoutMs;
    this.token = token;
    this.me = "";
    this.flavor = "v1";
    this.mode = "node";
    this.seen = new Map(); // v2 has no replies endpoint; replies are derived from everything fetched
    this.caps = capsFor("v1");
    this.onAuthExpired = null; // async () => boolean: re-run the challenge flow when the node forgot our session
    this.onNetworkError = null; // () => void: a request could not reach the node at all (fetch threw)
    this.onReachable = null; // () => void: the node answered a request (any HTTP status)
  }

  /**
   * Cheap health check: GET /.well-known/mesh-node (the same endpoint used to connect). Resolves true when the node answers
   * with a 2xx, false otherwise. Never throws and never fires the request hooks. A browser cannot read a CORS-less HTTP 500,
   * so this is how the app tells "node is down" from "node is up but a particular request failed".
   */
  async probe() {
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), Math.min(this.timeoutMs, 4000)) : 0;
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/.well-known/mesh-node`, { method: "GET", headers: {}, signal: ctl?.signal });
      return Boolean(res && res.ok);
    } catch { return false; } finally { clearTimeout(timer); }
  }

  get signedIn() { return Boolean(this.token && this.me); }

  /** `auth: true` requires a session token; `auth: "optional"` attaches one when we have it (GET /api/groups/{id}). */
  async request(method, path, { query = {}, body, auth = false, retried = false } = {}) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") params.set(k, String(v)); });
    if (auth === true && !this.token) throw new MeshError("Sign in to do that", { status: 401 });
    if (auth && this.token) params.set("token", this.token);
    const qs = params.toString();
    const url = `${this.baseUrl}${path}${qs ? `?${qs}` : ""}`;
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), this.timeoutMs) : 0;
    let res;
    try {
      res = await this.fetchImpl(url, { method, headers: body === undefined ? {} : { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl?.signal });
    } catch (err) {
      const failure = new MeshError(err?.name === "AbortError" ? `No answer from ${this.baseUrl}` : `Cannot reach ${this.baseUrl}`, { detail: String(err?.message || err) });
      failure.network = true; // fetch threw: no HTTP status could be read (node down, blocked, or a CORS-less error response)
      try { this.onNetworkError?.(failure); } catch { /* observer errors never mask the request error */ }
      throw failure;
    } finally { clearTimeout(timer); }
    try { this.onReachable?.(); } catch { /* observer only */ }
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) {
      if (res.status === 401 && auth === true && !retried && this.onAuthExpired) {
        let renewed = false;
        try { renewed = await this.onAuthExpired(); } catch { renewed = false; }
        if (renewed) return this.request(method, path, { query, body, auth, retried: true });
      }
      const detail = typeof data?.detail === "string" ? data.detail : data?.detail ? JSON.stringify(data.detail) : "";
      throw new MeshError(detail || `Node answered ${res.status}`, { status: res.status, detail });
    }
    return data;
  }

  /** GET /.well-known/mesh-node -> { node_id, node_url, protocol_version, features } (both servers). */
  async info() {
    const d = await this.request("GET", "/.well-known/mesh-node");
    if (!d || typeof d !== "object" || !d.node_id) throw new MeshError("Not a MESH node (no /.well-known/mesh-node)");
    this.flavor = String(d.protocol_version || "").startsWith("2") ? "v2" : "v1";
    this.caps = capsFor(this.flavor);
    return { nodeId: d.node_id, nodeUrl: d.node_url, protocolVersion: String(d.protocol_version || ""), features: d.features || [], flavor: this.flavor };
  }

  /**
   * POST /api/entities {public_key, encryption_key?, handle?, profile} -> {id, handle}.
   * 409 when the entity exists ("Entity already exists" / "Entity exists") or the handle is taken ("Handle already taken" / "Handle taken").
   * Neither server accepts `kind`; entities always register as kind "user" (agents are marked by profile.agent).
   */
  async createEntity({ publicKeyHex, encryptionKeyHex, handle, profile = {} }) {
    return this.request("POST", "/api/entities", { body: { public_key: publicKeyHex, encryption_key: encryptionKeyHex || null, handle: handle || null, profile } });
  }

  /** v1.1 only: PUT /api/entities/{id} with the bare profile dict as the body (replaces the stored profile). Auth: own id. */
  async updateProfile(profile) {
    if (!this.caps.profileEdit) throw new MeshError("This node has no profile update endpoint");
    return this.request("PUT", `/api/entities/${encodeURIComponent(this.me)}`, { body: profile, auth: true });
  }

  /** POST /api/auth/challenge {entity_id} -> {challenge}; sign the challenge text; POST /api/auth/verify -> {token}. */
  async signIn(identity) {
    const ch = await this.request("POST", "/api/auth/challenge", { body: { entity_id: identity.entityId } });
    const signature = await identity.sign(ch.challenge);
    const res = await this.request("POST", "/api/auth/verify", { body: { entity_id: identity.entityId, challenge: ch.challenge, signature } });
    this.token = res.token;
    this.me = identity.entityId;
    return { token: res.token, expiresAt: res.expires_at || null };
  }

  useSession(token, entityId) { this.token = token; this.me = entityId; }

  /** POST /api/auth/logout (v1.1 only). */
  async signOut() {
    if (this.flavor === "v1" && this.token) await this.request("POST", "/api/auth/logout", { auth: true }).catch(() => {});
    this.token = ""; this.me = "";
  }

  /** GET /api/entities/{id} -> Entity.to_dict() */
  async entity(id) { return normalizeEntity(await this.request("GET", `/api/entities/${encodeURIComponent(id)}`)); }

  /** Entity id directly, or a handle via GET /api/entities/by-handle/{handle} (v1.1 only). */
  async lookup(query) {
    const q = String(query || "").trim().replace(/^@/, "");
    if (!q) throw new MeshError("Enter an entity id or handle");
    if (q.startsWith("ent:")) return this.entity(q);
    if (this.flavor === "v2") throw new MeshError("This node cannot look up handles; paste an entity id (ent:…)");
    return normalizeEntity(await this.request("GET", `/api/entities/by-handle/${encodeURIComponent(q)}`));
  }

  remember(items) { items.forEach((m) => { if (m.id) this.seen.set(m.id, m); }); return items; }

  /** v1.1: GET /api/users/{me}/feed?labels=true (home_timeline view). v2: GET /api/feed?token=. */
  async feedFollowing(limit = 50) {
    if (this.flavor === "v2") {
      const d = await this.request("GET", "/api/feed", { query: { limit }, auth: true });
      return this.remember((d.items || []).map(normalizeContent)).reverse();
    }
    if (!this.me) throw new MeshError("Sign in to see the accounts you follow", { status: 401 });
    const d = await this.request("GET", `/api/users/${encodeURIComponent(this.me)}/feed`, { query: { limit, labels: "true" } });
    return this.remember((d.items || []).map(normalizeContent)).reverse();
  }

  /** v1.1: GET /api/content (public, top-level). v2 has no global listing. */
  async feedGlobal(limit = 50) {
    if (!this.caps.globalFeed) throw new MeshError("This node has no global feed endpoint");
    const d = await this.request("GET", "/api/content", { query: { limit } });
    return this.remember((d.items || []).map(normalizeContent)).reverse();
  }

  /** v1.1: GET /api/content?author=; v2: GET /api/timeline/{entity_id}. */
  async timeline(entityId, limit = 50) {
    const d = this.flavor === "v2"
      ? await this.request("GET", `/api/timeline/${encodeURIComponent(entityId)}`, { query: { limit } })
      : await this.request("GET", "/api/content", { query: { author: entityId, limit } });
    return this.remember((d.items || []).map(normalizeContent)).reverse();
  }

  /** v1.1: GET /api/content?reply_to=<id>[&group_id=] (group replies are only listed with group_id). v2: derived from already-fetched items (no endpoint). */
  async replies(contentId, { groupId = null } = {}) {
    if (this.flavor === "v2") return [...this.seen.values()].filter((m) => m.replyTo === contentId).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    const d = await this.request("GET", "/api/content", { query: { reply_to: contentId, group_id: groupId, limit: 100 } });
    return this.remember((d.items || []).map(normalizeContent)).reverse();
  }

  /**
   * v1.1: POST /api/content {kind: post|reply, body, reply_to, access: public|group, group_id?} -> {id}
   *       (ContentCreate also has `media`, but create_content never stores it, so it is not sent.)
   * v2:   POST /api/content {author, kind, body, media:[str], reply_to} -> {id}. v2 ContentKind has no "reply",
   *       so replies are posts with reply_to. Neither server has a title or tags field.
   */
  async post(text, { replyTo = null, groupId = null, media = [] } = {}) {
    if (this.flavor === "v2") {
      if (groupId) throw new MeshError("This node has no groups");
      return this.request("POST", "/api/content", { body: { author: this.me, kind: "post", body: text, media, reply_to: replyTo }, auth: true });
    }
    const body = { kind: replyTo ? "reply" : "post", body: text, reply_to: replyTo, access: groupId ? "group" : "public" };
    if (groupId) body.group_id = groupId;
    return this.request("POST", "/api/content", { body, auth: true });
  }

  /** v1.1 only: DELETE /api/content/{id} (author only, 403 otherwise). v2.0 has no delete or edit endpoint. */
  async deleteContent(contentId) {
    if (!this.caps.deleteContent) throw new MeshError("This node has no delete endpoint");
    return this.request("DELETE", `/api/content/${encodeURIComponent(contentId)}`, { auth: true });
  }

  /** v1.1: GET /api/messages/conversations. v2 has no DM read endpoint (DMs are stored encrypted). */
  async conversations() {
    if (!this.caps.dmRead) return [];
    const d = await this.request("GET", "/api/messages/conversations", { auth: true });
    return (d.conversations || []).map((c) => ({ id: c.participantId, handle: c.participantHandle, name: c.participantName, last: c.lastMessage || "", lastAt: c.lastMessageAt }));
  }

  /** v1.1: GET /api/messages/{participant_id} -> {messages: [{id, senderId, content, timestamp}]} */
  async messages(participantId) {
    if (!this.caps.dmRead) return [];
    const d = await this.request("GET", `/api/messages/${encodeURIComponent(participantId)}`, { auth: true });
    return (d.messages || []).map((m) => ({ id: m.id, author: m.senderId, authorHandle: null, authorName: null, authorAgent: false, kind: "dm", body: bodyText(m.content), replyTo: null, createdAt: m.timestamp, likeCount: 0, replyCount: 0, labels: [], media: [] }));
  }

  /**
   * v1.1: POST /api/messages {recipient_id, content} (stored in plaintext; `encrypted` is only a flag).
   * v2:   POST /api/dm {author, recipient, body}; the node encrypts to the recipient's published X25519 `encryption_key`
   *       and answers 400 "Recipient doesn't support E2EE" when it is missing.
   */
  async sendDm(participantId, text) {
    if (this.flavor === "v2") {
      try {
        return await this.request("POST", "/api/dm", { body: { author: this.me, recipient: participantId, body: text }, auth: true });
      } catch (err) {
        if (err.status === 400 && /E2EE/i.test(err.message)) throw new MeshError("That member has not published an encryption key (or does not exist), so this node cannot deliver an end-to-end encrypted message to them.", { status: 400, detail: err.detail });
        throw err;
      }
    }
    return this.request("POST", "/api/messages", { body: { recipient_id: participantId, content: text }, auth: true });
  }

  /**
   * POST /api/links {target, kind, data|metadata}. kinds used here: follow, like (both nodes), repost (v2 LinkKind only).
   * v1.1 answers 409 "Link already exists" when it is already active.
   */
  async link(kind, targetId) {
    try {
      return await this.request("POST", "/api/links", { body: this.flavor === "v2" ? { target: targetId, kind, metadata: {} } : { target: targetId, kind, data: {} }, auth: true });
    } catch (err) {
      if (err.status === 409) return { id: await linkIdFor(this.me, kind, targetId) };
      throw err;
    }
  }

  /** v1.1: DELETE /api/links/{link_id} (link_id = sha256("me:kind:target")[:32]; 404 = nothing to remove). v2: DELETE /api/links?target=&kind=. */
  async unlink(kind, targetId) {
    if (this.flavor === "v2") return this.request("DELETE", "/api/links", { query: { target: targetId, kind }, auth: true });
    try {
      return await this.request("DELETE", `/api/links/${await linkIdFor(this.me, kind, targetId)}`, { auth: true });
    } catch (err) {
      if (err.status === 404) return { status: "deleted" };
      throw err;
    }
  }

  follow(targetId) { return this.link("follow", targetId); }
  unfollow(targetId) { return this.unlink("follow", targetId); }

  /** v1.1: GET /api/users/{id}/following -> {items:[{id,handle,profile}]}. v2 has no listing (the app keeps a local list). */
  async following() {
    if (this.flavor === "v2" || !this.me) return [];
    const d = await this.request("GET", `/api/users/${encodeURIComponent(this.me)}/following`);
    return (d.items || []).map(normalizeEntity);
  }

  /** v1.1 groups (main.py; the v1.1 spec defers the social layer, so these are the node's own endpoints). */
  async groups(limit = 50) {
    if (!this.caps.groups) return [];
    const d = await this.request("GET", "/api/groups", { query: { limit } });
    return (d.items || []).map(normalizeGroup);
  }

  async group(groupId) {
    return normalizeGroup(await this.request("GET", `/api/groups/${encodeURIComponent(groupId)}`, { auth: "optional" }));
  }

  /** POST /api/groups {name, description, access: public|private} -> {id, name}; the creator becomes owner and member. */
  async createGroup({ name, description = "", access = "public" }) {
    if (!this.caps.groups) throw new MeshError("This node has no groups");
    return this.request("POST", "/api/groups", { body: { name, description, access }, auth: true });
  }

  /** POST /api/groups/{id}/join (403 for private groups) and /leave. */
  joinGroup(groupId) { return this.request("POST", `/api/groups/${encodeURIComponent(groupId)}/join`, { auth: true }); }
  leaveGroup(groupId) { return this.request("POST", `/api/groups/${encodeURIComponent(groupId)}/leave`, { auth: true }); }

  /** GET /api/content?group_id= (top-level group posts). */
  async groupFeed(groupId, limit = 50) {
    const d = await this.request("GET", "/api/content", { query: { group_id: groupId, limit } });
    return this.remember((d.items || []).map(normalizeContent)).reverse();
  }

  /** v2: GET /api/subjects/{subject}/labels?viewer=<me> -> {labels:[Attestation], resolution}. v1.1 labels ride on feed items. */
  async labels(subjects) {
    const out = new Map();
    if (!this.caps.labelRead) return out;
    await Promise.all(subjects.map(async (s) => {
      try {
        const d = await this.request("GET", `/api/subjects/${encodeURIComponent(s)}/labels`, { query: { viewer: this.me } });
        out.set(s, (d.labels || []).map(normalizeLabel).filter((l) => !l.revoked));
      } catch { /* labels are best-effort */ }
    }));
    return out;
  }

  /**
   * v2: POST /api/attestations {subject, type, claim, evidence, confidence}; the id is sha256("issuer:subject:type")[:32],
   * so labelling the same subject with the same type again replaces your earlier label. There is no revoke endpoint.
   */
  async attest(subject, type, claim = {}, confidence = 1.0) {
    if (!this.caps.labelWrite) throw new MeshError("This node does not accept attestations");
    return this.request("POST", "/api/attestations", { body: { subject, type, claim, evidence: null, confidence }, auth: true });
  }

  /** v2: GET /api/sync/{actor}/heads -> {actor, heads:[event ids]} (multi-head DAG). */
  async heads(actor) {
    if (this.flavor !== "v2") return null;
    const d = await this.request("GET", `/api/sync/${encodeURIComponent(actor)}/heads`);
    return d.heads || [];
  }
}

function capsFor(flavor) {
  const v2 = flavor === "v2";
  return {
    globalFeed: !v2, dmRead: !v2, dmSend: true, dmNeedsEncryptionKey: v2, labelRead: v2, labelWrite: v2, feedNeedsAuth: v2, handleLookup: !v2, replies: true,
    profileEdit: !v2, deleteContent: !v2, groups: !v2, like: true, repost: v2, media: v2,
  };
}

// ─── Demo node: the same interface, in memory ─────────────────────────────────────────────

const DEMO_ME = "ent:demo00000000000000000000000000";
const DEMO_GROUP = "grp:lobby00000000000000000000000000";
const DEMO_ENTITIES = [
  { id: DEMO_ME, handle: "you", kind: "user", profile: { name: "You" } },
  { id: "ent:ada00000000000000000000000000000", handle: "ada", kind: "user", profile: { name: "Ada Lovelace", bio: "Protocol nerd." } },
  { id: "ent:lin00000000000000000000000000000", handle: "lin", kind: "user", profile: { name: "Lin Wei", bio: "Runs the relay." } },
  { id: "ent:atlas000000000000000000000000000", handle: "atlas", kind: "bot", profile: { name: "Atlas", bio: "Conductor agent.", agent: true } },
  { id: "ent:nova0000000000000000000000000000", handle: "nova", kind: "bot", profile: { name: "Nova", bio: "Scout agent.", agent: true } },
  { id: "ent:sentinel00000000000000000000000", handle: "sentinel", kind: "bot", profile: { name: "Sentinel", bio: "Labeler: composes moderation attestations.", agent: true } },
];

/** An in-memory node with sample people, agents, replies, groups and moderation labels. It mirrors the v1.1 behaviour. */
export function createDemoClient(now = Date.now()) {
  const ago = (min) => new Date(now - min * 60_000).toISOString();
  const [, ada, lin, atlas, nova, sentinel] = DEMO_ENTITIES.map((e) => e.id);
  const entities = new Map(DEMO_ENTITIES.map((e) => [e.id, normalizeEntity(e)]));
  let meId = DEMO_ME;
  let token = "demo";
  let seq = 0;
  const blank = { authorHandle: null, authorName: null, authorAgent: false, likeCount: 0, likedByMe: false, replyCount: 0, labels: [], media: [], groupId: null };
  const mk = (author, body, minutes, replyTo = null, groupId = null) => {
    seq += 1;
    return { ...blank, id: `demo-c${seq}`, author, kind: replyTo ? "reply" : "post", body, replyTo, createdAt: ago(minutes), groupId };
  };
  const content = [];
  const first = mk(ada, "Welcome to **MESH**. Every message here is content in a signed DAG, and every member is an Ed25519 identity.", 190);
  const q = mk(lin, "Does the feed order depend on who is asking?", 120);
  const spam = mk(nova, "BUY NOW!!! limited offer http://example.com/free", 90);
  const tips = mk(atlas, "Three things I can do for you:\n\n- Summarise the **global feed**\n- Draft a reply\n- Label spam with `spam`\n\n```js\nawait mesh.post('hi')\n```", 60);
  content.push(first, q, spam, tips,
    mk(ada, "No: feeds are deterministic views over the DAG, so the same inputs give the same order.", 110, q.id),
    mk(sentinel, "Spam from a bot account, labeling it for everyone who trusts me.", 85, spam.id),
    mk(lin, "Nice. Moderation as attestations means I choose which labelers to trust.", 40),
    mk(lin, "Welcome to the lobby. Say hi and tell us what you are building.", 70, null, DEMO_GROUP));
  const labels = new Map([
    [spam.id, [{ id: "att-1", type: "spam", issuer: sentinel, claim: { reason: "unsolicited link" }, confidence: 0.97, revoked: false }]],
    [q.id, []],
    [ada, [{ id: "att-2", type: "verified", issuer: sentinel, claim: {}, confidence: 1, revoked: false }]],
    [atlas, [{ id: "att-3", type: "bot", issuer: sentinel, claim: {}, confidence: 1, revoked: false }]],
    [nova, [{ id: "att-4", type: "bot", issuer: sentinel, claim: {}, confidence: 1, revoked: false }]],
  ]);
  const links = new Set(); // "source|kind|target"
  [ada, lin, atlas].forEach((t) => links.add(`${DEMO_ME}|follow|${t}`));
  const hasLink = (s, k, t) => links.has(`${s}|${k}|${t}`);
  const targetsOf = (s, k) => [...links].map((l) => l.split("|")).filter(([a, b]) => a === s && b === k).map(([, , t]) => t);
  const groups = new Map([[DEMO_GROUP, { id: DEMO_GROUP, name: "Demo lobby", description: "Open room for everyone on this demo node.", owner: lin, access: "public", members: new Set([lin, ada]) }]]);
  const dms = [{ id: "demo-d1", author: atlas, to: DEMO_ME, body: "Hi! I am Atlas. Ask me to **summarise** anything.", createdAt: ago(30) }];
  const dmItem = (m) => ({ ...blank, id: m.id, author: m.author, kind: "dm", body: m.body, replyTo: null, createdAt: m.createdAt });
  const likeCount = (id) => [...links].filter((l) => l.endsWith(`|like|${id}`)).length;
  const withCounts = (m) => ({ ...m, labels: labels.get(m.id) || [], replyCount: content.filter((c) => c.replyTo === m.id).length, likeCount: likeCount(m.id), likedByMe: hasLink(meId, "like", m.id) });
  const byTime = (a, b) => String(a.createdAt).localeCompare(String(b.createdAt));
  const groupView = (g) => ({ id: g.id, name: g.name, description: g.description, owner: g.owner, access: g.access, memberCount: g.members.size, isMember: g.members.has(meId) });

  return {
    mode: "demo", flavor: "demo",
    get token() { return token; },
    get me() { return meId; },
    get signedIn() { return Boolean(token); },
    caps: { globalFeed: true, dmRead: true, dmSend: true, dmNeedsEncryptionKey: false, labelRead: true, labelWrite: true, feedNeedsAuth: false, handleLookup: true, replies: true, profileEdit: true, deleteContent: true, groups: true, like: true, repost: true, media: true },
    onAuthExpired: null,
    async info() { return { nodeId: "demo-node", nodeUrl: "memory://demo", protocolVersion: "demo", features: ["dag", "attestations", "views", "groups"], flavor: "demo" }; },
    async entity(id) { const e = entities.get(id); if (!e) throw new MeshError("Entity not found", { status: 404 }); return e; },
    async lookup(query) {
      const q2 = String(query || "").trim().replace(/^@/, "");
      if (!q2) throw new MeshError("Enter an entity id or handle");
      const e = [...entities.values()].find((x) => x.id === q2 || x.handle === q2);
      if (!e) throw new MeshError("Entity not found", { status: 404 });
      return e;
    },
    /** Same contract as POST /api/entities, including the 409 messages of main.py. */
    async createEntity({ publicKeyHex, encryptionKeyHex, handle, profile = {} }) {
      const id = await entityIdFor(hexToBytes(publicKeyHex));
      if (entities.has(id)) throw new MeshError("Entity already exists", { status: 409 });
      if (handle && [...entities.values()].some((e) => e.handle === handle)) throw new MeshError("Handle already taken", { status: 409 });
      entities.set(id, normalizeEntity({ id, kind: "user", handle: handle || null, profile, encryption_key: encryptionKeyHex || null }));
      return { id, handle: handle || null };
    },
    async updateProfile(profile) {
      const e = entities.get(meId);
      entities.set(meId, normalizeEntity({ id: meId, kind: e.kind, handle: e.handle, profile, encryption_key: e.encryptionKey }));
      return { status: "updated" };
    },
    async signIn(identity) {
      if (!entities.has(identity.entityId)) throw new MeshError("Entity not found", { status: 404 });
      meId = identity.entityId; token = "demo";
      return { token: "demo" };
    },
    useSession(t, id) { if (id) { meId = id; token = t || "demo"; } else { meId = DEMO_ME; token = "demo"; } },
    async signOut() { token = ""; },
    async feedFollowing() {
      const mine = new Set([...targetsOf(meId, "follow"), meId]);
      return content.filter((c) => !c.replyTo && !c.groupId && mine.has(c.author)).map(withCounts).sort(byTime);
    },
    async feedGlobal() { return content.filter((c) => !c.replyTo && !c.groupId).map(withCounts).sort(byTime); },
    async timeline(id) { return content.filter((c) => c.author === id && !c.groupId).map(withCounts).sort(byTime); },
    async replies(id) { return content.filter((c) => c.replyTo === id).map(withCounts).sort(byTime); },
    async post(text, { replyTo = null, groupId = null, media = [] } = {}) {
      if (groupId) {
        const g = groups.get(groupId);
        if (!g) throw new MeshError("Group not found", { status: 404 });
        if (!g.members.has(meId)) throw new MeshError("Must be a group member to post here", { status: 403 });
      }
      seq += 1;
      const e = entities.get(meId);
      const m = { ...blank, id: `demo-c${seq}`, author: meId, authorHandle: e?.handle || null, authorName: e?.name || null, kind: replyTo ? "reply" : "post", body: text, replyTo, createdAt: new Date().toISOString(), media: [...media], groupId };
      content.push(m);
      return { id: m.id };
    },
    async deleteContent(id) {
      const i = content.findIndex((c) => c.id === id);
      if (i < 0) throw new MeshError("Content not found", { status: 404 });
      if (content[i].author !== meId) throw new MeshError("Can only delete your own content", { status: 403 });
      content.splice(i, 1);
      return { status: "deleted" };
    },
    async conversations() {
      const peers = new Map();
      dms.filter((m) => m.author === meId || m.to === meId).forEach((m) => { const p = m.author === meId ? m.to : m.author; if (!peers.has(p) || peers.get(p).createdAt < m.createdAt) peers.set(p, m); });
      return [...peers.entries()].map(([id, m]) => ({ id, handle: entities.get(id)?.handle, name: entities.get(id)?.name, last: m.body.slice(0, 50), lastAt: m.createdAt }));
    },
    async messages(id) { return dms.filter((m) => (m.author === meId && m.to === id) || (m.author === id && m.to === meId)).sort(byTime).map(dmItem); },
    async sendDm(id, text) {
      if (!entities.has(id)) throw new MeshError("Recipient not found", { status: 404 });
      seq += 1;
      dms.push({ id: `demo-d${seq}`, author: meId, to: id, body: text, createdAt: new Date().toISOString() });
      return { id: `demo-d${seq}`, status: "sent" };
    },
    async link(kind, id) { links.add(`${meId}|${kind}|${id}`); return { id: await linkIdFor(meId, kind, id) }; },
    async unlink(kind, id) { links.delete(`${meId}|${kind}|${id}`); return { status: "deleted" }; },
    follow(id) { return this.link("follow", id); },
    unfollow(id) { return this.unlink("follow", id); },
    async following() { return targetsOf(meId, "follow").map((id) => entities.get(id)).filter(Boolean); },
    async groups() { return [...groups.values()].filter((g) => g.access === "public" || g.members.has(meId)).map(groupView); },
    async group(id) { const g = groups.get(id); if (!g) throw new MeshError("Group not found", { status: 404 }); return groupView(g); },
    async createGroup({ name, description = "", access = "public" }) {
      const id = `grp:${(await sha256Hex(`${meId}:${name}:${seq}:${Date.now()}`)).slice(0, 32)}`;
      groups.set(id, { id, name, description, owner: meId, access, members: new Set([meId]) });
      return { id, name };
    },
    async joinGroup(id) {
      const g = groups.get(id);
      if (!g) throw new MeshError("Group not found", { status: 404 });
      if (g.access === "private") throw new MeshError("This is a private group. Request an invite.", { status: 403 });
      g.members.add(meId);
      return { status: "joined" };
    },
    async leaveGroup(id) { groups.get(id)?.members.delete(meId); return { status: "left" }; },
    async groupFeed(id) { return content.filter((c) => c.groupId === id && !c.replyTo).map(withCounts).sort(byTime); },
    async labels(subjects) { return new Map(subjects.map((s) => [s, labels.get(s) || []])); },
    async attest(subject, type, claim = {}, confidence = 1) {
      const list = (labels.get(subject) || []).filter((l) => !(l.issuer === meId && l.type === type));
      list.push({ id: `att-${seq += 1}`, type, issuer: meId, claim, confidence, revoked: false });
      labels.set(subject, list);
      return { id: await attestationIdFor(meId, subject, type) };
    },
    async heads() { return ["demo-head"]; },
    entities: () => [...entities.values()],
  };
}

// ─── Markdown: built as DOM, never as HTML ────────────────────────────────────────────────

const SAFE_URL = /^(https?:\/\/|mailto:)/i;
const HTTP_URL = /^https?:\/\//i;
let urlPolicy = SAFE_URL; // set per renderMarkdown call; the docs reader allows http(s) only
const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*|__[^_\n]+__)|(~~[^~\n]+~~)|(\[[^\]\n]+\]\([^)\s]+\))|(\bhttps?:\/\/[^\s<>)]+[^\s<>).,;:!?])|(\*[^*\s][^*\n]*\*|_[^_\s][^_\n]*_)/g;

export function renderInline(parent, source) {
  let last = 0;
  const textOf = (t) => document.createTextNode(t);
  for (const m of source.matchAll(INLINE)) {
    if (m.index > last) parent.append(textOf(source.slice(last, m.index)));
    const [whole] = m;
    if (m[1]) { const c = document.createElement("code"); c.textContent = whole.slice(1, -1); parent.append(c); }
    else if (m[2]) { const b = document.createElement("strong"); renderInline(b, whole.slice(2, -2)); parent.append(b); }
    else if (m[3]) { const d = document.createElement("del"); renderInline(d, whole.slice(2, -2)); parent.append(d); }
    else if (m[4]) {
      const [, label, url] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(whole);
      if (urlPolicy.test(url)) { const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; renderInline(a, label); parent.append(a); }
      else parent.append(textOf(label));
    } else if (m[5]) { const a = document.createElement("a"); a.href = whole; a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = whole; parent.append(a); }
    else { const i = document.createElement("em"); renderInline(i, whole.slice(1, -1)); parent.append(i); }
    last = m.index + whole.length;
  }
  if (last < source.length) parent.append(textOf(source.slice(last)));
}

const FENCE_OPEN = /^\s*```\s*([\w+#.-]*)\s*$/;
const BULLET = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

function codeBlock(lang, lines) {
  const wrap = document.createElement("div");
  wrap.className = "mdcode";
  const bar = document.createElement("div");
  bar.className = "mdcodebar";
  const label = document.createElement("span");
  label.textContent = lang || "text";
  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "Copy";
  copy.addEventListener("click", () => {
    navigator.clipboard?.writeText(lines.join("\n")).then(() => { copy.textContent = "Copied"; setTimeout(() => { copy.textContent = "Copy"; }, 1200); }).catch(() => {});
  });
  bar.append(label, copy);
  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.textContent = lines.join("\n");
  pre.append(code);
  wrap.append(bar, pre);
  return wrap;
}

function listBlock(items) {
  const root = document.createElement(items[0].ordered ? "ol" : "ul");
  const stack = [{ indent: items[0].indent, list: root }];
  items.forEach((it) => {
    while (stack.length > 1 && it.indent < stack.at(-1).indent) stack.pop();
    let top = stack.at(-1);
    if (it.indent > top.indent) {
      const parentLi = top.list.lastElementChild;
      const sub = document.createElement(it.ordered ? "ol" : "ul");
      (parentLi || top.list).append(sub);
      top = { indent: it.indent, list: sub };
      stack.push(top);
    }
    const li = document.createElement("li");
    renderInline(li, it.text);
    top.list.append(li);
  });
  return root;
}

function tableBlock(rows) {
  const split = (line) => line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
  const table = document.createElement("table");
  const head = document.createElement("thead");
  const hr = document.createElement("tr");
  split(rows[0]).forEach((c) => { const th = document.createElement("th"); renderInline(th, c); hr.append(th); });
  head.append(hr);
  const body = document.createElement("tbody");
  rows.slice(2).forEach((line) => {
    const tr = document.createElement("tr");
    split(line).forEach((c) => { const td = document.createElement("td"); renderInline(td, c); tr.append(td); });
    body.append(tr);
  });
  table.append(head, body);
  const wrap = document.createElement("div");
  wrap.className = "mdtable";
  wrap.append(table);
  return wrap;
}

/** Renders Markdown to DOM nodes (never HTML). `httpOnly` limits links to http(s); the default also allows mailto:. */
export function renderMarkdown(source, { httpOnly = false } = {}) {
  const previous = urlPolicy;
  urlPolicy = httpOnly ? HTTP_URL : SAFE_URL;
  try { return buildMarkdown(source); } finally { urlPolicy = previous; }
}

function buildMarkdown(source) {
  const root = document.createElement("div");
  root.className = "md";
  const lines = String(source || "").replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  let para = [];
  const flush = () => {
    if (!para.length) return;
    const p = document.createElement("p");
    para.forEach((line, n) => { if (n) p.append(document.createElement("br")); renderInline(p, line); });
    root.append(p);
    para = [];
  };
  while (i < lines.length) {
    const line = lines[i];
    const open = FENCE_OPEN.exec(line);
    if (open) {
      flush();
      const code = [];
      i += 1;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { code.push(lines[i]); i += 1; }
      i += 1;
      root.append(codeBlock(open[1], code));
      continue;
    }
    if (!line.trim()) { flush(); i += 1; continue; }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) { flush(); const h = document.createElement(`h${Math.min(heading[1].length + 2, 6)}`); renderInline(h, heading[2]); root.append(h); i += 1; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); root.append(document.createElement("hr")); i += 1; continue; }
    if (/^\s*>/.test(line)) {
      flush();
      const quote = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { quote.push(lines[i].replace(/^\s*>\s?/, "")); i += 1; }
      const bq = document.createElement("blockquote");
      quote.forEach((qline, n) => { if (n) bq.append(document.createElement("br")); renderInline(bq, qline); });
      root.append(bq);
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
      flush();
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(lines[i]); i += 1; }
      root.append(tableBlock(rows));
      continue;
    }
    if (BULLET.test(line)) {
      flush();
      const items = [];
      while (i < lines.length && (BULLET.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
        const b = BULLET.exec(lines[i]);
        if (b) items.push({ indent: b[1].length, ordered: /\d/.test(b[2]), text: b[3] });
        else items.at(-1).text += ` ${lines[i].trim()}`;
        i += 1;
      }
      root.append(listBlock(items));
      continue;
    }
    para.push(line);
    i += 1;
  }
  flush();
  return root;
}

export function plainText(source) {
  return String(source || "")
    .replace(/```[\s\S]*?(```|$)/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/(\*\*|__|~~)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*([-*+]|\d+[.)])\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

// <docs:generated>
// Generated by scripts/embed-docs.mjs from docs/*.md. Do not edit by hand; run `npm run embed-docs`.
export const DOCS = [
  { id: "index", title: "MESH documentation", markdown: "# MESH documentation\n\n> Authored for this app (not imported). It lists the pages and says which are imported and which are written about this client.\n\nThis reader has two kinds of pages.\n\n| Page | Kind | What it covers |\n|---|---|---|\n| About this implementation | Authored here | What this app is, what works, what is demo, limits, storage, security |\n| How it works | Authored here | Modes, node connection, identity, posting, feeds, groups, DMs, moderation |\n| Getting started with others | Authored here | Run or reach a node, create identities, find and follow people, troubleshooting |\n| MESH protocol: overview | Imported | Layered stack and comparison, from the protocol README |\n| MESH spec v1.1: overview, principles, architecture | Imported | Spec sections 1 to 3 |\n| MESH spec v1.1: privacy, storage and integrity layers | Imported | Spec sections 4 to 6 |\n| MESH spec v1.1: social and moderation layers | Imported | Spec sections 7 and 8 |\n| MESH spec v1.1: view, network and application layers | Imported | Spec sections 9 to 11 |\n| MESH spec v1.1: sync protocol and security model | Imported | Spec sections 15 and 16 |\n\n## Where the protocol pages come from\n\nThe imported pages are copies of text in the MESH protocol repository, `https://github.com/FraterCCCLXIII/mesh-protocol` (released by its authors under CC0 1.0). Each one starts with a `Source:` line giving the file and line range. Some sections of the specification are left out for length (for example multi-device and identity recovery, sections 12 to 14, and the appendices). Read the repository for the whole specification.\n\nThe README of this app links to `https://github.com/holon-protocol/mesh-protocol`. That address did not resolve on GitHub when these docs were written; the local clone used for the import has `FraterCCCLXIII/mesh-protocol` as its remote.\n\n## Reading order\n\n1. About this implementation\n2. How it works\n3. Getting started with others\n4. The protocol pages, in the order of the table above\n\nThe spec describes protocol version 1.1. This app talks to nodes over HTTP, and the node servers it targets are described in the other pages. Where the spec and the node servers differ, the node servers decide what this app can do.\n" },
  { id: "about", title: "About this implementation", markdown: "# About this implementation\n\n> Authored for this app, from reading `extension.js` and `README.md` in the `mesh-hangout` folder. Not imported from the protocol repository.\n\n## What it is\n\nMESH is a Canvas Extension: one self-contained `extension.js` with an embedded stylesheet and no dependencies. It gives the Hangout / Team Chat experience (a channel list, a message thread, a member list) on top of a MESH protocol **node**. It is an HTTP client in your browser. It is not a node, a relay or a peer-to-peer program.\n\nThe mapping from chat ideas to MESH ideas:\n\n| Chat | MESH |\n|---|---|\n| Channel | A feed or a timeline: Following, Global feed, one timeline per entity |\n| Message | Content, with replies through `reply_to` |\n| Member (person or AI agent) | Entity |\n| Moderation | Attestations shown as badges |\n| Direct message | A message to another entity |\n| Group | A node feature of the v1.1 server |\n\n## Two modes\n\n- **Connected.** The app reached a node at the Node URL (default `http://localhost:12000`) and read `/.well-known/mesh-node`. The header shows `Connected` and the node id.\n- **Disconnected.** The same as Connected, but the node stopped answering. The pill says `Disconnected`, a banner says \"Cannot reach ...\" with a Retry node button, and your identity and loaded messages stay on screen. It returns to Connected on the next successful request or retry.\n- **Demo.** Everything is in memory with sample data. **It is ticked by default on a fresh browser** (and the welcome screen and \"Get started\" open in Demo with no hint), so untick it under the gear icon and press Save & reconnect to use a node. It also starts when no node answers. The header says `Demo`. Nothing in Demo mode is sent anywhere, and it resets when you reload.\n\n## What works today\n\n- Create an Ed25519 identity in the browser, register it on a node and sign in with the challenge flow.\n- Post and reply, like, quote, follow and unfollow, find members, send direct messages (sending only: see Known issues for reading).\n- Account shows an **Edit profile** button on both versions. On v2.0 it opens a short notice that the node has no profile update endpoint, so only v1.1 can edit a profile.\n- v1.1 nodes: global feed, groups, delete your own post, edit your profile.\n- v2.0 nodes: boost (repost), media links, attestation labels, end-to-end encrypted DMs (send only).\n\nBetween two people on one node (tested 2026-10-30, separate sessions): identity, find by handle (v1.1) or `ent:` id (v2.0), follow, post, reply, public groups (v1.1). Not working: DMs and private groups (see Known issues). On v2.0, handle search is not supported (paste the `ent:` id) and you will not see someone's reply until you follow its author.\n- Moderation labels as badges, with a per-viewer choice of which labelers to trust. Messages with a `spam`, `nsfw` or `harassment` label are folded until you click Show.\n- Export and import an identity key.\n\n## What is demo or mock\n\n- The demo members Ada, Lin, Atlas, Nova and Sentinel are fixed sample data. Atlas, Nova and Sentinel are marked as agents, but nothing in the code makes them act: they never reply. Sentinel's labels are pre-written sample attestations.\n- The demo node re-creates your stored key's account each time you open it.\n- Live testing: on 2026-10-30 the app was run against a real v1.1 node and a real v2.0 node (through the extension's code with real `fetch`, and through the real DOM). The core flows worked on both; the README's \"Verified and unverified\" section lists exactly what was and was not covered. Request paths are also checked in tests with a mocked `fetch`.\n\n## Limits\n\n- Per-content signatures: the client can sign an object (`signObject`) the way the spec describes, but posts are not signed today. The node servers it targets do not verify content signatures, so the client signs only the sign-in challenge.\n- No federation, relay selection or sync: the app talks to exactly one node at a time.\n- Groups exist only on v1.1 nodes. Delete exists only on v1.1. Boost, media and labels exist only on v2.0.\n- A v2.0 node has no endpoint to list follows, likes, reposts or read DMs, so the app keeps follows, likes and reposts in `localStorage` for that node and identity, and shows only the DMs you send in the current session.\n- Handle (2 to 32 letters, digits, `.`, `-`, `_`), display name (60) and bio (280) limits are client-side rules; the nodes accept any string.\n- Without WebCrypto Ed25519 in the browser you can read but not post. Without X25519 your identity has no encryption key and cannot receive v2.0 DMs.\n- No post editing, titles or tags: the nodes have no such fields.\n\n## Known issues\n\n- **v1.1 node: reading DMs fails with HTTP 500** (`GET /api/messages/conversations` and `GET /api/messages/{id}`, `sqlite3.OperationalError: malformed JSON`, `main.py` around lines 3552 to 3558) for **anyone whose DM partner has ever posted plain text**. The node's DM queries run `json_extract(body, '$.recipient')` over plain-text post rows. So DM reading effectively never works in normal use. Sending works and the node stores the message. This is a bug in the node, not in this app, and the app has no workaround. A suggested node fix (not done here) is to make the DM queries skip non-JSON bodies, for example by guarding with `json_valid(body)`. Because an error response without CORS headers cannot be read by a browser, the app checks the node's info endpoint: if the node answers, you see \"The node is up but could not load this view (it returned an error)\"; if not, \"Cannot reach ...\". A DM you just sent stays on screen marked Sent.\n- **v2.0 node: a DM cannot be received through this app.** DMs can be sent (encrypted) but the node has no read endpoint.\n- **Private groups do not work between people.** The create dialog offers \"Private\", but the node has no invite or add-member endpoint (`main.py` around lines 1842 to 1850 has admin, kick and ban only), so nobody else can join and the group does not appear in other users' rails. The node also returned a non-member the private group's content through `GET /api/content?group_id=`: a privacy hole in the node, to be fixed there.\n- **v2.0 search and replies:** handle search is not supported (paste the `ent:` entity id), and you will not see someone's reply until you follow its author.\n- **v1.1 attestations**: the node answers \"This node does not accept attestations\".\n\n## Not yet verified\n\nTwo people on separate sessions against a real v1.1 node and a real v2.0 node **were** tested on 2026-10-30 (UI level, built-in browser, separate origins, one machine). Not verified: a node reachable from other machines, opening MESH from the Canvas navigation (as opposed to a standalone page), an `https` page calling an `http` node (mixed content), long-running sessions, and DM reading on v2.0 (the node has no read endpoint).\n\n## Dependencies\n\nNone at runtime: browser APIs only (`fetch`, WebCrypto, `localStorage`, DOM). The test tooling needs `vitest` and `jsdom` (`npm test`). The Markdown in messages and in this reader is turned into DOM nodes; page text is never inserted as HTML.\n\n## Storage keys\n\nEverything is kept in `localStorage` under one key, `mesh-hangout:v1`, as JSON:\n\n| Field | Holds |\n|---|---|\n| `nodeUrl`, `forceDemo` | Node URL and the Demo switch |\n| `identity` | `{ jwk, enc, handle, name, bio, agent }`: your private key material and profile |\n| `tokens` | Session token per node URL |\n| `welcomed`, `channel` | Whether the welcome screen is done, and the last open channel |\n| `trusted` | List of trusted labeler ids, or `null` for everyone |\n| `local` | Per node and identity: follows, likes, reposts (v2.0 nodes) |\n| `myGroups` | Group bookkeeping |\n\n## Security notes\n\n- The private key (a JWK with the secret `d` field) lives in `localStorage` in this browser, unencrypted. Anyone or any script with access to this page's storage can read it. The key is not sent to the node; only the public key and signatures are.\n- Export shows the key only after an acknowledgement and a warning. Treat an exported bundle as a password.\n- Session tokens are sent as a `?token=` query parameter, which is how the node servers read them. URLs can end up in logs of the node or of anything between you and the node. Use `https` for any node that is not on your own machine.\n- Message text, names and links are always set as text. Links open in a new tab with `rel=\"noopener noreferrer\"`.\n- A node can see everything on v1.1: DMs there are stored in plaintext (the `encrypted` flag is only a flag). v2.0 encrypts DMs to the recipient's published X25519 key.\n" },
  { id: "how-it-works", title: "How it works", markdown: "# How it works\n\n> Authored for this app, from reading `extension.js`. Not imported from the protocol repository.\n\n## Overview\n\n```\n browser (this app)                                 MESH node (Python, FastAPI)\n┌───────────────────────────┐   HTTP + JSON        ┌───────────────────────────┐\n│ UI (DOM) + state          │ ───────────────────▶ │ /.well-known/mesh-node    │\n│ MeshClient                │ ◀─────────────────── │ /api/entities, /api/auth  │\n│ WebCrypto: Ed25519/X25519 │                      │ /api/content, /api/links  │\n│ localStorage: key, tokens │                      │ /api/messages | /api/dm   │\n└───────────────────────────┘                      └───────────────────────────┘\n        │  no node reachable, or Demo switched on\n        ▼\n in-memory Demo client (same interface, sample data)\n```\n\nThe UI talks to a client object. There are two with the same methods: `MeshClient` (HTTP) and the Demo client (in memory). That is why every flow works in both modes.\n\n## Connecting\n\n1. On open, the app builds a `MeshClient` for the saved Node URL and calls `GET /.well-known/mesh-node`.\n2. The answer must contain `node_id`. `protocol_version` starting with `2` selects **v2.0** behavior; anything else is treated as **v1.1**. The app then knows which endpoints exist.\n3. If the call fails or times out (6 seconds), the app enters Demo mode and says why in a notice, with a \"Retry node\" button. Retry node replaces the Demo members and data with the node's.\n4. Once connected, if the node stops answering the pill changes to `Disconnected`, the banner says \"Cannot reach ...\" with Retry node, and the app does not fall back to Demo: your identity and the messages already on screen stay. A failed request is checked with a cheap probe of `/.well-known/mesh-node`: if the probe answers, the node is up and that one request failed (the message then says \"The node answered <status>\", or, for an error the browser cannot read, \"The node is up but could not load this view\"); if the probe fails, the node is unreachable. The next successful request or retry returns the pill to Connected.\n5. In connected mode it checks that the browser supports Ed25519, loads your stored identity, reuses a saved session token or signs in again, then loads the side lists and the current channel. It refreshes the channel every 20 seconds.\n\n## Identity\n\nAn identity is an Ed25519 key pair made with WebCrypto, plus (when supported) an X25519 pair for encrypted DMs.\n\n```\npublic key (32 bytes) ──sha256──▶ first 32 hex chars ──▶  ent:<32 hex>   (your entity id)\n```\n\n- Create: Account, \"Create your identity\". The app generates the keys, checks the handle (v1.1 only), and registers `POST /api/entities` with the public key, the encryption public key, the handle and a profile (`name`, `bio`, and an `agent` flag).\n- Sign in is a challenge: `POST /api/auth/challenge`, the app signs the challenge text with the private key (hex signature), then `POST /api/auth/verify` returns a session token. If the node answers 401 later, the app signs in again once and retries.\n- The private key stays in the browser. Export gives a JSON bundle; import accepts that bundle or a bare Ed25519 private JWK.\n\n## Posting and signing\n\n```\ncompose text ─▶ POST /api/content  {kind, body, reply_to, ...}  ?token=<session>\n                         │\n                         ▼\n          the node stores it as content with an id and your entity as author\n```\n\nThe request is authorised by the session token, not by a signature over the post. The code includes `canonicalJson` (byte-identical to Python's sorted-key compact JSON), `signObject` and `verifyObject`, which implement the scheme the spec describes, but they are not used on the posting path. The README explains why: the node servers do not check per-content signatures yet.\n\nv1.1 body: `{ kind: \"post\" | \"reply\", body, reply_to, access: \"public\" | \"group\", group_id? }`. v2.0 body: `{ author, kind: \"post\", body, media: [urls], reply_to }`; replies are posts with `reply_to`.\n\n## Feeds, threads and timelines\n\n| View | v1.1 node | v2.0 node |\n|---|---|---|\n| Following | `GET /api/users/{me}/feed` | `GET /api/feed` (needs sign-in) |\n| Global feed | `GET /api/content` | not offered |\n| Timeline of one entity | `GET /api/content?author=` | `GET /api/timeline/{id}` |\n| Replies to a post | `GET /api/content?reply_to=` | derived from items already fetched |\n\nMessages are shown oldest to newest. Replies are indented under the post and can be expanded from the reply count.\n\n## Follows, likes, boosts\n\nThese are \"links\" from you to a target: `POST /api/links` with `kind` of `follow`, `like` or (v2.0 only) `repost`. v1.1 can list who you follow. v2.0 cannot, so the app stores the list locally.\n\n## Direct messages\n\n- v1.1: `POST /api/messages` and `GET /api/messages/...`; the node stores plaintext. Reading fails with an HTTP 500 for anyone whose DM partner has ever posted plain text (a node bug, see About this implementation), so in practice the other person's replies cannot be read.\n- v2.0: `POST /api/dm`; the node encrypts to the recipient's published X25519 key. If the recipient has no key the node refuses and the app explains it. There is no read endpoint, so a DM cannot be received through this app.\n- A message you send is shown at once in the thread, marked **Sent**, with a brief \"Message sent\" note. If the thread cannot be loaded afterwards, the messages sent from this session stay visible with the line \"Replies cannot be loaded from this node right now\". They are kept in memory only.\n\n## Groups\n\nOnly on v1.1 nodes: list, create, join, leave, and posts with `access: \"group\"` and a `group_id`. The protocol spec leaves groups to the social layer, so they are a feature of the node server, not of the protocol text.\n\n## Moderation\n\n```\nyou ──label (spam, nsfw, misleading, harassment, ...)──▶ POST /api/attestations   (v2.0)\nviewer ◀── GET /api/subjects/{id}/labels?viewer=me ──────  labels from issuers you trust\n```\n\n- Label types known to the app: `spam`, `nsfw`, `misleading`, `harassment`, `verified`, `trusted`, `bot`.\n- Labels display as badges. `spam`, `nsfw` and `harassment` fold the message behind a Show button. Your own messages are never folded.\n- \"Labelers\" lets you choose which issuers' labels you see. That choice is applied in the browser.\n- On v1.1, labels only appear if the node itself is set up with an external moderation service. You cannot create labels there.\n- Labelling the same subject with the same type again replaces your earlier label. There is no revoke.\n\n## Agents\n\nAn \"agent\" in this app is an entity flagged as one: the Account form has \"This identity is an AI agent\", which sets `profile.agent`. Agents get an Agent badge and are listed in their own section in the members column; a `bot` label from a trusted labeler has the same effect. The app does not run or call any AI model itself. In Demo mode the sample agents are static.\n\n## The docs reader\n\nThe pages you are reading are Markdown files in the `docs/` folder, embedded into `extension.js` by `scripts/embed-docs.mjs` so the extension stays one file. A test checks that the embedded copy matches the files.\n" },
  { id: "getting-started", title: "Getting started with others", markdown: "# Getting started with others\n\n> Authored for this app, from `README.md` and `extension.js`. Steps marked **unverified** were not tested. On 2026-10-30 the app was tested against a real v1.1 node and a real v2.0 node on `127.0.0.1` (see the README).\n\n## What works for two people today\n\nOn one shared node, two people on separate browsers can do all of the **public** features, tested on 2026-10-30 against a real v1.1 node and a real v2.0 node:\n\n- Create an identity (each person, in their own browser).\n- Find the other person by handle (v1.1) or by pasting their `ent:` entity id (v2.0).\n- Follow them, post, and reply, in **Following** or **Global feed** (Global feed is v1.1 only).\n- Create and join a **public** group by name (v1.1 only).\n\n## What does not work yet\n\n- **Direct messages.** On a v1.1 node you can send a DM and the node stores it, but reading DMs fails for almost everyone (a node bug, see Known issues), so the other person cannot read it in this app. On a v2.0 node a DM can be sent (encrypted) but the node has no read endpoint, so a DM cannot be received through this app at all.\n- **Private groups.** The create dialog offers \"Private\", but the node has no invite or add-member endpoint, so nobody else can join a private group and it does not appear in other people's rails.\n\n## The steps for two people\n\n1. Start one node that both browsers can reach. For a v1.1 node on one machine: `uvicorn main:app --host 127.0.0.1 --port 12000` (see step 1 below for the install line).\n2. Each person opens **MESH** and presses **Get started**, then opens the gear, **unticks Demo mode**, sets the **Node URL**, and presses **Save & reconnect**. The pill under \"MESH\" must say Connected.\n3. Each person creates an identity (Account, \"Create your identity\").\n4. Each person shares their handle (v1.1) or their `ent:` entity id (v2.0, shown in Account).\n5. Each person finds the other in the members search and presses **Follow**.\n6. Post and reply in **Following** or **Global feed**. On v2.0 you will not see someone's reply until you follow its author.\n7. For a public group (v1.1): under **Groups**, one person creates it and the other types the same name and presses **Join**.\n\n## What you need\n\nA MESH node that both you and the other people can reach over HTTP(S), and a browser with WebCrypto Ed25519. This app is only a client, so \"working with others\" means everyone uses the same node (there is no cross-node sync in this client).\n\n## 1. Run a node\n\nRun these from the protocol repository (`FraterCCCLXIII/mesh-protocol`, local clone path `holon-protocol/mesh-protocol/app/server`), ideally in a throwaway virtual environment:\n\n```bash\npip install fastapi uvicorn aiosqlite pydantic cryptography httpx websockets\nuvicorn main:app --host 127.0.0.1 --port 12000        # v1.1 node: DMs, global feed, replies, groups\n# or\nuvicorn server_v2:app --host 127.0.0.1 --port 12001   # v2.0 node: attestations, DAG heads\n```\n\nThe protocol README's install line (`pip install cryptography aiosqlite`) is incomplete; the node needs all seven packages above. Port 12000 is the default in this app. Prefer `uvicorn main:app` over `python main.py`: `python main.py` binds `0.0.0.0` and its `--port` flag overrides the database path. Set `MESH_DB_PATH` for an isolated data file.\n\nBoth nodes were tested from a page on another origin (`http://localhost:8000`): requests were allowed, including preflight for POST, PUT and DELETE. The app sends the session token as a `?token=` query parameter, so no Authorization header is needed.\n\nTo share the node with other people, it must be reachable from their machines, which was **not tested** (**unverified**): only `127.0.0.1` was used. Binding `0.0.0.0` (what `python main.py` does) or putting the node behind a public `https` address is up to you.\n\n## 2. Point the app at the node\n\n1. Open **MESH** from the Canvas navigation and press **Get started**. On a fresh browser the welcome screen and **Get started** open in **Demo** mode with no hint that you are not on a real node.\n2. Click the gear icon (Settings). **Demo mode is ticked by default**: **untick Demo mode**.\n3. Set **Node URL** (for example `http://localhost:12000`, or the address you share).\n4. Press **Save & reconnect**. The pill must change from Demo to Connected.\n\n## 3. Check the connection\n\nThe pill under \"MESH\" shows the state:\n\n| Pill | Meaning |\n|---|---|\n| Connecting… | Waiting for the node |\n| Connected · node-id | The node answered; hover for the URL and protocol version |\n| Demo | In-memory sample data; a notice says why (for example \"Cannot reach http://localhost:12000\") |\n| Disconnected · node-id | The app was connected, but the node no longer answers. A banner says \"Cannot reach ...\" with a **Retry node** button. Your identity and the messages already on screen stay; the pill returns to Connected on the next successful request or retry. |\n\nSettings repeats the state, including the MESH version and the detected flavor (v1 or v2).\n\n## 4. Create your identity\n\n1. Click **Create your identity** at the bottom of the left column (or open Account); if you already have a key, use \"I already have a key: import it\".\n2. Choose a handle (v1.1 checks that it is free; on v2.0 a taken handle shows up as an error after you submit), a display name, an optional bio, and tick the agent box only if this identity is an AI agent.\n3. The app generates the keys in your browser, registers you and signs you in.\n4. **Export key** in Account and keep the file somewhere safe. If you clear browser storage without a backup, the identity is gone.\n\nTo use the same identity on another device or browser, use Account, then import the exported key.\n\n## 5. Find and follow people\n\n- Tell people your handle (v1.1) or your entity id `ent:...` (shown in Account). On v2.0 nodes **handle search is not supported**: paste the `ent:` entity id.\n- On v2.0 you will not see someone's reply until you follow its author (there is no replies endpoint; replies are derived from the feeds you fetch).\n- Use the members column search (placeholder \"@handle or entity id\") to find someone, then press Follow. Followed accounts feed the **Following** tab.\n- **Global feed** shows public posts on v1.1 nodes.\n- You can start a direct message with **+ New** under Direct messages, or from a member's DM button, but see \"What does not work yet\": the other person cannot read it today.\n- On v1.1 nodes, create or join a **public** group under **Groups** (type the name and press Join). Do not use \"Private\": the node has no invite or add-member endpoint (only admin, kick and ban), so nobody else can join a private group and it does not appear in other people's rails. The node also returned a non-member the private group's content through `GET /api/content?group_id=`, which is a privacy hole in the node (to be fixed there, not in this app).\n\n## 6. Share links and keys\n\n- Share your handle or entity id, not your key. Never send an exported key to anyone: it is your account.\n- There is no invite link feature in this app (not found in the code).\n\n## Known issues\n\n- **v1.1 node: reading DMs fails with HTTP 500** (`GET /api/messages/conversations` and `GET /api/messages/{id}`, `sqlite3.OperationalError: malformed JSON`, from the `json_extract` queries in `main.py` around lines 3552 to 3558). It fails for **anyone whose DM partner has ever posted plain text**, so in normal use DM reading effectively never works. Sending works and the node stores the message. This is a bug in the node, not in this app, and there is no workaround in the app. Suggested node fix (not done here): make the DM queries skip non-JSON bodies, for example guard with `json_valid(body)`.\n  - What you see: a browser cannot read an error response without CORS headers, so the app asks the node's info endpoint whether it is up. If it is, the message says \"The node is up but could not load this view (it returned an error)\". If you just sent a DM, it stays on screen marked **Sent**, with the line \"Replies cannot be loaded from this node right now\".\n- **v2.0 node: DMs cannot be received.** A DM can be sent (encrypted to the recipient's key) but the node has no read endpoint. Only what you sent in this session is shown.\n- **Private groups** cannot be joined by anyone else (no invite or add-member endpoint), and the node leaks their content to non-members through `GET /api/content?group_id=`. See step 5.\n- **v1.1 attestations**: the node answers \"This node does not accept attestations\"; labels are a v2.0 feature.\n\n## Troubleshooting\n\n| Symptom | Likely cause and fix |\n|---|---|\n| Header says Demo and the notice says \"Cannot reach …\" | The node is not running, the URL or port is wrong, or the address is blocked. Check the URL in Settings, make sure Demo mode is unticked, and press Retry node. |\n| Pill says Disconnected and a banner says \"Cannot reach …\" | The node stopped answering after you connected. Start it again and press Retry node; your identity and loaded messages are kept. |\n| \"The node answered 500\" or \"The node is up but could not load this view\" | The node is running but failed on that request. In the Direct messages view of a v1.1 node this is the known DM bug above. |\n| \"Not a MESH node (no /.well-known/mesh-node)\" | The URL answers but is not a MESH node. Check the path; the URL may include a path prefix. |\n| Page is `https` but the node is `http` | Browsers can block mixed content. Use an `https` node address (**unverified**). |\n| \"Read-only: create or import an identity in Account to post.\" | You have no identity in this browser. Create or import one. |\n| \"Your identity is not registered on this node yet.\" | The key exists but this node has no entity for it. Register it in Account. |\n| \"Signed out: sign in from Account to post.\" | Session expired or the node restarted; v2.0 keeps sessions in memory. Sign in again. |\n| \"This browser has no WebCrypto Ed25519\" | Use a newer browser, or Demo mode. |\n| DM refused: recipient has no encryption key (v2.0) | The recipient registered without an X25519 key. They need an identity with an encryption key (made in a browser that supports X25519). |\n| Group, global feed, delete, profile edit or labels missing | The node version does not offer them (see About this implementation). |\n| Followed list empty after switching browser (v2.0) | The v2.0 follow list is stored locally, not on the node. |\n" },
  { id: "protocol-overview", title: "MESH protocol: overview", markdown: "# MESH protocol: overview\n\n> Source: https://github.com/FraterCCCLXIII/mesh-protocol/blob/main/README.md (lines 17-60 and 127-137). Imported verbatim from the MESH protocol repository (CC0 1.0). Text is unedited; other sections of the source are omitted for length. The MESH repository itself is the authority; this is a copy.\n\n## What is MESH?\n\nMESH is a layered protocol for decentralized social networking:\n\n```\n┌─────────────────────────────────────────────────────────────────────┐\n│                    APPLICATION (mobile, web, bots)                  │\n├─────────────────────────────────────────────────────────────────────┤\n│                    NETWORK (HTTP, WebSocket, federation)            │\n├─────────────────────────────────────────────────────────────────────┤\n│                    VIEW (feeds, algorithms, caching)                │\n├─────────────────────────────────────────────────────────────────────┤\n│                    MODERATION (attestations, trust networks)        │\n├─────────────────────────────────────────────────────────────────────┤\n│                    SOCIAL (Entity, Content, Link)                   │\n├─────────────────────────────────────────────────────────────────────┤\n│                    INTEGRITY (DAG, merge, verification)             │\n├─────────────────────────────────────────────────────────────────────┤\n│                    STORAGE (SQLite, PostgreSQL)                     │\n├─────────────────────────────────────────────────────────────────────┤\n│                    PRIVACY (Ed25519, X25519, AES-GCM)               │\n└─────────────────────────────────────────────────────────────────────┘\n```\n\n## Key Features\n\n| Feature | Description |\n|---------|-------------|\n| **Self-sovereign identity** | Ed25519 keys are your identity |\n| **Multi-device support** | Device keys with automatic merge |\n| **End-to-end encryption** | X25519 + AES-256-GCM for DMs/groups |\n| **Verifiable feeds** | Deterministic computation |\n| **Composable moderation** | Third-party attestations |\n| **Optional recovery** | Social, custodial, or hardware backup |\n| **High performance** | 6,000+ writes/sec, 37M+ DAU per node |\n\n## Performance\n\n| Operation | Time | Throughput |\n|-----------|:----:|:----------:|\n| Ed25519 sign+verify | 0.15ms | 6,700/sec |\n| Storage write | 0.17ms | 6,000/sec |\n| Simple query | 0.19ms | 5,300/sec |\n| View execution | 2.76ms | 360/sec |\n\n## Comparison with Other Protocols\n\n| Feature | MESH | Nostr | ActivityPub | SSB | AT Protocol |\n|---------|:----:|:-----:|:-----------:|:---:|:-----------:|\n| Self-sovereign ID | ✓ | ✓ | ✗ | ✓ | ✗ |\n| Multi-device | ✓ | ✗ | ✓ | ✗ | ✓ |\n| E2EE | ✓ | ✗ | ✗ | ✓ | ✗ |\n| Fork handling | ✓ Auto | N/A | N/A | ✗ Manual | ✓ |\n| Identity recovery | ✓ Optional | ✗ | ✓ | ✗ | ✓ |\n| Custom algorithms | ✓ | ✗ | ✗ | ✗ | ✓ |\n\n\n" },
  { id: "protocol-foundations", title: "MESH spec v1.1: overview, principles, architecture", markdown: "# MESH spec v1.1: overview, principles, architecture\n\n> Source: https://github.com/FraterCCCLXIII/mesh-protocol/blob/main/specs/MESH_PROTOCOL_v1.1.md (lines 36-143). Imported verbatim from the MESH protocol repository (CC0 1.0). Text is unedited; other sections of the source are omitted for length. The MESH repository itself is the authority; this is a copy.\n\n## 1. Overview\n\n### 1.1 What is MESH?\n\nMESH is a modular, layered protocol for decentralized social networking that provides:\n\n- **Self-sovereign identity** via Ed25519 cryptographic keys\n- **Append-only integrity** via prev-chain linked events\n- **Multi-device support** via device keys and automatic merge ← **NEW**\n- **End-to-end encryption** via X25519 + AES-256-GCM\n- **Verifiable feeds** via deterministic view computation\n- **Composable moderation** via third-party attestations\n- **Optional identity recovery** via social recovery or custodial backup ← **NEW**\n- **Horizontal scalability** via content-addressed data\n\n### 1.2 Key Properties\n\n| Property | Mechanism |\n|----------|-----------|\n| Decentralized | No required central servers |\n| Self-sovereign | Users own their keys and data |\n| Multi-device | Device keys with automatic merge |\n| Censorship-resistant | Data replicates across relays |\n| Privacy-preserving | E2EE for DMs and private groups |\n| Verifiable | Deterministic feed computation |\n| Recoverable | Optional social/custodial recovery |\n| Scalable | Content-addressed, shardable |\n\n### 1.3 Design Goals\n\n1. **Simplicity** - Minimal primitive set (Entity, Content, Link)\n2. **Integrity** - Provable append-only history\n3. **Practicality** - Works with real-world usage patterns ← **EMPHASIZED**\n4. **Privacy** - Encryption built-in, not bolted on\n5. **Modularity** - Use only the layers you need\n6. **Performance** - 6,000+ writes/sec, 5,000+ queries/sec\n\n---\n\n## 2. Design Principles\n\n### 2.1 Core Principles\n\n1. **Keys are identity** - Your Ed25519 keypair IS your identity\n2. **Events are immutable** - Once written, events cannot be changed\n3. **State is derived** - Current state is computed from event history\n4. **Forks are normal** - Multi-device naturally creates forks; merge them ← **NEW**\n5. **Attestations are separate** - Third-party claims never modify facts\n6. **Views are deterministic** - Same inputs always produce same outputs\n7. **Recovery is optional** - Users choose their security/convenience tradeoff ← **NEW**\n8. **Layers are optional** - Clients choose which layers to implement\n\n### 2.2 Tradeoffs Made\n\n| Tradeoff | Choice | Rationale |\n|----------|--------|-----------|\n| Event logs vs state | Event logs | Auditability, sync simplicity |\n| Push vs pull sync | Pull with subscriptions | Efficiency, offline support |\n| Keys vs delegated identity | Keys with optional recovery | Self-sovereignty + practicality |\n| Local-first vs relay-based | Hybrid | Flexibility, resilience |\n| Single chain vs multi-head | **Multi-head with merge** | Multi-device support |\n| Client-side vs protocol moderation | Client-side with attestations | Freedom, composability |\n| E2EE default vs optional | Optional with easy E2EE | Performance, usability |\n\n### 2.3 What MESH Does NOT Do\n\n- **Consensus** - No blockchain, no global ordering\n- **Payments** - No built-in cryptocurrency\n- **Storage guarantees** - Relays may drop data\n- **Forced recovery** - Recovery is opt-in, not mandatory\n- **Content moderation** - Protocol provides tools, not policies\n\n---\n\n## 3. Architecture\n\n### 3.1 Layer Stack\n\n```\n┌─────────────────────────────────────────────────────────────────────┐\n│                    LAYER 8: APPLICATION                             │\n│              (Mobile, Web, Desktop, Bots, VR)                       │\n├─────────────────────────────────────────────────────────────────────┤\n│                    LAYER 7: NETWORK                                 │\n│           (HTTP API, WebSocket, Federation, P2P)                    │\n├─────────────────────────────────────────────────────────────────────┤\n│                    LAYER 6: VIEW                                    │\n│        (ViewDefinitions, Reducers, Execution Limits)                │\n├─────────────────────────────────────────────────────────────────────┤\n│                    LAYER 5: MODERATION                              │\n│           (Attestations, Trust Networks, Conflict Resolution)       │\n├─────────────────────────────────────────────────────────────────────┤\n│                    LAYER 4: SOCIAL                                  │\n│              (Entity, Content, Link primitives)                     │\n├─────────────────────────────────────────────────────────────────────┤\n│                    LAYER 3: INTEGRITY                               │\n│         (LogEvent, Multi-Head DAG, Automatic Merge)                 │\n├─────────────────────────────────────────────────────────────────────┤\n│                    LAYER 2: STORAGE                                 │\n│            (SQLite/PostgreSQL, Indexes, Caching)                    │\n├─────────────────────────────────────────────────────────────────────┤\n│                    LAYER 1: PRIVACY                                 │\n│     (Ed25519, X25519, AES-256-GCM, Device Keys, Recovery Keys)      │\n└─────────────────────────────────────────────────────────────────────┘\n```\n\n---\n\n\n" },
  { id: "protocol-privacy-integrity", title: "MESH spec v1.1: privacy, storage and integrity layers", markdown: "# MESH spec v1.1: privacy, storage and integrity layers\n\n> Source: https://github.com/FraterCCCLXIII/mesh-protocol/blob/main/specs/MESH_PROTOCOL_v1.1.md (lines 144-488). Imported verbatim from the MESH protocol repository (CC0 1.0). Text is unedited; other sections of the source are omitted for length. The MESH repository itself is the authority; this is a copy.\n\n## 4. Layer 1: Privacy Layer\n\n### 4.1 Overview\n\nThe Privacy Layer provides cryptographic primitives for identity, authentication, encryption, and recovery.\n\n### 4.2 Identity Hierarchy ← **NEW SECTION**\n\nMESH supports a hierarchical key structure for practical multi-device use:\n\n```\n                    ┌─────────────────┐\n                    │   Root Key      │\n                    │   (Ed25519)     │\n                    │   KEEP OFFLINE  │\n                    └────────┬────────┘\n                             │\n              ┌──────────────┼──────────────┐\n              │              │              │\n              ▼              ▼              ▼\n        ┌──────────┐  ┌──────────┐  ┌──────────┐\n        │ Device 1 │  │ Device 2 │  │ Device 3 │\n        │   Key    │  │   Key    │  │   Key    │\n        └──────────┘  └──────────┘  └──────────┘\n              │              │              │\n              ▼              ▼              ▼\n        ┌──────────┐  ┌──────────┐  ┌──────────┐\n        │ Phone    │  │ Laptop   │  │ Desktop  │\n        └──────────┘  └──────────┘  └──────────┘\n```\n\n**Key Types:**\n\n| Key Type | Purpose | Storage | Compromise Impact |\n|----------|---------|---------|-------------------|\n| Root Key | Identity anchor | Offline/hardware | Total identity loss |\n| Device Key | Day-to-day signing | On device | Revoke that device |\n| Recovery Key | Account recovery | Trusted parties | Recovery possible |\n\n### 4.3 Root Identity\n\nThe root identity is the canonical identity:\n\n```typescript\ninterface RootIdentity {\n  id: string;                    // ent:sha256(root_public_key)[:32]\n  root_public_key: bytes;        // Ed25519 - KEEP PRIVATE KEY OFFLINE\n  device_keys: DeviceKey[];      // Authorized device keys\n  recovery_config?: RecoveryConfig;\n  created_at: timestamp;\n  sig: bytes;                    // Signed by root key\n}\n\ninterface DeviceKey {\n  device_id: string;\n  public_key: bytes;             // Ed25519\n  name: string;                  // \"iPhone\", \"Laptop\", etc.\n  authorized_at: timestamp;\n  expires_at?: timestamp;\n  revoked: boolean;\n  capabilities: string[];        // [\"post\", \"follow\", \"dm\", \"admin\"]\n  sig: bytes;                    // Signed by root key\n}\n```\n\n### 4.4 Device Key Authorization\n\nTo authorize a new device:\n\n```python\ndef authorize_device(root_key: SigningKeyPair, device_public_key: bytes, name: str) -> DeviceKey:\n    device = DeviceKey(\n        device_id=generate_device_id(device_public_key),\n        public_key=device_public_key,\n        name=name,\n        authorized_at=now(),\n        revoked=False,\n        capabilities=[\"post\", \"follow\", \"dm\"],\n    )\n    device.sig = root_key.sign(canonical_json(device.to_dict()))\n    return device\n```\n\n### 4.5 Signature Verification (Updated)\n\nSignatures can come from root key OR authorized device key:\n\n```python\ndef verify_event_signature(event: LogEvent, identity: RootIdentity) -> bool:\n    # Try root key\n    if verify_signature(identity.root_public_key, event_bytes, event.sig):\n        return True\n    \n    # Try device keys\n    for device in identity.device_keys:\n        if device.revoked:\n            continue\n        if device.expires_at and device.expires_at < now():\n            continue\n        if verify_signature(device.public_key, event_bytes, event.sig):\n            # Check capability\n            if event_requires_capability(event) in device.capabilities:\n                return True\n    \n    return False\n```\n\n### 4.6 Key Rotation\n\nDevice keys can be rotated without changing identity:\n\n```python\ndef rotate_device_key(root_key: SigningKeyPair, old_device_id: str, new_device_public_key: bytes):\n    # Revoke old\n    revocation = DeviceKeyRevocation(\n        device_id=old_device_id,\n        revoked_at=now(),\n        reason=\"rotation\",\n    )\n    revocation.sig = root_key.sign(...)\n    \n    # Authorize new\n    new_device = authorize_device(root_key, new_device_public_key, \"Rotated Device\")\n    \n    return revocation, new_device\n```\n\n---\n\n## 5. Layer 2: Storage Layer\n\n*[Same as v1.0 - see original spec]*\n\n---\n\n## 6. Layer 3: Integrity Layer\n\n### 6.1 Overview\n\nThe Integrity Layer ensures append-only semantics while supporting **multi-device usage through a DAG structure with automatic merge**.\n\n### 6.2 Multi-Head DAG (Key Change from v1.0) ← **MAJOR UPDATE**\n\n**Problem with strict single-chain:**\n- User posts from phone\n- User posts from laptop before sync\n- Result: FORK → terrible UX\n\n**Solution: Allow multiple heads with automatic merge**\n\n```\n        Event 1 (laptop)\n       /\nRoot ─┤\n       \\\n        Event 2 (phone)\n       \n        ↓ Automatic merge\n       \n        Event 1 (laptop)\n       /                \\\nRoot ─┤                  ├─ Merge Event\n       \\                /\n        Event 2 (phone)\n```\n\n### 6.3 LogEvent (Updated)\n\n```typescript\ninterface LogEvent {\n  id: string;                    // sha256(actor:device:local_seq)[:48]\n  actor: string;                 // entity_id of author\n  device_id: string;             // Which device created this ← NEW\n  \n  // DAG structure (changed from single prev)\n  parents: string[];             // Previous event IDs (1 or more) ← CHANGED\n  local_seq: number;             // Per-device sequence number ← CHANGED\n  \n  // Lamport timestamp for ordering\n  lamport: number;               // max(parent.lamport) + 1 ← NEW\n  \n  op: \"create\" | \"update\" | \"delete\";\n  object_type: \"entity\" | \"content\" | \"link\" | \"state\" | \"attestation\" | \"view\";\n  object_id: string;\n  payload: object;\n  \n  ts: timestamp;                 // Wall clock (informational only)\n  sig: bytes;                    // Signed by device key\n}\n```\n\n### 6.4 Fork Handling Strategies ← **NEW SECTION**\n\nMESH defines three fork handling strategies. Implementations MUST support at least one:\n\n#### Strategy 1: Automatic Merge (Recommended)\n\nFor most content, forks merge automatically:\n\n```python\ndef auto_merge(heads: list[LogEvent]) -> LogEvent:\n    \"\"\"Create a merge event that combines multiple heads.\"\"\"\n    \n    # Sort by lamport timestamp for deterministic ordering\n    sorted_heads = sorted(heads, key=lambda e: (e.lamport, e.id))\n    \n    merge_event = LogEvent(\n        id=generate_merge_id(sorted_heads),\n        actor=heads[0].actor,\n        device_id=\"merge\",  # Special device ID for merges\n        parents=[h.id for h in sorted_heads],\n        local_seq=0,\n        lamport=max(h.lamport for h in sorted_heads) + 1,\n        op=\"merge\",\n        object_type=\"merge\",\n        object_id=\"\",\n        payload={\n            \"merged_heads\": [h.id for h in sorted_heads],\n            \"strategy\": \"auto\",\n        },\n        ts=now(),\n        sig=b\"\",  # Merges are unsigned - deterministic from parents\n    )\n    \n    return merge_event\n```\n\n**Merge Rules by Object Type:**\n\n| Object Type | Merge Rule |\n|-------------|------------|\n| Content (post) | Both posts preserved, ordered by lamport |\n| Content (edit) | Last-write-wins by lamport |\n| Link (follow) | Union - if either says follow, follow |\n| Link (unfollow) | Last-write-wins by lamport |\n| Profile update | Last-write-wins by lamport |\n| Attestation | Both preserved |\n\n#### Strategy 2: Last-Write-Wins\n\nFor state that can't merge (e.g., profile bio):\n\n```python\ndef last_write_wins(heads: list[LogEvent]) -> LogEvent:\n    \"\"\"Select the head with highest lamport timestamp.\"\"\"\n    winner = max(heads, key=lambda e: (e.lamport, e.id))\n    \n    # Other heads are \"abandoned\" - still valid, but not current\n    return winner\n```\n\n#### Strategy 3: User Resolution\n\nFor rare conflicts that can't auto-resolve:\n\n```python\ndef request_user_resolution(heads: list[LogEvent]) -> UserResolutionRequest:\n    \"\"\"Present conflict to user for manual resolution.\"\"\"\n    return UserResolutionRequest(\n        conflict_type=\"unresolvable_fork\",\n        heads=heads,\n        message=\"Your account has conflicting changes. Please choose which to keep.\",\n        options=[\n            {\"id\": h.id, \"summary\": summarize_event(h)} \n            for h in heads\n        ],\n    )\n```\n\n**When to use each:**\n\n| Scenario | Strategy | Example |\n|----------|----------|---------|\n| Both devices posted | Auto merge | Both posts appear in timeline |\n| Both devices edited bio | LWW | Most recent bio wins |\n| Conflicting block/unblock | User resolution | \"Did you mean to block Alice?\" |\n\n### 6.5 Convergence Guarantee\n\nWith automatic merge, all devices eventually converge:\n\n```python\ndef sync_and_merge(local_events: list, remote_events: list) -> list:\n    # Combine all events\n    all_events = set(local_events + remote_events)\n    \n    # Find all heads (events with no children)\n    children = {e.id for e in all_events for p in e.parents}\n    heads = [e for e in all_events if e.id not in children]\n    \n    # If multiple heads, merge them\n    if len(heads) > 1:\n        merge = auto_merge(heads)\n        all_events.add(merge)\n    \n    return sorted(all_events, key=lambda e: e.lamport)\n```\n\n### 6.6 Offline Support\n\nDevices can work offline and merge later:\n\n```\nTimeline:\n─────────────────────────────────────────────────────►\n   │\n   │  Phone goes offline\n   │  ├── Post A (phone, lamport=5)\n   │  ├── Post B (phone, lamport=6)\n   │\n   │  Laptop continues online\n   │  ├── Post C (laptop, lamport=5)\n   │  ├── Post D (laptop, lamport=6)\n   │\n   │  Phone comes online\n   │  ├── Sync discovers fork\n   │  ├── Auto-merge creates merge event (lamport=7)\n   │  └── All 4 posts preserved, ordered by lamport\n   │\n```\n\n### 6.7 Preventing Malicious Forks\n\nWhile forks from honest multi-device use are normal, malicious forks are detected:\n\n```python\ndef detect_malicious_fork(events: list[LogEvent]) -> bool:\n    \"\"\"Detect if someone is intentionally creating many forks.\"\"\"\n    \n    # Count forks per time window\n    fork_events = [e for e in events if len(e.parents) > 1]\n    \n    # More than 10 forks per hour is suspicious\n    recent_forks = [e for e in fork_events if e.ts > now() - hours(1)]\n    if len(recent_forks) > 10:\n        return True\n    \n    # Same device creating forks is impossible (local_seq is sequential)\n    # Different devices creating occasional forks is normal\n    \n    return False\n```\n\n---\n\n\n" },
  { id: "protocol-social-moderation", title: "MESH spec v1.1: social and moderation layers", markdown: "# MESH spec v1.1: social and moderation layers\n\n> Source: https://github.com/FraterCCCLXIII/mesh-protocol/blob/main/specs/MESH_PROTOCOL_v1.1.md (lines 489-789). Imported verbatim from the MESH protocol repository (CC0 1.0). Text is unedited; other sections of the source are omitted for length. The MESH repository itself is the authority; this is a copy.\n\n## 7. Layer 4: Social Layer\n\n*[Same as v1.0 - see original spec]*\n\n---\n\n## 8. Layer 5: Moderation Layer\n\n### 8.1 Overview\n\nThe Moderation Layer provides attestation-based moderation with **explicit conflict resolution and spam prevention**.\n\n### 8.2 Core Principle\n\n**Attestations NEVER modify facts.** They are separate claims that compose on top of the truth layer.\n\n### 8.3 Attestation (Same as v1.0)\n\n```typescript\ninterface Attestation {\n  id: string;\n  issuer: string;\n  subject: string;\n  type: \"trust\" | \"label\" | \"badge\" | \"block\" | \"verify\" | \"flag\";\n  claim: object;\n  evidence?: object;\n  ts: timestamp;\n  expires_at?: timestamp;\n  revoked: boolean;\n  sig: bytes;\n}\n```\n\n### 8.4 Conflicting Attestations ← **NEW SECTION**\n\nWhen attestations conflict, clients MUST resolve them:\n\n```typescript\ninterface AttestationConflict {\n  subject: string;\n  attestations: Attestation[];\n  conflict_type: \"contradictory\" | \"severity_mismatch\" | \"trust_conflict\";\n}\n```\n\n**Resolution Strategies:**\n\n#### 1. Trust-Weighted Resolution\n\n```python\ndef resolve_by_trust(conflicts: list[Attestation], trust_network: TrustNetwork) -> Attestation:\n    \"\"\"Resolve conflict by trust weight.\"\"\"\n    \n    def trust_score(att: Attestation) -> float:\n        if att.issuer in trust_network.direct_trust:\n            return trust_network.direct_trust[att.issuer]  # 0.0 - 1.0\n        \n        # Transitive trust (discounted)\n        for trusted in trust_network.trusted_issuers:\n            if att.issuer in get_trusted_by(trusted):\n                return trust_network.direct_trust[trusted] * 0.5\n        \n        return 0.0\n    \n    # Highest trust wins\n    return max(conflicts, key=trust_score)\n```\n\n#### 2. Recency Resolution\n\n```python\ndef resolve_by_recency(conflicts: list[Attestation]) -> Attestation:\n    \"\"\"Most recent attestation wins.\"\"\"\n    return max(conflicts, key=lambda a: a.ts)\n```\n\n#### 3. Severity Resolution\n\n```python\ndef resolve_by_severity(conflicts: list[Attestation]) -> Attestation:\n    \"\"\"Most severe attestation wins (safety-first).\"\"\"\n    severity_order = {\"block\": 3, \"flag\": 2, \"label\": 1, \"trust\": 0}\n    return max(conflicts, key=lambda a: severity_order.get(a.type, 0))\n```\n\n#### 4. Configurable Resolution\n\nUsers configure their preferred resolution:\n\n```typescript\ninterface ModerationConfig {\n  conflict_resolution: \"trust_weighted\" | \"recency\" | \"severity\" | \"manual\";\n  \n  // Trust weights\n  trust_weights: {\n    [issuer: string]: number;  // 0.0 - 1.0\n  };\n  \n  // Auto-apply rules\n  auto_block_threshold: number;     // e.g., 3 trusted issuers = auto-block\n  auto_hide_threshold: number;      // e.g., 2 trusted flags = auto-hide\n  \n  // Manual review queue\n  require_manual_review: string[];  // Attestation types requiring manual review\n}\n```\n\n### 8.5 Spam Attestation Prevention ← **NEW SECTION**\n\nAttestations themselves can be spammed. Prevention mechanisms:\n\n#### 1. Rate Limiting\n\n```python\nATTESTATION_LIMITS = {\n    \"per_issuer_per_hour\": 100,\n    \"per_subject_per_hour\": 50,\n    \"per_issuer_per_day\": 1000,\n}\n\ndef check_attestation_rate_limit(att: Attestation) -> bool:\n    recent_by_issuer = count_attestations(issuer=att.issuer, since=hours_ago(1))\n    if recent_by_issuer > ATTESTATION_LIMITS[\"per_issuer_per_hour\"]:\n        return False\n    \n    recent_on_subject = count_attestations(subject=att.subject, since=hours_ago(1))\n    if recent_on_subject > ATTESTATION_LIMITS[\"per_subject_per_hour\"]:\n        return False\n    \n    return True\n```\n\n#### 2. Stake/Reputation Requirements\n\n```python\ndef can_issue_attestation(issuer: str, att_type: str) -> bool:\n    issuer_reputation = get_reputation(issuer)\n    \n    # Higher-impact attestations require more reputation\n    required_reputation = {\n        \"label\": 10,\n        \"flag\": 50,\n        \"block\": 100,\n        \"verify\": 200,\n    }\n    \n    return issuer_reputation >= required_reputation.get(att_type, 0)\n```\n\n#### 3. Attestation Challenges\n\n```python\ndef challenge_attestation(att: Attestation, challenger: str, reason: str):\n    \"\"\"Allow challenging questionable attestations.\"\"\"\n    challenge = AttestationChallenge(\n        attestation_id=att.id,\n        challenger=challenger,\n        reason=reason,\n        ts=now(),\n    )\n    \n    # If enough challenges, attestation is flagged for review\n    challenges = get_challenges(att.id)\n    if len(challenges) >= 3:\n        flag_for_review(att)\n```\n\n### 8.6 Trust Bootstrapping ← **NEW SECTION**\n\nNew users need a way to bootstrap trust:\n\n#### 1. Well-Known Trust Anchors\n\n```python\nWELL_KNOWN_ANCHORS = [\n    \"ent:mesh_foundation\",      # Protocol foundation\n    \"ent:community_council\",    # Elected moderators\n    \"ent:verified_orgs\",        # Verified organizations\n]\n\ndef default_trust_network() -> TrustNetwork:\n    \"\"\"Starting trust network for new users.\"\"\"\n    return TrustNetwork(\n        trusted_issuers=WELL_KNOWN_ANCHORS,\n        trust_depth=1,\n        attestation_types=[\"label\", \"block\", \"flag\"],\n    )\n```\n\n#### 2. Social Trust Import\n\n```python\ndef import_trust_from_follows(user_id: str) -> TrustNetwork:\n    \"\"\"Build trust network from who user follows.\"\"\"\n    following = get_following(user_id)\n    \n    # People you follow have base trust\n    trust_weights = {f: 0.3 for f in following}\n    \n    # Mutual follows have higher trust\n    followers = get_followers(user_id)\n    for f in following:\n        if f in followers:\n            trust_weights[f] = 0.6\n    \n    return TrustNetwork(\n        trusted_issuers=list(trust_weights.keys()),\n        trust_weights=trust_weights,\n    )\n```\n\n#### 3. Trust Discovery\n\n```python\ndef discover_trusted_labelers(user_id: str) -> list[str]:\n    \"\"\"Find well-regarded labelers in user's network.\"\"\"\n    \n    # Get who user's trusted contacts trust\n    my_trusted = get_trust_network(user_id).trusted_issuers\n    \n    candidates = {}\n    for trusted in my_trusted:\n        their_trusted = get_trust_network(trusted).trusted_issuers\n        for candidate in their_trusted:\n            if candidate not in my_trusted:\n                candidates[candidate] = candidates.get(candidate, 0) + 1\n    \n    # Sort by how many trusted contacts trust them\n    return sorted(candidates.keys(), key=lambda c: candidates[c], reverse=True)[:10]\n```\n\n### 8.7 Moderation Policy Framework ← **NEW SECTION**\n\nMESH doesn't define policies, but provides a framework for them:\n\n```typescript\ninterface ModerationPolicy {\n  id: string;\n  name: string;                    // \"Family Friendly\", \"Free Speech\", etc.\n  description: string;\n  \n  // What this policy considers violations\n  violation_definitions: {\n    [violation_type: string]: {\n      description: string;\n      severity: \"low\" | \"medium\" | \"high\" | \"critical\";\n      auto_action?: \"hide\" | \"warn\" | \"block\";\n    };\n  };\n  \n  // Who enforces this policy\n  enforcers: string[];             // entity_ids of authorized labelers\n  \n  // Appeals process\n  appeals_contact?: string;\n  appeals_process?: string;\n}\n```\n\n**Example Policies:**\n\n```json\n{\n  \"id\": \"policy:mesh-default\",\n  \"name\": \"MESH Default Policy\",\n  \"violation_definitions\": {\n    \"spam\": {\"severity\": \"medium\", \"auto_action\": \"hide\"},\n    \"harassment\": {\"severity\": \"high\", \"auto_action\": \"warn\"},\n    \"illegal_content\": {\"severity\": \"critical\", \"auto_action\": \"block\"},\n    \"impersonation\": {\"severity\": \"high\", \"auto_action\": \"warn\"}\n  },\n  \"enforcers\": [\"ent:mesh_foundation\", \"ent:community_council\"]\n}\n```\n\nUsers choose which policies to adopt:\n\n```python\ndef apply_policies(content: Content, policies: list[str]) -> ModerationResult:\n    \"\"\"Apply selected moderation policies to content.\"\"\"\n    \n    results = []\n    for policy_id in policies:\n        policy = get_policy(policy_id)\n        attestations = get_attestations_from(policy.enforcers, subject=content.id)\n        \n        for att in attestations:\n            if att.claim.get(\"violation_type\") in policy.violation_definitions:\n                violation = policy.violation_definitions[att.claim[\"violation_type\"]]\n                results.append(ModerationAction(\n                    policy=policy_id,\n                    violation=att.claim[\"violation_type\"],\n                    severity=violation[\"severity\"],\n                    action=violation.get(\"auto_action\"),\n                ))\n    \n    return aggregate_results(results)\n```\n\n---\n\n\n" },
  { id: "protocol-views-network", title: "MESH spec v1.1: view, network and application layers", markdown: "# MESH spec v1.1: view, network and application layers\n\n> Source: https://github.com/FraterCCCLXIII/mesh-protocol/blob/main/specs/MESH_PROTOCOL_v1.1.md (lines 790-968). Imported verbatim from the MESH protocol repository (CC0 1.0). Text is unedited; other sections of the source are omitted for length. The MESH repository itself is the authority; this is a copy.\n\n## 9. Layer 6: View Layer\n\n### 9.1 Overview\n\nThe View Layer provides deterministic feed computation with **explicit execution limits and cost controls**.\n\n### 9.2 Execution Limits ← **NEW SECTION**\n\nViews can be computationally expensive. Relays MUST enforce limits:\n\n```typescript\ninterface ViewExecutionLimits {\n  // Time limits\n  max_execution_time_ms: number;     // e.g., 5000ms\n  \n  // Resource limits\n  max_events_scanned: number;        // e.g., 100,000\n  max_memory_mb: number;             // e.g., 100MB\n  max_result_size: number;           // e.g., 1,000 events\n  \n  // Complexity limits\n  max_sources: number;               // e.g., 100\n  max_filters: number;               // e.g., 20\n  max_attestation_lookups: number;   // e.g., 10,000\n  \n  // Rate limits\n  executions_per_minute: number;     // e.g., 60\n  executions_per_hour: number;       // e.g., 1,000\n}\n\nconst DEFAULT_LIMITS: ViewExecutionLimits = {\n  max_execution_time_ms: 5000,\n  max_events_scanned: 100000,\n  max_memory_mb: 100,\n  max_result_size: 1000,\n  max_sources: 100,\n  max_filters: 20,\n  max_attestation_lookups: 10000,\n  executions_per_minute: 60,\n  executions_per_hour: 1000,\n};\n```\n\n### 9.3 View Cost Model ← **NEW SECTION**\n\nViews have an estimated cost for planning:\n\n```python\ndef estimate_view_cost(view_def: ViewDefinition) -> ViewCost:\n    \"\"\"Estimate computational cost of a view.\"\"\"\n    \n    cost = ViewCost()\n    \n    # Source costs\n    for source in view_def.sources:\n        if source.kind == \"actor\":\n            cost.events_to_scan += estimate_actor_events(source.actor_id)\n        elif source.kind == \"follows\":\n            following = len(get_following(source.actor_id))\n            cost.events_to_scan += following * AVG_EVENTS_PER_USER\n        elif source.kind == \"all\":\n            cost.events_to_scan += TOTAL_EVENTS  # Very expensive!\n    \n    # Filter costs\n    for filt in view_def.filters:\n        if filt.require_attestations:\n            cost.attestation_lookups += cost.events_to_scan\n        if filt.exclude_attestations:\n            cost.attestation_lookups += cost.events_to_scan\n    \n    # Reducer costs\n    if view_def.reducer == \"ranked\":\n        cost.complexity_multiplier = 2.0  # Scoring is expensive\n    elif view_def.reducer == \"custom\":\n        cost.complexity_multiplier = 5.0  # Unknown cost\n    \n    cost.total = (\n        cost.events_to_scan * 0.001 +\n        cost.attestation_lookups * 0.01\n    ) * cost.complexity_multiplier\n    \n    return cost\n```\n\n### 9.4 View Execution Sandbox ← **NEW SECTION**\n\nCustom reducers run in a sandbox:\n\n```typescript\ninterface ViewSandbox {\n  // Allowed operations\n  allowed_operations: [\n    \"read_events\",\n    \"read_attestations\", \n    \"sort\",\n    \"filter\",\n    \"aggregate\",\n  ];\n  \n  // Forbidden operations\n  forbidden: [\n    \"network_access\",\n    \"file_system\",\n    \"exec\",\n    \"eval\",\n  ];\n  \n  // Resource quotas\n  max_cpu_ms: number;\n  max_memory_bytes: number;\n  max_iterations: number;\n}\n```\n\nFor WebAssembly-based custom reducers:\n\n```python\ndef execute_custom_reducer(wasm_module: bytes, events: list, params: dict) -> list:\n    \"\"\"Execute custom reducer in WASM sandbox.\"\"\"\n    \n    sandbox = WasmSandbox(\n        memory_limit=100 * 1024 * 1024,  # 100MB\n        fuel_limit=1_000_000,             # Instruction limit\n        timeout_ms=5000,\n    )\n    \n    try:\n        result = sandbox.execute(wasm_module, {\n            \"events\": events,\n            \"params\": params,\n        })\n        return result\n    except SandboxTimeout:\n        raise ViewExecutionError(\"Custom reducer timed out\")\n    except SandboxMemoryExceeded:\n        raise ViewExecutionError(\"Custom reducer exceeded memory limit\")\n```\n\n### 9.5 View Abuse Prevention ← **NEW SECTION**\n\nPreventing view-based DoS:\n\n```python\ndef check_view_abuse(user_id: str, view_def: ViewDefinition) -> bool:\n    \"\"\"Check for view abuse patterns.\"\"\"\n    \n    cost = estimate_view_cost(view_def)\n    \n    # Reject obviously expensive views\n    if cost.total > MAX_VIEW_COST:\n        raise ViewTooExpensive(f\"View cost {cost.total} exceeds limit {MAX_VIEW_COST}\")\n    \n    # Rate limit expensive views\n    recent_expensive = count_expensive_views(user_id, since=minutes_ago(10))\n    if recent_expensive > 10:\n        raise RateLimited(\"Too many expensive views\")\n    \n    # Track cumulative cost\n    cumulative_cost = get_cumulative_cost(user_id, since=hours_ago(1))\n    if cumulative_cost + cost.total > HOURLY_COST_LIMIT:\n        raise CostLimitExceeded(\"Hourly view cost limit exceeded\")\n    \n    return True\n```\n\n---\n\n## 10. Layer 7: Network Layer\n\n*[Same as v1.0 - see original spec]*\n\n---\n\n## 11. Layer 8: Application Layer\n\n*[Same as v1.0 - see original spec]*\n\n---\n\n\n" },
  { id: "protocol-sync-security", title: "MESH spec v1.1: sync protocol and security model", markdown: "# MESH spec v1.1: sync protocol and security model\n\n> Source: https://github.com/FraterCCCLXIII/mesh-protocol/blob/main/specs/MESH_PROTOCOL_v1.1.md (lines 1394-1488). Imported verbatim from the MESH protocol repository (CC0 1.0). Text is unedited; other sections of the source are omitted for length. The MESH repository itself is the authority; this is a copy.\n\n## 15. Sync Protocol\n\n### 15.1 Overview\n\nMESH uses **DAG-based sync** that handles multi-device naturally.\n\n### 15.2 Sync Algorithm (Updated for DAG)\n\n```python\nasync def sync_actor(actor_id: str, relay: Relay):\n    # 1. Get local heads (may be multiple)\n    local_heads = storage.get_heads(actor_id)\n    local_head_ids = {h.id for h in local_heads}\n    \n    # 2. Get remote heads\n    remote_heads = await relay.get_heads(actor_id)\n    remote_head_ids = {h.id for h in remote_heads}\n    \n    # 3. If same heads, in sync\n    if local_head_ids == remote_head_ids:\n        return\n    \n    # 4. Find missing events\n    local_known = storage.get_all_event_ids(actor_id)\n    remote_known = await relay.get_all_event_ids(actor_id)\n    \n    missing_local = remote_known - local_known\n    missing_remote = local_known - remote_known\n    \n    # 5. Fetch missing events\n    if missing_local:\n        events = await relay.get_events(actor_id, event_ids=missing_local)\n        for event in topological_sort(events):\n            if verify_event(event):\n                storage.store_event(event)\n    \n    # 6. Push events remote doesn't have\n    if missing_remote:\n        events = storage.get_events(actor_id, event_ids=missing_remote)\n        await relay.submit_events(events)\n    \n    # 7. Merge if needed\n    new_heads = storage.get_heads(actor_id)\n    if len(new_heads) > 1:\n        merge = auto_merge(new_heads)\n        storage.store_event(merge)\n        await relay.submit(merge)\n```\n\n---\n\n## 16. Security Model\n\n### 16.1 Updated Threat Model\n\n**In Scope:**\n- Impersonation (prevented by signatures)\n- Tampering (prevented by signatures + DAG)\n- Replay attacks (prevented by content-addressing)\n- Eavesdropping on DMs (prevented by E2EE)\n- **Key compromise on single device** (limited by device keys) ← **NEW**\n- **Malicious fork attacks** (detected and rate-limited) ← **NEW**\n\n**Out of Scope:**\n- Root key compromise (total identity loss)\n- Denial of service (relay responsibility)\n- Spam (addressed by moderation layer)\n- Sybil attacks (partially addressed by attestations)\n\n### 16.2 Device Key Compromise Response\n\nIf a device is compromised:\n\n```python\nasync def handle_device_compromise(root_key: SigningKeyPair, compromised_device_id: str):\n    # 1. Revoke compromised device\n    revocation = DeviceKeyRevocation(\n        device_id=compromised_device_id,\n        revoked_at=now(),\n        reason=\"compromised\",\n    )\n    revocation.sig = root_key.sign(...)\n    await relay.publish_revocation(revocation)\n    \n    # 2. Events from compromised device after revocation are invalid\n    # Clients MUST check revocation status when verifying\n    \n    # 3. Optionally: mark suspicious events\n    suspicious = get_events_by_device(compromised_device_id, since=suspected_compromise_time)\n    for event in suspicious:\n        await mark_as_suspicious(event)\n```\n\n---\n\n\n" },
];
// </docs:generated>

// ─── Styles ───────────────────────────────────────────────────────────────────────────────

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
.mh { --hg-bg: var(--oh-color-base, #171717); --hg-panel: var(--oh-color-base-secondary, #212121); --hg-raised: var(--oh-surface-raised, #2a2a2a);
  --hg-text: var(--oh-foreground, #eee); --hg-contrast: var(--oh-contrast, #fff); --hg-muted: var(--oh-muted, #9a9a9a);
  --hg-border: var(--oh-border-subtle, #3a3a3a); --hg-primary: var(--oh-accent, var(--oh-color-primary, #fff)); --hg-on-primary: var(--oh-accent-foreground, #111);
  --hg-on-contrast: var(--oh-contrast-foreground, #111);
  --hg-ok: var(--oh-success, #34d399); --hg-warn: var(--oh-warning-soft-foreground, #f2b51d); --hg-bad: var(--oh-danger-soft-foreground, #ef4444); --hg-info: var(--oh-info-soft-foreground, #7c9dff);
  box-sizing: border-box; position: sticky; top: 0; color: var(--hg-text); background: var(--hg-bg); font: 14px/1.45 system-ui, sans-serif;
  height: 100%; min-height: 480px; overflow: hidden; overscroll-behavior: contain; }
.mh *, .mh *::before, .mh *::after { box-sizing: border-box; }
.mh [hidden] { display: none !important; }
.mh button, .mh input, .mh textarea, .mh select { font: inherit; color: inherit; }
.mh button { cursor: pointer; }
.mh .shell { position: relative; display: grid; grid-template-columns: var(--grip-0, 300px) minmax(0, 1fr) var(--grip-1, 280px); height: 100%; min-height: 0; }
.mh .shell.welcoming { grid-template-columns: var(--grip-0, 300px) minmax(0, 1fr); }
.mh .col { display: flex; flex-direction: column; min-height: 0; min-width: 0; }
.mh .list { border-right: 1px solid var(--hg-border); background: var(--hg-bg); }
.mh .members { border-left: 1px solid var(--hg-border); background: var(--hg-bg); }
.mh .lhead, .mh .chead, .mh .mhead { flex: none; display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--hg-border); min-height: 56px; }
.mh .lhead h2, .mh .chead h2, .mh .mhead h2 { margin: 0; font-size: 15px; font-weight: 650; color: var(--hg-contrast); }
.mh .lhead .grow, .mh .chead .grow { flex: 1; min-width: 0; }
.mh .chead small, .mh .sub { color: var(--hg-muted); font-size: 12px; }
.mh .scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 8px; }
.mh .sect { margin: 10px 8px 4px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--hg-muted); }
.mh .row { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border: 0; border-radius: 12px; background: transparent; text-align: left; }
.mh .row:hover { background: var(--hg-panel); }
.mh .row[aria-current="true"] { background: var(--hg-raised); }
.mh .row .meta { min-width: 0; flex: 1; display: grid; }
.mh .row .name { font-weight: 550; color: var(--hg-contrast); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mh .row .prev { font-size: 12px; color: var(--hg-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mh .glyph { flex: none; width: 36px; height: 36px; display: grid; place-items: center; border-radius: 12px; background: var(--hg-panel); color: var(--hg-muted); font-weight: 700; }
.mh .avatar { flex: none; width: 36px; height: 36px; }
.mh .avatar svg { width: 100%; height: 100%; display: block; }
.mh .avatar.sm { width: 28px; height: 28px; }
.mh .status { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; font-size: 12px; border: 1px solid var(--hg-border); background: var(--hg-panel); color: var(--hg-text); }
.mh .status i { width: 8px; height: 8px; border-radius: 50%; background: var(--hg-muted); }
.mh .status[data-mode="connected"] i { background: var(--hg-ok); }
.mh .status[data-mode="demo"] i { background: var(--hg-warn); }
.mh .status[data-mode="connecting"] i { background: var(--hg-info); }
.mh .status[data-mode="disconnected"] i { background: var(--hg-bad); }
.mh .iconbtn { border: 0; background: transparent; border-radius: 10px; padding: 7px; line-height: 0; color: var(--hg-muted); }
.mh .iconbtn svg { width: 18px; height: 18px; display: block; }
.mh .lhead { align-items: flex-start; padding: 16px 14px 14px; }
.mh .lhead .sub { margin-top: 8px; }
.mh .mtitle { display: flex; align-items: center; gap: 10px; }
.mh .meshlogo { width: 26px; height: 26px; flex: none; display: block; }
.mh .iconbtn:hover { background: var(--hg-panel); color: var(--hg-contrast); }
.mh .notice { flex: none; margin: 8px 14px 0; padding: 8px 12px; border-radius: 10px; background: var(--hg-panel); border: 1px solid var(--hg-border); font-size: 13px; color: var(--hg-text); display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.mh .notice.warn { border-color: var(--hg-warn); }
.mh .notice.error { border-color: var(--hg-bad); }
.mh .notice button { border: 1px solid var(--hg-border); background: var(--hg-raised); border-radius: 8px; padding: 2px 10px; }
.mh .thread { flex: 1; min-height: 0; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.mh .empty { margin: auto; text-align: center; color: var(--hg-muted); max-width: 320px; }
.mh .msg { display: flex; gap: 10px; align-items: flex-start; }
.mh .msg.reply { margin-left: 38px; }
.mh .msg .mbody { min-width: 0; flex: 1; }
.mh .msg .who { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.mh .msg .who b { color: var(--hg-contrast); font-weight: 600; }
.mh .msg .who small { color: var(--hg-muted); font-size: 12px; }
.mh .msg .quote { margin: 2px 0; font-size: 12px; color: var(--hg-muted); border-left: 2px solid var(--hg-border); padding-left: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mh .msg.me .bubble { background: var(--hg-primary); color: var(--hg-on-primary); }
.mh .bubble { display: inline-block; max-width: min(100%, 640px); margin-top: 3px; padding: 8px 14px; border-radius: 16px; background: var(--hg-raised); overflow-wrap: anywhere; }
.mh .msg.me .bubble .md a, .mh .msg.me .bubble .md strong { color: inherit; }
.mh .acts { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 2px; opacity: .95; }
.mh .acts button { border: 0; background: transparent; color: var(--hg-muted); font-size: 12px; padding: 2px 6px; border-radius: 6px; }
.mh .acts button:hover { background: var(--hg-panel); color: var(--hg-contrast); }
.mh .badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; padding: 0 7px; line-height: 18px; border-radius: 999px; border: 1px solid currentColor; }
.mh .badge.bad { color: var(--hg-bad); } .mh .badge.warn { color: var(--hg-warn); } .mh .badge.ok { color: var(--hg-ok); } .mh .badge.info { color: var(--hg-info); }
.mh .folded { display: inline-flex; gap: 8px; align-items: center; margin-top: 3px; padding: 6px 12px; border-radius: 12px; border: 1px dashed var(--hg-border); color: var(--hg-muted); font-size: 13px; }
.mh .folded button { border: 0; background: transparent; color: var(--hg-info); text-decoration: underline; }
.mh .menu { position: absolute; z-index: 5; background: var(--hg-raised); border: 1px solid var(--hg-border); border-radius: 10px; padding: 4px; display: grid; min-width: 150px; box-shadow: 0 8px 24px rgba(0,0,0,.35); }
.mh .menu button { border: 0; background: transparent; text-align: left; padding: 6px 10px; border-radius: 6px; }
.mh .menu button:hover { background: var(--hg-panel); }
.mh .composerwrap { flex: none; padding: 8px 16px 14px; background: var(--hg-bg); }
.mh .composerbox { border: 1px solid var(--hg-border); border-radius: 18px; background: var(--hg-panel); padding: 8px 10px; display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; }
.mh .composerbox:focus-within { border-color: var(--hg-muted); }
.mh .composerbox .chip { flex-basis: 100%; font-size: 12px; color: var(--hg-muted); display: flex; gap: 8px; align-items: center; }
.mh .composerbox .chip button { border: 0; background: transparent; color: var(--hg-info); }
.mh .composerbox textarea { flex: 1; min-width: 0; resize: none; border: 0; outline: 0; background: transparent; padding: 6px 4px; max-height: 160px; }
.mh .send { border: 0; border-radius: 999px; background: var(--hg-primary); color: var(--hg-on-primary); padding: 7px 16px; font-weight: 500; }
.mh button.send:disabled { opacity: .75; cursor: not-allowed; }
.mh textarea:disabled { opacity: .45; cursor: not-allowed; }
.mh .search { display: flex; gap: 6px; padding: 8px 12px; }
.mh .search input, .mh .modal input, .mh .modal textarea, .mh .modal select { flex: 1; min-width: 0; border: 1px solid var(--hg-border); border-radius: 10px; background: var(--hg-panel); padding: 7px 10px; outline: 0; }
.mh .search button, .mh .modal button.btn { border: 1px solid var(--hg-border); background: var(--hg-raised); border-radius: 10px; padding: 6px 12px; }
.mh .mrow { display: flex; gap: 10px; align-items: center; padding: 8px 10px; border-radius: 12px; }
.mh .mrow:hover { background: var(--hg-panel); }
.mh .mrow .meta { flex: 1; min-width: 0; display: grid; cursor: pointer; }
.mh .mrow .name { font-weight: 550; color: var(--hg-contrast); display: flex; gap: 6px; align-items: center; min-width: 0; }
.mh .mrow .name > :first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mh .mrow .follow { border: 1px solid var(--hg-border); background: transparent; border-radius: 999px; font-size: 12px; padding: 1px 10px; }
.mh .powered { display: flex; align-items: center; gap: 6px; color: var(--hg-muted); font-size: 12px; }
.mh .plogo { display: inline-flex; color: inherit; opacity: .7; }
.mh .plogo:hover { opacity: 1; }
.mh .plogo svg { height: 16px; width: auto; }
.mh .plogo.artec { color: var(--oh-contrast, currentColor); opacity: .85; }
.mh .plogo.artec svg { height: 20px; }
.mh .lpowered { flex: none; justify-content: center; padding: 8px 10px; border-top: 1px solid var(--hg-border); }
.mh .welcome { flex: 1; position: relative; display: grid; place-items: center; align-content: center; text-align: center; overflow: hidden; padding: 24px 24px 64px; }
.mh .welcome .worb { width: 160px; height: 160px; margin: 0 auto 18px; }
.mh .welcome .worb svg { width: 100%; height: 100%; }
.mh .welcome .minis { display: flex; gap: 14px; justify-content: center; margin-bottom: 18px; }
.mh .welcome h1 { margin: 0 0 6px; font-size: 40px; font-weight: 300; letter-spacing: -.01em; color: var(--hg-contrast); }
.mh .welcome p { margin: 0 auto 18px; max-width: 360px; font-weight: 300; color: var(--hg-muted); }
.mh .welcome .wgo { border: 0; border-radius: 999px; background: var(--hg-contrast); color: var(--hg-on-contrast); padding: 10px 22px; }
.mh .welcome .wpowered { position: absolute; left: 0; right: 0; bottom: 16px; justify-content: center; }
.mh .welcome .wactions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.mh .welcome .wdocs { border: 1px solid var(--hg-border); border-radius: 999px; background: transparent; color: var(--hg-text); padding: 10px 18px; }
.mh .welcome .wdocs:hover { background: var(--hg-panel); color: var(--hg-contrast); }
.mh .docslink { flex: none; align-self: flex-start; margin: 0 12px 4px; border: 0; background: transparent; color: var(--hg-muted); font-size: 12px; padding: 2px 6px; border-radius: 6px; text-decoration: underline; text-underline-offset: 2px; }
.mh .docslink:hover { background: var(--hg-panel); color: var(--hg-contrast); }
.mh .docs { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.mh .docs .headbtn { border: 1px solid var(--hg-border); background: var(--hg-raised); border-radius: 8px; padding: 4px 12px; }
.mh .docs .dbody { flex: 1; min-height: 0; display: grid; grid-template-columns: 240px minmax(0, 1fr); }
.mh .docs .dnav { overflow-y: auto; padding: 8px; display: grid; align-content: start; gap: 2px; }
.mh .docs .dlink { white-space: normal; font-size: 13px; line-height: 18px; }
.mh .docs .dpage { overflow-y: auto; padding: 12px 24px 32px; min-width: 0; }
.mh .docs .dpage > h2 { margin: 12px 0; font-size: 20px; line-height: 28px; color: var(--hg-contrast); outline: none; }
.mh .docs .dpage > h2:focus-visible { outline: 2px solid var(--hg-info); outline-offset: 4px; border-radius: 4px; }
.mh .docs .dtools { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.mh .docs .dpage .md { max-width: 820px; }
@media (max-width: 700px) { .mh .docs .dbody { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); } .mh .docs .dnav { max-height: 30vh; border-bottom: 1px solid var(--hg-border); } .mh .docs .dpage { padding: 12px 16px 24px; } }
.mh .overlay { position: absolute; inset: 0; background: rgba(0,0,0,.5); display: grid; place-items: center; z-index: 10; padding: 16px; }
.mh .modal { width: min(520px, 100%); max-height: 100%; overflow-y: auto; background: var(--hg-panel); border: 1px solid var(--hg-border); border-radius: 16px; padding: 18px; display: grid; gap: 10px; }
.mh .modal h3 { margin: 0; color: var(--hg-contrast); }
.mh .modal label { display: grid; gap: 4px; font-size: 12px; color: var(--hg-muted); }
.mh .modal .line { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.mh .modal .hint { font-size: 12px; color: var(--hg-muted); }
.mh .modal code { font: 12px ui-monospace, SF Mono, Menlo, monospace; word-break: break-all; }
.mh .md { display: grid; gap: 8px; min-width: 0; line-height: 1.5; }
.mh .md p, .mh .md ul, .mh .md ol, .mh .md blockquote, .mh .md h3, .mh .md h4, .mh .md h5, .mh .md h6, .mh .md hr { margin: 0; }
.mh .md h3, .mh .md h4, .mh .md h5, .mh .md h6 { font-size: 15px; font-weight: 650; color: var(--hg-contrast); }
.mh .md strong { font-weight: 650; color: var(--hg-contrast); }
.mh .md a { color: var(--hg-info); text-decoration: underline; text-underline-offset: 2px; }
.mh .md ul, .mh .md ol { padding-left: 22px; display: grid; gap: 3px; }
.mh .md blockquote { border-left: 3px solid var(--hg-border); padding: 2px 0 2px 12px; color: var(--hg-muted); }
.mh .md hr { border: 0; border-top: 1px solid var(--hg-border); }
.mh .md code { font: 12.5px ui-monospace, SF Mono, Menlo, monospace; background: rgba(255,255,255,.08); border-radius: 5px; padding: 1px 5px; overflow-wrap: anywhere; }
.mh .md .mdcode { border: 1px solid var(--hg-border); border-radius: 10px; overflow: hidden; background: #0e0e10; color: #eee; }
.mh .md .mdcodebar { display: flex; align-items: center; justify-content: space-between; padding: 4px 10px; font-size: 11px; color: #9a9a9a; border-bottom: 1px solid var(--hg-border); }
.mh .md .mdcodebar button { border: 0; background: transparent; color: #9a9a9a; font-size: 11px; }
.mh .md pre { margin: 0; padding: 10px 12px; overflow-x: auto; font: 12.5px/1.55 ui-monospace, SF Mono, Menlo, monospace; }
.mh .md pre code { background: none; padding: 0; }
.mh .md .mdtable { overflow-x: auto; border: 1px solid var(--hg-border); border-radius: 10px; }
.mh .md table { border-collapse: collapse; width: 100%; font-size: 13px; }
.mh .md th, .mh .md td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--hg-border); }
.mh .orb-body { transform-box: view-box; transform-origin: 32px 34px; animation: mhOrb 5s ease-in-out infinite alternate; }
.mh .orb-look { animation: mhLook 8s ease-in-out infinite; }
.mh .orb-blink { transform-box: view-box; transform-origin: 32px 33px; animation: mhBlink 6s infinite; }
@keyframes mhOrb { 0% { transform: scale(1, 1) rotate(0deg); } 100% { transform: scale(1.05, .95) rotate(-3deg); } }
@keyframes mhLook { 0%, 38% { transform: translateX(0); } 46%, 66% { transform: translateX(3px); } 76%, 92% { transform: translateX(-3px); } 100% { transform: translateX(0); } }
@keyframes mhBlink { 0%, 91%, 100% { transform: scaleY(1); } 94% { transform: scaleY(.1); } }
@media (prefers-reduced-motion: reduce) { .mh .orb-body, .mh .orb-look, .mh .orb-blink { animation: none; } }
.mh button:focus-visible, .mh input:focus-visible, .mh textarea:focus-visible, .mh select:focus-visible, .mh a:focus-visible { outline: 2px solid var(--hg-info); outline-offset: 2px; }
.mh button:disabled, .mh input:disabled, .mh select:disabled { opacity: .55; cursor: not-allowed; }
.mh .sect.hasaction { display: flex; justify-content: space-between; align-items: center; }
.mh .sectbtn { border: 0; background: transparent; color: var(--hg-info); font-size: 11px; letter-spacing: 0; text-transform: none; padding: 0 4px; }
.mh .acct { flex: none; border-top: 1px solid var(--hg-border); border-radius: 0; padding: 10px 14px; }
.mh .headbtn { border: 1px solid var(--hg-border); background: var(--hg-raised); border-radius: 999px; padding: 3px 14px; font-size: 13px; }
.mh .headbtn.primary, .mh .btn.primary, .mh .modal button.btn.primary { background: var(--hg-primary); color: var(--hg-on-primary); border-color: transparent; }
.mh .btn.danger, .mh .dangerbtn { color: var(--hg-bad) !important; border-color: var(--hg-bad) !important; }
.mh .modal form { display: grid; gap: 10px; }
.mh .modal h4 { margin: 4px 0 0; color: var(--hg-contrast); font-size: 14px; }
.mh .modal .checkrow { display: flex; flex-direction: row; align-items: center; gap: 8px; font-size: 13px; color: var(--hg-text); }
.mh .modal .checkrow input { flex: none; width: auto; }
.mh .modal .hint { font-size: 12px; color: var(--hg-muted); }
.mh .flash { min-height: 0; font-size: 13px; }
.mh .flash:empty { display: none; }
.mh .flash.ok { color: var(--hg-ok); }
.mh .flash.err { color: var(--hg-bad); }
.mh .warnbox { border: 1px solid var(--hg-warn); border-radius: 10px; padding: 8px 12px; font-size: 13px; background: var(--hg-bg); }
.mh .whocard { display: flex; gap: 12px; align-items: center; padding: 8px; border: 1px solid var(--hg-border); border-radius: 12px; background: var(--hg-bg); }
.mh .whocard .avatar { width: 44px; height: 44px; }
.mh .whocard .meta { display: grid; min-width: 0; }
.mh .whocard b { color: var(--hg-contrast); }
.mh .facts { margin: 0; padding-left: 18px; display: grid; gap: 3px; font-size: 12px; color: var(--hg-muted); }
.mh .factlist { display: grid; gap: 6px; max-height: 180px; overflow-y: auto; }
.mh .modal .closebtn { justify-self: start; border: 1px solid var(--hg-border); background: var(--hg-raised); border-radius: 10px; padding: 6px 12px; }
.mh .notice.ok { border-color: var(--hg-ok); }
.mh .labelinfo { margin-top: 3px; font-size: 12px; color: var(--hg-muted); }
.mh .acts .confirm { font-size: 12px; color: var(--hg-bad); padding: 2px 6px; }
.mh .acts button[aria-pressed="true"] { color: var(--hg-contrast); font-weight: 600; }
.mh .mediachips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; flex-basis: 100%; margin-top: 4px; font-size: 12px; }
.mh .mediachips a { color: var(--hg-info); }
.mh .mchip { display: inline-flex; gap: 4px; align-items: center; padding: 1px 8px; border: 1px solid var(--hg-border); border-radius: 999px; }
.mh .mchip button { border: 0; background: transparent; color: var(--hg-muted); padding: 0 2px; }
.mh .mediachips input { flex: 1; min-width: 160px; border: 1px solid var(--hg-border); border-radius: 8px; background: var(--hg-bg); padding: 3px 8px; }
.mh .attachbtn { border: 0; background: transparent; color: var(--hg-muted); font-size: 12px; padding: 6px; }
.mh .tabs { display: flex; gap: 6px; padding: 0 12px 6px; }
.mh .tab { border: 1px solid var(--hg-border); background: transparent; border-radius: 999px; padding: 1px 10px; font-size: 12px; color: var(--hg-muted); }
.mh .tab[aria-pressed="true"] { background: var(--hg-raised); color: var(--hg-contrast); }
.mh .mrow.found { background: var(--hg-panel); }
.mh .mrow .follow { flex: none; }
.mh .back { display: none; }
@media (max-width: 1000px) { .mh .shell { grid-template-columns: var(--grip-0, 260px) minmax(0, 1fr); } .mh .shell.welcoming { grid-template-columns: var(--grip-0, 260px) minmax(0, 1fr); } .mh .members { display: none; } }
@media (max-width: 700px) {
  .mh .shell, .mh .shell.welcoming { grid-template-columns: minmax(0, 1fr); }
  .mh[data-pane="list"] .main, .mh[data-pane="chat"] .list { display: none; }
  .mh .back { display: inline-block; }
}
/* Feed app sizing: 14px text, 12px meta, 16px gutters, 12px gaps, 32px avatars, 16px section titles. */
.mh { font-size: 14px; line-height: 20px; }
.mh small, .mh .sub, .mh .sectionlabel, .mh .sect { font-size: 12px; line-height: 16px; }
.mh h1, .mh .lhead h2, .mh .chead h2, .mh .mhead h2, .mh .brand h1 { font-size: 16px; line-height: 24px; font-weight: 600; }
.mh .lhead, .mh .chead, .mh .mhead, .mh .brand { padding-left: 16px; padding-right: 16px; }
.mh .msg { gap: 12px; }
.mh .thread, .mh .body { padding: 12px 16px; gap: 12px; }
.mh .composerwrap { padding: 8px 16px 14px; }
.mh .row { gap: 12px; padding-left: 12px; padding-right: 12px; }
.mh .avatar { width: 32px; height: 32px; }
/* Fewer rules: the rails separate from the page by tone, not by lines. */
.mh .list { border: 0; background: transparent; }
.mh .members { border: 0; background: var(--hg-panel); }
/* While the welcome screen is up, the nav is dimmed and inert behind it. */
.mh .shell.welcoming .list { position: relative; pointer-events: none; user-select: none; }
.mh .shell.welcoming .list::after { content: ""; position: absolute; inset: 0; background: rgba(0, 0, 0, .55); }
.mh .lhead, .mh .chead, .mh .mhead, .mh .lpowered, .mh .acct { border: 0; }
.mh .msg .quote { border-left: 0; }
` + GRIP_CSS;

// ─── The page ─────────────────────────────────────────────────────────────────────────────

function el(tag, cls, content) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (content !== undefined) node.textContent = content;
  return node;
}

function btn(label, onClick, cls = "") {
  const b = el("button", cls, label);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

function avatar(entityId, small) {
  const wrap = el("span", `avatar${small ? " sm" : ""}`);
  wrap.append(blobSvg(blobIdFor(entityId || "?")));
  return wrap;
}

/** A labelled form control. The label wraps the control, so clicking the text focuses it. */
function field(text, control, hint) {
  const l = el("label");
  l.append(el("span", "", text), control);
  if (hint) l.append(el("small", "hint", hint));
  return l;
}

function checkRow(text, checked = false) {
  const l = el("label", "checkrow");
  const input = el("input");
  input.type = "checkbox";
  input.checked = checked;
  l.append(input, el("span", "", text));
  return { wrap: l, input };
}

/** A live status line: info while working, ok/err when done. Errors use role=alert so screen readers announce them. */
function statusLine() {
  const n = el("div", "flash");
  n.setAttribute("role", "status");
  n.setAttribute("aria-live", "polite");
  const set = (cls, role, text) => { n.className = `flash ${cls}`.trim(); n.setAttribute("role", role); n.textContent = text; };
  return {
    el: n,
    info: (t) => set("", "status", t),
    ok: (t) => set("ok", "status", t),
    err: (t) => set("err", "alert", t),
    clear: () => { n.className = "flash"; n.textContent = ""; },
  };
}

/** Disables the whole form while `fn` runs and relabels the submit button; restores both unless the dialog was re-rendered. */
async function withBusy(form, button, busyLabel, fn) {
  const label = button.textContent;
  const controls = [...form.querySelectorAll("button, input, textarea, select")];
  const before = controls.map((c) => c.disabled);
  controls.forEach((c) => { c.disabled = true; });
  button.textContent = busyLabel;
  form.setAttribute("aria-busy", "true");
  try { return await fn(); } finally {
    if (button.isConnected) {
      controls.forEach((c, i) => { c.disabled = before[i]; });
      button.textContent = label;
      form.removeAttribute("aria-busy");
    }
  }
}

/** Client-side input rules (the nodes accept any string; these keep ids and URLs sane). */
export function validateProfileInput({ handle = "", name = "", bio = "" }) {
  if (handle && !/^[A-Za-z0-9_.-]{2,32}$/.test(handle)) return "Handle must be 2 to 32 characters: letters, numbers, dot, dash or underscore.";
  if (!name.trim()) return "Enter a display name.";
  if (name.trim().length > 60) return "Display name is limited to 60 characters.";
  if (bio.length > 280) return "Bio is limited to 280 characters.";
  return "";
}

/* Canonical "Coming Soon" splash for self-contained Canvas Apps. Copy this block into your extension.js
   (no imports) and call mountComingSoonSplash(root, {...}) at the end of the page mount. See README.md. */
const CS_DATE = "December 2026";
const CS_DEFAULTS = {
  coming: "Coming Soon",
  sub: "A preview is available today. Features may change before launch.",
  preview: "Preview",
  close: "Close",
};
// Footer: the logo row and the copyright / legal disclosure. The wording is the Apps page brand notice
// (src/constants/brand-notice.ts) in English; override any line through `footer.legal`, or pass `footer: false`.
const CS_LEGAL = {
  builtWith: "Built with Kamiji, Kosmos and Artec",
  toggle: "Legal notice",
  copyright: "\u00a9 2026 Artec, Paul Bloch, Modern Telepathy Inc and Automic Intelligence Holdings. All rights reserved.",
  marks: "Tower\u2122, Commons\u2122, Kosmos\u2122, Kamiji\u2122, Bitkin\u2122, Holons\u2122, Hangout\u2122, MESH\u2122 and DocTransit\u2122 are trademarks of Artec, Paul Bloch, Modern Telepathy Inc and Automic Intelligence Holdings.",
  dated: "Notice dated October 30, 2026.",
  preview: "Preview software is provided as is, without warranty, and may change before launch.",
};
// Light-on-dark marks as tiny data-URL SVGs (no network): the same shapes as public/logos/*.svg.
const CS_LOGOS = [
  { name: "Kamiji\u2122", height: 20, src: "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%20276%20118%22%3E%3Cdefs%3E%3Cg%20id=%22k%22%20fill=%22none%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22%3E%3Cpath%20d=%22M18%2024V82M46%2024L20%2054M28%2050L48%2082%22/%3E%3Ccircle%20cx=%2280%22%20cy=%2264%22%20r=%2216%22/%3E%3Cpath%20d=%22M96%2048V82%22/%3E%3Cpath%20d=%22M120%2048V82M120%2060Q120%2048%20134%2048Q148%2048%20148%2062V82M148%2062Q148%2048%20162%2048Q176%2048%20176%2062V82%22/%3E%3Cpath%20d=%22M198%2048V82M198%2026V26%22/%3E%3Cpath%20d=%22M224%2048V86Q224%2098%20210%2098M224%2026V26%22/%3E%3Cpath%20d=%22M250%2048V82M250%2026V26%22/%3E%3C/g%3E%3C/defs%3E%3Cuse%20href=%22%23k%22%20stroke=%22%231d2a20%22%20stroke-width=%2230%22/%3E%3Cuse%20href=%22%23k%22%20stroke=%22%23ffd23f%22%20stroke-width=%2218%22/%3E%3Cuse%20href=%22%23k%22%20stroke=%22%23fff%22%20stroke-opacity=%22.6%22%20stroke-width=%223.5%22%20transform=%22translate(-3.5%20-3.5)%22/%3E%3C/svg%3E" },
  { name: "Kosmos\u2122", height: 16, src: "data:image/svg+xml;charset=utf-8,%3Csvg%20id=%22Layer_1%22%20data-name=%22Layer%201%22%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%20405.3%2082.71%22%3E%3Cdefs%3E%3Cstyle%3E%20.cls-1%20%7B%20fill:%20%23ffffff;%20%7D%20%3C/style%3E%3C/defs%3E%3Cpath%20class=%22cls-1%22%20d=%22M79.81,54.47c-2.27-3.14-3.59-7.14-3.59-11.73,0-11.39,8.05-19.17,18.75-19.17,5.44,0,10.18,2.02,13.54,5.49,2.77-3.32,28.03-25.97,31.05-29.06-24.12,19.01-35.79,11.75-44.59,11.75-18.92,0-32.79,13.18-32.79,30.99,0,8.04,2.84,15.14,7.69,20.51%22/%3E%3Cpath%20class=%22cls-1%22%20d=%22M111.85,33.96c1.19,2.57,1.86,5.52,1.86,8.77,0,11.38-8.05,19.17-18.75,19.17-4.03,0-7.67-1.1-10.66-3.09-3.54,2.54-21.13,20.86-24.29,23.89,18.2-10.53,26.87-8.99,34.95-8.99,18.83,0,32.79-13.1,32.79-30.99,0-6.58-2.16-12.99-5.7-18.17l-10.2,9.4Z%22/%3E%3Cpath%20class=%22cls-1%22%20d=%22M137.56,66.79l4.71-10.44c5.05,3.68,12.58,6.25,19.77,6.25,8.22,0,11.56-2.74,11.56-6.42,0-11.21-34.84-3.51-34.84-25.77,0-10.19,8.22-18.66,25.25-18.66,7.53,0,15.24,1.8,20.8,5.31l-4.28,10.53c-5.56-3.17-11.3-4.71-16.61-4.71-8.22,0-11.39,3.08-11.39,6.85,0,11.04,34.84,3.42,34.84,25.42,0,10.02-8.3,18.58-25.42,18.58-9.5,0-19.09-2.83-24.4-6.93Z%22/%3E%3Cpath%20class=%22cls-1%22%20d=%22M254.75,72.7l-.09-35.95-17.63,29.62h-6.25l-17.55-28.85v35.18h-13.01V12.78h11.47l22.43,37.24,22.09-37.24h11.39l.17,59.92h-13.01Z%22/%3E%3Cpath%20class=%22cls-1%22%20d=%22M280.39,42.78c0-17.81,13.87-30.99,32.79-30.99s32.79,13.1,32.79,30.99-13.95,30.99-32.79,30.99-32.79-13.18-32.79-30.99ZM331.93,42.78c0-11.39-8.05-19.17-18.75-19.17s-18.75,7.79-18.75,19.17,8.05,19.17,18.75,19.17,18.75-7.79,18.75-19.17Z%22/%3E%3Cpath%20class=%22cls-1%22%20d=%22M355.48,66.84l4.71-10.44c5.05,3.68,12.58,6.25,19.77,6.25,8.22,0,11.56-2.74,11.56-6.42,0-11.21-34.84-3.51-34.84-25.77,0-10.19,8.22-18.66,25.25-18.66,7.53,0,15.24,1.8,20.8,5.31l-4.28,10.53c-5.56-3.17-11.3-4.71-16.61-4.71-8.22,0-11.39,3.08-11.39,6.85,0,11.04,34.84,3.42,34.84,25.42,0,10.02-8.3,18.58-25.42,18.58-9.5,0-19.09-2.83-24.4-6.93Z%22/%3E%3Cpath%20class=%22cls-1%22%20d=%22M13.78,39.15V12.78H0v59.92h13.78v-15.15l.03-.03%22/%3E%3Cpolygon%20class=%22cls-1%22%20points=%2228.22%2042.74%2056.22%2072.7%2038.43%2072.7%2019.09%2052.01%2013.81%2046.36%2010.43%2042.74%2013.78%2039.15%2013.81%2039.12%2038.43%2012.78%2056.22%2012.78%2031.06%2039.7%2028.22%2042.74%22/%3E%3C/svg%3E" },
  { name: "Artec", height: 20, src: "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%20174%2076%22%3E%3Cmask%20id=%22a%22%20maskUnits=%22userSpaceOnUse%22%20x=%220%22%20y=%220%22%20width=%22174%22%20height=%2276%22%3E%3Crect%20width=%22174%22%20height=%2276%22%20fill=%22%23fff%22/%3E%3Cpath%20d=%22M128.79%2031.06V44.53L138.79%2040.17V44.81L124.54%2051.02V24.57L138.79%2030.78V35.42L128.79%2031.06ZM108.79%2022.34V35.68H116.29V39.93H108.79V53.26L118.79%2048.9V53.53L104.54%2059.74V15.85L118.79%2022.06V26.7L108.79%2022.34ZM98.79%2013.33V17.98L88.79%2013.61V66.62L86.67%2067.54L84.54%2066.62V13.61L74.54%2017.97V13.33L86.67%208.04004L98.79%2013.33ZM65.83%2035.05L68.79%2033.75V15.84L54.54%2022.06V53.53L58.79%2055.38V38.11L61.91%2036.74L69.61%2060.11L72.45%2061.34H72.74V61.48L74.84%2062.39L65.83%2035.05ZM64.54%2030.96L58.79%2033.47V24.84L64.54%2022.33V30.96ZM34.54%2030.78V44.81L38.79%2046.66V42.07H44.54V49.17L48.79%2051.02V24.57L34.54%2030.78ZM44.54%2037.82H38.79V33.56L44.54%2031.05V37.82Z%22%20fill=%22%23fff%22/%3E%3C/mask%3E%3Cpath%20d=%22M86.67%200L0%2037.81L86.68%2075.11L173.35%2037.31L86.67%200Z%22%20fill=%22%23fff%22%20mask=%22url(%23a)%22/%3E%3C/svg%3E" },
];
// Every state selector, so host CSS such as `button:hover{color:#fff}` can never make a label white-on-white.
const CS_STATES = ["", ":hover", ":focus", ":focus-visible", ":active", ":disabled"];
// One rule per state (never a combined list): an engine that does not know a pseudo-class would drop the whole list.
const csRules = (s, decl) => CS_STATES.map((p) => `.cs-splash ${s}${p},.cs-splash ${s}${p} *{${decl}}`).join("\n");
const CS_CSS = `
.cs-splash{position:absolute;inset:0;z-index:1000;overflow:auto;background:#0b0b0f;color:#fff;font-family:-apple-system,"SF Pro Display",Inter,"Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.cs-splash *{box-sizing:border-box}
.cs-hero{position:relative;z-index:0;flex:0 1 auto;width:min(42vh,76vw,400px);aspect-ratio:1;margin:-6px 0 -2px;pointer-events:none}
.cs-hero::before{content:"";position:absolute;inset:-26%;border-radius:50%;background:radial-gradient(circle,rgba(var(--cs-rgb),.42),rgba(var(--cs-rgb),.12) 48%,transparent 70%);filter:blur(18px)}
.cs-hero::after{content:"";position:absolute;left:18%;right:18%;bottom:-3%;height:9%;border-radius:50%;background:radial-gradient(closest-side,rgba(0,0,0,.6),transparent);filter:blur(6px)}
.cs-hero canvas{position:absolute;left:-25%;top:-25%;width:150%;height:150%;-webkit-mask-image:radial-gradient(closest-side,#000 72%,transparent 100%);mask-image:radial-gradient(closest-side,#000 72%,transparent 100%)}
.cs-stage>*{position:relative;z-index:1}
.cs-stage>.cs-hero{z-index:0}
.cs-stage{position:relative;min-height:100%;margin:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:28px 24px;text-align:center}
.cs-logo{display:flex;align-items:center;justify-content:center;max-width:100%;min-height:56px;font-size:clamp(34px,9vw,56px);font-weight:600;letter-spacing:-.02em}
.cs-logo img,.cs-logo svg{max-height:96px;max-width:min(80vw,320px)}
.cs-splash .cs-tag{margin:0;max-width:34ch;font-size:clamp(15px,3.8vw,18px);line-height:1.45;color:rgba(255,255,255,.88)!important}
.cs-splash .cs-pill{display:inline-flex;align-items:center;gap:8px;margin-top:10px;padding:6px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.08);font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#fff!important}
.cs-pill i{width:8px;height:8px;border-radius:50%;background:var(--cs-tint)}
.cs-splash .cs-date{margin:0;font-size:clamp(40px,min(12vw,10.5vh),96px);font-weight:400;letter-spacing:-.035em;line-height:1.02;color:#fff!important}
.cs-splash .cs-sub{margin:0;max-width:40ch;font-size:14px;line-height:1.5;color:rgba(255,255,255,.8)!important}
.cs-splash button.cs-btn{appearance:none;-webkit-appearance:none;margin-top:10px;padding:12px 30px;border:0!important;border-radius:999px;background:#fff!important;font-family:inherit!important;font-size:15px;font-weight:600;line-height:1.2;letter-spacing:normal;text-transform:none;text-indent:0;cursor:pointer;opacity:1}
${csRules("button.cs-btn.cs-primary", "color:#0b0b12!important;-webkit-text-fill-color:#0b0b12!important;text-shadow:none!important;opacity:1!important;visibility:visible!important")}
.cs-splash button.cs-btn.cs-primary:hover,.cs-splash button.cs-btn.cs-primary:active{background:#e9e9f0!important}
.cs-splash button.cs-btn.cs-primary:focus,.cs-splash button.cs-btn.cs-primary:focus-visible{background:#f2f2f7!important}
.cs-splash button.cs-x{appearance:none;-webkit-appearance:none;position:absolute;top:14px;right:14px;z-index:2;width:36px;height:36px;padding:0;border-radius:50%;border:1px solid rgba(255,255,255,.3)!important;background:rgba(255,255,255,.1)!important;font-family:inherit!important;font-size:18px;line-height:1;cursor:pointer}
${csRules("button.cs-x", "color:#fff!important;-webkit-text-fill-color:#fff!important;text-shadow:none!important;opacity:1!important;visibility:visible!important")}
.cs-splash button.cs-x:hover,.cs-splash button.cs-x:active{background:rgba(255,255,255,.22)!important}
.cs-splash button.cs-btn:focus-visible,.cs-splash button.cs-x:focus-visible{outline:3px solid #fff!important;outline-offset:3px!important}
.cs-foot{display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;max-width:440px;margin-top:28px}
.cs-logos{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:14px}
.cs-logos img{width:auto;opacity:.78}
.cs-splash .cs-legal{margin:0;max-width:40ch;font-size:12px;line-height:1.5;color:rgba(255,255,255,.72)!important}
.cs-splash button.cs-legal-btn{appearance:none;-webkit-appearance:none;padding:2px 4px;border:0!important;background:none!important;font-family:inherit!important;font-size:12px;text-decoration:underline;text-underline-offset:2px;cursor:pointer}
${csRules("button.cs-legal-btn", "color:rgba(255,255,255,.8)!important;-webkit-text-fill-color:rgba(255,255,255,.8)!important;text-shadow:none!important;opacity:1!important;visibility:visible!important")}
.cs-splash button.cs-legal-btn:hover,.cs-splash button.cs-legal-btn:focus-visible{color:#fff!important}
.cs-splash button.cs-legal-btn:focus-visible{outline:3px solid #fff!important;outline-offset:3px!important}
.cs-legal-panel{display:flex;flex-direction:column;gap:6px;text-align:center}
.cs-legal-panel[hidden]{display:none}
`;
// The hero Kamiji: a compact port of the Hangout welcome blob (metaball mass, sphere-shaded gradient, pill eyes that
// follow the pointer and blink). Shapes and hues are seeded from the brand id so every app has its own Kamiji.
const csClamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// Alpha across the metaball edge: a smoothstep over a soft band, so the silhouette has no stair-steps.
const csBlobAlpha = (f) => { const x = csClamp((f - 0.82) / 0.36, 0, 1); return x * x * (3 - 2 * x); };
// Weighted colour mix: satellites blend into the body by their share of the field, never as flat discs.
const csBlendSats = (body, sats, f) => {
  const total = sats.reduce((a, s) => a + s.q, 0);
  if (!total || f <= 0) return body;
  const mix = csClamp((total / f) * 1.6, 0, 1);
  return body.map((v, k) => Math.round(v + (sats.reduce((a, s) => a + s.c[k] * s.q, 0) / total - v) * mix));
};
const csAround = (n, f) => Array.from({ length: n }, (_, i) => f((i / n) * Math.PI * 2));
const CS_SHAPES = [
  null,
  { k: 1.35, lr: 0.6, main: 0.7, poly: csAround(6, (a) => [Math.cos(a - 1.571) * 1.08, Math.sin(a - 1.571) * 1.08]) },
  { k: 1.45, lr: 0.52, main: 0.55, poly: csAround(32, (a) => [(16 * Math.sin(a) ** 3) / 15, -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 15 + 0.08]) },
  { k: 1.25, lr: 0.6, main: 0.75, poly: [[-0.95, -0.95], [0.95, -0.95], [0.95, 0.95], [-0.95, 0.95]] },
];
function csPerimeter(poly, n) {
  const pts = [...poly, poly[0]];
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const total = lens.reduce((a, b) => a + b, 0);
  return Array.from({ length: n }, (_, k) => {
    let d = (k / n) * total, i = 0;
    while (i < lens.length - 1 && d > lens[i]) { d -= lens[i]; i += 1; }
    const f = lens[i] ? d / lens[i] : 0;
    return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
  });
}
function csRng(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function csHue(rgb) {
  const [r, g, b] = rgb.split(",").map((v) => v / 255);
  const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
  if (!d) return 260;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
function csHsl(h, sat, l) {
  const hh = (((h % 360) + 360) % 360) / 30, a = sat * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + hh) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0), f(8), f(4)].map((v) => Math.round(csClamp(v, 0, 1) * 255));
}

/** Builds the big Kamiji canvas. Returns { el, start, stop } or null when canvas 2D is unavailable. */
function csHero(doc, host, brand, rgb, still) {
  const win = doc.defaultView;
  const canvas = doc.createElement("canvas");
  let ctx = null;
  try { ctx = canvas.getContext && canvas.getContext("2d"); } catch (e) { /* no canvas */ }
  if (!ctx) return null;
  const rng = csRng(String(brand));
  const h0 = csHue(rgb);
  const shape = CS_SHAPES[Math.floor(rng() * CS_SHAPES.length)];
  const pts = shape && csPerimeter(shape.poly, 10);
  const spread = 22 + rng() * 30, flow = 0.4 + rng() * 0.5, phase = rng() * 6.28;
  const mini = [csHsl(h0 + 150 + rng() * 60, 0.75, 0.62), csHsl(h0 - 60 - rng() * 40, 0.8, 0.64), csHsl(h0 + 40 + rng() * 40, 0.8, 0.66)];
  const lobes = Array.from({ length: 10 }, (_, i) => ({ a: (i / 10) * 6.283, sp: 0.4 + i * 0.07, ph: i * 1.3, rs: 0.5 + 0.12 * (i % 3), x: null, y: 0, r: 0 }));
  const minis = mini.map((c, i) => ({ c, a: phase + i * 2.1, sp: 0.16 + rng() * 0.12, d: 0.3 + rng() * 0.05, r: 0.05 + rng() * 0.025 }));
  const off = doc.createElement("canvas");
  const eyes = { yaw: 0, pitch: 0, vy: 0, vp: 0, ty: 0, tp: 0, look: 0.6, blinkAt: 1.5 + rng() * 2, blinkP: -1, closed: 0 };
  const sc = { t: 0, px: 0, py: 0, at: -9, balls: [], fx: 0, fy: 0, R: 1, base: 1, C: 300, cell: 4, dpr: 1 };
  let last = 0, raf = 0, alive = true;
  const field = (x, y, n) => {
    let f = 0;
    for (let i = 0; i < n; i += 1) { const b = sc.balls[i], dx = x - b.x, dy = y - b.y; f += (b.r * b.r) / (dx * dx + dy * dy + 1); }
    return f;
  };
  const step = (dt) => {
    const { C, base } = sc, t = (sc.t += dt), cx = C / 2 + Math.sin(t * 0.7) * base * 0.1, cy = C / 2 + Math.cos(t * 0.55) * base * 0.08;
    const ease = dt === 0 ? 1 : Math.min(1, dt * 6);
    const balls = [{ x: cx, y: cy, r: base * (shape ? shape.main : 1) * (1 + 0.05 * Math.sin(t * 1.9)) }];
    lobes.forEach((l, i) => {
      let tx, ty, tr;
      if (pts) {
        tx = pts[i][0] * base * shape.k + Math.sin(t * 1.3 + l.ph) * base * 0.07;
        ty = pts[i][1] * base * shape.k + Math.cos(t * 1.1 + l.ph) * base * 0.07;
        tr = base * shape.lr * (1 + 0.1 * Math.sin(t * 2.1 + l.ph));
      } else {
        const reach = base * 0.42 * (1 + 0.28 * Math.sin(t * 1.3 + l.ph));
        tx = Math.cos(l.a + t * l.sp) * reach;
        ty = Math.sin(l.a + t * l.sp * 0.9) * reach;
        tr = base * l.rs * (1 + 0.14 * Math.sin(t * 2.1 + l.ph));
      }
      if (l.x === null) { l.x = tx; l.y = ty; l.r = tr; }
      l.x += (tx - l.x) * ease; l.y += (ty - l.y) * ease; l.r += (tr - l.r) * ease;
      balls.push({ x: cx + l.x, y: cy + l.y, r: l.r });
    });
    sc.mass = balls.length;
    minis.forEach((m) => balls.push({ x: cx + Math.cos(m.a + t * m.sp) * C * m.d, y: cy + Math.sin(m.a + t * m.sp * 1.1) * C * m.d * 0.9, r: C * m.r * (1 + 0.1 * Math.sin(t * 3 + m.a)) }));
    sc.balls = balls;
    sc.fx = cx; sc.fy = cy;
    let sum = 0;
    for (let k = 0; k < 12; k += 1) {
      const a = (k / 12) * 6.283;
      let r = base * 0.4;
      while (r < base * 4 && field(cx + Math.cos(a) * r, cy + Math.sin(a) * r, sc.mass) >= 1) r += base * 0.05;
      sum += r;
    }
    sc.R += (sum / 12 * 0.9 - sc.R) * Math.min(1, dt * 8 + (dt === 0 ? 1 : 0));
    // Eyes: follow a fresh pointer, else glance around; a damped spring; quick blinks.
    if (sc.at > t - 2.5) {
      eyes.ty = csClamp(((sc.px - cx) / sc.R) * 1.1, -0.55, 0.55);
      eyes.tp = csClamp(((sc.py - cy) / sc.R) * 0.9, -0.38, 0.38);
    } else if ((eyes.look -= dt) <= 0) {
      eyes.look = 0.9 + rng() * 2.4;
      eyes.ty = rng() < 0.3 ? 0 : (rng() - 0.5);
      eyes.tp = eyes.ty ? (rng() - 0.5) * 0.6 : 0;
    }
    eyes.vy += (eyes.ty - eyes.yaw) * 90 * dt; eyes.vp += (eyes.tp - eyes.pitch) * 90 * dt;
    const damp = Math.max(0, 1 - 11 * dt);
    eyes.vy *= damp; eyes.vp *= damp;
    eyes.yaw += eyes.vy * dt; eyes.pitch += eyes.vp * dt;
    eyes.blinkAt -= dt;
    if (eyes.blinkP < 0 && eyes.blinkAt <= 0) eyes.blinkP = 0;
    if (eyes.blinkP >= 0) {
      eyes.blinkP += dt / 0.18;
      eyes.closed = Math.sin(Math.PI * Math.min(1, eyes.blinkP));
      if (eyes.blinkP >= 1) { eyes.blinkP = -1; eyes.closed = 0; eyes.blinkAt = 2 + rng() * 3.5; }
    }
  };
  const paint = () => {
    const { C, cell, t, fx, fy, R } = sc, g = Math.ceil(C / cell), n = sc.balls.length;
    if (off.width !== g) { off.width = g; off.height = g; }
    const octx = off.getContext("2d"), img = octx.createImageData(g, g);
    for (let gy = 0; gy < g; gy += 1) {
      for (let gx = 0; gx < g; gx += 1) {
        const x = (gx + 0.5) * cell, y = (gy + 0.5) * cell, f = field(x, y, n);
        const a = csBlobAlpha(f);
        if (!a) continue;
        // Sphere shading: hue flows round the mass, lit from the top left, a soft highlight and a darker rim.
        let u = (x - fx) / (R / 0.9), v = (y - fy) / (R / 0.9);
        const rr = Math.hypot(u, v);
        if (rr > 1) { u /= rr; v /= rr; }
        const w = Math.sqrt(Math.max(0, 1 - u * u - v * v));
        const hue = h0 + spread * Math.sin(Math.atan2(u, w) * 1.6 + t * flow + phase) + 26 * Math.sin(Math.asin(v) * 2.6 - t * flow * 0.7);
        const hl = Math.max(0, 1 - Math.hypot(u + 0.38, v + 0.42) * 1.9);
        let c = csHsl(hue, 0.82, csClamp(0.4 + 0.2 * w + 0.12 * (-u * 0.5 - v * 0.6) + 0.3 * hl * hl, 0.3, 0.92));
        const sats = [];
        for (let i = sc.mass; i < n; i += 1) { const b = sc.balls[i]; const dx = x - b.x, dy = y - b.y; sats.push({ q: (b.r * b.r) / (dx * dx + dy * dy + 1), c: mini[i - sc.mass] }); }
        c = csBlendSats(c, sats, f);
        const i4 = (gy * g + gx) * 4;
        img.data[i4] = c[0]; img.data[i4 + 1] = c[1]; img.data[i4 + 2] = c[2]; img.data[i4 + 3] = a * 255;
      }
    }
    octx.putImageData(img, 0, 0);
    ctx.setTransform(sc.dpr, 0, 0, sc.dpr, 0, 0);
    ctx.clearRect(0, 0, C, C);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(off, 0, 0, g * cell, g * cell);
    // Pill eyes bent onto the sphere.
    ctx.fillStyle = "#1a0f33";
    const squash = 1 - eyes.closed * 0.92;
    [-0.3, 0.3].forEach((dx) => {
      ctx.beginPath();
      for (let k = 0; k < 2; k += 1) {
        for (let j = 0; j <= 10; j += 1) {
          const f = (Math.PI * j) / 10, u = k ? -0.1 * Math.cos(f) : 0.1 * Math.cos(f), v = k ? 0.17 + 0.1 * Math.sin(f) : -0.17 - 0.1 * Math.sin(f);
          const lat = eyes.pitch + v * squash, lon = eyes.yaw + dx + u / Math.max(0.3, Math.cos(eyes.pitch));
          const px = fx + R * Math.sin(lon) * Math.cos(lat), py = fy + R * Math.sin(lat);
          if (!k && !j) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
      }
      ctx.closePath();
      ctx.fill();
    });
  };
  const layout = () => {
    const box = canvas.parentNode || host;
    const side = (box.clientWidth || 300) * 1.5;
    sc.C = side; sc.base = side * 0.142; sc.cell = Math.max(2, Math.round(side / 260));
    sc.dpr = Math.min(win.devicePixelRatio || 1, 2);
    canvas.width = Math.round(side * sc.dpr); canvas.height = Math.round(side * sc.dpr);
    lobes.forEach((l) => { l.x = null; });
    step(0);
    for (let n = 0; n < 30; n += 1) step(0.1);
    paint();
  };
  const frame = (now) => {
    raf = 0;
    if (!alive || doc.hidden) return;
    if (!host.isConnected) { api.stop(); return; }
    if (now - last >= 33) { step(Math.min(0.1, (now - last) / 1000 || 0.033)); last = now; paint(); }
    raf = win.requestAnimationFrame(frame);
  };
  const start = () => { layout(); if (!raf && alive && host.isConnected && !still && win.requestAnimationFrame && !doc.hidden) { last = 0; raf = win.requestAnimationFrame(frame); } };
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    sc.px = ((e.clientX - r.left) / r.width) * sc.C; sc.py = ((e.clientY - r.top) / r.height) * sc.C; sc.at = sc.t;
  };
  const onVis = () => { if (!host.isConnected) api.stop(); else if (doc.hidden) { if (raf) win.cancelAnimationFrame(raf); raf = 0; } else if (!raf && alive && !still && win.requestAnimationFrame) { last = 0; raf = win.requestAnimationFrame(frame); } };
  const ro = win.ResizeObserver ? new win.ResizeObserver(() => { if (alive) layout(); }) : null;
  canvas.setAttribute("aria-hidden", "true");
  if (!still) { host.addEventListener("pointermove", onMove); doc.addEventListener("visibilitychange", onVis); }
  const api = {
    el: canvas,
    start() { if (ro) ro.observe(canvas.parentNode); start(); },
    stop() {
      alive = false;
      if (raf) win.cancelAnimationFrame(raf);
      raf = 0;
      host.removeEventListener("pointermove", onMove);
      doc.removeEventListener("visibilitychange", onVis);
      if (ro) ro.disconnect();
    },
  };
  return api;
}
let csCounter = 0;

function mountComingSoonSplash(root, opts) {
  const o = Object.assign({ dateLabel: CS_DATE }, CS_DEFAULTS, opts);
  const noop = { dismiss() {}, destroy() {} };
  const key = o.storageKey || `splash:${o.brand}:2026-12`;
  try {
    if (localStorage.getItem(key) === "1") return noop;
  } catch (e) { /* storage blocked: show it every time */ }
  const doc = root.ownerDocument;
  if (!doc.getElementById("cs-style")) {
    const st = doc.createElement("style");
    st.id = "cs-style";
    st.textContent = CS_CSS;
    (doc.head || doc.documentElement).appendChild(st);
  }
  const el = (tag, cls, text) => {
    const n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const tint = /^#[0-9a-f]{6}$/i.test(o.tint || "") ? o.tint : "#8b5cf6";
  const rgb = [1, 3, 5].map((i) => parseInt(tint.slice(i, i + 2), 16)).join(",");
  const id = `cs-${(csCounter += 1)}`;
  const reduce = !!(root.ownerDocument.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

  const overlay = el("div", "cs-splash");
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", `${id}-n ${id}-c ${id}-d`);
  overlay.dataset.motion = reduce ? "reduce" : "full";
  overlay.dataset.brand = o.brand;
  overlay.style.setProperty("--cs-tint", tint);
  overlay.style.setProperty("--cs-rgb", rgb);
  const x = el("button", "cs-x", "×");
  x.type = "button";
  x.setAttribute("aria-label", o.close);
  const logo = el("div", "cs-logo");
  logo.append(o.logoNode || el("span", "", o.name));
  const nameEl = el("span", "", o.name);
  nameEl.id = `${id}-n`;
  nameEl.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)";
  const pill = el("span", "cs-pill");
  pill.append(el("i"), el("span", "", o.coming));
  pill.lastChild.id = `${id}-c`;
  const date = el("h2", "cs-date", o.dateLabel);
  date.id = `${id}-d`;
  const btn = el("button", "cs-btn cs-primary");
  btn.append(el("span", "cs-bt", o.preview));
  btn.type = "button";
  const stage = el("div", "cs-stage");
  stage.append(nameEl, logo, el("p", "cs-tag", o.tagline || ""), pill, date, el("p", "cs-sub", o.sub), btn);
  let legalBtn = null;
  if (o.footer !== false) {
    const f = Object.assign({}, o.footer);
    const lg = Object.assign({}, CS_LEGAL, f.legal);
    const foot = el("footer", "cs-foot");
    const logos = el("div", "cs-logos");
    logos.setAttribute("role", "group");
    logos.setAttribute("aria-label", lg.builtWith);
    (f.logos || CS_LOGOS).forEach((l) => {
      const img = el("img");
      img.src = l.src;
      img.alt = l.name;
      img.title = l.name;
      img.style.height = `${l.height || 20}px`;
      logos.append(img);
    });
    legalBtn = el("button", "cs-legal-btn", lg.toggle);
    legalBtn.type = "button";
    legalBtn.setAttribute("aria-expanded", "false");
    legalBtn.setAttribute("aria-controls", `${id}-legal`);
    const panel = el("div", "cs-legal cs-legal-panel");
    panel.id = `${id}-legal`;
    panel.hidden = true;
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", lg.toggle);
    [lg.marks, lg.dated, lg.preview].forEach((t) => panel.append(el("p", "cs-legal", t)));
    legalBtn.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      legalBtn.setAttribute("aria-expanded", String(!panel.hidden));
    });
    foot.append(logos, el("p", "cs-legal", lg.copyright), legalBtn, panel);
    stage.append(foot);
  }
  const hero = o.characters === false ? null : csHero(doc, overlay, o.brand, rgb, reduce);
  overlay.dataset.characters = hero ? "on" : "off";
  let heroBox = null;
  if (hero) {
    heroBox = el("div", "cs-hero");
    heroBox.setAttribute("aria-hidden", "true");
    heroBox.append(hero.el);
    stage.prepend(heroBox);
  }
  overlay.append(x, stage);

  const prevPos = root.style.position;
  if (root.ownerDocument.defaultView.getComputedStyle(root).position === "static") root.style.position = "relative";
  const hidden = [...root.children].map((c) => [c, c.getAttribute("aria-hidden"), c.inert]);
  hidden.forEach(([c]) => { c.setAttribute("aria-hidden", "true"); c.inert = true; });
  const opener = doc.activeElement;
  root.appendChild(overlay);
  btn.focus();
  if (hero) hero.start();

  let open = true;
  const close = (persist) => {
    if (!open) return;
    open = false;
    doc.removeEventListener("keydown", onKey, true);
    if (hero) hero.stop();
    overlay.remove();
    hidden.forEach(([c, a, i]) => {
      if (a == null) c.removeAttribute("aria-hidden"); else c.setAttribute("aria-hidden", a);
      c.inert = !!i;
    });
    root.style.position = prevPos;
    if (persist) {
      try { localStorage.setItem(key, "1"); } catch (e) { /* ignore */ }
    }
    if (opener && opener.focus && doc.contains(opener)) opener.focus();
    if (persist && o.onDismiss) o.onDismiss();
  };
  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(true); return; }
    if (e.key !== "Tab") return;
    const f = legalBtn ? [x, btn, legalBtn] : [x, btn];
    const i = f.indexOf(doc.activeElement);
    e.preventDefault();
    f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
  }
  doc.addEventListener("keydown", onKey, true);
  btn.addEventListener("click", () => close(true));
  x.addEventListener("click", () => close(true));
  return { dismiss: () => close(true), destroy: () => close(false) };
}

export function activate(host) {
  if (host.apiVersion !== "1") throw new Error("MESH requires Canvas host API 1.");
  return host.registerPage("mesh-hangout", ({ container }) => mount(host, container));
}

const loadSaved = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; } };

function mount(host, container) {
  const style = el("style", "", CSS);
  const root = el("div", "mh");
  root.dataset.pane = "list";
  container.append(style, root);
  let disposed = false;
  let pollTimer = 0;
  let toastTimer = 0;
  let connectRun = 0;
  let loadRun = 0;
  let reauth = null;
  let overlayReturn = null;

  const saved = loadSaved();
  const cfg = {
    nodeUrl: saved.nodeUrl || DEFAULT_NODE,
    forceDemo: Boolean(saved.forceDemo),
    identity: saved.identity || null, // { jwk, enc, handle, name, bio, agent }
    tokens: saved.tokens || {},
    welcomed: Boolean(saved.welcomed),
    channel: saved.channel || "following",
    trusted: Array.isArray(saved.trusted) ? saved.trusted : null, // null = trust every labeler
    local: saved.local && typeof saved.local === "object" ? saved.local : {}, // per node+identity: follows/likes/reposts (v2 has no listing endpoints)
    myGroups: saved.myGroups && typeof saved.myGroups === "object" ? saved.myGroups : {},
  };
  const persist = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch { /* storage unavailable */ }
  };

  const state = {
    mode: "connecting", // connecting | connected | demo
    note: "",
    info: null,
    client: null,
    identity: null, // live identity object (with sign())
    reg: { status: "none" }, // registration of state.identity on this node
    channel: cfg.channel,
    messages: [],
    loading: false,
    error: "",
    toast: null,
    entities: new Map(), // id -> normalized entity
    labels: new Map(), // subject -> labels
    following: new Set(),
    conversations: [],
    groups: [],
    groupInfo: null,
    replyTo: null,
    expanded: new Map(), // message id -> loaded replies
    shown: new Set(), // folded messages the viewer chose to reveal
    liked: new Set(),
    boosted: new Set(),
    confirmDelete: "",
    overlay: null, // { kind, view, ... }
    draft: "",
    media: [],
    mediaOpen: false,
    mediaDraft: "",
    sending: false,
    signNote: "",
    edSupported: true,
    heads: null,
    findError: "",
    findDraft: "",
    finding: false,
    found: null,
    memberTab: "all",
    down: false, // connected earlier, but the node no longer answers: shown as "Disconnected"
    sentLocal: new Map(), // DM partner id -> messages sent from this session (nodes cannot always read them back)
    threadNote: "", // small line about the open thread (for example: replies cannot be loaded)
    errorDocs: false, // the error notice links to the Docs
    docs: { open: false, page: DOCS[0].id, opener: "", pane: "list" }, // the built-in documentation reader
  };

  const me = () => state.client?.me || "";
  const nodeKey = () => state.client?.baseUrl || "demo";
  const localKey = () => `${nodeKey()}|${state.identity?.entityId || me()}`;
  const localList = (name) => (state.mode === "demo" ? [] : cfg.local[localKey()]?.[name] || []);
  const setLocal = (name, list) => {
    if (state.mode === "demo") return;
    cfg.local[localKey()] = { ...(cfg.local[localKey()] || {}), [name]: [...list] };
    persist();
  };
  const trustedIssuer = (issuer) => cfg.trusted === null || cfg.trusted.includes(issuer) || issuer === me();
  const visibleLabels = (list) => (list || []).filter((l) => trustedIssuer(l.issuer));
  const displayName = (id) => state.entities.get(id)?.name || shortId(id);

  const poweredBy = (cls = "") => {
    const d = el("div", `powered${cls ? ` ${cls}` : ""}`);
    const logo = (href, svg) => {
      const a = el("a", "plogo");
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.setAttribute("aria-label", svg.getAttribute("aria-label"));
      a.append(svg);
      return a;
    };
    d.append(
      el("span", "", "Built with"),
      logo("https://github.com/FraterCCCLXIII/kamiji", logoSvg("0 0 276 118", "Kamiji™", KAMIJI_STROKES, 16)),
      logo("https://kosmos.computer", logoSvg("0 0 405.3 82.71", "Kosmos™", KOSMOS_PATHS)), artecLogo(),
    );
    return d;
  };

  function toast(text, kind = "ok") {
    state.toast = { text, kind };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { state.toast = null; if (!disposed) renderNotices(); }, 6000);
    renderNotices();
  }

  // ── Connection ──────────────────────────────────────────────────────────────────────────
  async function loadStoredIdentity() {
    state.identity = null;
    if (!cfg.identity?.jwk || !state.edSupported) return;
    try {
      let enc = null;
      if (cfg.identity.enc) { try { enc = await encryptionKeyFromJwk(cfg.identity.enc); } catch { enc = null; } }
      state.identity = await identityFromJwk(cfg.identity.jwk, enc);
    } catch { state.identity = null; }
  }

  const profileFrom = ({ name, bio, agent }) => {
    const profile = { name, agent: Boolean(agent) };
    if (bio) profile.bio = bio;
    return profile;
  };

  async function connect() {
    const run = ++connectRun;
    state.mode = "connecting"; state.note = ""; state.info = null; state.heads = null; state.down = false;
    renderAll();
    if (cfg.forceDemo) return enterDemo("Demo mode is on.");
    let client;
    try {
      client = new MeshClient(cfg.nodeUrl);
      state.info = await client.info();
    } catch (err) {
      if (run !== connectRun || disposed) return undefined;
      return enterDemo(`${err.message}. Showing Demo data until a node answers.`);
    }
    if (run !== connectRun || disposed) return undefined;
    resetNodeData();
    state.client = client;
    wireLinkHooks(client);
    client.onAuthExpired = () => {
      if (!state.identity) return Promise.resolve(false);
      if (!reauth) reauth = trySignIn(true).finally(() => { reauth = null; });
      return reauth;
    };
    state.mode = "connected";
    state.edSupported = await ed25519Supported();
    await loadStoredIdentity();
    const token = cfg.tokens[client.baseUrl];
    if (state.identity && token) client.useSession(token, state.identity.entityId);
    else if (state.identity) await trySignIn(true);
    updateSignNote();
    await refreshSide();
    renderAll();
    await loadChannel();
    return undefined;
  }

  /** Members, follows, labels, DMs and the open thread belong to one data source. Drop them when switching between Demo and a node. */
  function resetNodeData() {
    state.entities = new Map();
    state.labels = new Map();
    state.following = new Set();
    state.conversations = [];
    state.groups = [];
    state.groupInfo = null;
    state.messages = [];
    state.expanded = new Map();
    state.shown = new Set();
    state.liked = new Set();
    state.boosted = new Set();
    state.sentLocal = new Map();
    state.found = null; state.findError = ""; state.replyTo = null; state.heads = null;
    state.error = ""; state.errorDocs = false; state.threadNote = ""; state.down = false;
  }

  // ── Link state: a node that stops answering shows as Disconnected without leaving the screen ──
  let linkCheck = null;
  /** Probe the node once at a time. Marks the app Disconnected when the probe fails and Connected when it succeeds. Resolves to "up" or "down". */
  function checkLink() {
    const c = state.client;
    if (!c || state.mode !== "connected") return Promise.resolve("up");
    if (!linkCheck) {
      linkCheck = c.probe().then((ok) => {
        if (c === state.client && !disposed) setDown(!ok);
        return ok ? "up" : "down";
      }).finally(() => { linkCheck = null; });
    }
    return linkCheck;
  }
  function setDown(down) {
    if (state.down === down) return;
    state.down = down;
    renderAll();
  }
  function wireLinkHooks(client) {
    client.onNetworkError = () => { if (client === state.client) checkLink(); };
    client.onReachable = () => {
      if (client !== state.client || !state.down) return;
      state.down = false;
      renderAll();
      refreshSide().then(() => { if (!disposed) renderAll(); });
    };
  }
  const unreachableText = () => `Cannot reach ${state.client?.baseUrl || cfg.nodeUrl}. Check that the node is running and that this page may call it.`;
  async function retryNode() {
    const c = state.client;
    if (!c) return;
    const up = (await checkLink()) === "up";
    if (!up) return; // the banner stays; the next successful request or retry reconnects
    state.error = ""; state.errorDocs = false;
    await refreshSide();
    renderAll();
    await loadChannel({ quiet: true });
  }

  function updateSignNote() {
    if (state.mode !== "connected") { state.signNote = ""; return; }
    if (!state.edSupported) state.signNote = "This browser has no WebCrypto Ed25519: browsing is read-only. Use Demo mode or a newer browser to post.";
    else if (!state.identity) state.signNote = "Read-only: create or import an identity in Account to post.";
    else if (!state.client.signedIn) state.signNote = state.signNote || "Signed out: sign in from Account to post.";
    else state.signNote = "";
  }

  async function enterDemo(note) {
    resetNodeData();
    state.client = createDemoClient();
    state.mode = "demo";
    state.note = note;
    state.signNote = "";
    state.entities = new Map(state.client.entities().map((e) => [e.id, e]));
    state.edSupported = await ed25519Supported();
    await loadStoredIdentity();
    if (state.identity) {
      // Re-create the stored key's account on the in-memory node so the same identity works offline.
      try { await state.client.createEntity({ publicKeyHex: state.identity.publicKeyHex, encryptionKeyHex: state.identity.enc?.publicKeyHex || null, handle: cfg.identity.handle, profile: profileFrom(cfg.identity) }); } catch { /* handle clash: sign in below reports it */ }
      await trySignIn(true);
    }
    state.reg = { status: "none" };
    await refreshSide();
    renderAll();
    return loadChannel();
  }

  async function trySignIn(silent) {
    if (!state.identity || !state.client) return false;
    try {
      const r = await state.client.signIn(state.identity);
      if (state.mode === "connected") { cfg.tokens[state.client.baseUrl] = r.token; persist(); }
      state.signNote = "";
      return true;
    } catch (err) {
      state.signNote = err.status === 404 ? "Your identity is not registered on this node yet. Register it in Account." : `Sign-in failed: ${err.message}`;
      if (!silent) renderAll();
      return false;
    }
  }

  async function refreshSide() {
    const c = state.client;
    if (!c) return;
    try { state.conversations = await c.conversations(); } catch { state.conversations = []; }
    state.liked = new Set(localList("likes"));
    state.boosted = new Set(localList("reposts"));
    try {
      const f = await c.following();
      const ids = c.flavor === "v2" ? localList("follows") : f.map((e) => e.id);
      state.following = new Set(ids);
      f.forEach((e) => state.entities.set(e.id, e));
      if (c.flavor === "v2") await ensureEntities(ids);
    } catch { /* optional */ }
    if (c.me && !state.entities.has(c.me)) await ensureEntities([c.me]);
    await loadGroups();
    if (state.mode === "connected" && c.flavor === "v2" && c.me) { try { state.heads = await c.heads(c.me); } catch { state.heads = null; } }
  }

  async function loadGroups() {
    const c = state.client;
    if (!c?.caps.groups) { state.groups = []; return; }
    let list = [];
    try { list = await c.groups(); } catch { list = []; }
    const have = new Set(list.map((g) => g.id));
    for (const id of cfg.myGroups[nodeKey()] || []) {
      if (have.has(id)) continue;
      try { list.push(await c.group(id)); } catch { /* group gone */ }
    }
    state.groups = list;
  }

  async function ensureEntities(ids) {
    const missing = [...new Set(ids)].filter((id) => id && !state.entities.has(id)).slice(0, 25);
    await Promise.all(missing.map(async (id) => {
      try { state.entities.set(id, await state.client.entity(id)); } catch { /* unknown entity: shown by id */ }
    }));
  }

  // ── Channels ────────────────────────────────────────────────────────────────────────────
  const isDm = () => state.channel.startsWith("dm:");
  const isTimeline = () => state.channel.startsWith("tl:");
  const isGroup = () => state.channel.startsWith("group:");
  const groupIdOf = () => (isGroup() ? state.channel.slice(6) : null);

  const channelTitle = (id) => {
    if (id === "following") return "Following";
    if (id === "global") return "Global feed";
    if (id.startsWith("group:")) {
      const gid = id.slice(6);
      return (state.groupInfo?.id === gid ? state.groupInfo.name : state.groups.find((g) => g.id === gid)?.name) || "Group";
    }
    const [kind, ref] = [id.slice(0, id.indexOf(":")), id.slice(id.indexOf(":") + 1)];
    const e = state.entities.get(ref) || state.conversations.find((c) => c.id === ref);
    const name = e ? e.name : shortId(ref);
    return kind === "dm" ? name : `${name}'s timeline`;
  };

  /** Messages sent from this session that the node did not hand back (v2.0 has no DM read; v1.1 may fail to read). Matched by text. */
  function withSentLocal(partner, serverItems) {
    const local = state.sentLocal.get(partner) || [];
    if (!local.length) return serverItems;
    const counts = new Map();
    serverItems.filter((m) => m.author === me()).forEach((m) => counts.set(m.body, (counts.get(m.body) || 0) + 1));
    const pending = local.filter((m) => {
      const n = counts.get(m.body) || 0;
      if (n > 0) { counts.set(m.body, n - 1); return false; }
      return true;
    });
    state.sentLocal.set(partner, pending);
    return [...serverItems, ...pending];
  }

  async function fetchChannel() {
    const c = state.client;
    const id = state.channel;
    if (id === "following") return c.feedFollowing();
    if (id === "global") return c.feedGlobal();
    if (id.startsWith("tl:")) return c.timeline(id.slice(3));
    if (id.startsWith("dm:")) return withSentLocal(id.slice(3), await c.messages(id.slice(3)));
    if (id.startsWith("group:")) {
      const gid = id.slice(6);
      const [info, items] = await Promise.all([c.group(gid).catch(() => null), c.groupFeed(gid)]);
      state.groupInfo = info;
      return items;
    }
    return [];
  }

  async function loadChannel({ quiet = false } = {}) {
    const run = ++loadRun;
    if (!quiet) { state.loading = true; state.error = ""; state.errorDocs = false; state.threadNote = ""; renderThread(); renderHead(); }
    try {
      const items = await fetchChannel();
      if (run !== loadRun || disposed) return;
      state.messages = items;
      state.error = ""; state.errorDocs = false; state.threadNote = "";
      await decorate(items);
    } catch (err) {
      if (run !== loadRun || disposed) return;
      await explainLoadFailure(err, quiet);
      if (run !== loadRun || disposed) return;
    }
    state.loading = false;
    renderAll();
  }

  /**
   * Turn a failed channel read into an honest message. A browser cannot read a CORS-less HTTP 500 (fetch just throws), so a
   * thrown fetch is told apart by probing the node's info endpoint: probe fails = unreachable, probe works = the node is up and
   * the request itself failed.
   */
  async function explainLoadFailure(err, quiet) {
    const dm = isDm() ? state.channel.slice(3) : "";
    const local = dm ? state.sentLocal.get(dm) || [] : [];
    state.errorDocs = false; state.threadNote = "";
    if (err.status === 401) { state.messages = []; state.error = `${err.message}.`; return; }
    if (err.network) {
      const up = (await checkLink()) === "up";
      if (!up) {
        // Disconnected: keep what is already on screen (identity, loaded messages). The banner explains and offers Retry node.
        if (!quiet) state.messages = dm ? [...local] : [];
        state.error = "";
        return;
      }
      state.messages = [...local];
      if (local.length) { state.error = ""; state.threadNote = "Replies cannot be loaded from this node right now."; return; }
      state.error = "The node is up but could not load this view (it returned an error). If this is the Direct messages view on a v1.1 node, this is a known node bug; see Docs.";
      state.errorDocs = true;
      return;
    }
    state.messages = [...local];
    if (local.length) { state.error = ""; state.threadNote = "Replies cannot be loaded from this node right now."; return; }
    if (err.status) {
      state.error = `Could not load this channel: The node answered ${err.status}${err.detail ? ` (${err.detail})` : ""}.`;
      state.errorDocs = Boolean(dm) && err.status >= 500;
      return;
    }
    state.error = `Could not load this channel: ${err.message}`;
  }

  /** Fill in authors and labels for what is on screen. v1.1 labels ride on feed items; v2 asks per subject. */
  async function decorate(items) {
    const authors = items.flatMap((m) => [m.author]).filter(Boolean);
    await ensureEntities(authors);
    items.forEach((m) => {
      if (!state.entities.has(m.author) && (m.authorName || m.authorHandle)) {
        state.entities.set(m.author, normalizeEntity({ id: m.author, handle: m.authorHandle, kind: m.authorAgent ? "bot" : "user", profile: { name: m.authorName || undefined, agent: m.authorAgent || undefined } }));
      }
      if (m.labels.length) state.labels.set(m.id, m.labels);
      if (m.likedByMe) state.liked.add(m.id);
    });
    if (state.client.caps.labelRead && !isDm()) {
      const subjects = [...new Set([...items.map((m) => m.id), ...authors])].filter((s) => !state.labels.has(s)).slice(0, 60);
      const got = await state.client.labels(subjects);
      got.forEach((v, k) => state.labels.set(k, v));
    }
  }

  // ── Actions ─────────────────────────────────────────────────────────────────────────────
  const groupBlocked = () => isGroup() && state.groupInfo && !state.groupInfo.isMember && state.client?.caps.groups;
  const canSend = () => {
    if (!state.client?.signedIn) return false;
    if (isTimeline() && !state.replyTo) return false;
    if (groupBlocked()) return false;
    return true;
  };
  const composerReason = () => {
    if (!state.client?.signedIn) return state.mode === "demo" ? "Sign in from Account to post." : state.signNote || "Sign in to post.";
    if (isTimeline() && !state.replyTo) return "Timelines are read-only. Reply to a message to respond.";
    if (groupBlocked()) return "Join this group to post here.";
    return "";
  };

  async function send() {
    const text = state.draft.trim();
    if (!text || !canSend() || state.sending) return;
    const c = state.client;
    state.sending = true;
    renderComposer();
    try {
      if (isDm()) {
        const pid = state.channel.slice(3);
        await c.sendDm(pid, text);
        // Show it at once (marked Sent): v2.0 cannot read DMs back and v1.1 may fail to.
        const sent = { id: `local-${Date.now()}`, author: c.me, kind: "dm", body: text, replyTo: null, createdAt: new Date().toISOString(), labels: [], likeCount: 0, replyCount: 0, media: [], authorName: null, authorHandle: null, authorAgent: false, sent: true };
        state.sentLocal.set(pid, [...(state.sentLocal.get(pid) || []), sent]);
        state.messages = [...state.messages, sent];
        toast("Message sent.");
      } else {
        await c.post(text, { replyTo: state.replyTo?.id || null, groupId: groupIdOf(), media: c.caps.media ? state.media : [] });
      }
      state.draft = "";
      state.media = []; state.mediaOpen = false; state.mediaDraft = "";
      const parent = state.replyTo;
      state.replyTo = null;
      state.error = "";
      state.sending = false;
      if (parent) state.expanded.set(parent.id, await c.replies(parent.id, { groupId: groupIdOf() }));
      if (!(isDm() && c.flavor === "v2")) await loadChannel({ quiet: true });
      else renderAll();
      if (isDm()) refreshSide().then(renderRail);
    } catch (err) {
      state.sending = false;
      state.error = `Send failed: ${err.message}`;
      renderAll();
    }
  }

  async function toggleFollow(id) {
    const c = state.client;
    try {
      if (state.following.has(id)) { await c.unfollow(id); state.following.delete(id); } else { await c.follow(id); state.following.add(id); }
      if (c.flavor === "v2") setLocal("follows", state.following);
      state.error = "";
    } catch (err) { state.error = `Follow failed: ${err.message}`; }
    renderAll();
    if (state.channel === "following") loadChannel({ quiet: true });
  }

  async function toggleReaction(kind, m) {
    const c = state.client;
    const set = kind === "like" ? state.liked : state.boosted;
    const on = kind === "like" ? m.likedByMe || set.has(m.id) : set.has(m.id);
    try {
      if (on) { await c.unlink(kind, m.id); set.delete(m.id); if (kind === "like") { m.likedByMe = false; m.likeCount = Math.max(0, (m.likeCount || 1) - 1); } }
      else { await c.link(kind, m.id); set.add(m.id); if (kind === "like") { m.likedByMe = true; m.likeCount = (m.likeCount || 0) + 1; } }
      setLocal(kind === "like" ? "likes" : "reposts", set);
      state.error = "";
    } catch (err) { state.error = `${kind === "like" ? "Like" : "Boost"} failed: ${err.message}`; }
    renderAll();
  }

  async function removeMessage(m) {
    state.confirmDelete = "";
    try {
      await state.client.deleteContent(m.id);
      state.messages = state.messages.filter((x) => x.id !== m.id);
      state.expanded.forEach((list, k) => state.expanded.set(k, list.filter((x) => x.id !== m.id)));
      state.error = "";
      toast("Message deleted.");
    } catch (err) { state.error = `Delete failed: ${err.message}`; }
    renderAll();
  }

  async function toggleReplies(m) {
    if (state.expanded.has(m.id)) state.expanded.delete(m.id);
    else {
      try {
        const replies = await state.client.replies(m.id, { groupId: groupIdOf() });
        await decorate(replies);
        state.expanded.set(m.id, replies);
      } catch (err) { state.error = `Could not load replies: ${err.message}`; }
    }
    renderThread();
  }

  function quote(m) {
    const who = state.entities.get(m.author);
    const line = plainText(m.body).slice(0, 200);
    state.draft = `> ${line}\n> — ${who?.handle ? `@${who.handle}` : who?.name || shortId(m.author)} (\`${m.id}\`)\n\n`;
    state.replyTo = null;
    renderComposer();
    const ta = root.querySelector(".composerbox textarea");
    ta?.focus?.();
  }

  function openChannel(id) {
    if (state.docs.open) { state.docs.open = false; renderAll(); }
    state.channel = id; cfg.channel = id; persist();
    state.messages = []; state.replyTo = null; state.expanded = new Map(); state.groupInfo = null; state.confirmDelete = "";
    root.dataset.pane = "chat";
    loadChannel();
  }

  async function applyLabel(subject, type, claim, confidence) {
    await state.client.attest(subject, type, claim, confidence);
    const got = await state.client.labels([subject]);
    got.forEach((v, k) => state.labels.set(k, v));
  }

  // ── Overlays (dialogs) ──────────────────────────────────────────────────────────────────
  const shell = el("div", "shell");
  const listCol = el("aside", "col list");
  const mainCol = el("main", "col main");
  const memCol = el("aside", "col members");
  shell.append(listCol, mainCol, memCol);
  root.append(shell);
  const grip = gripColumns({
    grid: shell,
    storageKey: "grip:mesh-hangout",
    narrowQuery: "(max-width: 700px)",
    columns: [
      { el: listCol, edge: "left", min: 220, max: 480, initial: 300, label: "list" },
      { el: memCol, edge: "right", min: 200, max: 400, initial: 280, label: "members" },
    ],
  });
  const overlayHost = el("div", "overlays");
  root.append(overlayHost);

  function openOverlay(kind, data = {}) {
    if (!state.overlay) overlayReturn = document.activeElement;
    state.overlay = { kind, view: "main", ...data };
    renderOverlay();
  }
  function closeOverlay() {
    state.overlay = null;
    renderOverlay();
    const r = overlayReturn;
    overlayReturn = null;
    if (r && r.isConnected) r.focus?.();
  }
  function setView(view, flash = "", flashKind = "ok") {
    if (!state.overlay) return;
    state.overlay = { ...state.overlay, view, flash, flashKind };
    renderOverlay();
  }
  async function openAccount() {
    if (state.identity) state.reg = { status: "checking" };
    openOverlay("account");
    if (!state.identity) return;
    await checkRegistration();
    if (state.overlay?.kind === "account" && state.overlay.view === "main") renderOverlay();
  }

  async function checkRegistration() {
    if (!state.identity || !state.client) { state.reg = { status: "none" }; return; }
    state.reg = { status: "checking" };
    try {
      const e = await state.client.entity(state.identity.entityId);
      state.reg = { status: "registered", entity: e };
      state.entities.set(e.id, e);
    } catch (err) {
      state.reg = err.status === 404 ? { status: "unregistered" } : { status: "error", message: err.message };
    }
  }

  const overlayTitle = {
    settings: "Node settings", account: "Account", label: "Label", labelers: "Trusted labelers", newdm: "New message", newgroup: "New group",
  };

  function renderOverlay() {
    overlayHost.replaceChildren();
    const o = state.overlay;
    if (!o) return;
    const ov = el("div", "overlay");
    const modal = el("div", "modal");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "mh-dlg-title");
    const title = el("h3", "", overlayTitle[o.kind] || "Dialog");
    title.id = "mh-dlg-title";
    modal.append(title);
    ov.addEventListener("click", (e) => { if (e.target === ov) closeOverlay(); });
    ov.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.stopPropagation(); closeOverlay(); return; }
      if (e.key !== "Tab") return;
      const items = [...modal.querySelectorAll("button, input, textarea, select, a[href]")].filter((n) => !n.disabled && !n.hidden && n.type !== "hidden" && n.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    ({ settings: buildSettings, account: buildAccount, label: buildLabel, labelers: buildLabelers, newdm: buildNewDm, newgroup: buildNewGroup }[o.kind])(modal, o);
    modal.append(btn("Close", closeOverlay, "btn closebtn"));
    ov.append(modal);
    overlayHost.append(ov);
    const target = modal.querySelector("[data-autofocus]") || modal.querySelector("input:not([type=checkbox]), textarea, select") || modal.querySelector("button");
    target?.focus?.();
  }

  function buildSettings(modal) {
    const form = el("form");
    const nodeInput = el("input");
    nodeInput.value = cfg.nodeUrl;
    nodeInput.placeholder = DEFAULT_NODE;
    nodeInput.setAttribute("data-autofocus", "");
    const demo = checkRow("Use Demo mode (in-memory sample data)", cfg.forceDemo);
    const status = el("div", "hint", state.mode === "connected" ? `Connected to ${state.info?.nodeId} (MESH ${state.info?.protocolVersion}, ${state.info?.flavor}).` : state.mode === "demo" ? "Demo mode." : "Connecting…");
    const flash = statusLine();
    const apply = el("button", "btn primary", "Save & reconnect");
    apply.type = "submit";
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      try { cfg.nodeUrl = normalizeNodeUrl(nodeInput.value); } catch (err) { flash.err(err.message); return; }
      cfg.forceDemo = demo.input.checked;
      persist();
      closeOverlay();
      connect();
    });
    form.append(field("Node URL", nodeInput), demo.wrap, status, flash.el, apply);
    const more = el("div", "line");
    more.append(btn("Account & identity…", () => openAccount(), "btn"), btn("Trusted labelers…", () => openOverlay("labelers"), "btn"));
    modal.append(form, more);
  }

  // ── Account: create / register / sign in / edit / export / import / forget ───────────────
  function whoCard(id, fallbackName, extra) {
    const e = state.entities.get(id);
    const card = el("div", "whocard");
    card.append(avatar(id));
    const meta = el("div", "meta");
    meta.append(el("b", "", e?.name || fallbackName || shortId(id)));
    const handle = e?.handle || cfg.identity?.handle;
    meta.append(el("span", "sub", handle ? `@${handle}` : "No handle"));
    meta.append(el("code", "", id));
    if (extra) meta.append(el("span", "sub", extra));
    card.append(meta);
    return card;
  }

  function profileForm({ submitLabel, initial, withHandle, onSubmit }) {
    const form = el("form");
    const handle = el("input"); handle.value = initial.handle || ""; handle.placeholder = "e.g. ada (optional)"; handle.maxLength = 32; handle.autocomplete = "off";
    const name = el("input"); name.value = initial.name || ""; name.placeholder = "Display name"; name.maxLength = 60; name.required = true;
    const bio = el("textarea"); bio.rows = 2; bio.value = initial.bio || ""; bio.placeholder = "A line about you (optional)"; bio.maxLength = 280;
    const agent = checkRow("This identity is an AI agent", Boolean(initial.agent));
    const flash = statusLine();
    const submit = el("button", "btn primary", submitLabel);
    submit.type = "submit";
    if (withHandle) form.append(field("Handle", handle, "Public and unique on a node. You cannot change it later."));
    form.append(field("Display name", name), field("Bio", bio), agent.wrap, flash.el, submit);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const values = { handle: withHandle ? handle.value.trim().replace(/^@/, "") : initial.handle || "", name: name.value.trim(), bio: bio.value.trim(), agent: agent.input.checked };
      const problem = validateProfileInput(values);
      if (problem) { flash.err(problem); return; }
      await withBusy(form, submit, "Working…", async () => {
        try { await onSubmit(values, flash); } catch (err) { flash.err(err.message); }
      });
    });
    return { form, flash };
  }

  async function registerCurrent(values) {
    const c = state.client;
    const idn = state.identity;
    if (!idn.enc && c.caps.dmNeedsEncryptionKey && await x25519Supported()) {
      idn.enc = await generateEncryptionKey();
      cfg.identity = { ...cfg.identity, enc: idn.enc.jwk };
      persist();
    }
    try {
      await c.createEntity({ publicKeyHex: idn.publicKeyHex, encryptionKeyHex: idn.enc?.publicKeyHex || null, handle: values.handle || null, profile: profileFrom(values) });
    } catch (err) {
      if (err.status === 409 && /handle/i.test(err.message)) throw new Error(`@${values.handle} is already taken. Choose another handle and register again; your key is saved.`);
      if (!(err.status === 409 && /exist/i.test(err.message))) throw err;
    }
    cfg.identity = { ...cfg.identity, handle: values.handle || null, name: values.name, bio: values.bio, agent: values.agent };
    persist();
  }

  async function afterIdentityChange(message) {
    await checkRegistration();
    updateSignNote();
    await refreshSide();
    renderAll();
    loadChannel({ quiet: true });
    setView("main", message);
  }

  async function createIdentityFlow(values, flash) {
    const c = state.client;
    if (!state.edSupported) throw new Error("This browser has no WebCrypto Ed25519, so it cannot create a key. Use a current Chrome, Safari or Firefox.");
    if (c.caps.handleLookup && values.handle) {
      flash.info("Checking the handle…");
      let taken = false;
      try { await c.lookup(values.handle); taken = true; } catch (err) { if (err.status !== 404) throw err; }
      if (taken) throw new Error(`@${values.handle} is already taken. Choose another handle.`);
    }
    flash.info("Step 1 of 3: creating your Ed25519 key…");
    const idn = await generateIdentity({ encryption: true });
    state.identity = idn;
    cfg.identity = { jwk: idn.jwk, enc: idn.enc?.jwk || null, handle: values.handle || null, name: values.name, bio: values.bio, agent: values.agent };
    persist();
    try {
      flash.info("Step 2 of 3: registering on the node…");
      await registerCurrent(values);
      flash.info("Step 3 of 3: signing in…");
      if (!await trySignIn(true)) throw new Error(state.signNote || "Sign-in failed");
    } catch (err) {
      state.reg = { status: "unregistered" };
      await afterIdentityChange("");
      if (state.overlay) {
        state.overlay.flash = `Your key was created and saved in this browser, but setup did not finish: ${err.message}`;
        state.overlay.flashKind = "err";
        renderOverlay();
      }
      return;
    }
    await afterIdentityChange(`Welcome, ${values.name}. Your key is created, registered and you are signed in. Export the key from this dialog to back it up.`);
  }

  async function importFlow(text) {
    const { identity, stored } = await importBundle(text);
    state.identity = identity;
    cfg.identity = { ...stored, name: stored.name || "Imported", bio: "", agent: false };
    persist();
    await checkRegistration();
    if (state.reg.status === "registered") {
      const p = state.reg.entity.profile || {};
      cfg.identity = { ...cfg.identity, handle: state.reg.entity.handle || null, name: p.name || cfg.identity.name, bio: p.bio || "", agent: Boolean(p.agent) };
      persist();
      const ok = await trySignIn(true);
      await afterIdentityChange(ok ? `Key imported. Signed in as ${cfg.identity.name}.` : "Key imported, but sign-in failed.");
    } else {
      await afterIdentityChange("Key imported. This identity is not registered on this node yet: fill in the form and register it.");
    }
  }

  function buildAccount(modal, o) {
    const c = state.client;
    const flash = statusLine();
    if (o.flash) (o.flashKind === "err" ? flash.err : flash.ok)(o.flash);
    const idn = state.identity;
    const header = (text) => modal.append(el("div", "hint", text));

    if (!c) { modal.append(el("div", "hint", "Still connecting to a node…")); return; }
    const backRow = () => { const r = el("div", "line"); r.append(btn("Back", () => setView("main"), "btn")); return r; };

    // Views that need an identity
    if (idn && o.view === "edit") {
      const e = state.reg.entity;
      if (!c.caps.profileEdit) {
        modal.append(el("div", "hint", "This node (v2.0) has no profile update endpoint: PUT /api/entities/{id} only exists on v1.1 nodes. Your profile is fixed at registration."), backRow());
        return;
      }
      const p = e?.profile || {};
      const { form } = profileForm({
        submitLabel: "Save profile", withHandle: false,
        initial: { handle: e?.handle || cfg.identity?.handle, name: p.name || cfg.identity?.name, bio: p.bio || cfg.identity?.bio, agent: p.agent ?? cfg.identity?.agent },
        onSubmit: async (v) => {
          if (!c.signedIn) throw new Error("Sign in first (Back, then Sign in).");
          const profile = { ...p, name: v.name, agent: v.agent };
          if (v.bio) profile.bio = v.bio; else delete profile.bio;
          await c.updateProfile(profile);
          cfg.identity = { ...cfg.identity, name: v.name, bio: v.bio, agent: v.agent };
          persist();
          state.entities.delete(idn.entityId);
          await checkRegistration();
          renderAll();
          setView("main", "Profile saved.");
        },
      });
      modal.append(flash.el, form, backRow());
      return;
    }

    if (idn && o.view === "export") {
      modal.append(el("div", "warnbox", "This is your private key. Anyone who has it can post and message as you, and there is no way to revoke it. Keep it in a password manager and never paste it into a chat or a page you do not trust. If you lose it and have no copy, this identity is gone."));
      const ack = checkRow("I understand. Show my private key.");
      const area = el("textarea");
      area.readOnly = true; area.rows = 8; area.hidden = true;
      area.setAttribute("aria-label", "Private key (JSON)");
      area.value = exportBundle(cfg.identity);
      const row = el("div", "line");
      const copy = btn("Copy", async () => { try { await navigator.clipboard.writeText(area.value); flash.ok("Copied to the clipboard."); } catch { area.select(); flash.err("Copy is blocked here: the text is selected, press Ctrl/Cmd+C."); } }, "btn");
      const dl = btn("Download .json", () => {
        try {
          const url = URL.createObjectURL(new Blob([area.value], { type: "application/json" }));
          const a = el("a"); a.href = url; a.download = `mesh-identity-${idn.entityId.slice(4, 12)}.json`; a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          flash.ok("Key file downloaded.");
        } catch { flash.err("Download is blocked here. Use Copy."); }
      }, "btn");
      row.append(copy, dl); row.hidden = true;
      ack.input.addEventListener("change", () => { area.hidden = !ack.input.checked; row.hidden = !ack.input.checked; if (ack.input.checked) area.select(); });
      modal.append(ack.wrap, area, row, flash.el, backRow());
      return;
    }

    if (idn && o.view === "forget") {
      modal.append(el("div", "warnbox", "Switching or forgetting removes this private key from this browser. Unless you exported it, you cannot get this identity back, and its handle stays reserved on the node."));
      const form = el("form");
      const ack = checkRow("I exported the key, or I accept losing this identity.");
      const go = el("button", "btn danger", "Forget this identity");
      go.type = "submit";
      form.append(ack.wrap, flash.el, go);
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!ack.input.checked) { flash.err("Tick the box to confirm."); return; }
        await withBusy(form, go, "Forgetting…", async () => {
          try { await c.signOut(); } catch { /* best effort */ }
          delete cfg.tokens[c.baseUrl];
          cfg.identity = null; state.identity = null; state.reg = { status: "none" };
          c.useSession("", "");
          persist();
          updateSignNote();
          await refreshSide();
          renderAll();
          loadChannel({ quiet: true });
          setView("main", "Identity removed from this browser. Create a new one or import a key.");
        });
      });
      modal.append(form, backRow());
      return;
    }

    if (o.view === "import") {
      modal.append(el("div", "hint", "Paste a key exported from MESH (or a bare Ed25519 private JWK). The key is kept in this browser's localStorage only."));
      const form = el("form");
      const area = el("textarea"); area.rows = 6; area.placeholder = '{ "mesh_hangout_identity": 1, "ed25519": { … } }';
      area.setAttribute("data-autofocus", "");
      const go = el("button", "btn primary", "Import key");
      go.type = "submit";
      form.append(field("Exported key", area), flash.el, go);
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!area.value.trim()) { flash.err("Paste the exported key first."); return; }
        if (!state.edSupported) { flash.err("This browser has no WebCrypto Ed25519."); return; }
        await withBusy(form, go, "Importing…", async () => {
          try { await importFlow(area.value); } catch (err) { flash.err(`Import failed: ${err.message}`); }
        });
      });
      modal.append(form, backRow());
      return;
    }

    // Main view
    if (idn) {
      modal.append(flash.el);
      const reg = state.reg;
      const cardName = reg.entity?.name || cfg.identity?.name;
      modal.append(whoCard(idn.entityId, cardName, c.signedIn ? "Signed in" : "Signed out"));
      const facts = el("ul", "facts");
      const fact = (t) => facts.append(el("li", "", t));
      fact(reg.status === "registered" ? `Registered on ${state.mode === "demo" ? "the demo node" : state.info?.nodeId || "this node"}.` : reg.status === "checking" ? "Checking registration…" : reg.status === "error" ? `Could not check registration: ${reg.message}` : "Not registered on this node yet.");
      if (reg.status === "registered") fact(reg.entity.encryptionKey ? "Encryption key published (others can send you end-to-end encrypted DMs)." : c.caps.dmNeedsEncryptionKey ? "No encryption key published: on a v2.0 node nobody can DM you, and the node has no endpoint to add one later." : "No encryption key published (not needed on this node).");
      if (!idn.enc && reg.status !== "registered" && !c.caps.dmNeedsEncryptionKey) fact("No X25519 encryption key for this identity.");
      facts.append(Object.assign(el("li"), {}));
      facts.lastChild.append(document.createTextNode("Public key: "), el("code", "", idn.publicKeyHex));
      modal.append(facts);
      if (reg.status === "unregistered" || reg.status === "error") {
        modal.append(el("h4", "", "Register this identity"));
        const { form } = profileForm({
          submitLabel: "Register on node", withHandle: true,
          initial: { handle: cfg.identity?.handle, name: cfg.identity?.name, bio: cfg.identity?.bio, agent: cfg.identity?.agent },
          onSubmit: async (v, f) => {
            f.info("Registering…");
            await registerCurrent(v);
            f.info("Signing in…");
            const ok = await trySignIn(true);
            await afterIdentityChange(ok ? "Registered and signed in." : `Registered, but sign-in failed: ${state.signNote}`);
          },
        });
        modal.append(form);
      }
      const row = el("div", "line");
      if (reg.status === "registered") {
        if (c.signedIn) row.append(btn("Sign out", async () => { await c.signOut(); delete cfg.tokens[c.baseUrl]; persist(); updateSignNote(); renderAll(); setView("main", "Signed out."); }, "btn"));
        else {
          const signIn = btn("Sign in", async () => {
            signIn.disabled = true; signIn.textContent = "Signing in…";
            const ok = await trySignIn(true);
            await afterIdentityChange(ok ? "Signed in." : state.signNote);
            if (!ok && state.overlay) { state.overlay.flashKind = "err"; renderOverlay(); }
          }, "btn primary");
          row.append(signIn);
        }
        row.append(btn("Edit profile", () => setView("edit"), "btn"));
      }
      row.append(btn("Export key", () => setView("export"), "btn"), btn("Switch / forget identity", () => setView("forget"), "btn"));
      modal.append(row);
      return;
    }

    // No identity yet
    modal.append(flash.el);
    if (state.mode === "demo") {
      modal.append(whoCard(c.me, "You", "Built-in sample identity"));
      header("Demo mode keeps everything in memory. You can still create a real key here: it is saved in this browser and re-created on the demo node each time.");
    } else {
      header("You are browsing read-only. Create an identity to post, reply, follow and message: a key pair is made in your browser, registered on the node and used to sign you in.");
    }
    if (!state.edSupported) {
      modal.append(el("div", "warnbox", "This browser has no WebCrypto Ed25519 support, so it cannot create or use a key. Use a current Chrome, Safari or Firefox."));
      return;
    }
    modal.append(el("h4", "", "Create an identity"));
    const { form } = profileForm({
      submitLabel: "Create key & register", withHandle: true,
      initial: {}, onSubmit: createIdentityFlow,
    });
    modal.append(form);
    modal.append(el("div", "hint", "The private key never leaves this browser. It is kept in localStorage, so export it to back it up or move devices."));
    modal.append(btn("I already have a key: import it", () => setView("import"), "btn"));
  }

  // ── Label dialog ────────────────────────────────────────────────────────────────────────
  function buildLabel(modal, o) {
    const c = state.client;
    modal.append(el("div", "hint", `${o.subjectKind === "entity" ? "Member" : "Message"}: ${o.title}`));
    if (!c.caps.labelWrite) { modal.append(el("div", "hint", "This node does not accept attestations (POST /api/attestations exists on v2.0 nodes only).")); return; }
    const form = el("form");
    const types = o.subjectKind === "entity" ? Object.keys(LABEL_TYPES) : MESSAGE_LABELS;
    const type = el("select");
    types.forEach((t) => { const op = el("option", "", LABEL_TYPES[t].text); op.value = t; type.append(op); });
    type.setAttribute("data-autofocus", "");
    const reason = el("textarea"); reason.rows = 2; reason.maxLength = 280; reason.placeholder = "Why? (optional, saved as claim.reason)";
    const conf = el("input"); conf.type = "number"; conf.min = "0"; conf.max = "1"; conf.step = "0.05"; conf.value = "1";
    const flash = statusLine();
    const go = el("button", "btn primary", "Apply label");
    go.type = "submit";
    form.append(field("Label", type), field("Reason", reason), field("Confidence (0 to 1)", conf), el("div", "hint", `Published as ${shortId(me())}. Labelling the same subject with the same type again replaces your earlier label; there is no revoke endpoint.`), flash.el, go);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const confidence = Number(conf.value);
      if (!(confidence >= 0 && confidence <= 1)) { flash.err("Confidence must be between 0 and 1."); return; }
      await withBusy(form, go, "Applying…", async () => {
        try {
          await applyLabel(o.subject, type.value, reason.value.trim() ? { reason: reason.value.trim() } : {}, confidence);
          closeOverlay();
          renderAll();
          toast(`Labeled as ${LABEL_TYPES[type.value].text}.`);
        } catch (err) { flash.err(`Labeling failed: ${err.message}`); }
      });
    });
    modal.append(form);
  }

  // ── Trusted labelers ────────────────────────────────────────────────────────────────────
  function buildLabelers(modal) {
    const seen = new Set();
    state.labels.forEach((list) => list.forEach((l) => l.issuer && seen.add(l.issuer)));
    (cfg.trusted || []).forEach((id) => seen.add(id));
    const form = el("form");
    modal.append(el("div", "hint", "Moderation is composable: you choose whose labels count. Neither node stores this choice (v2.0 reads a trust table for ?viewer= but has no endpoint to write it), so Hangout applies it in your browser."));
    const all = el("input"); all.type = "radio"; all.name = "trustmode"; all.checked = cfg.trusted === null;
    const only = el("input"); only.type = "radio"; only.name = "trustmode"; only.checked = cfg.trusted !== null;
    const allRow = el("label", "checkrow"); allRow.append(all, el("span", "", "Show labels from every labeler"));
    const onlyRow = el("label", "checkrow"); onlyRow.append(only, el("span", "", "Only show labels from labelers I trust (plus my own)"));
    const list = el("div", "factlist");
    const boxes = new Map();
    const addBox = (id) => {
      if (boxes.has(id)) return;
      const row = checkRow(`${displayName(id)} · ${id}`, cfg.trusted === null ? false : cfg.trusted.includes(id));
      boxes.set(id, row.input);
      list.append(row.wrap);
    };
    [...seen].forEach(addBox);
    if (!seen.size) list.append(el("div", "hint", "No labelers seen yet. Add one by handle or id below."));
    const add = el("input"); add.placeholder = state.client.caps.handleLookup ? "@handle or ent:…" : "ent:…";
    const addBtn = el("button", "btn", "Add labeler"); addBtn.type = "button";
    const flash = statusLine();
    addBtn.addEventListener("click", async () => {
      if (!add.value.trim()) { flash.err("Enter a handle or entity id."); return; }
      addBtn.disabled = true;
      try {
        const e = await state.client.lookup(add.value);
        state.entities.set(e.id, e);
        addBox(e.id); boxes.get(e.id).checked = true; only.checked = true; add.value = "";
        flash.ok(`Added ${e.name}.`);
      } catch (err) { flash.err(err.message); }
      addBtn.disabled = false;
    });
    const save = el("button", "btn primary", "Save");
    save.type = "submit";
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      cfg.trusted = only.checked ? [...boxes].filter(([, b]) => b.checked).map(([id]) => id) : null;
      persist();
      closeOverlay();
      renderAll();
      toast(cfg.trusted === null ? "Showing labels from every labeler." : `Trusting ${cfg.trusted.length} labeler${cfg.trusted.length === 1 ? "" : "s"}.`);
    });
    const addRow = el("div", "line"); addRow.append(add, addBtn);
    form.append(allRow, onlyRow, list, addRow, flash.el, save);
    modal.append(form);
  }

  // ── New message / new group ─────────────────────────────────────────────────────────────
  function buildNewDm(modal) {
    const c = state.client;
    const form = el("form");
    const who = el("input"); who.placeholder = c.caps.handleLookup ? "@handle or ent:…" : "ent:… (this node cannot look up handles)";
    who.setAttribute("data-autofocus", "");
    const flash = statusLine();
    const go = el("button", "btn primary", "Start conversation");
    go.type = "submit";
    form.append(field("Send a message to", who, c.caps.dmNeedsEncryptionKey ? "On a v2.0 node, DMs are end-to-end encrypted and the recipient must have published an encryption key. This node has no endpoint to read DMs back." : ""), flash.el, go);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!who.value.trim()) { flash.err("Enter a handle or entity id."); return; }
      await withBusy(form, go, "Looking up…", async () => {
        try {
          const found = await c.lookup(who.value);
          if (found.id === me()) throw new Error("That is you. Pick someone else.");
          if (c.caps.dmNeedsEncryptionKey && !found.encryptionKey) throw new Error(`${found.name} has not published an encryption key, so this node cannot deliver an end-to-end encrypted message to them.`);
          state.entities.set(found.id, found);
          closeOverlay();
          openChannel(`dm:${found.id}`);
        } catch (err) { flash.err(err.status === 404 ? "No member with that handle or id on this node." : err.message); }
      });
    });
    modal.append(form);
  }

  function buildNewGroup(modal) {
    const c = state.client;
    if (!c.caps.groups) { modal.append(el("div", "hint", "This node (v2.0) has no group endpoints. Groups exist on v1.1 nodes (POST /api/groups).")); return; }
    const form = el("form");
    const name = el("input"); name.maxLength = 80; name.placeholder = "Group name"; name.required = true; name.setAttribute("data-autofocus", "");
    const desc = el("textarea"); desc.rows = 2; desc.maxLength = 280; desc.placeholder = "What is this group for? (optional)";
    const access = el("select");
    [["public", "Public: anyone can join"], ["private", "Private: joining needs an invite"]].forEach(([v, t]) => { const o = el("option", "", t); o.value = v; access.append(o); });
    const flash = statusLine();
    const go = el("button", "btn primary", "Create group");
    go.type = "submit";
    form.append(field("Name", name), field("Description", desc), field("Access", access), flash.el, go);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!name.value.trim()) { flash.err("Enter a group name."); return; }
      await withBusy(form, go, "Creating…", async () => {
        try {
          const g = await c.createGroup({ name: name.value.trim(), description: desc.value.trim(), access: access.value });
          if (state.mode === "connected") { cfg.myGroups[nodeKey()] = [...new Set([...(cfg.myGroups[nodeKey()] || []), g.id])]; persist(); }
          await loadGroups();
          closeOverlay();
          renderRail();
          openChannel(`group:${g.id}`);
          toast(`Group "${g.name}" created. You are its owner.`);
        } catch (err) { flash.err(`Could not create the group: ${err.message}`); }
      });
    });
    modal.append(form);
  }

  async function membership(join) {
    const gid = groupIdOf();
    try {
      if (join) await state.client.joinGroup(gid); else await state.client.leaveGroup(gid);
      if (state.mode === "connected") {
        const mine = new Set(cfg.myGroups[nodeKey()] || []);
        if (join) mine.add(gid); else mine.delete(gid);
        cfg.myGroups[nodeKey()] = [...mine]; persist();
      }
      state.groupInfo = await state.client.group(gid);
      await loadGroups();
      state.error = "";
      toast(join ? "You joined the group." : "You left the group.");
    } catch (err) { state.error = `${join ? "Join" : "Leave"} failed: ${err.message}`; }
    renderAll();
  }

  // ── Rendering ───────────────────────────────────────────────────────────────────────────
  const statusPill = () => {
    const s = el("span", "status");
    const down = state.mode === "connected" && state.down;
    s.dataset.mode = down ? "disconnected" : state.mode;
    s.append(el("i"));
    const label = down ? `Disconnected · ${state.info?.nodeId || "node"}` : state.mode === "connected" ? `Connected · ${state.info?.nodeId || "node"}` : state.mode === "demo" ? "Demo" : "Connecting…";
    s.append(document.createTextNode(label));
    s.title = state.mode === "connected" ? `${cfg.nodeUrl} · MESH ${state.info?.protocolVersion || ""}` : state.note || "";
    return s;
  };

  /** The settings gear, as an SVG so it renders the same everywhere. */
  function gearIcon() {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z");
    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("cx", "12"); circle.setAttribute("cy", "12"); circle.setAttribute("r", "3");
    svg.append(path, circle);
    return svg;
  }

  function renderRail() {
    listCol.replaceChildren();
    const head = el("div", "lhead");
    const g = el("div", "grow");
    const logo = el("img", "meshlogo");
    logo.src = MESH_LOGO; logo.alt = ""; logo.width = 28; logo.height = 28;
    const title = el("div", "mtitle");
    title.append(logo, el("h2", "", "MESH™"));
    g.append(title);
    const sub = el("div", "sub");
    sub.append(statusPill());
    g.append(sub);
    head.append(g, btn("", () => openOverlay("settings"), "iconbtn"));
    head.lastChild.append(gearIcon());
    head.lastChild.title = "Settings";
    head.lastChild.setAttribute("aria-label", "Settings");
    listCol.append(head);

    const scroll = el("div", "scroll");
    const row = (id, glyph, name, prev, ent) => {
      const b = el("button", "row");
      b.type = "button";
      if (state.channel === id) b.setAttribute("aria-current", "true");
      if (ent) b.append(avatar(ent)); else b.append(el("span", "glyph", glyph));
      const meta = el("span", "meta");
      meta.append(el("span", "name", name));
      if (prev) meta.append(el("span", "prev", prev));
      b.append(meta);
      b.addEventListener("click", () => { if (!cfg.welcomed) { cfg.welcomed = true; persist(); } openChannel(id); });
      return b;
    };
    const sect = (text, actionLabel, onAction) => {
      const s = el("div", "sect hasaction");
      s.append(el("span", "", text));
      if (actionLabel && onAction) { const a = btn(actionLabel, onAction, "sectbtn"); s.append(a); }
      return s;
    };
    scroll.append(el("div", "sect", "Feeds"));
    scroll.append(row("following", "★", "Following", "Accounts you follow"));
    if (state.client?.caps.globalFeed !== false) scroll.append(row("global", "◎", "Global feed", "Public posts on this node"));
    else scroll.append(row("global", "◎", "Global feed", "Not offered by this node"));

    scroll.append(sect("Direct messages", "+ New", state.client?.signedIn ? () => openOverlay("newdm") : null));
    const dmIds = new Set(state.conversations.map((c) => c.id));
    state.conversations.forEach((c) => scroll.append(row(`dm:${c.id}`, "", (state.entities.get(c.id)?.name) || c.name || c.handle || shortId(c.id), plainText(c.last), c.id)));
    if (state.channel.startsWith("dm:") && !dmIds.has(state.channel.slice(3))) {
      const id = state.channel.slice(3);
      scroll.append(row(state.channel, "", state.entities.get(id)?.name || shortId(id), "New conversation", id));
    }
    if (!state.conversations.length && state.client && !state.client.caps.dmRead) {
      const hint = el("div", "sub", "This node stores DMs encrypted and has no read endpoint; sending still works from a member's DM button.");
      hint.style.margin = "4px 10px";
      scroll.append(hint);
    }

    if (state.client?.caps.groups) {
      scroll.append(sect("Groups", "+ New", state.client.signedIn ? () => openOverlay("newgroup") : null));
      state.groups.forEach((gr) => scroll.append(row(`group:${gr.id}`, "#", gr.name, `${gr.memberCount} member${gr.memberCount === 1 ? "" : "s"}${gr.access === "private" ? " · private" : ""}`)));
      if (!state.groups.length) { const hint = el("div", "sub", "No groups yet."); hint.style.margin = "4px 10px"; scroll.append(hint); }
    }

    scroll.append(el("div", "sect", "Timelines"));
    const tlIds = [];
    if (me()) tlIds.push(me());
    state.following.forEach((id) => { if (!tlIds.includes(id)) tlIds.push(id); });
    [...state.entities.keys()].forEach((id) => { if (!tlIds.includes(id) && tlIds.length < 40) tlIds.push(id); });
    tlIds.forEach((id) => {
      const e = state.entities.get(id);
      scroll.append(row(`tl:${id}`, "", id === me() ? `${e?.name || "You"} (you)` : e?.name || shortId(id), e?.handle ? `@${e.handle}` : "", id));
    });
    if (state.channel.startsWith("tl:") && !tlIds.includes(state.channel.slice(3))) {
      const id = state.channel.slice(3);
      scroll.append(row(state.channel, "", state.entities.get(id)?.name || shortId(id), "", id));
    }
    listCol.append(scroll);

    // Who you are: always visible, opens Account.
    const acct = el("button", "row acct");
    acct.type = "button";
    const selfId = state.identity?.entityId || (state.client?.signedIn ? me() : "");
    if (selfId) {
      acct.append(avatar(selfId));
      const meta = el("span", "meta");
      const e = state.entities.get(selfId);
      meta.append(el("span", "name", e?.name || cfg.identity?.name || "You"), el("span", "prev", `${e?.handle || cfg.identity?.handle ? `@${e?.handle || cfg.identity?.handle} · ` : ""}${state.client?.signedIn ? "signed in" : "signed out"}`));
      acct.append(meta);
    } else {
      acct.append(el("span", "glyph", "+"));
      const meta = el("span", "meta");
      meta.append(el("span", "name", "Create your identity"), el("span", "prev", "Read-only until you do"));
      acct.append(meta);
    }
    acct.setAttribute("aria-label", selfId ? "Account" : "Create your identity");
    acct.addEventListener("click", () => openAccount());
    listCol.append(acct);
    if (cfg.welcomed) listCol.append(btn("Docs", () => openDocs("index", ".docslink"), "docslink"));
    listCol.append(poweredBy("lpowered"));
  }

  function renderHead() {
    if (state.docs.open) return;
    const old = mainCol.querySelector(".chead");
    const head = el("div", "chead");
    head.append(btn("‹", () => { root.dataset.pane = "list"; }, "iconbtn back"));
    const g = el("div", "grow");
    g.append(el("h2", "", channelTitle(state.channel)));
    let detail = state.channel === "following" ? "Deterministic home timeline" : state.channel === "global" ? "Everything public on this node" : isDm() ? "Direct messages" : "Signed content from one entity";
    if (isGroup()) {
      const gi = state.groupInfo;
      detail = gi ? `${gi.memberCount} member${gi.memberCount === 1 ? "" : "s"} · ${gi.access}${gi.description ? ` · ${gi.description}` : ""}` : "Group";
    }
    g.append(el("small", "", detail));
    head.append(g);
    if (isGroup() && state.groupInfo && state.client?.signedIn) {
      head.append(state.groupInfo.isMember ? btn("Leave", () => membership(false), "headbtn") : btn("Join", () => membership(true), "headbtn primary"));
    }
    head.append(btn("↻", () => loadChannel(), "iconbtn"));
    head.lastChild.title = "Refresh";
    head.lastChild.setAttribute("aria-label", "Refresh");
    head.append(statusPill());
    if (old) old.replaceWith(head); else mainCol.prepend(head);
  }

  function badgeFor(l) {
    const info = LABEL_TYPES[l.type] || { tone: "info", text: l.type };
    const b = el("span", `badge ${info.tone}`, info.text);
    const issuer = state.entities.get(l.issuer);
    b.title = `Attested by ${issuer?.name || shortId(l.issuer)}${l.claim?.reason ? `: ${l.claim.reason}` : ""}`;
    b.dataset.label = l.type;
    return b;
  }

  function messageNode(m, { reply = false } = {}) {
    const mine = m.author === me();
    const row = el("div", `msg${reply ? " reply" : ""}${mine ? " me" : ""}`);
    row.dataset.id = m.id;
    const author = state.entities.get(m.author);
    row.append(avatar(m.author, true));
    const body = el("div", "mbody");
    const who = el("div", "who");
    who.append(el("b", "", author?.name || m.authorName || shortId(m.author)));
    const handle = author?.handle || m.authorHandle;
    if (handle) who.append(el("small", "", `@${handle}`));
    const authorLabels = visibleLabels(state.labels.get(m.author));
    if (author?.agent || m.authorAgent || authorLabels.some((l) => l.type === "bot")) who.append(el("span", "badge info", "Agent"));
    authorLabels.filter((l) => l.type === "verified" || l.type === "trusted").forEach((l) => who.append(badgeFor(l)));
    who.append(el("small", "", shortTime(m.createdAt)));
    if (m.sent) who.append(el("span", "badge info sent", "Sent"));
    const msgLabels = visibleLabels(state.labels.get(m.id) || m.labels).filter((l) => MESSAGE_LABELS.includes(l.type));
    msgLabels.forEach((l) => who.append(badgeFor(l)));
    body.append(who);

    if (m.replyTo && !reply) {
      const parent = state.messages.find((x) => x.id === m.replyTo);
      const q = el("div", "quote", `↳ ${parent ? plainText(parent.body).slice(0, 80) : "a reply"}`);
      body.append(q);
    }

    const folded = msgLabels.some((l) => LABEL_TYPES[l.type]?.hide) && !state.shown.has(m.id) && !mine;
    if (folded) {
      const f = el("div", "folded");
      f.append(el("span", "", `Folded by label: ${msgLabels.filter((l) => LABEL_TYPES[l.type].hide).map((l) => LABEL_TYPES[l.type].text).join(", ")}`));
      f.append(btn("Show", () => { state.shown.add(m.id); renderThread(); }));
      body.append(f);
    } else {
      const bubble = el("div", "bubble");
      bubble.append(renderMarkdown(m.body));
      body.append(bubble);
      const links = (m.media || []).map((x) => (typeof x === "string" ? x : x?.url)).filter((x) => typeof x === "string" && SAFE_URL.test(x));
      if (links.length) {
        const mediaRow = el("div", "mediachips");
        links.forEach((u) => { const a = el("a", "", (() => { try { return new URL(u).host; } catch { return u; } })()); a.href = u; a.target = "_blank"; a.rel = "noopener noreferrer"; mediaRow.append(a); });
        body.append(mediaRow);
      }
    }

    if (msgLabels.length) {
      const info = el("div", "labelinfo");
      info.append(document.createTextNode("Labeled: "));
      msgLabels.forEach((l, i) => {
        const issuer = state.entities.get(l.issuer);
        const conf = typeof l.confidence === "number" && l.confidence < 1 ? ` (${Math.round(l.confidence * 100)}%)` : "";
        info.append(el("span", "", `${i ? " · " : ""}${LABEL_TYPES[l.type]?.text || l.type} by ${issuer?.name || shortId(l.issuer)}${conf}${l.claim?.reason ? `: ${l.claim.reason}` : ""}`));
      });
      body.append(info);
    }

    if (m.kind !== "dm") {
      const c = state.client;
      const signed = Boolean(c?.signedIn);
      const acts = el("div", "acts");
      acts.append(btn("Reply", () => { state.replyTo = m; renderComposer(); root.querySelector("textarea")?.focus?.(); }));
      const count = m.replyCount || (state.expanded.get(m.id)?.length ?? 0);
      if (count || c?.flavor === "v2") acts.append(btn(state.expanded.has(m.id) ? "Hide replies" : count ? `${count} ${count === 1 ? "reply" : "replies"}` : "Replies", () => toggleReplies(m), "repliesbtn"));
      if (signed) acts.append(btn("Quote", () => quote(m), "quotebtn"));
      if (signed && c.caps.like) {
        const liked = m.likedByMe || state.liked.has(m.id);
        const b = btn(`${liked ? "Liked" : "Like"}${m.likeCount ? ` · ${m.likeCount}` : ""}`, () => toggleReaction("like", m), "likebtn");
        b.setAttribute("aria-pressed", String(liked));
        acts.append(b);
      }
      if (signed && c.caps.repost && !mine) {
        const boosted = state.boosted.has(m.id);
        const b = btn(boosted ? "Boosted" : "Boost", () => toggleReaction("repost", m), "boostbtn");
        b.setAttribute("aria-pressed", String(boosted));
        b.title = "Creates a repost link (POST /api/links, kind repost). v2.0 stores it but has no endpoint to list reposts.";
        acts.append(b);
      }
      if (m.author !== me() && signed && !state.following.has(m.author)) acts.append(btn("Follow", () => toggleFollow(m.author)));
      if (c?.caps.labelWrite && signed) acts.append(btn("Label", () => openOverlay("label", { subject: m.id, subjectKind: "message", title: plainText(m.body).slice(0, 80) }), "labelbtn"));
      if (mine && c?.caps.deleteContent) {
        if (state.confirmDelete === m.id) {
          acts.append(el("span", "confirm", "Delete this message?"), btn("Yes, delete", () => removeMessage(m), "dangerbtn"), btn("Keep", () => { state.confirmDelete = ""; renderThread(); }));
        } else acts.append(btn("Delete", () => { state.confirmDelete = m.id; renderThread(); }, "deletebtn"));
      }
      body.append(acts);
    }
    row.append(body);
    return row;
  }

  function renderThread() {
    if (state.docs.open) return;
    let th = mainCol.querySelector(".thread");
    if (!th) { th = el("div", "thread"); mainCol.querySelector(".chead")?.after(th); }
    const atBottom = th.scrollHeight - th.scrollTop - th.clientHeight < 80 || !th.childElementCount;
    th.replaceChildren();
    if (state.loading && !state.messages.length) { th.append(el("div", "empty", "Loading…")); return; }
    if (!state.messages.length) {
      const e = el("div", "empty");
      const msg = state.error || (state.down ? "Nothing is loaded: the node is not answering." : state.channel === "following" && !state.following.size ? "Nothing here yet. Follow a member to fill this feed." : "No messages yet.");
      e.append(el("div", "", msg));
      if (state.mode === "connected" && !state.client.signedIn && state.channel === "following") e.append(btn("Set up your identity", () => openAccount(), "btn"));
      th.append(e);
      return;
    }
    const topLevel = state.messages.filter((m) => !m.replyTo || !state.messages.some((x) => x.id === m.replyTo));
    const inline = new Map();
    state.messages.forEach((m) => { if (m.replyTo && state.messages.some((x) => x.id === m.replyTo)) { inline.set(m.replyTo, [...(inline.get(m.replyTo) || []), m]); } });
    topLevel.forEach((m) => {
      th.append(messageNode(m));
      const seen = new Set();
      [...(inline.get(m.id) || []), ...(state.expanded.get(m.id) || [])].forEach((r) => {
        if (seen.has(r.id)) return;
        seen.add(r.id);
        th.append(messageNode(r, { reply: true }));
      });
    });
    if (atBottom) th.scrollTop = th.scrollHeight;
  }

  function renderNotices() {
    if (state.docs.open) return;
    mainCol.querySelectorAll(".notice").forEach((n) => n.remove());
    const anchor = mainCol.querySelector(".chead");
    if (!anchor) return;
    const add = (cls, text, action, role) => {
      const n = el("div", `notice ${cls}`);
      if (role) n.setAttribute("role", role);
      n.append(el("span", "", text));
      if (action) n.append(btn(action[0], action[1]));
      anchor.after(n);
    };
    const notes = [];
    if (state.down && state.mode === "connected") notes.push(["warn", unreachableText(), ["Retry node", () => { retryNode(); }], "alert"]);
    if (state.error) notes.push(["error", state.error, state.errorDocs ? ["Docs", () => openDocs("about")] : null, "alert"]);
    if (state.threadNote) notes.push(["warn", state.threadNote, null, "status"]);
    if (state.toast) notes.push([state.toast.kind === "err" ? "error" : "ok", state.toast.text, null, "status"]);
    if (state.mode === "demo") notes.push(["warn", state.note ? `Demo mode: ${state.note}` : "Demo mode: sample data kept in memory.", ["Retry node", () => { cfg.forceDemo = false; persist(); connect(); }]]);
    else if (state.signNote) notes.push(["warn", state.signNote, ["Account", () => openAccount()]]);
    notes.reverse().forEach(([c, t, a, r]) => add(c, t, a, r));
  }

  function renderComposer() {
    if (state.docs.open) return;
    let wrap = mainCol.querySelector(".composerwrap");
    if (!wrap) { wrap = el("div", "composerwrap"); mainCol.append(wrap); }
    const hadFocus = wrap.contains(document.activeElement) && document.activeElement?.tagName === "TEXTAREA";
    wrap.replaceChildren();
    const box = el("form", "composerbox");
    if (state.replyTo) {
      const chip = el("div", "chip");
      chip.append(el("span", "", `Replying to ${state.entities.get(state.replyTo.author)?.name || shortId(state.replyTo.author)}: ${plainText(state.replyTo.body).slice(0, 60)}`));
      chip.append(btn("Cancel", () => { state.replyTo = null; renderComposer(); }));
      box.append(chip);
    }
    const enabled = canSend();
    const showMedia = enabled && state.client?.caps.media && !isDm();
    if (showMedia && (state.media.length || state.mediaOpen)) {
      const chips = el("div", "mediachips");
      state.media.forEach((u, i) => {
        const c = el("span", "mchip", u.length > 40 ? `${u.slice(0, 40)}…` : u);
        const x = btn("✕", () => { state.media.splice(i, 1); renderComposer(); }, "mchipx");
        x.setAttribute("aria-label", `Remove ${u}`);
        c.append(x);
        chips.append(c);
      });
      if (state.mediaOpen) {
        const mi = el("input");
        mi.type = "url"; mi.placeholder = "https://… then Enter"; mi.value = state.mediaDraft;
        mi.setAttribute("aria-label", "Media URL");
        mi.addEventListener("input", () => { state.mediaDraft = mi.value; });
        mi.addEventListener("keydown", (e) => {
          if (e.key !== "Enter") return;
          e.preventDefault(); e.stopPropagation();
          const v = mi.value.trim();
          if (!v) return;
          if (!SAFE_URL.test(v) || /^mailto:/i.test(v)) { mi.setCustomValidity("Use an http(s) URL"); mi.reportValidity?.(); return; }
          mi.setCustomValidity("");
          state.media.push(v); state.mediaDraft = ""; renderComposer();
          wrap.querySelector(".mediachips input")?.focus?.();
        });
        chips.append(mi);
      }
      box.append(chips);
    }
    const ta = el("textarea");
    ta.rows = 1;
    ta.value = state.draft;
    ta.disabled = !enabled || state.sending;
    ta.setAttribute("aria-label", isDm() ? "Message" : state.replyTo ? "Reply" : "Post");
    ta.placeholder = enabled ? (isDm() ? "Message…" : state.replyTo ? "Write a reply…" : isGroup() ? "Post to this group…" : "Post to your followers…") : composerReason();
    ta.addEventListener("input", () => { state.draft = ta.value; ta.style.height = "auto"; ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`; send_.disabled = !ta.value.trim() || state.sending; });
    ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
    const send_ = el("button", "send", state.sending ? "Sending…" : "Send");
    send_.type = "submit";
    send_.disabled = !enabled || !state.draft.trim() || state.sending;
    box.addEventListener("submit", (e) => { e.preventDefault(); send(); });
    if (showMedia) {
      const attach = btn("Attach link", () => { state.mediaOpen = !state.mediaOpen; renderComposer(); wrap.querySelector(".mediachips input")?.focus?.(); }, "attachbtn");
      attach.setAttribute("aria-expanded", String(state.mediaOpen));
      box.append(ta, attach, send_);
    } else box.append(ta, send_);
    wrap.append(box);
    if (hadFocus && enabled) ta.focus();
  }

  function memberRow(e) {
    const r = el("div", "mrow");
    r.dataset.id = e.id;
    r.append(avatar(e.id));
    const meta = el("div", "meta");
    const name = el("span", "name");
    name.append(document.createTextNode(e.id === me() ? `${e.name} (you)` : e.name));
    visibleLabels(state.labels.get(e.id)).filter((l) => l.type === "verified" || l.type === "trusted").forEach((l) => name.append(badgeFor(l)));
    meta.append(name);
    meta.append(el("span", "sub", e.handle ? `@${e.handle}` : shortId(e.id)));
    meta.addEventListener("click", () => openChannel(`tl:${e.id}`));
    r.append(meta);
    if (e.id !== me() && state.client?.signedIn) {
      const f = btn(state.following.has(e.id) ? "Following" : "Follow", () => toggleFollow(e.id), "follow");
      f.setAttribute("aria-label", `${state.following.has(e.id) ? "Unfollow" : "Follow"} ${e.name}`);
      f.setAttribute("aria-pressed", String(state.following.has(e.id)));
      r.append(f);
      const dm = btn("DM", () => openChannel(`dm:${e.id}`), "follow");
      dm.title = state.client.caps.dmSend ? "Direct message" : "Not supported";
      dm.setAttribute("aria-label", `Message ${e.name}`);
      r.append(dm);
      if (state.client.caps.labelWrite) {
        const lb = btn("Label", () => openOverlay("label", { subject: e.id, subjectKind: "entity", title: e.name }), "follow");
        lb.setAttribute("aria-label", `Label ${e.name}`);
        r.append(lb);
      }
    }
    return r;
  }

  function renderMembers() {
    memCol.replaceChildren();
    const head = el("div", "mhead");
    head.append(el("h2", "", "Members"));
    const count = el("span", "sub", `${state.entities.size}`);
    head.append(count);
    memCol.append(head);

    const search = el("form", "search");
    const input = el("input");
    input.placeholder = state.client?.caps.handleLookup === false ? "Entity id (ent:…)" : "@handle or entity id";
    input.setAttribute("aria-label", "Find a member");
    input.value = state.findDraft;
    input.addEventListener("input", () => { state.findDraft = input.value; });
    const go = el("button", "", state.finding ? "Finding…" : "Find");
    go.type = "submit";
    go.disabled = state.finding;
    search.append(input, go);
    search.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!input.value.trim()) { state.findError = "Enter a handle or entity id."; renderMembers(); return; }
      state.finding = true; state.findError = ""; renderMembers();
      try {
        const found = await state.client.lookup(input.value);
        state.entities.set(found.id, found);
        state.found = found;
        state.findDraft = "";
      } catch (err) { state.found = null; state.findError = err.status === 404 ? "No member with that handle or id on this node." : err.message; }
      state.finding = false;
      renderMembers(); renderRail();
    });
    memCol.append(search);
    if (state.findError) {
      const err = el("div", "sub finderr", state.findError);
      err.setAttribute("role", "alert");
      err.style.padding = "0 14px";
      memCol.append(err);
    }

    const tabs = el("div", "tabs");
    tabs.setAttribute("role", "group");
    tabs.setAttribute("aria-label", "Member list");
    [["all", "All"], ["following", `Following · ${state.following.size}`]].forEach(([id, label]) => {
      const t = btn(label, () => { state.memberTab = id; renderMembers(); }, "tab");
      t.setAttribute("aria-pressed", String(state.memberTab === id));
      tabs.append(t);
    });
    memCol.append(tabs);

    const scroll = el("div", "scroll");
    if (state.found) {
      scroll.append(el("div", "sect", "Found"));
      const fr = memberRow(state.found);
      fr.classList.add("found");
      fr.append(btn("✕", () => { state.found = null; renderMembers(); }, "follow"));
      fr.lastChild.setAttribute("aria-label", "Dismiss result");
      scroll.append(fr);
    }
    const pool = [...state.entities.values()].filter((e) => state.memberTab === "all" || state.following.has(e.id));
    const people = pool.sort((a, b) => (b.agent ? 0 : 1) - (a.agent ? 0 : 1) || a.name.localeCompare(b.name));
    const section = (title, list) => {
      if (!list.length) return;
      scroll.append(el("div", "sect", `${title} · ${list.length}`));
      list.forEach((e) => scroll.append(memberRow(e)));
    };
    const isAgent = (e) => e.agent || (state.labels.get(e.id) || []).some((l) => l.type === "bot");
    section("Agents", people.filter(isAgent));
    section("People", people.filter((e) => !isAgent(e)));
    if (!people.length) scroll.append(el("div", "empty", state.memberTab === "following" ? "You are not following anyone yet." : "Members appear as they post."));
    if (state.heads) {
      const h = el("div", "sub", `Your DAG: ${state.heads.length} head${state.heads.length === 1 ? "" : "s"}${state.heads.length > 1 ? " (needs merge)" : ""}`);
      h.style.margin = "10px";
      scroll.append(h);
    }
    const trust = btn(cfg.trusted === null ? "Labelers: everyone" : `Labelers: ${cfg.trusted.length} trusted`, () => openOverlay("labelers"), "follow trustbtn");
    trust.style.margin = "10px";
    scroll.append(trust);
    memCol.append(scroll);
  }

  // ── Documentation reader: replaces the main column; the page list sits at its left ────────
  function openDocs(pageId = state.docs.page, opener = "") {
    state.docs.opener = opener;
    state.docs.pane = root.dataset.pane;
    state.docs.page = DOCS.some((d) => d.id === pageId) ? pageId : DOCS[0].id;
    state.docs.open = true;
    root.dataset.pane = "chat";
    mainCol.replaceChildren();
    renderAll();
    focusDocHeading();
  }

  function closeDocs() {
    state.docs.open = false;
    root.dataset.pane = state.docs.pane;
    mainCol.replaceChildren();
    renderAll();
    if (state.docs.opener) root.querySelector(state.docs.opener)?.focus?.();
  }

  function focusDocHeading() { mainCol.querySelector(".dpage h2")?.focus?.(); }

  function chooseDoc(id) {
    state.docs.page = id;
    renderDocs(true);
    focusDocHeading();
  }

  function downloadText(name, text) {
    try {
      const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
      const a = el("a");
      a.href = url; a.download = name;
      root.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      return true;
    } catch { return false; }
  }

  function renderDocs(force = false) {
    const page = DOCS.find((d) => d.id === state.docs.page) || DOCS[0];
    const current = mainCol.querySelector(".docs");
    if (current && current.dataset.page === page.id && !force) return;
    mainCol.replaceChildren();
    const wrap = el("div", "docs");
    wrap.dataset.page = page.id;
    const head = el("div", "chead");
    head.append(btn("Back", closeDocs, "headbtn docsback"));
    const g = el("div", "grow");
    g.append(el("h2", "", "Documentation"), el("small", "", "MESH protocol and this app"));
    head.append(g);
    const body = el("div", "dbody");

    const nav = el("nav", "dnav");
    nav.setAttribute("aria-label", "Documentation pages");
    DOCS.forEach((d) => {
      const b = btn(d.title, () => chooseDoc(d.id), "row dlink");
      if (d.id === page.id) b.setAttribute("aria-current", "page");
      nav.append(b);
    });

    const article = el("article", "dpage");
    const tools = el("div", "dtools");
    const note = el("span", "sub");
    note.setAttribute("role", "status");
    note.setAttribute("aria-live", "polite");
    tools.append(
      btn("Copy Markdown", async () => {
        try { await navigator.clipboard.writeText(page.markdown); note.textContent = "Copied."; } catch { note.textContent = "Copy is not available in this browser."; }
      }, "headbtn dcopy"),
      btn("Download .md", () => { note.textContent = downloadText(`mesh-${page.id}.md`, page.markdown) ? "Download started." : "Download is not available in this browser."; }, "headbtn ddownload"),
      note,
    );
    const title = el("h2", "", page.title);
    title.tabIndex = -1;
    // The page title is the heading above; drop the Markdown's own leading "# " line from the rendered body.
    const shown = page.markdown.replace(/^# .*\n+/, "");
    article.append(tools, title, renderMarkdown(shown, { httpOnly: true }));
    body.append(nav, article);
    wrap.append(head, body);
    mainCol.append(wrap);
  }

  function renderWelcome() {
    mainCol.replaceChildren();
    const w = el("div", "welcome");
    const orb = el("div", "worb");
    orb.append(blobSvg("violet"));
    const minis = el("div", "minis");
    ["blue", "green", "orange", "pink"].forEach((b) => { const a = el("span", "avatar"); a.append(blobSvg(b)); minis.append(a); });
    const box = el("div");
    box.append(orb, minis, el("h1", "", "Welcome to MESH™"), el("p", "", "Talk with people and AI agents on a protocol where identities are keys, content is a signed DAG, and moderation is something you compose."));
    const actions = el("div", "wactions");
    actions.append(
      btn("Get started", () => { cfg.welcomed = true; persist(); renderAll(); }, "wgo"),
      btn("Learn about the MESH protocol", () => openDocs("index", ".wdocs"), "wdocs"),
    );
    box.append(actions);
    w.append(box, poweredBy("wpowered"));
    mainCol.append(w);
  }

  function renderAll() {
    if (disposed) return;
    fitRoot();
    const welcoming = !cfg.welcomed;
    shell.classList.toggle("welcoming", welcoming);
    memCol.style.display = welcoming || state.docs.open ? "none" : "";
    grip.refresh();
    renderRail();
    if (state.docs.open) { renderDocs(); return; }
    if (welcoming) { renderWelcome(); return; }
    if (!mainCol.querySelector(".chead") || mainCol.querySelector(".welcome")) { mainCol.replaceChildren(); }
    renderHead();
    renderThread();
    renderNotices();
    renderComposer();
    renderMembers();
  }

  /** Fill the visible page below wherever the host put us (hosts may not give a definite height). */
  function fitRoot() {
    const top = Math.max(0, root.getBoundingClientRect().top);
    root.style.height = `${Math.max(480, (window.innerHeight || 800) - top)}px`;
  }
  const onWinResize = () => { if (!disposed) fitRoot(); };
  window.addEventListener("resize", onWinResize);
  const roFit = typeof ResizeObserver === "function" && container.parentElement ? new ResizeObserver(onWinResize) : null;
  roFit?.observe(container.parentElement || container);

  renderAll();
  connect();
  pollTimer = setInterval(() => { if (state.mode === "connected" && cfg.welcomed && !state.loading && !state.draft && !state.overlay) loadChannel({ quiet: true }); }, 20_000);
  const splash = mountComingSoonSplash(root, { brand: "mesh", name: "MESH™", tint: "#f59e0b", tagline: "MESH protocol hangout, with a built-in docs reader." });
  return () => { splash.destroy(); disposed = true; window.removeEventListener("resize", onWinResize); roFit?.disconnect(); grip.dispose(); clearInterval(pollTimer); clearTimeout(toastTimer); root.remove(); style.remove(); };
}
