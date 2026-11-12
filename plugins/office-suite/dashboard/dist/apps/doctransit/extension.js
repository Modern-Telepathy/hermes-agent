// DocTransit: a dependency-free Canvas Extension (manifest schema 1, host API 1).
// - Connect: a guided dialog (sign in / create account on DocTransit's own pages, create an
//   API key, paste it) that VERIFIES the key with GET /me before saving it in this browser.
//   No DocTransit password is ever collected here.
// - Documents: a native list through the public Agents API (https://api.doctransit.com/v1).
// - Dashboard / Sign in / Create account: DocTransit's own web pages in an iframe that
//   fills the page.

const STORAGE_KEY = "canvas-extension-doctransit:v1";
export const DEFAULT_APP_URL = "https://app.doctransit.com";
export const API_BASE = "https://api.doctransit.com/v1";
export const LOAD_HINT_MS = 10000;

/** Real routes of the DocTransit web app (apps/doctransit/src/App.jsx). */
export const ROUTES = {
  dashboard: "/dashboard/35KBoSgoAK",
  signin: "/login",
  signup: "/create-account",
  apikeys: "/generatetoken", // the API Keys page (Developer -> API Keys)
};

export const STATUSES = ["draft", "sent", "completed", "declined", "expired", "archived", "cancelled"];

const STATUS_LABELS = {
  draft: "Draft",
  sent: "Out for signature",
  completed: "Completed",
  declined: "Declined",
  expired: "Expired",
  archived: "Archived",
  cancelled: "Cancelled",
};

export const isHttpUrl = (value) => {
  try {
    const u = new URL(String(value).trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

/** Origin plus any path, without a trailing slash; null when not http(s). */
export const normalizeAppUrl = (value) => {
  if (!isHttpUrl(value)) return null;
  const u = new URL(String(value).trim());
  return (u.origin + u.pathname).replace(/\/+$/, "");
};

export const routeUrl = (base, key) => `${base}${ROUTES[key]}`;

export const statusLabel = (s) => STATUS_LABELS[s] || (s ? String(s) : "Unknown");

export const authHeaders = (key) => ({ Authorization: `Bearer ${String(key).trim()}`, Accept: "application/json" });

/** "dt_••••1234": only the last four characters of a key are ever shown. */
export const maskKey = (key) => `dt_••••${String(key || "").trim().slice(-4)}`;

/** Plain-language message for a failed request. Never includes the key. */
export function errorMessage(err) {
  if (err && typeof err.status === "number") {
    const s = err.status;
    if (s === 401) return "That API key was not accepted.";
    if (s === 403) return "This API key is not allowed to do that.";
    if (s === 404) return "DocTransit could not find that.";
    if (s === 429) return "Too many requests. Wait a moment and try again.";
    if (s >= 500) return "DocTransit had a problem. Try again shortly.";
    return `DocTransit returned an error (${s}).`;
  }
  return "Could not reach api.doctransit.com.";
}

const asString = (v) => (typeof v === "string" ? v : "");

/** GET /me documents only "key context"; look for a name or email in the usual places. */
export function parseMe(body) {
  const o = body && typeof body === "object" ? body : {};
  const spots = [o, o.account, o.user, o.owner, o.principal, o.key, o.api_key].filter((x) => x && typeof x === "object");
  const pick = (f) => spots.map((x) => asString(x[f]).trim()).find(Boolean) || "";
  return { name: pick("name") || pick("display_name"), email: pick("email") };
}

export function parseSigner(s) {
  const o = s && typeof s === "object" ? s : {};
  return {
    id: asString(o.id),
    name: asString(o.name),
    email: asString(o.email),
    role: asString(o.role) || "signer",
    order: Number.isFinite(o.order) ? o.order : null,
    signUrl: isHttpUrl(o.sign_url) ? o.sign_url : "",
  };
}

export function parseDocument(d) {
  const o = d && typeof d === "object" ? d : {};
  return {
    id: asString(o.document_id),
    name: asString(o.name) || "Untitled document",
    status: asString(o.status),
    signers: Array.isArray(o.signers) ? o.signers.map(parseSigner) : [],
    createdAt: asString(o.created_at),
    updatedAt: asString(o.updated_at),
    completedAt: asString(o.completed_at),
    signedUrl: isHttpUrl(o.signed_url) ? o.signed_url : "",
    nextActions: Array.isArray(o.next_actions) ? o.next_actions.filter((a) => typeof a === "string") : [],
  };
}

/** GET /documents -> { documents, nextCursor }. */
export function parseDocuments(body) {
  const list = body && Array.isArray(body.documents) ? body.documents : [];
  return {
    documents: list.map(parseDocument).filter((d) => d.id),
    nextCursor: body && typeof body.next_cursor === "string" && body.next_cursor ? body.next_cursor : null,
  };
}

export function documentsUrl({ status = "", cursor = "", limit = 20 } = {}) {
  const q = new URLSearchParams({ limit: String(limit) });
  if (STATUSES.includes(status)) q.set("status", status);
  if (cursor) q.set("cursor", cursor);
  return `${API_BASE}/documents?${q}`;
}

export function filterDocuments(docs, search) {
  const q = String(search || "").trim().toLowerCase();
  if (!q) return docs;
  return docs.filter((d) => d.name.toLowerCase().includes(q) || d.signers.some((s) => `${s.name} ${s.email}`.toLowerCase().includes(q)));
}

/** Counts for the summary cards, from the documents loaded so far. */
export function summarize(docs) {
  const n = (...st) => docs.filter((d) => st.includes(d.status)).length;
  return { total: docs.length, awaiting: n("sent"), completed: n("completed"), closed: n("declined", "expired") };
}

export function formatDate(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toISOString().slice(0, 10);
}

export function fullDate(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** "5 min ago", "3 days ago"; falls back to the date after a month. */
export function relativeTime(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const sec = Math.round((now - t) / 1000);
  if (sec < 0) return formatDate(iso);
  if (sec < 60) return "just now";
  const plural = (n, u) => `${n} ${u}${n === 1 ? "" : "s"} ago`;
  if (sec < 3600) return plural(Math.floor(sec / 60), "min");
  if (sec < 86400) return plural(Math.floor(sec / 3600), "hour");
  if (sec < 86400 * 30) return plural(Math.floor(sec / 86400), "day");
  return formatDate(iso);
}

export function initials(s) {
  const base = (s?.name || "").trim() || (s?.email || "").split("@")[0].replace(/[^a-z0-9]+/gi, " ").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase();
}

const hueOf = (text) => {
  let h = 0;
  for (const c of String(text)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};

/** "Ada <ada@x.com>" or "ada@x.com" per line -> [{ name, email }]; throws on a bad address. */
export function parseSignerLines(text) {
  return String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.*?)\s*<([^<>\s]+)>$/);
      const email = (m ? m[2] : line).trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error(`"${line}" is not a valid email address.`);
      const name = m ? m[1].trim() : "";
      return name ? { name, email } : { email };
    });
}

/** Body for POST /documents. `send` stays false unless explicitly true. */
export function createBody({ templateId, name, signers, send }) {
  const body = { template_id: String(templateId).trim(), signers, send: send === true };
  if (String(name || "").trim()) body.name = String(name).trim();
  return body;
}

export class ApiError extends Error {
  constructor(status) {
    super(`HTTP ${status}`);
    this.status = status;
  }
}

async function api(path, { key, signal, method = "GET", body } = {}) {
  const init = { method, headers: authHeaders(key), signal };
  if (body !== undefined) {
    init.headers = { ...init.headers, "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(path.startsWith("http") ? path : API_BASE + path, init);
  if (!res.ok) throw new ApiError(res.status);
  return res.json();
}

/** Stored shape: { appUrl, apiKey, account: { name, email } }. The older { appUrl, apiKey } still loads. */
function loadStore(win = window) {
  try {
    const raw = JSON.parse(win.localStorage.getItem(STORAGE_KEY) || "{}") || {};
    const acc = raw.account && typeof raw.account === "object" ? raw.account : {};
    return {
      appUrl: normalizeAppUrl(raw.appUrl) || DEFAULT_APP_URL,
      apiKey: typeof raw.apiKey === "string" ? raw.apiKey.trim() : "",
      account: { name: asString(acc.name), email: asString(acc.email) },
    };
  } catch {
    return { appUrl: DEFAULT_APP_URL, apiKey: "", account: { name: "", email: "" } };
  }
}

function saveStore(store, win = window) {
  try { win.localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch { /* storage unavailable */ }
}

// Official DocTransit artwork from the DocTransit website (doctransit-web/public), recoloured to
// follow the theme text colour (shapes unchanged): the mark and the full wordmark.
const MARK_SVG = `<svg viewBox="0 0 34.48 34.48" aria-hidden="true" focusable="false"><g fill="currentColor"><polygon points="17.24 17.24 0 17.24 17.24 0 17.24 17.24"/><polygon points="17.24 17.24 34.48 17.24 17.24 34.48 17.24 17.24"/></g></svg>`;
const WORDMARK_SVG = `<svg viewBox="0 0 237 34.48" role="img" aria-label="DocTransit" fill="currentColor"><g> <polygon points="17.24 17.24 0 17.24 17.24 0 17.24 17.24"/> <polygon points="17.24 17.24 34.48 17.24 17.24 34.48 17.24 17.24"/> </g> <g> <path d="M55.57,3.33c2.77,0,5.1.35,6.97,1.05,1.88.7,3.39,1.67,4.53,2.9,1.13,1.24,1.95,2.65,2.44,4.24s.74,3.28.74,5.06-.27,3.44-.8,5.06c-.53,1.62-1.38,3.06-2.55,4.32-1.17,1.26-2.68,2.26-4.55,2.98-1.86.73-4.12,1.09-6.79,1.09h-10.69V3.33h10.69ZM48.82,26.45h6.7c2.11,0,3.85-.28,5.23-.84,1.37-.56,2.46-1.32,3.27-2.26s1.38-2.01,1.73-3.19c.34-1.18.51-2.37.51-3.58s-.17-2.43-.51-3.58c-.35-1.15-.92-2.19-1.73-3.11s-1.9-1.64-3.27-2.18c-1.37-.53-3.11-.8-5.23-.8h-6.7v19.54Z"/> <path d="M83.21,30.48c-2,0-3.84-.43-5.51-1.28s-3-2.07-3.99-3.66-1.48-3.5-1.48-5.72.49-4.17,1.48-5.78,2.32-2.83,3.99-3.68c1.67-.85,3.51-1.28,5.51-1.28s3.83.42,5.47,1.28c1.65.85,2.96,2.08,3.95,3.68.98,1.6,1.48,3.53,1.48,5.78s-.5,4.13-1.48,5.72c-.99,1.59-2.3,2.81-3.95,3.66-1.64.85-3.47,1.28-5.47,1.28ZM83.21,27.07c1.24,0,2.38-.28,3.43-.84s1.91-1.39,2.55-2.47c.64-1.08.96-2.39.96-3.93s-.32-2.89-.96-3.99c-.65-1.1-1.5-1.93-2.55-2.51s-2.2-.87-3.43-.87-2.38.28-3.45.84c-1.07.56-1.93,1.39-2.59,2.49s-.99,2.44-.99,4.03.33,2.85.97,3.93,1.5,1.91,2.57,2.47c1.07.56,2.24.84,3.5.84Z"/> <path d="M116.69,22.21c-.17,1.7-.7,3.18-1.63,4.42-.92,1.25-2.11,2.2-3.59,2.86-1.48.66-3.13.99-4.94.99-2,0-3.84-.42-5.51-1.26-1.67-.84-3.01-2.06-4.01-3.66-1-1.61-1.5-3.52-1.5-5.74s.5-4.17,1.5-5.78c1-1.6,2.34-2.83,4.01-3.68,1.67-.85,3.51-1.28,5.51-1.28,1.81,0,3.44.33,4.89.99,1.45.66,2.65,1.6,3.58,2.82.93,1.22,1.49,2.68,1.68,4.38h-3.58c-.47-1.48-1.29-2.65-2.49-3.52-1.19-.87-2.56-1.3-4.09-1.3-1.26,0-2.43.29-3.52.87s-1.95,1.41-2.59,2.49c-.65,1.08-.97,2.42-.97,4.01s.32,2.85.97,3.93c.64,1.08,1.5,1.91,2.57,2.47,1.07.56,2.25.84,3.54.84,1.75,0,3.18-.43,4.28-1.28,1.09-.85,1.88-2.04,2.34-3.58h3.54Z"/> <path d="M117.26,3.33h23.41v3.54h-9.71v23.16h-3.99V6.87h-9.71v-3.54Z"/> <path d="M139.52,9.5h3.95v5.8c.13-.55.34-1.14.62-1.77.33-.74.77-1.45,1.32-2.12.55-.67,1.23-1.23,2.06-1.67.82-.44,1.81-.66,2.96-.66v3.91c-1.42,0-2.64.33-3.64.99s-1.79,1.47-2.37,2.43c-.41.66-.73,1.32-.94,1.97v11.64h-3.95V9.5Z"/> <path d="M160.83,30.44c-1.76,0-3.36-.45-4.81-1.36-1.46-.91-2.61-2.16-3.45-3.76-.85-1.61-1.27-3.45-1.27-5.53s.43-3.93,1.29-5.53c.86-1.6,2.05-2.86,3.56-3.78,1.51-.92,3.19-1.38,5.06-1.38,2.06,0,3.66.48,4.79,1.44,1.14.96,1.93,2.25,2.37,3.87.11.3.19.62.25.95v-5.84h3.95v20.52h-3.62l-.08-.74c-.05-.52-.11-1.14-.16-1.85-.06-.71-.08-1.34-.08-1.89v-2.06c-.27,1.15-.7,2.25-1.27,3.29-.61,1.1-1.44,1.98-2.51,2.65-1.07.67-2.4,1.01-3.99,1.01ZM161.93,27.02c1.46,0,2.68-.32,3.68-.97,1-.64,1.75-1.51,2.24-2.61.49-1.1.74-2.32.74-3.66,0-1.45-.25-2.73-.76-3.83-.51-1.1-1.26-1.95-2.26-2.55s-2.22-.91-3.64-.91c-2.14,0-3.79.69-4.96,2.06-1.17,1.37-1.75,3.11-1.75,5.22,0,1.43.28,2.68.87,3.77.57,1.08,1.36,1.93,2.36,2.55,1,.62,2.16.93,3.48.93Z"/> <path d="M176.04,9.5h3.95v5.84c.13-.57.33-1.12.57-1.64.47-.93,1.05-1.75,1.75-2.45s1.51-1.23,2.44-1.6,1.95-.56,3.05-.56,2.19.17,3.12.49,1.73.82,2.39,1.46c.66.64,1.17,1.44,1.54,2.39.37.95.56,2.02.56,3.23v13.37h-3.91v-12.5c0-1.62-.39-2.83-1.17-3.64-.78-.81-1.97-1.21-3.56-1.21-1.23,0-2.36.29-3.37.86-1.02.58-1.85,1.33-2.51,2.26-.41.63-.71,1.3-.91,2.01v12.22h-3.95V9.5Z"/> <path d="M198.05,23.36h3.62c.13,1.1.63,1.99,1.48,2.69.85.7,2.05,1.05,3.58,1.05.99,0,1.76-.12,2.3-.35.55-.23.94-.55,1.17-.97s.35-.86.35-1.36c0-.63-.17-1.12-.49-1.46-.33-.34-.8-.63-1.4-.86-.61-.23-1.32-.46-2.14-.68-.91-.25-1.81-.54-2.71-.87-.91-.33-1.74-.73-2.49-1.19s-1.36-1.05-1.81-1.75c-.46-.7-.68-1.56-.68-2.57,0-.85.18-1.64.55-2.39.37-.74.91-1.38,1.61-1.91.7-.53,1.51-.95,2.44-1.23s1.96-.43,3.09-.43c1.56,0,2.88.28,3.95.84s1.89,1.35,2.44,2.36c.56,1.02.86,2.18.89,3.5h-3.45c-.19-1.15-.59-1.99-1.19-2.53-.61-.53-1.51-.8-2.71-.8s-2.09.24-2.71.7c-.63.47-.95,1.1-.95,1.89,0,.6.22,1.09.66,1.46s1.03.69,1.77.97c.74.27,1.57.56,2.51.87.88.3,1.72.61,2.53.92s1.54.69,2.18,1.11,1.16.97,1.52,1.64c.37.67.55,1.5.55,2.49,0,1.21-.3,2.26-.91,3.15-.6.89-1.47,1.58-2.61,2.08-1.14.49-2.52.74-4.13.74-1.48,0-2.73-.18-3.76-.54-1.03-.35-1.9-.82-2.6-1.4-.7-.57-1.23-1.19-1.6-1.83-.37-.64-.62-1.27-.74-1.87s-.16-1.1-.1-1.48Z"/> <path d="M221.74,1.03v4.24h-4.89V1.03h4.89ZM217.34,9.5h3.91v20.52h-3.91V9.5Z"/> <path d="M223.71,9.5h4.69v-5.43h3.91v5.43h4.69v3.41h-4.69v17.11h-3.91V12.92h-4.69v-3.41Z"/> </g></svg>`;
// hero-signing.jpeg from https://doctransit.com, resized to 1200px wide and recompressed.
const BG_IMAGE = "data:image/jpeg;base64,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";

const ICONS = {
  reload: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.6 2.6 0 1 1 3.6 2.4c-.7.4-1.1.9-1.1 1.6M12 17v.5"/>',
};

function svgNode(markup) {
  const t = document.createElement("template");
  t.innerHTML = markup.trim();
  return t.content.firstElementChild;
}

const icon = (name, size = 16) =>
  svgNode(`<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`);

const SVG_NS = "http://www.w3.org/2000/svg";
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
  const span = document.createElement("span");
  span.className = "plogo artec";
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

/** The "Built with" row: Kamiji and Kosmos logos linking to their sites, then the Artec mark. */
function poweredBy() {
  const d = document.createElement("div");
  d.className = "powered";
  const label = document.createElement("span");
  label.textContent = "Built with";
  const logo = (href, svg) => {
    const a = document.createElement("a");
    a.className = "plogo";
    a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer";
    a.setAttribute("aria-label", svg.getAttribute("aria-label"));
    a.append(svg);
    return a;
  };
  d.append(
    label,
    logo("https://github.com/FraterCCCLXIII/kamiji", logoSvg("0 0 276 118", "Kamiji™", KAMIJI_STROKES, 16)),
    logo("https://kosmos.computer", logoSvg("0 0 405.3 82.71", "Kosmos™", KOSMOS_PATHS)),
    artecLogo(),
  );
  return d;
}

const CSS = `
.dt{--b:var(--oh-color-base,#fff);--b2:var(--oh-color-base-secondary,#f4f4f5);--fg:var(--oh-foreground,#18181b);--mu:var(--oh-muted,#71717a);--bd:var(--oh-border-subtle,#e4e4e7);--ct:var(--oh-contrast,#2563eb);--ctf:var(--oh-contrast-foreground,#fff);
 --ok:#16a34a;--warn:#d97706;--bad:var(--oh-danger,#dc2626);--r1:8px;--r2:12px;--sh1:0 1px 2px rgba(0,0,0,.08);--sh2:0 12px 32px rgba(0,0,0,.28);
 display:flex;flex-direction:column;height:100%;min-height:480px;background:var(--b);color:var(--fg);font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;position:relative;overflow:hidden}
.dt *{box-sizing:border-box}
.dt button,.dt input,.dt select,.dt textarea{font:inherit;color:inherit}
.dt :focus-visible{outline:2px solid var(--ct);outline-offset:2px}
.dt h1,.dt h2,.dt h3,.dt p{margin:0}
.dt a:not(.btn){color:var(--ct)}
.dt [inert]{pointer-events:none}
.dt .bar{display:flex;align-items:center;gap:12px;padding:8px 14px;border-bottom:1px solid var(--bd);background:var(--b);flex-wrap:wrap;position:relative;z-index:3}
.dt .brand{display:flex;align-items:center;gap:8px;color:var(--fg);flex:none}
.dt .brand .mk{width:20px;height:20px;display:block}
.dt .brand .wm{height:17px;width:auto;display:block}
.dt .tabs{display:flex;gap:2px;flex:1;flex-wrap:wrap;min-width:0}
.dt .tab{background:none;border:0;border-radius:var(--r1);padding:6px 12px;cursor:pointer;color:var(--mu);font-weight:500;transition:background .15s,color .15s}
.dt .tab:hover{background:var(--b2);color:var(--fg)}
.dt .tab[aria-selected=true]{color:var(--fg);background:var(--b2);box-shadow:inset 0 -2px 0 var(--ct)}
.dt .btn{background:var(--b2);border:1px solid var(--bd);border-radius:var(--r1);padding:6px 12px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px;color:var(--fg);transition:background .15s,border-color .15s,transform .1s;line-height:1.3}
.dt .btn:hover{border-color:var(--mu)}
.dt .btn:active{transform:translateY(1px)}
.dt .btn.primary{background:var(--ct);border-color:var(--ct);color:var(--ctf);font-weight:600}
.dt .btn.primary:hover{filter:brightness(1.1)}
.dt .btn.lg{padding:9px 18px;font-size:15px}
.dt .btn.ghost{background:transparent;border-color:transparent;color:var(--mu)}
.dt .btn.ghost:hover{color:var(--fg);background:var(--b2)}
.dt .btn.icon{padding:6px}
.dt .btn.danger{color:var(--bad)}
.dt .btn:disabled{opacity:.55;cursor:default}
.dt .conn{gap:8px}
.dt .dot{width:8px;height:8px;border-radius:50%;background:var(--mu);flex:none}
.dt .dot.on{background:var(--ok);box-shadow:0 0 0 3px color-mix(in srgb,var(--ok) 25%,transparent)}
.dt .menu{position:absolute;right:14px;top:50px;min-width:240px;max-width:calc(100% - 28px);background:var(--b);border:1px solid var(--bd);border-radius:var(--r2);box-shadow:var(--sh2);padding:6px;z-index:8;display:flex;flex-direction:column;gap:2px}
.dt .menu .who{padding:8px 10px;border-bottom:1px solid var(--bd);margin-bottom:4px}
.dt .menu .who b{display:block}
.dt .menu [role=menuitem]{background:none;border:0;border-radius:var(--r1);padding:7px 10px;text-align:left;cursor:pointer}
.dt .menu [role=menuitem]:hover,.dt .menu [role=menuitem]:focus-visible{background:var(--b2)}
.dt .powered { display: flex; align-items: center; gap: 6px; color: var(--mu); font-size: 12px; padding: 4px 12px 8px; justify-content: center; flex: none; }
.dt .plogo { display: inline-flex; color: inherit; opacity: .7; }
.dt .plogo:hover { opacity: 1; }
.dt .plogo svg { height: 16px; width: auto; }
.dt .plogo.artec { color: var(--oh-contrast, currentColor); opacity: .85; }
.dt .plogo.artec svg { height: 20px; }
.dt .main{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}
.dt .panel{flex:1;min-height:0;overflow:auto;padding:16px 16px 24px;display:flex;flex-direction:column;gap:14px}
.dt .panel[hidden]{display:none}
.dt .panel.fp{padding:0;gap:0;overflow:hidden}
.dt .wrap{width:100%;max-width:1100px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
.dt .card{background:var(--b);border:1px solid var(--bd);border-radius:var(--r2);box-shadow:var(--sh1)}
.dt .note{color:var(--mu);font-size:12px}
.dt .err{color:var(--bad);font-size:13px}
.dt .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.dt label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--mu)}
.dt input,.dt select,.dt textarea{background:var(--b);border:1px solid var(--bd);border-radius:var(--r1);padding:7px 10px;min-width:0}
.dt input:hover,.dt select:hover,.dt textarea:hover{border-color:var(--mu)}
.dt .wide{flex:1;min-width:140px}
.dt .vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

/* embedded pages */
.dt .frame-card{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;border-width:1px 0 0;border-radius:0;box-shadow:none}
.dt .tb{display:flex;align-items:center;gap:8px;padding:5px 10px;border-bottom:1px solid var(--bd);background:var(--b2);flex:none;flex-wrap:wrap}
.dt .tb .ttl{font-weight:600;font-size:13px}
.dt .addr{flex:1;min-width:80px;max-width:420px;background:var(--b);border:1px solid var(--bd);border-radius:999px;padding:2px 12px;font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--mu);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dt .tb .sp{flex:1}
.dt .tb .btn{padding:3px 8px;font-size:12px}
.dt .frame-wrap{flex:1 1 auto;min-height:0;position:relative;border:1px solid var(--bd);border-width:1px 0 0}
.dt iframe{width:100%;height:100%;border:0;background:#fff;position:absolute;inset:0;display:block}
.dt .loading{position:absolute;inset:0;display:flex;flex-direction:column;gap:14px;align-items:center;justify-content:center;color:var(--mu);background:var(--b2);pointer-events:none;z-index:1}
.dt .loading .mk{width:36px;height:36px;color:var(--fg);animation:dtpulse 1.4s ease-in-out infinite}
.dt .frame-hint{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);background:var(--b);border:1px solid var(--bd);border-radius:999px;padding:6px 14px;box-shadow:var(--sh2);font-size:12px;color:var(--mu);z-index:2;max-width:calc(100% - 24px)}
.dt .frame-hint[hidden]{display:none}
@keyframes dtpulse{50%{opacity:.35;transform:scale(.92)}}
@keyframes dtshim{to{background-position:-200% 0}}
.dt .shim{background:linear-gradient(90deg,var(--b2) 25%,color-mix(in srgb,var(--mu) 18%,var(--b2)) 50%,var(--b2) 75%);background-size:200% 100%;animation:dtshim 1.4s linear infinite;border-radius:6px}

/* hero (not connected) */
.dt .hero{position:relative;overflow:hidden;border-radius:var(--r2);border:1px solid var(--bd);color:#fff;background:#0b1220 center/cover no-repeat;flex:1;display:flex;align-items:center;justify-content:center;padding:32px 20px}
.dt .hero::before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(8,12,24,.88),rgba(8,12,24,.62) 55%,rgba(8,12,24,.84))}
.dt .hero>*{position:relative}
.dt .hero-in{display:flex;flex-direction:column;align-items:center;text-align:center;gap:16px;max-width:620px;width:100%}
.dt .hero h1{font-size:28px;line-height:1.15;font-weight:700;letter-spacing:-.01em}
.dt .hero p{color:rgba(255,255,255,.82);font-size:15px}
.dt .hero .wm{height:20px;width:auto;color:#fff}
.dt .hero .btn:not(.primary){background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.35);color:#fff}
.dt .hero .btn:not(.primary):hover{background:rgba(255,255,255,.2)}
.dt .steps3{list-style:none;margin:6px 0 0;padding:14px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;width:100%;text-align:left;background:rgba(8,12,24,.55);border:1px solid rgba(255,255,255,.18);border-radius:var(--r2);backdrop-filter:blur(6px)}
.dt .steps3 li{display:flex;gap:10px;align-items:flex-start;font-size:13px;color:rgba(255,255,255,.9)}
.dt .steps3 .n{flex:none;width:22px;height:22px;border-radius:50%;background:#fff;color:#0b1220;font-weight:700;font-size:12px;display:grid;place-items:center}

/* summary cards */
.dt .sum{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.dt .stat{padding:12px 14px;display:flex;flex-direction:column;gap:2px;border-left:3px solid var(--bd)}
.dt .stat b{font-size:24px;line-height:1.1;font-weight:700}
.dt .stat span{font-size:12px;color:var(--mu)}
.dt .stat.sent{border-left-color:var(--warn)}.dt .stat.completed{border-left-color:var(--ok)}.dt .stat.closed{border-left-color:var(--bad)}.dt .stat.total{border-left-color:var(--ct)}
.dt .cap{font-size:12px;color:var(--mu)}
.dt .banner{padding:8px 12px;border-radius:var(--r1);border:1px solid color-mix(in srgb,var(--ok) 40%,var(--bd));background:color-mix(in srgb,var(--ok) 10%,var(--b));display:flex;gap:8px;align-items:center}

/* filters + table */
.dt .filters{position:sticky;top:-16px;z-index:2;background:var(--b);padding:10px 0;margin:-6px 0 0;display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;border-bottom:1px solid var(--bd)}
.dt .tablecard{overflow:hidden}
.dt table{width:100%;border-collapse:collapse}
.dt th,.dt td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--bd);vertical-align:middle}
.dt tbody tr:last-child td{border-bottom:0}
.dt th{font-size:12px;color:var(--mu);font-weight:500;background:var(--b2)}
.dt tbody tr{cursor:pointer;transition:background .12s}
.dt tbody tr:hover{background:var(--b2)}
.dt tbody tr:focus-visible{outline-offset:-2px}
.dt .nm{display:flex;align-items:center;gap:8px;font-weight:600;min-width:0}
.dt .nm svg{color:var(--mu);flex:none}
.dt .chip{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--bd);background:var(--b2);border-radius:999px;padding:1px 9px;font-size:12px;font-weight:500;white-space:nowrap;--c:var(--mu);color:color-mix(in srgb,var(--c) 58%,var(--fg));border-color:color-mix(in srgb,var(--c) 40%,var(--bd));background:color-mix(in srgb,var(--c) 12%,var(--b))}
.dt .chip::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--c)}
.dt .chip.completed{--c:var(--ok)}.dt .chip.sent{--c:var(--warn)}.dt .chip.declined,.dt .chip.cancelled{--c:var(--bad)}.dt .chip.expired{--c:#a16207}.dt .chip.draft{--c:var(--ct)}
.dt .avs{display:flex;align-items:center;gap:8px}
.dt .avstack{display:flex}
.dt .av{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:10px;font-weight:700;color:#fff;border:2px solid var(--b);margin-left:-6px;flex:none}
.dt .avstack .av:first-child{margin-left:0}
.dt .av.lg{width:34px;height:34px;font-size:12px;margin:0;border:0}
.dt .more-av{background:var(--b2);color:var(--mu)}
.dt .skel{padding:6px 0}
.dt .skel div{height:44px;margin:8px 12px}
.dt .state{padding:36px 20px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px}
.dt .state svg{color:var(--mu)}
.dt .state.bad svg{color:var(--bad)}

/* drawer */
.dt .scrim{position:absolute;inset:0;background:rgba(0,0,0,.4);z-index:4;animation:dtfade .18s}
.dt .drawer{position:absolute;top:0;right:0;bottom:0;width:min(440px,100%);background:var(--b);border-left:1px solid var(--bd);box-shadow:var(--sh2);padding:16px;overflow:auto;display:flex;flex-direction:column;gap:14px;z-index:5;animation:dtslide .22s ease-out}
@keyframes dtslide{from{transform:translateX(24px);opacity:0}}
@keyframes dtfade{from{opacity:0}}
.dt .dh{display:flex;gap:8px;align-items:flex-start;justify-content:space-between}
.dt .dh h2{font-size:17px;line-height:1.25;overflow-wrap:anywhere}
.dt .tl{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.dt .tl li{position:relative;display:flex;gap:12px;padding:0 0 16px 0}
.dt .tl li::before{content:"";position:absolute;left:16px;top:34px;bottom:0;width:2px;background:var(--bd)}
.dt .tl li:last-child::before{display:none}
.dt .tl .pt{width:34px;height:34px;border-radius:50%;flex:none;display:grid;place-items:center;background:var(--b2);border:2px solid var(--bd);color:var(--mu)}
.dt .tl .pt.ok{background:var(--ok);border-color:var(--ok);color:#fff}
.dt .tl .body{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}
.dt .tl .body b{overflow-wrap:anywhere}

/* dialog */
.dt .overlay{position:absolute;inset:0;background:rgba(0,0,0,.5);z-index:10;display:flex;align-items:center;justify-content:center;padding:14px;animation:dtfade .15s;background-image:linear-gradient(rgba(8,12,24,.78),rgba(8,12,24,.78)),var(--bg);background-size:cover;background-position:center}
.dt .dlg{width:min(520px,100%);max-height:100%;overflow:auto;background:var(--b);border:1px solid var(--bd);border-radius:var(--r2);box-shadow:var(--sh2);padding:18px;display:flex;flex-direction:column;gap:14px}
.dt .dlg h2{font-size:18px}
.dt .prog{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.dt .prog i{height:4px;border-radius:2px;background:var(--bd)}
.dt .prog i.on{background:var(--ct)}
.dt .st{border:1px solid var(--bd);border-radius:var(--r1);overflow:hidden}
.dt .st.active{border-color:var(--ct)}
.dt .st>button{width:100%;display:flex;gap:10px;align-items:center;background:var(--b2);border:0;padding:10px 12px;cursor:pointer;text-align:left;font-weight:600}
.dt .st .n{flex:none;width:24px;height:24px;border-radius:50%;background:var(--bd);display:grid;place-items:center;font-size:12px;color:var(--fg)}
.dt .st.active .n{background:var(--ct);color:var(--ctf)}
.dt .st.done .n{background:var(--ok);color:#fff}
.dt .st .sb{padding:12px;display:flex;flex-direction:column;gap:10px}
.dt .kv{display:grid;grid-template-columns:auto 1fr;gap:6px 14px}
.dt .kv dt{color:var(--mu)}.dt .kv dd{margin:0;overflow-wrap:anywhere}

.dt .pop{position:absolute;right:14px;top:50px;width:min(360px,calc(100% - 28px));background:var(--b);border:1px solid var(--bd);border-radius:var(--r2);padding:14px;display:flex;flex-direction:column;gap:8px;box-shadow:var(--sh2);z-index:8}
.dt details{border:1px solid var(--bd);border-radius:var(--r2);padding:10px 14px}
.dt summary{cursor:pointer;font-weight:600}
.dt details form{margin-top:10px}

@media (max-width:719px){
 .dt .bar{gap:8px;padding:8px 10px}
 .dt .tabs{order:5;flex-basis:100%;overflow-x:auto;flex-wrap:nowrap}
 .dt .tab{white-space:nowrap}
 .dt .brand{flex:1}
 .dt .btn .lbl{display:none}
 .dt .sum{grid-template-columns:repeat(2,1fr)}
 .dt .steps3{grid-template-columns:1fr}
 .dt .hero h1{font-size:22px}
 .dt .panel{padding:12px 12px 20px}
 .dt .filters{top:-12px}
 .dt thead{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
 .dt table,.dt tbody,.dt tr,.dt td{display:block;width:100%}
 .dt tbody tr{padding:10px 12px;border-bottom:1px solid var(--bd);display:grid;grid-template-columns:1fr auto;gap:6px 10px;align-items:center}
 .dt tbody tr td{padding:0;border:0}
 .dt tbody tr td:first-child{grid-column:1 / -1}
 .dt tbody tr td.hide-sm{display:none}
 .dt .addr{display:none}
 .dt .menu{right:10px}
}
@media (prefers-reduced-motion:reduce){.dt *,.dt *::before{animation:none!important;transition:none!important}}
`;

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else n.setAttribute(k, v === true ? "" : v);
  }
  n.append(...kids.filter((x) => x !== null && x !== undefined));
  return n;
}

const TAB_DEFS = [
  { id: "documents", label: "Documents" },
  { id: "dashboard", label: "Dashboard", route: "dashboard" },
  { id: "signin", label: "Sign in", route: "signin" },
  { id: "signup", label: "Create account", route: "signup" },
];

/** New Chat intents (see `registerCreateAction`) -> the create form they open. */
const CREATE_KINDS = { "create:document": "document", "create:contract": "contract" };

/** Mounted pages, so a subscribed `onIntent` reaches the page that is already open. */
const openMounts = new Set();

const DOCUMENT_ICON = '<svg viewBox="0 0 16 16"><path fill="currentColor" fill-rule="evenodd" d="M3 1h6.5L13 4.5V15H3zM4.5 2.5v11h7V5.5H9V2.5z"/><path fill="currentColor" d="M7.25 7h1.5v1.75H10.5v1.5H8.75V12h-1.5v-1.75H5.5v-1.5h1.75z"/></svg>';
const CONTRACT_ICON = '<svg viewBox="0 0 16 16"><path fill="currentColor" fill-rule="evenodd" d="M3 1h6.5L13 4.5V15H3zM4.5 2.5v11h7V5.5H9V2.5z"/><path fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" d="M5.5 11.5c.9-2.2 1.6-2.2 2-.6.4 1.3 1 1 1.6-.3.3-.6.6-.5.9.3h1.2"/></svg>';

const FOCUSABLE = 'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';

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

export function mountDocTransit(container, { initialTab = "documents", intent = null } = {}) {
  const win = container.ownerDocument.defaultView || window;
  let store = loadStore(win);
  let tab = TAB_DEFS.some((t) => t.id === initialTab) ? initialTab : "documents";
  let disposed = false;
  const aborts = new Set();

  const s = {
    keyState: "unknown", // unknown | ok | rejected
    autoLoaded: false,
    docsLoaded: false,
    docs: [],
    nextCursor: null,
    status: "",
    search: "",
    loading: false,
    error: "",
    selected: null,
    detail: null,
    detailError: "",
    detailLoading: false,
    copied: "",
    notice: "",
    settingsOpen: false,
    settingsError: "",
    menuOpen: false,
    creating: false,
    createMsg: "",
    createKind: "document", // document | contract: which New Chat entry opened the form
    createOpen: false,
  };
  let d = null; // connect / manage dialog state

  const root = el("div", { class: "dt" });
  root.style.setProperty("--bg", `url("${BG_IMAGE}")`);
  const style = el("style", { text: CSS });
  container.append(style, root);

  const newSignal = () => {
    const c = new AbortController();
    aborts.add(c);
    return c;
  };
  const run = async (fn) => {
    const c = newSignal();
    try { return await fn(c.signal); } finally { aborts.delete(c); }
  };

  const connected = () => Boolean(store.apiKey);

  // Persistent iframes, one per route tab, created on first visit.
  const frames = {};
  function frameFor(tabDef) {
    if (frames[tabDef.id]) return frames[tabDef.id];
    const url = routeUrl(store.appUrl, tabDef.route);
    const f = { loaded: false, timer: 0 };
    const iframe = el("iframe", {
      title: `DocTransit ${tabDef.label}`,
      src: url,
      referrerpolicy: "strict-origin-when-cross-origin",
      allow: "clipboard-write",
      sandbox: "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads",
    });
    const loading = el("div", { class: "loading" }, svgNode(MARK_SVG), el("div", { class: "shim", style: "width:140px;height:8px" }), el("span", { text: "Loading DocTransit..." }));
    loading.querySelector("svg").classList.add("mk");
    const hint = el("div", { class: "frame-hint", hidden: true, role: "note" },
      "Not loading? ",
      el("a", { href: url, target: "_blank", rel: "noopener noreferrer", text: "Open in browser" }));
    const arm = () => {
      win.clearTimeout(f.timer);
      f.timer = win.setTimeout(() => { if (!f.loaded) hint.hidden = false; }, LOAD_HINT_MS);
    };
    iframe.addEventListener("load", () => { f.loaded = true; loading.remove(); hint.hidden = true; win.clearTimeout(f.timer); });
    arm();

    const reload = el("button", { class: "btn", type: "button", "aria-label": `Reload ${tabDef.label}`, title: "Reload" }, icon("reload", 14), el("span", { class: "lbl", text: "Reload" }));
    reload.querySelector(".lbl").remove();
    reload.addEventListener("click", () => {
      f.loaded = false;
      hint.hidden = true;
      if (!loading.isConnected) f.wrap.append(loading);
      iframe.setAttribute("src", url);
      iframe.src = url;
      arm();
    });
    const open = el("a", { class: "btn", "aria-label": "Open in browser", href: url, target: "_blank", rel: "noopener noreferrer", title: "Not loading? We cannot tell whether a page refuses to be embedded, so this link is always here." },
      icon("external", 14), el("span", { class: "lbl", text: "Open in browser" }));
    open.append(); // text lives in the span; textContent is "Open in browser"
    let path = ROUTES[tabDef.route];
    try { path = new URL(url).pathname; } catch { /* keep route */ }
    const connectHint = el("span", { class: "row", style: "gap:6px" }, el("span", { class: "note", text: "Not signed in?" }));
    const connectBtn = el("button", { class: "btn primary", type: "button", text: "Connect" });
    connectBtn.addEventListener("click", () => openDialog("connect"));
    connectHint.append(connectBtn);
    const tb = el("div", { class: "tb" },
      el("span", { class: "ttl", text: tabDef.label }),
      el("span", { class: "addr", title: "Page shown", text: path }),
      el("span", { class: "sp" }),
      tabDef.id === "dashboard" ? connectHint : null,
      reload, open);
    const wrap = el("div", { class: "frame-wrap" }, iframe, loading, hint);
    f.wrap = wrap;
    f.card = el("div", { class: "frame-card card" }, tb, wrap);
    f.connectHint = connectHint;
    frames[tabDef.id] = f;
    return f;
  }

  function resetFrames() {
    Object.values(frames).forEach((f) => win.clearTimeout(f.timer));
    Object.keys(frames).forEach((k) => delete frames[k]);
  }

  // ---- API actions ----
  async function loadDocs({ append = false } = {}) {
    if (!store.apiKey) return;
    s.loading = true;
    s.error = "";
    render();
    try {
      const body = await run((signal) =>
        api(documentsUrl({ status: s.status, cursor: append ? s.nextCursor : "" }), { key: store.apiKey, signal }),
      );
      if (disposed) return;
      const page = parseDocuments(body);
      s.docs = append ? [...s.docs, ...page.documents] : page.documents;
      s.nextCursor = page.nextCursor;
      s.keyState = "ok";
    } catch (e) {
      if (disposed || e?.name === "AbortError") return;
      s.error = errorMessage(e);
      if (e?.status === 401) s.keyState = "rejected";
    }
    s.docsLoaded = true;
    s.loading = false;
    render();
  }

  async function openDetail(doc) {
    s.selected = doc;
    s.detail = null;
    s.detailError = "";
    s.detailLoading = true;
    s.focusDrawer = true;
    render();
    try {
      const body = await run((signal) => api(`/documents/${encodeURIComponent(doc.id)}/links`, { key: store.apiKey, signal }));
      if (disposed || s.selected !== doc) return;
      s.detail = {
        status: asString(body?.status) || doc.status,
        signers: Array.isArray(body?.signers) ? body.signers.map(parseSigner) : doc.signers,
        nextActions: Array.isArray(body?.next_actions) ? body.next_actions.filter((a) => typeof a === "string") : doc.nextActions,
      };
    } catch (e) {
      if (disposed || e?.name === "AbortError") return;
      s.detail = { status: doc.status, signers: doc.signers, nextActions: doc.nextActions };
      s.detailError = errorMessage(e);
    }
    s.detailLoading = false;
    render();
  }

  async function downloadSigned(doc) {
    s.detailError = "";
    try {
      const body = await run((signal) => api(`/documents/${encodeURIComponent(doc.id)}/download`, { key: store.apiKey, signal }));
      if (disposed) return;
      // The spec only says "Download URL"; accept the usual field names.
      const url = [body?.download_url, body?.url, body?.signed_url].find((u) => isHttpUrl(u)) || doc.signedUrl;
      if (!url) { s.detailError = "DocTransit did not return a download link."; render(); return; }
      win.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      if (disposed || e?.name === "AbortError") return;
      s.detailError = errorMessage(e);
      render();
    }
  }

  async function copy(text) {
    try {
      await win.navigator.clipboard.writeText(text);
      s.copied = text;
    } catch {
      s.copied = "";
      s.detailError = "Copy failed. Select the link and copy it by hand.";
    }
    render();
  }

  async function createDocument(form) {
    let signers;
    try { signers = parseSignerLines(form.signers.value); } catch (e) { s.createMsg = e.message; render(); return; }
    if (!form.template.value.trim()) { s.createMsg = "Enter a template id."; render(); return; }
    if (!signers.length) { s.createMsg = "Add at least one signer."; render(); return; }
    const send = form.send.checked;
    if (send && !win.confirm(`Create the document and send it to ${signers.length} signer(s) now? They will be emailed.`)) return;
    s.creating = true;
    s.createMsg = "";
    render();
    try {
      await run((signal) =>
        api("/documents", { key: store.apiKey, signal, method: "POST", body: createBody({ templateId: form.template.value, name: form.docname.value, signers, send }) }),
      );
      if (disposed) return;
      s.createMsg = send ? "Created and sent." : "Draft created. It was not sent.";
      s.creating = false;
      await loadDocs();
      return;
    } catch (e) {
      if (disposed || e?.name === "AbortError") return;
      s.createMsg = errorMessage(e);
    }
    s.creating = false;
    render();
  }

  // ---- connect / manage ----
  function openDialog(mode) {
    s.menuOpen = false;
    s.settingsOpen = false;
    d = { mode, step: mode === "connect" && store.apiKey ? 3 : 1, done: {}, draft: "", show: false, busy: false, error: "", focus: mode === "manage" ? "dt-manage-close" : "dt-step-1" };
    if (d.step === 3) d.focus = "dt-key";
    render();
  }

  function closeDialog({ restoreFocus = true } = {}) {
    d = null;
    render();
    if (restoreFocus) root.querySelector("#dt-connect")?.focus();
  }

  async function verifyAndConnect() {
    const key = d.draft.trim();
    if (!key) { d.error = "Paste your API key first."; d.focus = "dt-key"; render(); return; }
    d.busy = true;
    d.error = "";
    render();
    try {
      const body = await run((signal) => api("/me", { key, signal }));
      if (disposed) return;
      const account = parseMe(body);
      store = { ...store, apiKey: key, account };
      saveStore(store, win);
      s.keyState = "ok";
      s.docs = [];
      s.nextCursor = null;
      s.docsLoaded = false;
      s.autoLoaded = true;
      s.selected = null;
      s.notice = `Connected${account.email || account.name ? ` as ${account.name || account.email}` : ""}.`;
      d = null;
      render();
      root.querySelector("#dt-connect")?.focus();
      loadDocs();
      return;
    } catch (e) {
      if (disposed || e?.name === "AbortError") return;
      d.error = errorMessage(e);
    }
    d.busy = false;
    d.focus = "dt-key";
    render();
  }

  function disconnect() {
    store = { ...store, apiKey: "", account: { name: "", email: "" } };
    saveStore(store, win);
    aborts.forEach((c) => c.abort());
    aborts.clear();
    Object.assign(s, { keyState: "unknown", autoLoaded: false, docsLoaded: false, docs: [], nextCursor: null, error: "", selected: null, detail: null, loading: false, notice: "", menuOpen: false, status: "", search: "" });
    d = null;
    render();
    root.querySelector("#dt-connect")?.focus();
  }

  // ---- rendering ----
  function setTab(id) {
    tab = id;
    s.menuOpen = false;
    render();
  }

  function renderBar() {
    const tablist = el("div", { class: "tabs", role: "tablist", "aria-label": "DocTransit sections" });
    TAB_DEFS.forEach((t) => {
      const b = el("button", {
        class: "tab", type: "button", role: "tab", id: `dt-tab-${t.id}`,
        "aria-selected": String(tab === t.id), "aria-controls": `dt-panel-${t.id}`,
        tabindex: tab === t.id ? "0" : "-1", text: t.label,
      });
      b.addEventListener("click", () => setTab(t.id));
      b.addEventListener("keydown", (ev) => {
        const i = TAB_DEFS.indexOf(t);
        const next = ev.key === "ArrowRight" ? i + 1 : ev.key === "ArrowLeft" ? i - 1 : null;
        if (next === null) return;
        setTab(TAB_DEFS[(next + TAB_DEFS.length) % TAB_DEFS.length].id);
        root.querySelector(`#dt-tab-${tab}`)?.focus();
      });
      tablist.append(b);
    });

    const brand = el("span", { class: "brand" }, svgNode(WORDMARK_SVG));
    brand.firstChild.classList.add("wm");
    const gear = el("button", { class: "btn ghost", type: "button", "aria-label": "Settings", "aria-expanded": String(s.settingsOpen), title: "Settings" }, icon("gear", 15), el("span", { class: "lbl", text: "Settings" }));
    gear.addEventListener("click", () => { s.settingsOpen = !s.settingsOpen; s.settingsError = ""; s.menuOpen = false; render(); });

    let conn;
    if (connected()) {
      const ok = s.keyState !== "rejected";
      conn = el("button", { id: "dt-connect", class: "btn conn", type: "button", "aria-haspopup": "menu", "aria-expanded": String(s.menuOpen), title: ok ? "Connected to DocTransit" : "DocTransit rejected the saved key" },
        el("span", { class: ok ? "dot on" : "dot", "aria-hidden": "true" }), el("span", { text: ok ? "Connected" : "Key not accepted" }), icon("chevron", 14));
      conn.addEventListener("click", () => { s.menuOpen = !s.menuOpen; s.settingsOpen = false; render(); if (s.menuOpen) root.querySelector("#dt-menu-manage")?.focus(); });
    } else {
      conn = el("button", { id: "dt-connect", class: "btn primary", type: "button", text: "Connect" });
      conn.addEventListener("click", () => openDialog("connect"));
    }
    return el("div", { class: "bar" }, brand, tablist, gear, conn);
  }

  function renderMenu() {
    const who = store.account.name || store.account.email;
    const item = (id, text, fn, cls = "") => {
      const b = el("button", { id, role: "menuitem", type: "button", class: cls, text });
      b.addEventListener("click", fn);
      return b;
    };
    const menu = el("div", { class: "menu", role: "menu", "aria-label": "Connection" },
      el("div", { class: "who" }, el("b", { text: who || "Connected" }), store.account.name && store.account.email ? el("div", { class: "note", text: store.account.email }) : null, el("div", { class: "note", text: maskKey(store.apiKey) })),
      item("dt-menu-manage", "Manage connection", () => openDialog("manage")),
      item("dt-menu-disconnect", "Disconnect", disconnect));
    menu.addEventListener("keydown", (ev) => {
      if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return;
      const items = [...menu.querySelectorAll("[role=menuitem]")];
      const i = items.indexOf(root.ownerDocument.activeElement);
      items[(i + (ev.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
      ev.preventDefault();
    });
    return menu;
  }

  function renderSettings() {
    const input = el("input", { id: "dt-app-url", type: "url", value: store.appUrl, spellcheck: "false" });
    const save = el("button", { class: "btn primary", type: "button", text: "Save" });
    save.addEventListener("click", () => {
      const next = normalizeAppUrl(input.value);
      if (!next) { s.settingsError = "Only http:// or https:// addresses are accepted."; render(); return; }
      if (next !== store.appUrl) { store = { ...store, appUrl: next }; saveStore(store, win); resetFrames(); }
      s.settingsOpen = false;
      s.settingsError = "";
      render();
    });
    return el("div", { class: "pop", role: "dialog", "aria-label": "DocTransit settings" },
      el("label", {}, "Web app address", input),
      el("div", { class: "note", text: `Default ${DEFAULT_APP_URL}. Used for the Dashboard, Sign in and Create account pages and the links in Connect.` }),
      s.settingsError ? el("div", { class: "err", role: "alert", text: s.settingsError }) : null,
      el("div", { class: "row" }, save),
    );
  }

  function connectButton(cls = "btn primary lg") {
    const b = el("button", { class: cls, type: "button", text: "Connect" });
    b.addEventListener("click", () => openDialog("connect"));
    return b;
  }

  function renderHero() {
    const wm = svgNode(WORDMARK_SVG);
    wm.classList.add("wm");
    const steps = ["Sign in or create your DocTransit account", "Create an API key in Developer, API Keys", "Paste the key here to connect"];
    const hero = el("div", { class: "hero", style: `background-image:url("${BG_IMAGE}")` },
      el("div", { class: "hero-in" },
        wm,
        el("h1", { text: "Get it signed, from right here" }),
        el("p", { text: "Send documents for e-signature, follow every signer and download the signed PDF without leaving Canvas." }),
        el("div", { class: "row", style: "justify-content:center" },
          connectButton(),
          el("a", { class: "btn lg", href: store.appUrl, target: "_blank", rel: "noopener noreferrer" }, "Open DocTransit", icon("external", 14))),
        el("ol", { class: "steps3", "aria-label": "How to connect" },
          ...steps.map((t, i) => el("li", {}, el("span", { class: "n", text: String(i + 1) }), el("span", { text: t })))),
        el("p", { class: "note", style: "color:rgba(255,255,255,.7)", text: "Your key stays in this browser and is sent only to api.doctransit.com. We never ask for your password." })));
    return hero;
  }

  function avatar(sg, big) {
    const a = el("span", { class: big ? "av lg" : "av", "aria-hidden": "true", title: sg.name || sg.email, text: initials(sg) });
    a.style.background = `hsl(${hueOf(sg.email || sg.name)} 50% 40%)`;
    return a;
  }

  function renderDocuments() {
    if (!connected()) {
      return [renderHero()];
    }
    const wrap = el("div", { class: "wrap" });
    if (s.notice) wrap.append(el("div", { class: "banner", role: "status" }, icon("check", 16), s.notice));

    const sum = summarize(s.docs);
    const stat = (cls, label, n) => el("div", { class: `card stat ${cls}` }, el("b", { text: String(n) }), el("span", { text: label }));
    wrap.append(
      el("div", { class: "sum", role: "group", "aria-label": "Summary of loaded documents" },
        stat("total", "Total", sum.total), stat("sent", "Awaiting signature", sum.awaiting), stat("completed", "Completed", sum.completed), stat("closed", "Declined or expired", sum.closed)),
      el("div", { class: "cap", text: `Counts are of loaded documents (${s.docs.length} loaded${s.nextCursor ? ", more available" : ""}).` }));

    const status = el("select", { id: "dt-status" }, el("option", { value: "", text: "All statuses" }),
      ...STATUSES.map((v) => el("option", { value: v, text: statusLabel(v), selected: s.status === v })));
    status.addEventListener("change", () => { s.status = status.value; loadDocs(); });
    const search = el("input", { id: "dt-search", type: "search", value: s.search, placeholder: "Name or signer" });
    search.addEventListener("input", () => {
      s.search = search.value;
      render();
      const again = root.querySelector("#dt-search");
      again?.focus();
      again?.setSelectionRange(again.value.length, again.value.length);
    });
    const refresh = el("button", { class: "btn", type: "button", id: "dt-refresh" }, icon("reload", 14), el("span", { text: s.loading ? "Refreshing..." : "Refresh" }));
    refresh.disabled = s.loading;
    refresh.addEventListener("click", () => loadDocs());
    wrap.append(el("div", { class: "filters", role: "search" },
      el("label", {}, "Status", status), el("label", { class: "wide" }, "Search", search), refresh));

    const shown = filterDocuments(s.docs, s.search);
    if (s.error) {
      const retry = el("button", { class: "btn primary", type: "button", text: "Try again" });
      retry.addEventListener("click", () => loadDocs());
      const replace = el("button", { class: "btn", type: "button", text: "Replace API key" });
      replace.addEventListener("click", () => openDialog("connect"));
      wrap.append(el("div", { class: "card state bad" }, icon("alert", 28), el("div", { class: "err", role: "alert", text: s.error }),
        el("div", { class: "row" }, retry, s.keyState === "rejected" ? replace : null)));
    } else if (s.loading && !s.docs.length) {
      wrap.append(el("div", { class: "card skel", role: "status", "aria-label": "Loading documents" }, ...[0, 1, 2, 3, 4].map(() => el("div", { class: "shim" }))));
    } else if (!shown.length) {
      wrap.append(el("div", { class: "card state" }, icon("doc", 28),
        el("b", { text: s.docs.length ? "No documents match" : "No documents yet" }),
        el("div", { class: "note", text: s.docs.length ? "Try a different search or status." : "Documents you create in DocTransit or through the API appear here." })));
    }

    if (!s.error && shown.length) {
      const tbody = el("tbody");
      shown.forEach((doc) => {
        const stack = el("span", { class: "avstack" }, ...doc.signers.slice(0, 3).map((sg) => avatar(sg)));
        if (doc.signers.length > 3) stack.append(el("span", { class: "av more-av", "aria-hidden": "true", text: `+${doc.signers.length - 3}` }));
        const when = (iso, cls) => el("td", { class: cls, title: fullDate(iso) || null, text: relativeTime(iso) });
        const tr = el("tr", { tabindex: "0", "aria-label": `Open ${doc.name}` },
          el("td", {}, el("span", { class: "nm" }, icon("doc", 16), el("span", { text: doc.name }))),
          el("td", {}, el("span", { class: `chip ${doc.status}`, text: statusLabel(doc.status) })),
          el("td", {}, el("span", { class: "avs" }, stack, el("span", { class: "note", text: `${doc.signers.length} ${doc.signers.length === 1 ? "signer" : "signers"}` }))),
          when(doc.createdAt, "hide-sm"), when(doc.updatedAt, "hide-sm"));
        tr.addEventListener("click", () => openDetail(doc));
        tr.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openDetail(doc); } });
        tbody.append(tr);
      });
      wrap.append(el("div", { class: "card tablecard" }, el("table", { "aria-label": "Documents" },
        el("thead", {}, el("tr", {}, ...["Name", "Status", "Signers", "Created", "Updated"].map((h, i) => el("th", { class: i > 2 ? "hide-sm" : "", scope: "col", text: h })))),
        tbody)));
    }
    if (s.nextCursor) {
      const more = el("button", { class: "btn", type: "button", text: "Load more" });
      more.disabled = s.loading;
      more.addEventListener("click", () => loadDocs({ append: true }));
      wrap.append(el("div", { class: "row" }, more));
    }
    wrap.append(renderCreate());
    return [wrap];
  }

  function renderCreate() {
    const contract = s.createKind === "contract";
    const noun = contract ? "contract" : "document";
    const form = el("form", { class: "row", "aria-label": contract ? "New contract" : "New document" });
    const template = el("input", { name: "template", id: "dt-template", placeholder: "template_id", required: true });
    const docname = el("input", { name: "docname", id: "dt-docname", placeholder: `${contract ? "Contract" : "Document"} name (optional)` });
    const signers = el("textarea", { name: "signers", id: "dt-signers", rows: "3", placeholder: "Ada Lovelace <ada@example.com>\nbob@example.com" });
    const send = el("input", { type: "checkbox", name: "send", id: "dt-send" });
    form.template = template; form.docname = docname; form.signers = signers; form.send = send;
    const submit = el("button", { class: "btn", type: "submit", text: s.creating ? "Creating..." : "Create from template" });
    submit.disabled = s.creating;
    form.addEventListener("submit", (ev) => { ev.preventDefault(); createDocument(form); });
    form.append(
      el("label", {}, "Template id", template), el("label", {}, "Name", docname),
      el("label", { class: "wide" }, "Signers, one per line", signers),
      el("label", { style: "flex-direction:row;align-items:center;gap:6px" }, send, "Send to signers now (asks to confirm)"),
      submit);
    const details = el("details", {},
      el("summary", { text: `New ${noun} from a template` }),
      form,
      el("div", { class: "note", style: "margin-top:8px", text: "Creates a draft that is not sent unless you tick the box. Find template ids in DocTransit under Templates." }),
      s.createMsg ? el("div", { class: "note", role: "status", text: s.createMsg }) : null,
    );
    details.open = Boolean(s.createOpen);
    details.addEventListener("toggle", () => { s.createOpen = details.open; });
    return details;
  }

  function renderDrawer() {
    const doc = s.selected;
    const det = s.detail;
    const st = det?.status || doc.status;
    const close = el("button", { class: "btn", type: "button", id: "dt-drawer-close", "aria-label": "Close details" }, icon("close", 14), "Close");
    close.addEventListener("click", closeDrawer);
    const body = [el("div", { class: "dh" }, el("div", { class: "row", style: "flex-direction:column;align-items:flex-start;gap:6px" }, el("h2", { text: doc.name }),
      el("span", { class: `chip ${st}`, text: statusLabel(st) })), close)];
    if (s.detailLoading) body.push(el("div", { class: "note", role: "status", text: "Loading signing links..." }));
    if (s.detailError) body.push(el("div", { class: "err", role: "alert", text: s.detailError }));

    const signers = det ? det.signers : doc.signers;
    const actions = det ? det.nextActions : doc.nextActions;
    const tl = el("ol", { class: "tl", "aria-label": "Signing timeline" });
    const point = (ok, content) => el("span", { class: ok ? "pt ok" : "pt", "aria-hidden": "true" }, content);
    tl.append(el("li", {}, point(true, icon("check", 16)), el("div", { class: "body" }, el("b", { text: "Created" }), el("span", { class: "note", title: fullDate(doc.createdAt) || null, text: fullDate(doc.createdAt) || "Date not provided" }))));
    signers.forEach((sg, i) => {
      const body2 = el("div", { class: "body" },
        el("b", { text: `${sg.name || sg.email} (${sg.role})` }),
        sg.name ? el("span", { class: "note", text: sg.email }) : null);
      if (sg.signUrl) {
        const btn = el("button", { class: "btn", type: "button", text: s.copied === sg.signUrl ? "Copied" : "Copy link" });
        btn.addEventListener("click", () => copy(sg.signUrl));
        body2.append(el("div", { class: "row" }, el("a", { href: sg.signUrl, target: "_blank", rel: "noopener noreferrer", text: "Open signing link" }), btn));
      } else body2.append(el("span", { class: "note", text: "No signing link for this role." }));
      const li = el("li", {}, avatar(sg, true), body2);
      li.setAttribute("aria-label", `Signer ${i + 1} of ${signers.length}`);
      tl.append(li);
    });
    tl.append(el("li", {}, point(st === "completed", icon(st === "completed" ? "check" : "doc", 16)),
      el("div", { class: "body" }, el("b", { text: st === "completed" ? "Completed" : st === "sent" ? "Waiting for signatures" : statusLabel(st) }),
        el("span", { class: "note", text: st === "completed" ? fullDate(doc.completedAt) || fullDate(doc.updatedAt) : fullDate(doc.updatedAt) ? `Last update ${fullDate(doc.updatedAt)}` : "" }))));
    body.push(el("h3", { text: `Signers (${signers.length})` }), tl);
    if (actions.length) body.push(el("div", { class: "note", text: `Next actions DocTransit offers: ${actions.join(", ")}` }));
    if (actions.includes("download") || doc.status === "completed" || doc.signedUrl) {
      const dl = el("button", { class: "btn primary", type: "button", text: "Download signed PDF" });
      dl.addEventListener("click", () => downloadSigned(doc));
      body.push(el("div", { class: "row" }, dl));
    }
    return el("aside", { class: "drawer", role: "dialog", "aria-modal": "true", "aria-label": `Details for ${doc.name}` }, ...body);
  }

  function closeDrawer() {
    const doc = s.selected;
    s.selected = null;
    render();
    const idx = doc ? filterDocuments(s.docs, s.search).findIndex((x) => x.id === doc.id) : -1;
    root.querySelectorAll("tbody tr")[idx]?.focus();
  }

  function renderDialog() {
    const manage = d.mode === "manage";
    const close = el("button", { class: "btn ghost icon", type: "button", id: "dt-dlg-close", "aria-label": "Close dialog" }, icon("close", 16));
    close.addEventListener("click", () => closeDialog());
    const kids = [];
    const link = (id, text, route, step) => {
      const a = el("a", { id, class: "btn", href: routeUrl(store.appUrl, route), target: "_blank", rel: "noopener noreferrer" }, text, icon("external", 13));
      a.addEventListener("click", () => {
        d.done[step] = true;
        win.setTimeout(() => { if (d && !disposed) { d.step = step + 1; d.focus = `dt-step-${step + 1}`; render(); } }, 0);
      });
      return a;
    };
    const stepCard = (n, title, content) => {
      const active = d.step === n;
      const head = el("button", { id: `dt-step-${n}`, type: "button", "aria-expanded": String(active) },
        el("span", { class: "n" }, d.done[n] ? icon("check", 13) : String(n)), el("span", { text: title }));
      head.addEventListener("click", () => { d.step = n; d.focus = `dt-step-${n}`; render(); });
      return el("section", { class: `st${active ? " active" : ""}${d.done[n] ? " done" : ""}`, "aria-label": `Step ${n} of 3` }, head, active ? el("div", { class: "sb" }, ...content) : null);
    };

    if (manage) {
      const rep = el("button", { class: "btn", type: "button", text: "Replace key" });
      rep.addEventListener("click", () => { d = { ...d, mode: "connect", step: 3, draft: "", error: "", focus: "dt-key" }; render(); });
      const dis = el("button", { class: "btn danger", type: "button", text: "Disconnect" });
      dis.addEventListener("click", disconnect);
      const done = el("button", { class: "btn primary", type: "button", id: "dt-manage-close", text: "Done" });
      done.addEventListener("click", () => closeDialog());
      kids.push(
        el("dl", { class: "kv" },
          el("dt", { text: "Account" }), el("dd", { text: store.account.name || store.account.email || "Not provided by DocTransit" }),
          store.account.name && store.account.email ? el("dt", { text: "Email" }) : null, store.account.name && store.account.email ? el("dd", { text: store.account.email }) : null,
          el("dt", { text: "API key" }), el("dd", { text: maskKey(store.apiKey) }),
          el("dt", { text: "Status" }), el("dd", { text: s.keyState === "rejected" ? "DocTransit no longer accepts this key" : "Connected" })),
        el("p", { class: "note", text: "The key is stored in this browser only and sent only to api.doctransit.com. It is never shown again beyond its last four characters." }),
        el("div", { class: "row" }, rep, dis, done));
    } else {
      kids.push(el("div", { class: "prog", role: "progressbar", "aria-label": "Connection progress", "aria-valuemin": "1", "aria-valuemax": "3", "aria-valuenow": String(d.step) },
        ...[1, 2, 3].map((n) => el("i", { class: n <= d.step ? "on" : "" }))), el("div", { class: "note", text: `Step ${d.step} of 3` }));

      const embedded = el("button", { class: "btn ghost", type: "button", text: "Use the embedded page instead" });
      embedded.addEventListener("click", () => { tab = "signin"; closeDialog({ restoreFocus: false }); });
      const have = el("button", { class: "btn ghost", type: "button", text: "I already have an API key" });
      have.addEventListener("click", () => { d.step = 3; d.focus = "dt-key"; render(); });
      kids.push(stepCard(1, "Sign in or create your DocTransit account", [
        el("p", { text: "Sign in on DocTransit's own page. This app never sees your password." }),
        el("div", { class: "row" }, link("dt-open-signin", "Sign in", "signin", 1), link("dt-open-signup", "Create account", "signup", 1)),
        el("div", { class: "row" }, embedded, have)]));

      kids.push(stepCard(2, "Create an API key", [
        el("p", { text: "In DocTransit open Developer, then API Keys, then create a key. Copy it when it is shown." }),
        el("div", { class: "row" }, link("dt-open-keys", "Open API Keys", "apikeys", 2))]));

      const input = el("input", { id: "dt-key", type: d.show ? "text" : "password", autocomplete: "off", autocapitalize: "off", spellcheck: "false", class: "wide", placeholder: "dt_...", "aria-describedby": "dt-key-note" });
      input.value = d.draft;
      input.addEventListener("input", () => { d.draft = input.value; });
      const toggle = el("button", { class: "btn icon", type: "button", "aria-pressed": String(d.show), "aria-label": d.show ? "Hide API key" : "Show API key", title: d.show ? "Hide" : "Show" }, icon("eye", 16));
      toggle.addEventListener("click", () => { d.show = !d.show; d.focus = "dt-key"; render(); });
      const submit = el("button", { class: "btn primary", type: "submit", text: d.busy ? "Verifying..." : "Connect" });
      submit.disabled = d.busy;
      const form = el("form", { "aria-label": "Paste your API key", style: "display:flex;flex-direction:column;gap:10px" },
        el("label", {}, "API key", el("span", { class: "row", style: "flex-wrap:nowrap" }, input, toggle)),
        d.error ? el("div", { class: "err", role: "alert", text: d.error }) : null,
        el("div", { id: "dt-key-note", class: "note", text: "We check the key with DocTransit first and keep it in this browser only after it is accepted. It is sent only to api.doctransit.com." }),
        el("div", { class: "row" }, submit));
      form.addEventListener("submit", (ev) => { ev.preventDefault(); verifyAndConnect(); });
      kids.push(stepCard(3, "Paste your API key", [form]));
    }

    const dlg = el("div", { class: "dlg", role: "dialog", "aria-modal": "true", "aria-labelledby": "dt-dlg-title" },
      el("div", { class: "dh" }, el("h2", { id: "dt-dlg-title", text: manage ? "Manage connection" : "Connect DocTransit" }), close), ...kids);
    dlg.addEventListener("keydown", (ev) => {
      if (ev.key !== "Tab") return;
      const f = [...dlg.querySelectorAll(FOCUSABLE)].filter((x) => !x.hidden);
      if (!f.length) return;
      const a = root.ownerDocument.activeElement;
      if (ev.shiftKey && (a === f[0] || !dlg.contains(a))) { ev.preventDefault(); f[f.length - 1].focus(); }
      else if (!ev.shiftKey && (a === f[f.length - 1] || !dlg.contains(a))) { ev.preventDefault(); f[0].focus(); }
    });
    return el("div", { class: "overlay" }, dlg);
  }

  // Stable skeleton so the iframes are never detached (moving an iframe reloads it).
  const barHost = el("div");
  const menuHost = el("div");
  const popHost = el("div");
  const drawerHost = el("div");
  const dialogHost = el("div");
  const main = el("div", { class: "main" });
  const panels = {};
  TAB_DEFS.forEach((t) => {
    panels[t.id] = el("div", { class: t.route ? "panel fp" : "panel", role: "tabpanel", id: `dt-panel-${t.id}`, "aria-labelledby": `dt-tab-${t.id}` });
    main.append(panels[t.id]);
  });
  root.append(barHost, menuHost, popHost, main, poweredBy(), drawerHost, dialogHost);

  /** Fill the visible page below wherever the host put us (hosts may not give a definite height). */
  function fit() {
    const top = Math.max(0, root.getBoundingClientRect().top);
    const h = Math.max(480, (win.innerHeight || 800) - top);
    root.style.height = `${h}px`;
  }

  /** Open the Documents tab with the New document or New contract form expanded. Returns false for other intents. */
  function openIntent(next) {
    const kind = CREATE_KINDS[next?.action];
    if (!kind || disposed) return false;
    tab = "documents";
    s.createKind = kind;
    s.createOpen = true;
    s.createMsg = "";
    s.focusCreate = true;
    render();
    return true;
  }

  function render() {
    if (disposed) return;
    const focusedId = root.ownerDocument.activeElement?.id;
    fit();
    barHost.replaceChildren(renderBar());
    menuHost.replaceChildren(...(s.menuOpen && connected() ? [renderMenu()] : []));
    popHost.replaceChildren(...(s.settingsOpen ? [renderSettings()] : []));
    TAB_DEFS.forEach((t) => {
      const panel = panels[t.id];
      panel.hidden = tab !== t.id;
      if (!t.route) {
        if (tab === t.id) panel.replaceChildren(...renderDocuments());
      } else {
        const f = frames[t.id];
        if (!f && tab === t.id) panel.replaceChildren(frameFor(t).card);
        else if (!f) panel.replaceChildren();
        if (frames[t.id]?.connectHint) frames[t.id].connectHint.hidden = connected();
      }
    });
    if (s.selected && tab === "documents" && connected()) {
      drawerHost.replaceChildren(el("div", { class: "scrim", "aria-hidden": "true" }), renderDrawer());
      drawerHost.firstChild.addEventListener("click", closeDrawer);
    } else drawerHost.replaceChildren();
    dialogHost.replaceChildren(...(d ? [renderDialog()] : []));
    barHost.toggleAttribute("inert", Boolean(d));
    main.toggleAttribute("inert", Boolean(d));
    if (d && d.focus) {
      root.querySelector(`#${d.focus}`)?.focus();
      d.focus = "";
    } else if (s.focusDrawer && s.selected) {
      root.querySelector("#dt-drawer-close")?.focus();
      s.focusDrawer = false;
    } else if (s.focusCreate && tab === "documents") {
      root.querySelector("#dt-template")?.focus();
      s.focusCreate = false;
    } else if (focusedId && focusedId !== "dt-search") root.querySelector(`#${focusedId}`)?.focus?.();

    // Load documents once for a key saved earlier.
    if (tab === "documents" && connected() && !s.autoLoaded && !s.loading) {
      s.autoLoaded = true;
      Promise.resolve().then(() => { if (!disposed) loadDocs(); });
    }
  }

  root.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    if (d) { ev.stopPropagation(); closeDialog(); }
    else if (s.menuOpen) { s.menuOpen = false; render(); root.querySelector("#dt-connect")?.focus(); }
    else if (s.settingsOpen) { s.settingsOpen = false; render(); }
    else if (s.selected) closeDrawer();
  });
  root.addEventListener("click", (ev) => {
    if (s.menuOpen && !ev.target.closest?.(".menu, #dt-connect")) { s.menuOpen = false; render(); }
  });
  const onResize = () => fit();
  win.addEventListener("resize", onResize);
  const observer = typeof win.ResizeObserver === "function" ? new win.ResizeObserver(() => fit()) : null;
  observer?.observe(container);

  const instance = { openIntent };
  openMounts.add(instance);
  if (!openIntent(intent)) render();

  const splashLogo = svgNode(WORDMARK_SVG);
  splashLogo.style.cssText = "height:40px;width:auto;color:#fff";
  splashLogo.removeAttribute("role");
  splashLogo.setAttribute("aria-hidden", "true");
  const splash = mountComingSoonSplash(root, { brand: "doctransit", name: "DocTransit™", tagline: "E-signature for your documents, right inside Canvas.", tint: "#f43f5e", logoNode: splashLogo });

  return () => {
    disposed = true;
    splash.destroy();
    openMounts.delete(instance);
    observer?.disconnect();
    win.removeEventListener("resize", onResize);
    aborts.forEach((c) => c.abort());
    aborts.clear();
    resetFrames();
    style.remove();
    root.remove();
  };
}

export function activate(host) {
  const disposers = [host.registerPage("doctransit", ({ container, intent }) => mountDocTransit(container, { intent }))];
  // Host API additions; an older host has neither, and the page still works.
  if (typeof host.onIntent === "function") {
    disposers.push(host.onIntent((intent) => openMounts.forEach((m) => m.openIntent(intent))));
  }
  if (typeof host.registerCreateAction === "function") {
    disposers.push(host.registerCreateAction({
      id: "new-document",
      label: "New document",
      description: "Start a document from a DocTransit template",
      icon: { svg: DOCUMENT_ICON },
      pageId: "doctransit",
      intent: "create:document",
    }));
    disposers.push(host.registerCreateAction({
      id: "new-contract",
      label: "New contract",
      description: "Start a contract from a DocTransit template",
      icon: { svg: CONTRACT_ICON },
      pageId: "doctransit",
      intent: "create:contract",
    }));
  }
  return () => disposers.forEach((dispose) => dispose?.());
}
