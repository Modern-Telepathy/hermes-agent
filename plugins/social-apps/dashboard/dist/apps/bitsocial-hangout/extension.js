/* Bitkin — a Canvas App that looks and feels like Hangout / Team Chat, but talks
 * to the Bitsocial protocol (peer-to-peer social on IPFS pubsub, formerly Plebbit).
 *
 *   community  = channel      post  = thread root      reply = reply in the thread
 *
 * It speaks the Plebbit RPC (JSON-RPC 2.0 over WebSocket, default ws://localhost:9138, the
 * same one Bitsocial Node Manager and seedit use). With no reachable node it falls back to a
 * Demo mode with in-memory sample communities, so the page always works.
 *
 * Browser-only, dependency-free ESM. Styles are scoped under `.bh`; text is always set with
 * textContent. The RPC URL and a few preferences are kept in this browser's localStorage.
 *
 * Publishing: every comment, vote and comment edit is signed in this browser (Ed25519 via
 * WebCrypto, CBOR-encoded exactly like plebbit-js) and handed to the node as a ready-made
 * signed publication. The private key never leaves this browser's localStorage.
 */

const STORAGE_KEY = "bitsocial-hangout:v1";
export const DEFAULT_RPC_URL = "ws://localhost:9138";

const isObject = (v) => v && typeof v === "object" && !Array.isArray(v);

// ─── JSON-RPC 2.0 over WebSocket (the Plebbit RPC wire protocol) ────────────────────────────
// Verified against plebbit-js 0.0.11 (seedit/node_modules/@plebbit/plebbit-js):
//  - requests are {jsonrpc:"2.0", method, params:[...], id}      (rpc-websockets client `call`)
//  - responses carry the same id with `result` or `error`
//  - subscriptions answer with a numeric subscription id; later events arrive as notifications
//    without an id: {jsonrpc:"2.0", method, params:{result, subscription, event}}

/** Encodes one JSON-RPC request frame. */
export function encodeRequest(method, params = [], id = 1) {
  return JSON.stringify({ jsonrpc: "2.0", method, params, id });
}

/** Classifies an incoming frame: a response (has id), a subscription notification, or junk. */
export function decodeFrame(raw) {
  let msg;
  try { msg = JSON.parse(typeof raw === "string" ? raw : String(raw)); } catch { return { kind: "invalid" }; }
  if (!isObject(msg)) return { kind: "invalid" };
  if (msg.id !== undefined && msg.id !== null) {
    if (msg.error) return { kind: "response", id: msg.id, error: msg.error };
    return { kind: "response", id: msg.id, result: msg.result };
  }
  const p = msg.params;
  if (isObject(p) && p.subscription !== undefined) return { kind: "notification", subscription: p.subscription, event: p.event, result: p.result, method: msg.method };
  return { kind: "invalid" };
}

const describeError = (err) => {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  return [err.code ? `${err.code}` : "", err.message || ""].filter(Boolean).join(": ") || "Unknown error";
};

/** A tiny JSON-RPC client over one WebSocket. `socketFactory(url)` is injectable for tests. */
export function createRpcClient(url, { socketFactory, timeoutMs = 15000 } = {}) {
  let socket = null;
  let nextId = 1;
  let openPromise = null;
  const pending = new Map(); // id -> { resolve, reject, timer }
  const handlers = new Map(); // subscription id -> fn(event, result)
  const buffered = new Map(); // notifications that arrived before the handler was set
  const stateListeners = new Set();
  let state = "closed"; // closed | connecting | open | failed
  const setState = (s) => { if (s === state) return; state = s; stateListeners.forEach((fn) => fn(s)); };

  const failAll = (error) => { pending.forEach(({ reject, timer }) => { clearTimeout(timer); reject(error); }); pending.clear(); };

  function onMessage(ev) {
    const frame = decodeFrame(ev && ev.data !== undefined ? ev.data : ev);
    if (frame.kind === "response") {
      const entry = pending.get(frame.id);
      if (!entry) return;
      pending.delete(frame.id);
      clearTimeout(entry.timer);
      if (frame.error) { const e = new Error(describeError(frame.error)); e.rpc = frame.error; entry.reject(e); } else entry.resolve(frame.result);
    } else if (frame.kind === "notification") {
      const fn = handlers.get(frame.subscription);
      if (fn) fn(frame.event, frame.result);
      else { const list = buffered.get(frame.subscription) || []; list.push(frame); buffered.set(frame.subscription, list); }
    }
  }

  function connect() {
    if (state === "open") return Promise.resolve();
    if (openPromise) return openPromise;
    setState("connecting");
    openPromise = new Promise((resolve, reject) => {
      const unreachable = (why) => {
        const e = new Error(`Can't reach the node at ${url}${why ? ` (${why})` : ""}. Start your node and check the URL.`);
        e.unreachable = true;
        return e;
      };
      let settled = false;
      try {
        socket = socketFactory ? socketFactory(url) : new WebSocket(url);
      } catch (err) {
        setState("failed");
        openPromise = null;
        reject(unreachable(err && err.message));
        return;
      }
      const timer = setTimeout(() => { if (!settled) { settled = true; setState("failed"); openPromise = null; try { socket.close(); } catch { /* ignore */ } reject(unreachable("timed out")); } }, timeoutMs);
      socket.onopen = () => { if (settled) return; settled = true; clearTimeout(timer); setState("open"); resolve(); };
      socket.onerror = () => { if (settled) return; settled = true; clearTimeout(timer); setState("failed"); openPromise = null; reject(unreachable("connection refused")); };
      socket.onclose = () => {
        clearTimeout(timer);
        if (!settled) { settled = true; setState("failed"); openPromise = null; reject(unreachable("closed")); return; }
        openPromise = null;
        setState("closed");
        failAll(new Error("The connection to the node closed."));
      };
      socket.onmessage = onMessage;
    });
    return openPromise;
  }

  async function call(method, params = []) {
    await connect();
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`The node did not answer ${method} in time.`)); }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      try { socket.send(encodeRequest(method, params, id)); } catch (err) { pending.delete(id); clearTimeout(timer); reject(err); }
    });
  }

  /** Registers a handler for a subscription id; replays notifications that arrived early. */
  function onSubscription(subscriptionId, fn) {
    handlers.set(subscriptionId, fn);
    const early = buffered.get(subscriptionId);
    if (early) { buffered.delete(subscriptionId); early.forEach((f) => fn(f.event, f.result)); }
    return () => handlers.delete(subscriptionId);
  }

  function close() {
    failAll(new Error("closed"));
    handlers.clear();
    buffered.clear();
    try { socket && socket.close(); } catch { /* ignore */ }
    openPromise = null;
    setState("closed");
  }

  return { url, connect, call, onSubscription, close, get state() { return state; }, onState: (fn) => { stateListeners.add(fn); return () => stateListeners.delete(fn); } };
}

// ─── Bitsocial / Plebbit calls on top of the RPC client ────────────────────────────────────
// Method names and param shapes come from plebbit-js (plebbit-rpc-client.ts, rpc/src/index.ts):
//   subplebbitsSubscribe []                         -> sub id; event "subplebbitschange" = [addresses]
//   subplebbitUpdateSubscribe [{address}]           -> sub id; event "update" = community JSON (posts.pages)
//   getSubplebbitPage [{cid, subplebbitAddress, type:"posts", pageMaxSize}] -> {comments:[{comment,commentUpdate}], nextCid}
//   getCommentPage [{cid, commentCid, subplebbitAddress, pageMaxSize}]      -> same page shape (replies)
//   getComment [{cid}]                              -> comment (ipfs)
//   publishComment [{comment}]                      -> sub id; events "challenge", "challengeverification", "error"
//   publishVote [{vote}] / publishCommentEdit [{commentEdit}]   same event shape as publishComment
//   createSubplebbit [{title?, description?}]       -> {address, ...}   (local community on the node)
//   startSubplebbit [{address}]                     -> sub id (the node keeps the community running)
//   editSubplebbit [address, {title?, description?, address?}] -> community JSON
//   publishChallengeAnswers [subId, {challengeAnswers}] -> true
//   unsubscribe [subId]

const PUBLISH_METHODS = {
  comment: { method: "publishComment", key: "comment" },
  vote: { method: "publishVote", key: "vote" },
  commentEdit: { method: "publishCommentEdit", key: "commentEdit" },
  commentModeration: { method: "publishCommentModeration", key: "commentModeration" },
};

export function createBitsocialApi(client) {
  const subscribe = async (method, params, onEvent) => {
    const id = await client.call(method, params);
    const off = client.onSubscription(id, onEvent);
    return { id, stop: async () => { off(); try { await client.call("unsubscribe", [id]); } catch { /* connection may be gone */ } } };
  };
  return {
    watchCommunityList: (onList) => subscribe("subplebbitsSubscribe", [], (event, result) => { if (event === "subplebbitschange" && Array.isArray(result)) onList(result); }),
    watchCommunity: (address, onUpdate, onError) => subscribe("subplebbitUpdateSubscribe", [{ address }], (event, result) => { if (event === "update") onUpdate(unwrapCommunityUpdate(result)); else if (event === "error" && onError) onError(result); }),
    getSubplebbitPage: (subplebbitAddress, cid, pageMaxSize = 50) => client.call("getSubplebbitPage", [{ cid, subplebbitAddress, type: "posts", pageMaxSize }]),
    getCommentPage: (subplebbitAddress, commentCid, cid, pageMaxSize = 50) => client.call("getCommentPage", [{ cid, commentCid, subplebbitAddress, pageMaxSize }]),
    getComment: (cid) => client.call("getComment", [{ cid }]),
    publishComment: (comment, onEvent) => subscribe("publishComment", [{ comment }], (event, result) => onEvent && onEvent(event, result)),
    /** Publishes a signed comment / vote / commentEdit; resolves to {id, stop} once the node accepted the request. */
    publish: (kind, publication, onEvent) => {
      const spec = PUBLISH_METHODS[kind];
      if (!spec) throw new Error(`Unknown publication kind ${kind}`);
      return subscribe(spec.method, [{ [spec.key]: publication }], (event, result) => onEvent && onEvent(event, result));
    },
    createCommunity: (options) => client.call("createSubplebbit", [options]),
    startCommunity: (address, onEvent) => subscribe("startSubplebbit", [{ address }], (event, result) => onEvent && onEvent(event, result)),
    editCommunity: (address, props) => client.call("editSubplebbit", [address, props]),
    answerChallenge: (subscriptionId, challengeAnswers) => client.call("publishChallengeAnswers", [subscriptionId, { challengeAnswers }]),
  };
}

// ─── Normalising Bitsocial data into chat messages ─────────────────────────────────────────

const authorOf = (comment) => {
  const a = (comment && comment.author) || {};
  const address = a.address || "unknown";
  return { address, name: a.displayName || (address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address) };
};

/** One page entry {comment, commentUpdate} (or a bare comment) to a chat message. */
export function normalizeEntry(entry) {
  const comment = (entry && entry.comment) || entry || {};
  const update = (entry && entry.commentUpdate) || {};
  const edit = update.edit || {};
  const removed = Boolean(update.removed) || Boolean(edit.deleted);
  return {
    cid: update.cid || comment.cid || "",
    author: authorOf(comment),
    title: comment.title || "",
    content: removed ? "_[removed]_" : edit.content || comment.content || "",
    link: comment.link || "",
    timestamp: (comment.timestamp || 0) * 1000,
    replyCount: update.replyCount || 0,
    upvotes: update.upvoteCount || 0,
    downvotes: update.downvoteCount || 0,
    pinned: Boolean(update.pinned),
    repliesRaw: update.replies || null,
    replies: null,
  };
}

const sortPages = (pages) => {
  if (!isObject(pages)) return [];
  const order = ["hot", "new", "active", "best", "old"];
  const names = [...order.filter((n) => pages[n]), ...Object.keys(pages).filter((n) => !order.includes(n))];
  return names.length ? pages[names[0]].comments || [] : [];
};

/** The preloaded posts of a community update, as chat messages (oldest first). */
export function postsFromCommunity(sub) {
  const entries = sortPages(sub && sub.posts && sub.posts.pages);
  return entries.map(normalizeEntry).sort((a, b) => a.timestamp - b.timestamp);
}

/** A remote community's update arrives as {subplebbit, updateCid, updatingState}; a local one is the flat community. */
export function unwrapCommunityUpdate(result) {
  return result && typeof result === "object" && result.subplebbit && typeof result.subplebbit === "object" ? result.subplebbit : result;
}

/** True once an update carries real community data (a remote community first sends an empty one). */
export function hasCommunityData(sub) {
  return Boolean(sub && typeof sub === "object" && (sub.title || sub.description || sub.updatedAt || sub.createdAt || sub.posts || sub.lastPostCid || sub.signature));
}

const CHALLENGE_REJECTED = "This community requires a challenge your identity cannot satisfy. If you own it, open Community settings and allow anyone to post.";
/** Turns the node's challenge failure into a plain sentence; anything else is shown as the node said it. */
export function explainPublishError(reason) {
  const text = String(reason || "");
  return /ERR_INVALID_RESULT_FROM_GET_CHALLENGE_FUNCTION|challenges? is misconfigured/i.test(text) ? CHALLENGE_REJECTED : text;
}

/** Flattens preloaded replies (nested trees) to a list sorted oldest first. */
export function repliesFromRaw(raw) {
  const out = [];
  const walk = (entries, depth) => entries.forEach((e) => {
    const msg = { ...normalizeEntry(e), depth };
    out.push(msg);
    const nested = msg.repliesRaw && sortPages(msg.repliesRaw.pages);
    if (nested && nested.length) walk(nested, depth + 1);
  });
  walk(raw ? sortPages(raw.pages) : [], 0);
  return out.sort((a, b) => a.timestamp - b.timestamp);
}

/** An unsigned Bitsocial comment ready to hand to publishComment. */
export function buildComment({ subplebbitAddress, authorAddress, content, title = "", parentCid, postCid, now = Date.now() }) {
  const comment = { subplebbitAddress, author: { address: authorAddress }, timestamp: Math.floor(now / 1000), content, protocolVersion: "1.0.0" };
  if (title) comment.title = title;
  if (parentCid) { comment.parentCid = parentCid; comment.postCid = postCid || parentCid; }
  return comment;
}

// ─── Identity and signing ──────────────────────────────────────────────────────────────────
// Verified against plebbit-js 0.0.11 (src/signer/signatures.ts, src/signer/util.ts, src/plebbit/plebbit.ts):
//  - signer = Ed25519; privateKey = base64 (no padding) of the 32 byte seed; publicKey likewise (raw 32 bytes)
//  - author address = base58btc of the identity multihash of the libp2p protobuf public key ("12D3KooW...")
//  - a publication is signed as: pick the signed properties, drop null/undefined/empty objects,
//    CBOR-encode (cborg, map keys sorted by byte length then bytewise), Ed25519-sign the bytes
//  - the signature object is {signature (base64), publicKey (base64), type: "ed25519", signedPropertyNames}
//  - the node's publishComment / publishVote / publishCommentEdit take the pubsub publication, i.e. only the
//    signed properties plus `signature` (no `signer`)

export const PROTOCOL_VERSION = "1.0.0";

// Property order of each publication type (src/publications/*/schema.ts); `signedPropertyNames` follows it.
const SIGNED_ORDER = {
  comment: ["flairs", "spoiler", "nsfw", "content", "title", "link", "linkWidth", "linkHeight", "linkHtmlTagName", "parentCid", "postCid", "quotedCids", "author", "subplebbitAddress", "protocolVersion", "timestamp"],
  vote: ["author", "subplebbitAddress", "protocolVersion", "timestamp", "commentCid", "vote"],
  commentEdit: ["author", "subplebbitAddress", "protocolVersion", "timestamp", "commentCid", "content", "deleted", "flairs", "spoiler", "nsfw", "reason"],
  // Verified against plebbit-js: createCommentModeration(...).signature.signedPropertyNames.
  commentModeration: ["author", "subplebbitAddress", "protocolVersion", "timestamp", "commentModeration", "commentCid"],
};

const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Base58btc (Bitcoin alphabet) encoding of bytes. */
export function base58btcEncode(bytes) {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  const digits = [];
  for (let i = zeros; i < bytes.length; i += 1) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j += 1) { carry += digits[j] << 8; digits[j] = carry % 58; carry = Math.floor(carry / 58); }
    while (carry) { digits.push(carry % 58); carry = Math.floor(carry / 58); }
  }
  return "1".repeat(zeros) + digits.reverse().map((d) => B58_ALPHABET[d]).join("");
}

/** Base64 without padding (what plebbit-js stores for keys and signatures). */
export function bytesToBase64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/=+$/, "");
}

/** Decodes standard or url-safe base64, padded or not. Throws on junk. */
export function base64ToBytes(text) {
  const clean = String(text || "").trim().replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  if (!/^[A-Za-z0-9+/]*$/.test(clean) || clean.length % 4 === 1) throw new Error("That is not valid base64.");
  const bin = atob(clean + "=".repeat((4 - (clean.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

const utf8 = (text) => new TextEncoder().encode(text);

function cborHead(major, n) {
  if (n < 24) return Uint8Array.of((major << 5) | n);
  if (n < 0x100) return Uint8Array.of((major << 5) | 24, n);
  if (n < 0x10000) return Uint8Array.of((major << 5) | 25, n >> 8, n & 255);
  if (n < 0x100000000) return Uint8Array.of((major << 5) | 26, (n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
  const out = new Uint8Array(9);
  out[0] = (major << 5) | 27;
  new DataView(out.buffer).setBigUint64(1, BigInt(n));
  return out;
}

const concatBytes = (parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  parts.forEach((p) => { out.set(p, at); at += p.length; });
  return out;
};

const compareKeyBytes = (a, b) => {
  if (a.length !== b.length) return a.length - b.length;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
};

/** The subset of CBOR plebbit signs: integers, strings, booleans, arrays and maps (keys sorted like cborg). */
export function cborEncode(value) {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error("Only whole numbers can be signed.");
    return value >= 0 ? cborHead(0, value) : cborHead(1, -1 - value);
  }
  if (typeof value === "string") { const b = utf8(value); return concatBytes([cborHead(3, b.length), b]); }
  if (typeof value === "boolean") return Uint8Array.of(value ? 0xf5 : 0xf4);
  if (value === null) return Uint8Array.of(0xf6);
  if (Array.isArray(value)) return concatBytes([cborHead(4, value.length), ...value.map(cborEncode)]);
  if (isObject(value)) {
    const entries = Object.entries(value).map(([k, v]) => [utf8(k), v]);
    entries.sort((a, b) => compareKeyBytes(a[0], b[0]));
    return concatBytes([cborHead(5, entries.length), ...entries.flatMap(([k, v]) => [cborHead(3, k.length), k, cborEncode(v)])]);
  }
  throw new Error("This value can not be signed.");
}

/** plebbit-js cleanUpBeforePublishing: drops null/undefined values and empty objects, recursively. */
export function cleanForSigning(value) {
  if (Array.isArray(value)) return value.map(cleanForSigning);
  if (!isObject(value)) return value;
  const out = {};
  Object.entries(value).forEach(([k, v]) => {
    if (v === null || v === undefined) return;
    const cleaned = cleanForSigning(v);
    if (isObject(cleaned) && !Object.keys(cleaned).length) return;
    out[k] = cleaned;
  });
  return out;
}

/** The Bitsocial (Plebbit) address of an Ed25519 public key: base58btc of the identity multihash of its libp2p protobuf. */
export function addressFromPublicKey(publicKeyBytes) {
  if (!publicKeyBytes || publicKeyBytes.length !== 32) throw new Error("An Ed25519 public key is 32 bytes.");
  const pb = concatBytes([Uint8Array.of(0x08, 0x01, 0x12, 0x20), publicKeyBytes]);
  return base58btcEncode(concatBytes([Uint8Array.of(0x00, pb.length), pb]));
}

const PKCS8_ED25519_PREFIX = Uint8Array.of(0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20);
const subtle = () => (typeof globalThis !== "undefined" && globalThis.crypto && globalThis.crypto.subtle) || null;
export const NO_ED25519_TEXT = "This browser can't create or use Ed25519 keys (WebCrypto Ed25519 is missing). Update to a current Chrome, Edge, Safari or Firefox to publish. Reading and demo mode still work.";

/** True when WebCrypto can generate Ed25519 keys here. */
export async function ed25519Supported() {
  try {
    const s = subtle();
    if (!s) return false;
    return Boolean(await s.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]));
  } catch { return false; }
}

const importSeed = async (seed) => {
  const s = subtle();
  if (!s) throw new Error(NO_ED25519_TEXT);
  try { return await s.importKey("pkcs8", concatBytes([PKCS8_ED25519_PREFIX, seed]), { name: "Ed25519" }, true, ["sign"]); } catch { throw new Error(NO_ED25519_TEXT); }
};

/** Builds a signer {privateKey, publicKey, address, type} from a base64 32 byte Ed25519 seed. */
export async function identityFromPrivateKey(privateKeyBase64) {
  let seed;
  try { seed = base64ToBytes(privateKeyBase64); } catch { throw new Error("That is not a valid private key. Expected 32 bytes in base64."); }
  if (seed.length !== 32) throw new Error(`A private key is 32 bytes (43 base64 characters); this one is ${seed.length} bytes.`);
  const key = await importSeed(seed);
  const jwk = await subtle().exportKey("jwk", key);
  const publicKey = base64ToBytes(jwk.x);
  return { type: "ed25519", privateKey: bytesToBase64(seed), publicKey: bytesToBase64(publicKey), address: addressFromPublicKey(publicKey) };
}

/** Creates a brand new random signer. */
export async function generateIdentity() {
  const s = subtle();
  if (!s) throw new Error(NO_ED25519_TEXT);
  let pkcs8;
  try { pkcs8 = new Uint8Array(await s.exportKey("pkcs8", (await s.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])).privateKey)); } catch { throw new Error(NO_ED25519_TEXT); }
  return identityFromPrivateKey(bytesToBase64(pkcs8.slice(pkcs8.length - 32)));
}

/** Pulls a private key out of what a person pastes: the bare base64 key, or an exported account JSON. */
export function extractPrivateKey(text) {
  const raw = String(text || "").trim();
  if (!raw) throw new Error("Paste a private key first.");
  if (!raw.startsWith("{")) return raw;
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error("That looks like JSON but could not be parsed."); }
  const found = [data && data.signer && data.signer.privateKey, data && data.account && data.account.signer && data.account.signer.privateKey, data && data.privateKey].find((k) => typeof k === "string");
  if (!found) throw new Error("No signer private key found in that JSON.");
  return found;
}

/**
 * Signs a publication ("comment" | "vote" | "commentEdit") with the identity and returns the pubsub
 * publication the Plebbit RPC expects: the signed properties plus `signature`.
 * `fields` are the type's own fields; author.address, protocolVersion and timestamp are filled in here.
 */
export async function signPublication(kind, fields, identity, { now = Date.now() } = {}) {
  const order = SIGNED_ORDER[kind];
  if (!order) throw new Error(`Unknown publication kind ${kind}`);
  const unknown = Object.keys(fields).filter((k) => fields[k] !== undefined && fields[k] !== null && !order.includes(k));
  if (unknown.length) throw new Error(`Can't sign unknown ${kind} field(s): ${unknown.join(", ")}`);
  if (!identity || !identity.privateKey) throw new Error("Create or import an identity first.");
  const author = { ...(fields.author || {}), address: identity.address };
  const full = cleanForSigning({ ...fields, author, protocolVersion: fields.protocolVersion || PROTOCOL_VERSION, timestamp: fields.timestamp || Math.floor(now / 1000) });
  const signedPropertyNames = order.filter((k) => k in full);
  const picked = Object.fromEntries(signedPropertyNames.map((k) => [k, full[k]]));
  const key = await importSeed(base64ToBytes(identity.privateKey));
  const signature = new Uint8Array(await subtle().sign({ name: "Ed25519" }, key, cborEncode(picked)));
  return { ...picked, signature: { signature: bytesToBase64(signature), publicKey: identity.publicKey, type: "ed25519", signedPropertyNames } };
}

const PEER_ID = /^(12D3KooW[1-9A-HJ-NP-Za-km-z]{44}|Qm[1-9A-HJ-NP-Za-km-z]{44})$/;
const DOMAIN_NAME = /^(?=.{3,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** Accepts a peer-id style IPNS address or an ENS-like name (name.eth, name.sol); returns {ok, address} or {ok:false, error}. */
export function validateCommunityAddress(input) {
  const text = String(input || "").trim();
  if (!text) return { ok: false, error: "Enter a community address, such as name.eth or 12D3KooW…" };
  if (PEER_ID.test(text)) return { ok: true, address: text };
  if (DOMAIN_NAME.test(text.toLowerCase())) return { ok: true, address: text.toLowerCase() };
  return { ok: false, error: `"${text.length > 60 ? `${text.slice(0, 57)}…` : text}" is not a community address. Use a name like music.eth or a peer id starting with 12D3KooW.` };
}

// ─── Spaces: access, invitations and roles (verified against a real node, see README) ──────
// "Private" is invite-only to POST. Anyone with the address can still read the content; the node has no
// switch to hide it. Access is the community's `settings.challenges`:
//   Public  = []                                              (no challenge: anyone can post)
//   Private = [{name:"whitelist", options:{addresses:"a,b", error}, exclude:[{role:[owner,admin,moderator]}]}]
//   Locked  = the same list plus {name:"fail", options:{error}, exclude:[{role:[...]}]} (only the roles can post)
// `roles` in editSubplebbit REPLACES the whole map, so callers always send the full merged map.

export const STAFF_ROLES = ["owner", "admin", "moderator"];
export const INVITE_ONLY_MESSAGE = "This room is invite-only.";
export const LOCK_MESSAGE = "This room is locked right now.";
export const PRIVATE_HONESTY = "Anyone with the address can read; only invited people can post.";

/** A pasted author address: a peer id (12D3KooW… / Qm…) or a name like alice.eth. */
export function validateAuthorAddress(input) {
  const text = String(input || "").trim();
  if (!text) return { ok: false, error: "Enter an author address." };
  if (PEER_ID.test(text)) return { ok: true, address: text };
  if (DOMAIN_NAME.test(text.toLowerCase())) return { ok: true, address: text.toLowerCase() };
  return { ok: false, error: `"${text.length > 40 ? `${text.slice(0, 37)}…` : text}" is not an author address. Use 12D3KooW… or a name like alice.eth.` };
}

/** Splits pasted text (commas, spaces, new lines) into unique valid addresses and the entries that failed. */
export function parseAddressList(text) {
  const valid = [];
  const invalid = [];
  String(text || "").split(/[\s,;]+/).filter(Boolean).forEach((part) => {
    const v = validateAuthorAddress(part);
    if (!v.ok) invalid.push(part);
    else if (!valid.includes(v.address)) valid.push(v.address);
  });
  return { valid, invalid };
}

const isInviteChallenge = (ch) => Boolean(ch) && ch.name === "whitelist" && isObject(ch.options) && typeof ch.options.addresses === "string";
const isLockChallenge = (ch) => Boolean(ch) && ch.name === "fail" && isObject(ch.options) && ch.options.error === LOCK_MESSAGE;

/** The challenge that makes a space invite-only to post. */
export function inviteChallenge(addresses) {
  return { name: "whitelist", options: { addresses: addresses.join(","), error: INVITE_ONLY_MESSAGE }, exclude: [{ role: [...STAFF_ROLES] }] };
}
/** The challenge that always fails, except for the owner, admins and moderators. */
export function lockChallenge() {
  return { name: "fail", options: { error: LOCK_MESSAGE }, exclude: [{ role: [...STAFF_ROLES] }] };
}

/** What a challenge list means for people: {private, locked, allow}. */
export function readAccess(challenges) {
  const list = Array.isArray(challenges) ? challenges : [];
  const invite = list.find(isInviteChallenge);
  return {
    private: Boolean(invite),
    locked: list.some(isLockChallenge),
    allow: invite ? invite.options.addresses.split(",").map((a) => a.trim()).filter(Boolean) : [],
  };
}
/** The same list with the allow-list replaced (other challenges are kept). */
export function withAllowList(challenges, addresses) {
  const list = Array.isArray(challenges) ? challenges : [];
  if (!list.some(isInviteChallenge)) return [inviteChallenge(addresses), ...list];
  return list.map((ch) => (isInviteChallenge(ch) ? { ...ch, options: { ...ch.options, addresses: addresses.join(",") } } : ch));
}
/** The same list with the lock added or removed. */
export function withLock(challenges, locked) {
  const list = (Array.isArray(challenges) ? challenges : []).filter((ch) => !isLockChallenge(ch));
  return locked ? [...list, lockChallenge()] : list;
}
/** The challenge list for a visibility: public clears everything but a lock; private needs the owner on the list. */
export function accessChallenges({ visibility, allow = [], locked = false }) {
  return withLock(visibility === "private" ? [inviteChallenge(allow)] : [], locked);
}
/** Roles after setting one address's role (null removes it). The owner's own entry can never change here. */
export function mergeRoles(roles, address, role) {
  const out = { ...(isObject(roles) ? roles : {}) };
  if (out[address] && out[address].role === "owner") return out;
  if (role) out[address] = { role }; else delete out[address];
  return out;
}
export const BAN_DURATIONS = [
  { id: "1h", label: "1 hour", seconds: 3600 },
  { id: "1d", label: "1 day", seconds: 86400 },
  { id: "7d", label: "7 days", seconds: 7 * 86400 },
  { id: "30d", label: "30 days", seconds: 30 * 86400 },
];
/** The `commentModeration` object for a removal and/or a ban. `now` is in ms. */
export function moderationFor({ remove = false, banSeconds = 0, reason = "", now = Date.now() }) {
  const out = {};
  if (remove) out.removed = true;
  if (banSeconds) out.author = { banExpiresAt: Math.floor(now / 1000) + banSeconds };
  if (reason.trim()) out.reason = reason.trim();
  return out;
}
/** The text a person pastes to invite someone. */
export function inviteMessage({ title, address, isPrivate }) {
  return `Join my Bitkin space "${title}". Open Bitkin, choose Join, and paste this address: ${address}${isPrivate ? "\nThis space is invite-only: send me your author address (Bitkin, your identity) so I can add you before you post." : ""}`;
}

/** Checks the fields of a new post or reply; returns an error string or "". */
export function validateComposer({ content = "", title = "", link = "", isReply = false }) {
  if (isReply) return content.trim() ? "" : "Write something to reply.";
  if (!content.trim() && !title.trim() && !link.trim()) return "A post needs a title, some text or a link.";
  if (link.trim()) {
    if (link.trim().length > 2000) return "The link is longer than 2000 characters.";
    try { const u = new URL(link.trim()); if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("scheme"); } catch { return "The link must be a full http(s) address, like https://example.com."; }
  }
  return "";
}

// ─── Demo mode: in-memory sample communities ───────────────────────────────────────────────

const H = 3600 * 1000;
const mk = (cid, name, address, text, ago, extra = {}) => ({ cid, author: { address, name }, title: "", content: text, link: "", timestamp: 0, ago, replyCount: 0, upvotes: 0, downvotes: 0, pinned: false, replies: [], ...extra });

/**
 * The public topic communities every demo starts with. One entry per community, plain data, so a later
 * "activate on my node" flow can read `id`, `address`, `topic` and `visibility` and create the real community from it.
 * Shape: { id, title, description, address, topic, visibility: "public" | "private", challenge?: {question, answer},
 *   posts: [{ cid, who, title, text, ago (hours), up, pinned, replies: [{ cid, who, text, ago }] }] }
 */
export const SEEDED_COMMUNITIES = [
  { id: "ai", title: "AI", description: "Artificial intelligence: research, tools and discussion.", address: "ai.bitkin", topic: "topic-ai", visibility: "public", posts: [
    { cid: "Qm-demo-1", who: "es", title: "Welcome to AI", text: "Welcome to the **AI** community on Bitkin. Share papers, tools and questions.", ago: 30, up: 42, pinned: true, replies: [{ cid: "Qm-demo-1a", who: "ada", text: "Love that *anyone* can run a community like this from a laptop.", ago: 29 }, { cid: "Qm-demo-1b", who: "li", text: "What is the best way to try a small model locally?\n\nStart with a quantised model and a simple runner.", ago: 28 }] },
    { cid: "Qm-demo-2", who: "gr", title: "Prompting tips that worked", text: "Be specific about the output format.\n\n```\nAnswer as a JSON list of strings.\n```", ago: 5, up: 17, replies: [{ cid: "Qm-demo-2a", who: "es", text: "That also makes the answers easier to check.", ago: 4 }] },
  ] },
  { id: "news", title: "News", description: "News & Current Events.", address: "news.bitkin", topic: "topic-news", visibility: "public", challenge: {"question": "What is 2 + 3?", "answer": "5"}, posts: [
    { cid: "Qm-demo-3", who: "ma", title: "Weekly digest", text: "A short digest of what happened this week. Posting here asks a demo challenge, to show how moderated communities work.", ago: 12, up: 9, replies: [{ cid: "Qm-demo-3a", who: "ada", text: "Thanks, this saves me a lot of reading.", ago: 11 }] },
    { cid: "Qm-demo-3b", who: "li", title: "Sources you trust", text: "Which outlets do you read, and why?", ago: 6, up: 5 },
  ] },
  { id: "tech", title: "Tech", description: "Technology and gadgets.", address: "tech.bitkin", topic: "topic-tech", visibility: "public", posts: [
    { cid: "Qm-demo-4", who: "li", title: "Weekend projects", text: "What are you building this weekend?", ago: 2, up: 3, replies: [{ cid: "Qm-demo-4a", who: "ada", text: "A tiny garden planner.", ago: 1 }] },
    { cid: "Qm-demo-4b", who: "gr", title: "Best budget keyboard?", text: "Looking for something quiet that lasts.", ago: 9, up: 4 },
  ] },
  { id: "science", title: "Science", description: "Discoveries, papers and curiosity.", address: "science.bitkin", topic: "topic-science", visibility: "public", posts: [
    { cid: "Qm-demo-7", who: "ada", title: "Favourite science explainer", text: "Share an article or video that made something click for you.", ago: 14, up: 8, replies: [{ cid: "Qm-demo-7a", who: "es", text: "Anything on how vaccines are tested.", ago: 13 }] },
  ] },
  { id: "business", title: "Business", description: "Startups, work and money matters.", address: "business.bitkin", topic: "topic-business", visibility: "public", posts: [
    { cid: "Qm-demo-8", who: "gr", title: "Show your side project", text: "Share what you are shipping and what you learned.", ago: 8, up: 11, replies: [{ cid: "Qm-demo-8a", who: "ma", text: "Pricing was the hardest part for me.", ago: 7 }] },
  ] },
  { id: "design", title: "Design", description: "Interfaces, graphics and craft.", address: "design.bitkin", topic: "topic-design", visibility: "public", posts: [
    { cid: "Qm-demo-9", who: "ma", title: "Critique corner", text: "Post a screenshot and get friendly feedback.", ago: 20, up: 6 },
  ] },
];
const DEMO_PEOPLE = {"es": {"name": "Esteban", "address": "12D3KooWesteban"}, "ada": {"name": "Ada", "address": "12D3KooWada"}, "li": {"name": "Linus", "address": "12D3KooWlinus"}, "gr": {"name": "Grace", "address": "12D3KooWgrace"}, "ma": {"name": "Margaret", "address": "12D3KooWmargaret"}};
const fromSeed = (c) => ({
  address: c.address, title: c.title, description: c.description, topic: c.topic, visibility: c.visibility, seedId: c.id, ...(c.challenge ? { challenge: { ...c.challenge } } : {}),
  posts: c.posts.map((p) => mk(p.cid, DEMO_PEOPLE[p.who].name, DEMO_PEOPLE[p.who].address, p.text, p.ago * H, { title: p.title, pinned: Boolean(p.pinned), upvotes: p.up, replies: (p.replies || []).map((r) => mk(r.cid, DEMO_PEOPLE[r.who].name, DEMO_PEOPLE[r.who].address, r.text, r.ago * H)) })),
});
export function demoCommunities(now = Date.now()) {
  const list = SEEDED_COMMUNITIES.map(fromSeed);
  list.forEach((c) => c.posts.forEach((p) => { p.timestamp = now - p.ago; p.replies.forEach((r) => { r.timestamp = now - r.ago; r.depth = 0; }); p.replyCount = p.replies.length; }));
  return list;
}

/** Communities a demo user can join by address (not in the sidebar until joined). */
export function demoDirectory(now = Date.now()) {
  const list = [
    { address: "music.eth", title: "Music", description: "Albums, gigs and gear.", posts: [mk("Qm-demo-5", "Ada", "12D3KooWada", "What are you listening to this week?", 3 * H, { title: "Weekly listening thread", upvotes: 6 })] },
    { address: "devs.eth", title: "Devs", description: "Building with Bitkin.", posts: [mk("Qm-demo-6", "Grace", "12D3KooWgrace", "Share what you are shipping.", 6 * H, { title: "Show and tell", upvotes: 11 })] },
  ];
  list.forEach((c) => c.posts.forEach((p) => { p.timestamp = now - p.ago; p.replies.forEach((r) => { r.timestamp = now - r.ago; r.depth = 0; }); p.replyCount = p.replies.length; }));
  return list;
}

// ─── Avatars: Kamiji-style orbs, tinted from the author address ────────────────────────────

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


const BLOBS = [
  { id: "violet", fill: "#8B5CF6", path: "M32 6c14 0 24 10 24 24 0 16-11 28-24 28S8 46 8 30C8 16 18 6 32 6Z" },
  { id: "blue", fill: "#2D9CF0", path: "M32 4c9 14 22 22 22 36 0 11-10 20-22 20S10 51 10 40C10 26 23 18 32 4Z" },
  { id: "green", fill: "#2FBF71", path: "M18 18c4-8 12-8 14-2 3-6 12-6 15 2 7 1 12 9 8 17-3 7-10 9-16 8-6 4-14 4-19-2-7-3-9-12-5-18 0-2 1-4 3-5Z" },
  { id: "teal", fill: "#19B5A5", path: "M10 14c0-5 4-8 9-8h14c9 0 15 7 15 16s-6 14-14 14H21c-6 0-11-4-11-10Z" },
  { id: "brown", fill: "#8A5A3C", path: "M32 6c15 0 26 10 26 25S47 58 32 58 6 46 6 31 17 6 32 6Z" },
  { id: "orange", fill: "#F5760A", path: "M32 5c14 0 25 11 25 26 0 14-10 26-25 26S7 45 7 31C7 16 18 5 32 5Z" },
  { id: "red", fill: "#EF4444", path: "M12 22c0-8 6-14 14-14h12c8 0 14 6 14 14v10c0 8-6 14-14 14H26c-8 0-14-6-14-14Z" },
  { id: "pink", fill: "#EC4899", path: "M32 6 58 52H6Z" },
  { id: "indigo", fill: "#5B5BF0", path: "M14 12h36c3 0 6 3 6 6v28c0 3-3 6-6 6H14c-3 0-6-3-6-6V18c0-3 3-6 6-6Z" },
];


// Slightly different outlines for the orb, so a column of them does not look stamped.
// Bitsocial characters have square heads: a rounded square with a slightly different corner radius each.
const ORB_PATHS = [
  "M18 7h28c8 0 12 4 12 12v26c0 8-4 12-12 12H18c-8 0-12-4-12-12V19C6 11 10 7 18 7Z",
  "M15 7h34c6 0 9 3 9 9v32c0 6-3 9-9 9H15c-6 0-9-3-9-9V16C6 10 9 7 15 7Z",
  "M20 7h24c9 0 14 5 14 14v22c0 9-5 14-14 14H20c-9 0-14-5-14-14V21C6 12 11 7 20 7Z",
];

/** The front-page orb as an avatar: one flat blob that wobbles, with two pill eyes that glance around and blink. */
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
  const halo = add(svg, "rect", { x: 1, y: 2, width: 62, height: 62, rx: 18, fill: blob.fill, opacity: 0.16 });
  halo.setAttribute("class", "orb-halo");
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

/** The avatar for an agent, tinted per agent: the wisp, a flat blob with two pill eyes. */
export function blobSvg(blobId) {
  const blob = BLOBS.find((b) => b.id === blobId) || BLOBS[0];
  return orbSvg(blob, BLOBS.indexOf(blob));
}


// ─── Markdown for messages: built as DOM, never as HTML (copied from Hangout) ─────

/** Agents sometimes reply with a JSON envelope like {"message": "...", "summary": "..."}; show the message. */
export function unwrapMessage(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return { body: String(raw || ""), note: "" };
  try {
    const data = JSON.parse(trimmed);
    if (isObject(data) && typeof data.message === "string") {
      const note = typeof data.summary === "string" ? data.summary : "";
      return { body: data.message, note };
    }
  } catch { /* not an envelope */ }
  return { body: String(raw || ""), note: "" };
}
const SAFE_URL = /^(https?:\/\/|mailto:)/i;
const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*|__[^_\n]+__)|(~~[^~\n]+~~)|(\[[^\]\n]+\]\([^)\s]+\))|(\bhttps?:\/\/[^\s<>)]+[^\s<>).,;:!?])|(\*[^*\s][^*\n]*\*|_[^_\s][^_\n]*_)/g;

/** Appends inline markdown (code, bold, italic, strike, links) to a parent, as text nodes and elements. */
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
      if (SAFE_URL.test(url)) { const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; renderInline(a, label); parent.append(a); }
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
  // items: [{ indent, ordered, text }]; nested by indentation.
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
    const task = /^\[([ xX])\]\s+(.*)$/.exec(it.text);
    if (task) {
      li.className = "mdtask";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.disabled = true;
      box.checked = task[1].toLowerCase() === "x";
      li.append(box, document.createTextNode(" "));
      renderInline(li, task[2]);
    } else renderInline(li, it.text);
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

/** Renders markdown into a container element. Tolerates half-finished text, so it is safe to call as a reply streams in. */
export function renderMarkdown(source) {
  const root = document.createElement("div");
  root.className = "md";
  const { body, note } = unwrapMessage(source);
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
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
      i += 1; // closing fence, or the end of a reply that is still streaming
      root.append(codeBlock(open[1], code));
      continue;
    }
    if (!line.trim()) { flush(); i += 1; continue; }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const h = document.createElement(`h${Math.min(heading[1].length + 2, 6)}`);
      renderInline(h, heading[2]);
      root.append(h);
      i += 1;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); root.append(document.createElement("hr")); i += 1; continue; }
    if (/^\s*>/.test(line)) {
      flush();
      const quote = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { quote.push(lines[i].replace(/^\s*>\s?/, "")); i += 1; }
      const bq = document.createElement("blockquote");
      quote.forEach((q, n) => { if (n) bq.append(document.createElement("br")); renderInline(bq, q); });
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
  if (note) { const n = document.createElement("p"); n.className = "mdnote"; n.textContent = note; root.append(n); }
  return root;
}

/** A one-line plain version/** A one-line plain version of a message, for the list preview. */
export function plainText(source) {
  const { body } = unwrapMessage(source);
  return body
    .replace(/```[\s\S]*?(```|$)/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/(\*\*|__|~~)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}


const hashOf = (text) => { let h = 2166136261; for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

/** The orb avatar for an author: colour and outline picked from their address. */
export function orbFor(address) {
  const h = hashOf(address);
  return orbSvg(BLOBS[h % BLOBS.length], h % 97);
}

export function relativeTime(ts, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
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
    h.className = `colgrip colgrip-${c.edge}`;
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

// ─── Voxel cloud: one metaball blob per community, drawn as hard square cells (Hangout's welcome scene, per community) ──
const CLOUD_HUES = { ai: 271, news: 210, tech: 172, science: 145, business: 36, design: 328 };
const CLOUD_MAX = 12;
const cloudClamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const cloudHash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i += 1) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; };
function cloudRand(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** The tint of a community's blob: the app accent hue (#a855f7) for AI, a fixed hue per seeded topic, a stable hash hue otherwise. */
export function cloudTint(item) {
  const hue = CLOUD_HUES[item.id] !== undefined ? CLOUD_HUES[item.id] : cloudHash(String(item.address || item.id)) % 360;
  const sat = 0.62, l = 0.6;
  const a = sat * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + hue / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}

/** Builds the cloud: blobs spread on an ellipse, each with a body and two lobes, pill eyes and its own gaze/blink timers. */
export function createCloudScene(items, w, h, rand = cloudRand(7)) {
  const list = items.slice(0, CLOUD_MAX);
  const n = Math.max(1, list.length);
  const r = cloudClamp((h - 44) * 0.15, 16, 48) * Math.sqrt(Math.min(1, 6 / n));
  const blobs = list.map((item, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const uh = h - 44; // keep the bottom strip free for the style toggle
    const hx = n === 1 ? w / 2 : w / 2 + Math.cos(a) * w * 0.38, hy = n === 1 ? uh / 2 : uh / 2 + 4 + Math.sin(a) * uh * 0.3;
    return { item, rgb: cloudTint(item), hx, hy, x: hx, y: hy, r, ph: rand() * 6.28, sp: 0.35 + rand() * 0.3, gx: 0, gy: 0, vx: 0, vy: 0, tx: 0, ty: 0, look: rand() * 2, blinkAt: 1 + rand() * 3, blinkP: -1, closed: 0 };
  });
  return { w, h, t: 0, rand, blobs, pointer: null, focus: -1, balls: [] };
}
function cloudBalls(s) {
  const out = [];
  s.blobs.forEach((b, i) => {
    out.push({ x: b.x, y: b.y, r: b.r, i });
    for (let k = 0; k < 2; k += 1) {
      const a = s.t * (0.8 + k * 0.5) + b.ph + k * 3.1;
      out.push({ x: b.x + Math.cos(a) * b.r * 0.5, y: b.y + Math.sin(a) * b.r * 0.42, r: b.r * (0.5 + 0.08 * k), i });
    }
  });
  s.balls = out;
}
/** Advances the cloud by dt seconds: gentle drift (neighbours sometimes touch and merge), gaze towards the pointer, blinks. */
export function stepCloudScene(s, dt) {
  s.t += dt;
  s.blobs.forEach((b) => {
    const amp = b.r * 0.45;
    b.x = b.hx + Math.sin(s.t * b.sp + b.ph) * amp;
    b.y = b.hy + Math.cos(s.t * b.sp * 0.8 + b.ph * 1.3) * amp * 0.6;
    if (s.pointer) { b.tx = cloudClamp((s.pointer.x - b.x) / (b.r * 3), -1, 1); b.ty = cloudClamp((s.pointer.y - b.y) / (b.r * 3), -1, 1); }
    else {
      b.look -= dt;
      if (b.look <= 0) { b.look = 1 + s.rand() * 2.4; b.tx = s.rand() < 0.3 ? 0 : (s.rand() - 0.5) * 1.4; b.ty = s.rand() < 0.3 ? 0 : (s.rand() - 0.5) * 0.8; }
    }
    b.vx += (b.tx - b.gx) * 90 * dt; b.vy += (b.ty - b.gy) * 90 * dt;
    const damp = Math.max(0, 1 - 11 * dt);
    b.vx *= damp; b.vy *= damp;
    b.gx += b.vx * dt; b.gy += b.vy * dt;
    b.blinkAt -= dt;
    if (b.blinkP < 0 && b.blinkAt <= 0) b.blinkP = 0;
    if (b.blinkP >= 0) {
      b.blinkP += dt / 0.18;
      b.closed = Math.sin(Math.PI * Math.min(1, b.blinkP));
      if (b.blinkP >= 1) { b.blinkP = -1; b.closed = 0; b.blinkAt = 2 + s.rand() * 3.5; }
    }
  });
  cloudBalls(s);
}
/** Index of the blob under (x, y), or -1. */
export function cloudHit(s, x, y) {
  let best = -1, bf = 0.8;
  const per = new Map();
  s.balls.forEach((b) => { const dx = x - b.x, dy = y - b.y; per.set(b.i, (per.get(b.i) || 0) + (b.r * b.r) / (dx * dx + dy * dy + 1)); });
  per.forEach((f, i) => { if (f > bf) { bf = f; best = i; } });
  return best;
}
/** Paints the cloud. Voxel mode keeps hard square cells (nearest-neighbour scaling); smooth mode softens the edge. */
export function drawCloudScene(ctx, off, s, mode, cellSize) {
  const voxel = mode === "voxel";
  const cell = cellSize || (voxel ? 14 : 4);
  const gw = Math.max(1, Math.ceil(s.w / cell)), gh = Math.max(1, Math.ceil(s.h / cell));
  if (off.width !== gw || off.height !== gh) { off.width = gw; off.height = gh; }
  const octx = off.getContext("2d");
  const img = octx.createImageData(gw, gh);
  const contrib = new Float32Array(s.blobs.length);
  for (let gy = 0; gy < gh; gy += 1) {
    for (let gx = 0; gx < gw; gx += 1) {
      const px = (gx + 0.5) * cell, py = (gy + 0.5) * cell;
      contrib.fill(0);
      let f = 0;
      for (let k = 0; k < s.balls.length; k += 1) { const b = s.balls[k]; const dx = px - b.x, dy = py - b.y; const c = (b.r * b.r) / (dx * dx + dy * dy + 1); contrib[b.i] += c; f += c; }
      const a = voxel ? (f > 1 ? 255 : 0) : Math.round(cloudClamp((f - 0.9) / 0.18, 0, 1) * 255);
      if (!a) continue;
      let top = 0;
      for (let i = 1; i < contrib.length; i += 1) if (contrib[i] > contrib[top]) top = i;
      const rgb = s.blobs[top].rgb, o = (gy * gw + gx) * 4;
      img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = a;
    }
  }
  octx.putImageData(img, 0, 0);
  ctx.clearRect(0, 0, s.w, s.h);
  ctx.imageSmoothingEnabled = !voxel;
  ctx.drawImage(off, 0, 0, gw * cell, gh * cell);
  s.blobs.forEach((b, i) => {
    const ew = b.r * 0.2, eh = b.r * 0.5 * (1 - b.closed * 0.9);
    ctx.fillStyle = "#1a0f33";
    [-0.3, 0.3].forEach((dx) => {
      const cx = b.x + dx * b.r * 1.2 + b.gx * b.r * 0.32, cy = b.y - b.r * 0.04 + b.gy * b.r * 0.26;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cx - ew / 2, cy - eh / 2, ew, eh, ew / 2); else ctx.rect(cx - ew / 2, cy - eh / 2, ew, eh);
      ctx.fill();
    });
    if (s.focus === i) { ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2; ctx.setLineDash?.([4, 3]); ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.35, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash?.([]); }
  });
}


const CSS = `
.bh { --bh-bg: var(--oh-color-base, #171717); --bh-panel: var(--oh-color-base-secondary, #212121); --bh-raised: var(--oh-surface-raised, #2a2a2a);
  --bh-text: var(--oh-foreground, #eee); --bh-contrast: var(--oh-contrast, #fff); --bh-muted: var(--oh-muted, #9a9a9a);
  --bh-border: var(--oh-border-subtle, #3a3a3a); --bh-primary: var(--oh-accent, var(--oh-color-primary, #fff)); --bh-on-primary: var(--oh-accent-foreground, #111);
  --bh-on-contrast: var(--oh-contrast-foreground, #111);
  --bh-ok: var(--oh-success, #34d399); --bh-bad: var(--oh-danger-soft-foreground, #f87171);
  --bh-link: var(--oh-info-soft-foreground, #7c9dff);
  /* the copied markdown block below still names Hangout's tokens; resolve them here so text never loses its colour */
  --hg-contrast: var(--bh-contrast); --hg-muted: var(--bh-muted); --hg-primary: var(--bh-primary);
  box-sizing: border-box; position: sticky; top: 0; color: var(--bh-text); background: var(--bh-bg); font: 14px/1.45 system-ui, sans-serif;
  height: 100%; min-height: 480px; overflow: hidden; }
.bh *, .bh *::before, .bh *::after { box-sizing: border-box; }
.bh button, .bh input, .bh textarea { font: inherit; color: inherit; }
.bh .shell { position: relative; display: grid; grid-template-columns: var(--grip-0, 260px) minmax(0, 1fr) var(--grip-1, 240px); height: 100%; min-height: 0; }
.bh .side, .bh .members { display: flex; flex-direction: column; min-height: 0; background: var(--bh-bg); }
.bh .side { border-right: 1px solid var(--bh-border); }
.bh .members { border-left: 1px solid var(--bh-border); }
.bh .brand { display: flex; align-items: center; gap: 12px; padding: 18px 18px 10px; }
.bh .brand h1 { margin: 0; font-size: 16px; font-weight: 600; color: var(--bh-contrast); }
.bh .status { display: inline-flex; align-items: center; gap: 6px; margin: 0 18px 6px; padding: 3px 10px; border: 1px solid var(--bh-border); border-radius: 999px; font-size: 12px; color: var(--bh-muted); align-self: flex-start; }
.bh .status::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--bh-muted); }
.bh .status[data-state="connected"]::before { background: var(--bh-ok); }
.bh .status[data-state="connecting"]::before { background: #f2b51d; }
.bh .status[data-state="demo"]::before { background: #8b5cf6; }
.bh .sectionlabel { padding: 14px 18px 6px; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--bh-muted); }
.bh .list { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 0 10px; display: grid; grid-template-columns: minmax(0, 1fr); align-content: start; gap: 2px; }
.bh .row { display: flex; align-items: center; gap: 12px; width: 100%; min-width: 0; padding: 9px 10px; border: 0; border-radius: 10px; background: transparent; cursor: pointer; text-align: left; }
.bh .row:hover { background: var(--bh-panel); }
.bh .row[aria-current="true"] { background: var(--bh-raised); color: var(--bh-contrast); }
.bh .row .t { min-width: 0; flex: 1; display: grid; gap: 1px; }
.bh .row .t b { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bh .row .t b i { font-style: normal; color: var(--bh-muted); margin-right: 2px; }
.bh .row .t small { color: var(--bh-muted); font-size: 12px; line-height: 1.35; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bh .row[aria-current="true"] .t b i { color: var(--bh-contrast); }
.bh .avatar { flex: none; width: 36px; height: 36px; }
.bh .avatar svg { width: 100%; height: 100%; display: block; }
.bh .avatar.sm { width: 28px; height: 28px; }
.bh .avatar.lg { width: 96px; height: 96px; }
.bh .sidefoot { display: grid; gap: 8px; padding: 10px 12px 12px; border-top: 1px solid var(--bh-border); }
.bh .btn { border: 1px solid var(--bh-border); border-radius: 10px; background: var(--bh-panel); padding: 6px 12px; cursor: pointer; }
.bh .btn:hover { background: var(--bh-raised); }
.bh .btn.primary { background: var(--bh-primary); color: var(--bh-on-primary); border-color: transparent; }
.bh .btn:disabled { opacity: .5; cursor: default; }
.bh .powered { display: flex; align-items: center; gap: 6px; color: var(--bh-muted); font-size: 12px; }
.bh .plogo { display: inline-flex; color: inherit; opacity: .7; }
.bh .plogo:hover { opacity: 1; }
.bh .plogo svg { height: 16px; width: auto; }
.bh .plogo.artec { color: var(--oh-contrast, currentColor); opacity: .85; }
.bh .plogo.artec svg { height: 20px; }
.bh .main { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.bh .head { flex: none; display: flex; align-items: center; gap: 10px; padding: 12px 20px; border-bottom: 1px solid var(--bh-border); }
.bh .head h2 { margin: 0; font-size: 16px; font-weight: 600; color: var(--bh-contrast); }
.bh .head .desc { color: var(--bh-muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bh .body { flex: 1; min-height: 0; overflow: auto; }
.bh .msgs { padding: 16px 20px; display: grid; gap: 14px; align-content: start; }
.bh .msg { display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 10px; }
.bh .msg .who { display: flex; align-items: baseline; gap: 8px; }
.bh .msg .who b { color: var(--bh-contrast); font-weight: 600; }
.bh .msg .who span { color: var(--bh-muted); font-size: 12px; }
.bh .msg .ptitle { font-weight: 650; color: var(--bh-contrast); margin: 1px 0 2px; }
.bh .msg .tag { font-size: 11px; padding: 0 6px; border: 1px solid var(--bh-border); border-radius: 6px; color: var(--bh-muted); }
.bh .msg.pending { opacity: .65; }
.bh .msg.failed .note { color: var(--bh-bad); }
.bh .msg .note { font-size: 12px; color: var(--bh-muted); }
.bh .linkbtn { border: 0; background: none; padding: 2px 0; color: var(--bh-link); cursor: pointer; font-size: 12px; }
.bh .linkbtn:hover { text-decoration: underline; }
.bh .empty { padding: 40px 20px; text-align: center; color: var(--bh-muted); }
.bh .composerwrap { flex: none; padding: 8px 16px 14px; }
.bh .composerbox { display: grid; gap: 2px; border: 1px solid var(--bh-border); border-radius: 18px; background: var(--bh-panel); padding: 0 10px 8px; }
.bh .composerbox:focus-within { border-color: var(--bh-muted); }
.bh .composerbox .grip { height: 14px; display: grid; place-items: center; }
.bh .composerbox .grip::after { content: ""; width: 36px; height: 4px; border-radius: 4px; background: var(--bh-border); }
.bh .composerbox input, .bh .composerbox textarea { border: 0; outline: 0; background: transparent; resize: none; width: 100%; padding: 6px 6px; }
.bh .composerbox textarea { min-height: 44px; max-height: 320px; }
.bh .composerbar { display: flex; align-items: center; gap: 6px; }
.bh .composerbar .tool { display: inline-flex; align-items: center; gap: 6px; border: 0; border-radius: 12px; background: var(--bh-bg); padding: 6px 10px; font-size: 12px; cursor: pointer; white-space: nowrap; }
.bh .composerbar .tool:hover { background: var(--bh-raised); }
.bh .composerbar .tool.on { background: var(--bh-primary); color: var(--bh-on-primary); }
.bh .composerbar .spacer { flex: 1; }
.bh .composerbar .send { border: 0; border-radius: 50%; width: 34px; height: 34px; background: var(--bh-primary); color: var(--bh-on-primary); cursor: pointer; font-weight: 700; }
.bh .composerbar .send:disabled { opacity: .4; cursor: default; }
.bh .composerbar .err { color: var(--bh-bad); font-size: 12px; }
.bh .mhead { padding: 14px 14px 6px; font-weight: 600; color: var(--bh-contrast); }
.bh .mrow { display: flex; align-items: center; gap: 10px; padding: 5px 14px; }
.bh .mrow .t { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bh .mrow small { color: var(--bh-muted); display: block; font-size: 11px; }
.bh .cloudstage { position: relative; flex: none; height: clamp(190px, 36vh, 300px); overflow: hidden; border-bottom: 1px solid var(--bh-border); }
.bh .cloudstage canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; cursor: default; }
.bh .cloudstage canvas[data-hit="true"] { cursor: pointer; }
.bh .cloudlist { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; list-style: none; }
.bh .cloudcorner { position: absolute; left: 12px; bottom: 10px; right: 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px; pointer-events: none; }
.bh .cloudcorner > * { pointer-events: auto; }
.bh .cloudmodes { display: inline-flex; gap: 2px; padding: 2px; border-radius: 999px; background: var(--bh-panel); border: 1px solid var(--bh-border); }
.bh .cloudmode { border: 0; background: transparent; color: var(--bh-text); border-radius: 999px; padding: 3px 12px; font-size: 12px; cursor: pointer; }
.bh .cloudmode[aria-pressed="true"] { background: var(--bh-contrast); color: var(--bh-on-contrast); }
.bh .cloudcap { padding: 3px 10px; border-radius: 999px; background: var(--bh-panel); border: 1px solid var(--bh-border); color: var(--bh-text); font-size: 12px; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bh .cloudcap:empty { display: none; }
.bh .page { max-width: 560px; margin: 0 auto; padding: 36px 24px; display: grid; gap: 16px; justify-items: center; text-align: center; }
.bh .page h2 { margin: 0; font-size: 26px; font-weight: 500; color: var(--bh-contrast); }
.bh .page p { margin: 0; color: var(--bh-muted); }
.bh .card { width: 100%; display: grid; gap: 8px; padding: 14px; border: 1px solid var(--bh-border); border-radius: 14px; background: var(--bh-panel); text-align: left; }
.bh .card label { font-size: 12px; color: var(--bh-muted); }
.bh .card input { border: 1px solid var(--bh-border); border-radius: 10px; background: var(--bh-bg); padding: 7px 10px; width: 100%; }
.bh .card .actions { display: flex; flex-wrap: wrap; gap: 8px; }
.bh .card .errtext { color: var(--bh-bad); font-size: 13px; }
.bh .card .hint { color: var(--bh-muted); font-size: 12px; }
/* the "no node yet" tutorial: two commands to copy, a start button, and the docs */
.bh .card .setup { display: grid; gap: 10px; padding: 12px; border: 1px solid var(--bh-border); border-radius: 12px; background: var(--bh-bg); }
.bh .card .setuph { font-size: 13px; font-weight: 600; color: var(--bh-contrast); }
/* the dashboard's reset strips list markers, and this list IS the steps: restore them */
.bh .card .steps { margin: 0; padding-left: 22px; list-style: decimal; font-size: 12.5px; line-height: 1.45; }
.bh .card .steps > li + li { margin-top: 10px; }
.bh .card .steps > li::marker { color: var(--bh-muted); }
.bh .card .steps code { font: 12px ui-monospace, SF Mono, Menlo, monospace; color: var(--bh-contrast); }
.bh .card .cmd { display: flex; align-items: stretch; gap: 8px; margin-top: 5px; }
.bh .card .cmd code { flex: 1; min-width: 0; padding: 6px 8px; border: 1px solid var(--bh-border); border-radius: 8px; background: var(--bh-panel); overflow-x: auto; white-space: nowrap; }
.bh .card .cmd .btn { flex: none; padding: 4px 10px; font-size: 12px; }
.bh .card .setupbtns { display: flex; flex-wrap: wrap; gap: 8px; }
.bh .card .setupbtns a.btn { display: inline-flex; align-items: center; text-decoration: none; color: inherit; }
.bh .side > .setupbtn { align-self: flex-start; margin: 0 18px 6px; padding: 3px 10px; border: 1px solid var(--bh-border); border-radius: 999px; background: var(--bh-panel); font-size: 12px; cursor: pointer; }
.bh .side > .setupbtn:hover { background: var(--bh-raised); }
/* markdown + orb styles, copied from Hangout */
.bh .md { display: grid; gap: 8px; min-width: 0; line-height: 1.5; }
.bh .md > :first-child { margin-top: 0; }
.bh .md p, .bh .md ul, .bh .md ol, .bh .md blockquote, .bh .md h3, .bh .md h4, .bh .md h5, .bh .md h6, .bh .md hr { margin: 0; }
.bh .md h3 { font-size: 16px; font-weight: 650; color: var(--hg-contrast); }
.bh .md h4 { font-size: 15px; font-weight: 650; color: var(--hg-contrast); }
.bh .md h5, .bh .md h6 { font-size: 14px; font-weight: 650; color: var(--hg-contrast); }
.bh .md strong { font-weight: 650; color: var(--hg-contrast); }
.bh .md a { color: var(--bh-link); text-decoration: underline; text-underline-offset: 2px; }
.bh .md ul, .bh .md ol { padding-left: 22px; display: grid; gap: 3px; }
.bh .md li > ul, .bh .md li > ol { margin-top: 3px; }
.bh .md li.mdtask { list-style: none; margin-left: -20px; }
.bh .md li.mdtask input { margin-right: 4px; vertical-align: -1px; accent-color: var(--hg-primary); }
.bh .md blockquote { border-left: 3px solid var(--hg-border); padding: 2px 0 2px 12px; color: var(--hg-muted); }
.bh .md hr { border: 0; border-top: 1px solid var(--hg-border); }
.bh .md code { font: 12.5px ui-monospace, SF Mono, Menlo, monospace; background: rgba(255,255,255,.08); border-radius: 5px; padding: 1px 5px; overflow-wrap: anywhere; }
.bh .md .mdcode { border: 1px solid var(--hg-border); border-radius: 10px; overflow: hidden; background: #0e0e10; color: #eee; }
.bh .md .mdcodebar { display: flex; align-items: center; justify-content: space-between; padding: 4px 10px; font-size: 11px; color: #9a9a9a; border-bottom: 1px solid var(--hg-border); background: rgba(255,255,255,.03); }
.bh .md .mdcodebar button { border: 0; background: transparent; color: #9a9a9a; cursor: pointer; font-size: 11px; }
.bh .md .mdcodebar button:hover { color: #fff; }
.bh .md pre { margin: 0; padding: 10px 12px; overflow-x: auto; font: 12.5px/1.55 ui-monospace, SF Mono, Menlo, monospace; }
.bh .md pre code { background: none; padding: 0; border-radius: 0; overflow-wrap: normal; }
.bh .md .mdtable { overflow-x: auto; border: 1px solid var(--hg-border); border-radius: 10px; }
.bh .md table { border-collapse: collapse; width: 100%; font-size: 13px; }
.bh .md th, .bh .md td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--hg-border); }
.bh .md th { color: var(--hg-contrast); background: rgba(255,255,255,.03); font-weight: 600; }
.bh .md tr:last-child td { border-bottom: 0; }
.bh .md .mdnote.bh .md .mdnote { font-size: 12px; color: var(--hg-muted); border-top: 1px solid var(--hg-border); padding-top: 6px; }
.bh .orb-body { transform-box: view-box; transform-origin: 32px 34px; animation: bhOrb 5s ease-in-out infinite alternate; }
.bh .orb-look { animation: bhLook 8s ease-in-out infinite; }
.bh .orb-blink { transform-box: view-box; transform-origin: 32px 33px; animation: bhBlink 6s infinite; }
.bh .head .spacer { flex: 1; min-width: 0; }
.bh .head .btn { padding: 4px 10px; font-size: 13px; }
.bh .notice { flex: none; margin: 8px 16px 0; padding: 7px 12px; border: 1px solid var(--bh-border); border-radius: 10px; background: var(--bh-panel); font-size: 13px; }
.bh .notice[data-kind="error"] { border-color: var(--bh-bad); color: var(--bh-bad); }
.bh .notice[hidden] { display: none; }
.bh .acts { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 10px; margin-top: 2px; }
.bh .vote { display: inline-flex; align-items: center; gap: 2px; font-size: 12px; color: var(--bh-muted); }
.bh .vote button { border: 0; background: none; padding: 1px 5px; border-radius: 6px; cursor: pointer; color: var(--bh-muted); font-size: 12px; }
.bh .vote button:hover:not(:disabled) { background: var(--bh-raised); color: var(--bh-contrast); }
.bh .vote button[aria-pressed="true"] { color: var(--bh-contrast); background: var(--bh-raised); }
.bh .vote button:disabled { opacity: .5; cursor: default; }
.bh .vote output { min-width: 16px; text-align: center; color: var(--bh-text); }
.bh .linkbtn.danger { color: var(--bh-bad); }
.bh .replychip { display: flex; align-items: center; gap: 8px; margin: 0 4px 6px; padding: 4px 10px; border: 1px solid var(--bh-border); border-radius: 10px; font-size: 12px; color: var(--bh-muted); }
.bh .replychip[hidden] { display: none; }
.bh .sidebtns { display: flex; gap: 6px; padding: 8px 12px 0; }
.bh .sidebtns .btn { flex: 1; padding: 5px 8px; font-size: 13px; }
.bh .idchip { display: flex; align-items: center; gap: 10px; width: 100%; padding: 6px 8px; border: 1px solid var(--bh-border); border-radius: 12px; background: var(--bh-panel); cursor: pointer; text-align: left; }
.bh .idchip:hover { background: var(--bh-raised); }
.bh .idchip .t { min-width: 0; display: grid; }
.bh .idchip .t b { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bh .idchip .t small { color: var(--bh-muted); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bh .tag { font-size: 10px; padding: 0 5px; margin-left: 6px; border: 1px solid var(--bh-border); border-radius: 6px; color: var(--bh-muted); font-style: normal; }
.bh .dlgback { position: absolute; inset: 0; z-index: 30; display: grid; place-items: center; padding: 16px; background: rgba(0,0,0,.55); }
.bh .dlg { width: min(520px, 100%); max-height: 100%; overflow: auto; display: grid; gap: 12px; align-content: start; padding: 16px; border: 1px solid var(--bh-border); border-radius: 16px; background: var(--bh-bg); box-shadow: 0 12px 40px rgba(0,0,0,.5); }
.bh .dlghead { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.bh .dlghead h2 { margin: 0; font-size: 17px; font-weight: 600; color: var(--bh-contrast); }
.bh .dlgbody { display: grid; gap: 12px; }
.bh .dlg p { margin: 0; color: var(--bh-muted); font-size: 13px; }
.bh .fld { display: grid; gap: 4px; }
.bh .fld label, .bh .dlg legend { font-size: 12px; color: var(--bh-muted); }
.bh .fld input, .bh .fld textarea, .bh .dlg input.plain { border: 1px solid var(--bh-border); border-radius: 10px; background: var(--bh-panel); padding: 7px 10px; width: 100%; }
.bh .fld textarea { min-height: 84px; resize: vertical; }
.bh .fld textarea.mono, .bh .mono { font: 12px ui-monospace, SF Mono, Menlo, monospace; word-break: break-all; }
.bh .fld .hint, .bh .dlg .hint { font-size: 12px; color: var(--bh-muted); }
.bh .dlg .actions { display: flex; flex-wrap: wrap; gap: 8px; }
.bh .dlg .errtext { color: var(--bh-bad); font-size: 13px; }
.bh .dlg .oktext { color: var(--bh-ok); font-size: 13px; }
.bh .dlg .warn { padding: 8px 10px; border: 1px solid #f2b51d; border-radius: 10px; font-size: 13px; color: var(--bh-text); }
.bh .dlg fieldset { margin: 0; padding: 10px; display: grid; gap: 8px; border: 1px solid var(--bh-border); border-radius: 12px; }
.bh .dlg fieldset img { max-width: 100%; background: #fff; border-radius: 8px; justify-self: start; }
.bh .dlg .sep { border: 0; border-top: 1px solid var(--bh-border); margin: 0; }
.bh .dlg .idbox { display: flex; align-items: center; gap: 12px; padding: 10px; border: 1px solid var(--bh-border); border-radius: 12px; background: var(--bh-panel); }
.bh .dlg .idbox .t { min-width: 0; display: grid; gap: 2px; }
.bh .dlg .ownrow { display: grid; gap: 8px; padding: 10px; border: 1px solid var(--bh-border); border-radius: 12px; background: var(--bh-panel); }
.bh .dlg .ownrow .top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.bh .dlg .ownrow .top b { color: var(--bh-contrast); font-weight: 500; }
.bh .sidebtns { flex-wrap: wrap; }
.bh .sidebtns .btn { flex: 1 1 auto; white-space: nowrap; }
.bh .seedhead { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-right: 12px; }
.bh .seedhead .btn { padding: 2px 10px; font-size: 12px; }
.bh .seedrow { display: flex; align-items: center; gap: 12px; padding: 6px 12px; }
.bh .seedrow .t { min-width: 0; flex: 1; display: grid; }
.bh .seedrow .t b { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bh .seedrow .t small { color: var(--bh-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bh .seedrow .btn { padding: 3px 10px; font-size: 12px; }
.bh .btn.danger { color: var(--bh-bad); border-color: var(--bh-bad); background: transparent; }
.bh a.btn { display: inline-block; text-decoration: none; color: var(--bh-link); text-align: center; }
.bh .dlg.wide { width: min(720px, 100%); }
.bh .dlg .steps { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.bh .dlg .steps li { display: grid; gap: 2px; padding: 8px 10px; border: 1px solid var(--bh-border); border-radius: 10px; background: var(--bh-panel); }
.bh .dlg .steps li b { color: var(--bh-contrast); font-weight: 500; }
.bh .dlg .stepstatus { font-size: 12px; color: var(--bh-muted); word-break: break-word; }
.bh .dlg .stepstatus[data-kind="error"] { color: var(--bh-bad); }
.bh .dlg .opt { display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; }
.bh .dlg .opt input { width: auto; margin-top: 3px; }
.bh .dlg .opt span { display: grid; }
.bh .dlg .opt small { color: var(--bh-muted); }
.bh .dlg .check { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.bh .dlg select { border: 1px solid var(--bh-border); border-radius: 10px; background: var(--bh-panel); color: var(--bh-text); padding: 5px 8px; }
.bh .pill { display: inline-block; font-size: 11px; padding: 1px 8px; border: 1px solid var(--bh-border); border-radius: 999px; color: var(--bh-muted); white-space: nowrap; }
.bh .pill.role { border-color: var(--bh-link); color: var(--bh-link); }
.bh .pill.bad { border-color: var(--bh-bad); color: var(--bh-bad); }
.bh .pills { display: flex; gap: 6px; flex-wrap: wrap; }
.bh .dlg .attendee, .bh .dlg .invitees .mrow { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 6px 0; }
.bh .dlg .attendee .t, .bh .dlg .invitees .mrow .t { flex: 1; min-width: 140px; }
.bh .dlg .attendees { display: grid; }
.bh button:focus-visible, .bh input:focus-visible, .bh textarea:focus-visible { outline: 2px solid var(--bh-link); outline-offset: 1px; }
@keyframes bhOrb { 0% { transform: scale(1, 1) rotate(0deg); } 100% { transform: scale(1.05, .95) rotate(-3deg); } }
@keyframes bhLook { 0%, 38% { transform: translateX(0); } 46%, 66% { transform: translateX(3px); } 76%, 92% { transform: translateX(-3px); } 100% { transform: translateX(0); } }
@keyframes bhBlink { 0%, 91%, 100% { transform: scaleY(1); } 94% { transform: scaleY(.1); } }
@media (prefers-reduced-motion: reduce) { .bh .orb-body, .bh .orb-look, .bh .orb-blink { animation: none; } }
@media (max-width: 900px) { .bh .shell { grid-template-columns: 220px minmax(0, 1fr); } .bh .members { display: none; } }
@media (max-width: 600px) { .bh .shell { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); } .bh .side { border-right: 0; border-bottom: 1px solid var(--bh-border); max-height: 38vh; } }
/* Feed app sizing: 14px text, 12px meta, 16px gutters, 12px gaps, 32px avatars, 16px section titles. */
.bh { font-size: 14px; line-height: 20px; }
.bh small, .bh .sub, .bh .sectionlabel, .bh .sect { font-size: 12px; line-height: 16px; }
.bh h1, .bh .lhead h2, .bh .chead h2, .bh .mhead h2, .bh .brand h1 { font-size: 16px; line-height: 24px; font-weight: 600; }
.bh .lhead, .bh .chead, .bh .mhead, .bh .brand { padding-left: 16px; padding-right: 16px; }
.bh .msg { gap: 12px; }
.bh .thread, .bh .body { padding: 12px 16px; gap: 12px; }
.bh .composerwrap { padding: 8px 16px 14px; }
.bh .row { gap: 12px; padding-left: 12px; padding-right: 12px; }
.bh .avatar { width: 32px; height: 32px; }
/* Fewer rules: the rails separate from the page by tone, not by lines. */
.bh .side, .bh .members { border: 0; background: var(--bh-panel); }
.bh .sidefoot, .bh .head, .bh .dlg .sep { border: 0; }
/* Draggable column dividers. */
.colgrip { position: absolute; top: 0; bottom: 0; width: 11px; z-index: 6; cursor: col-resize; touch-action: none; outline: 0; }
.colgrip-left { transform: translateX(-50%); }
.colgrip-right { transform: translateX(50%); }
.colgrip::after { content: ""; position: absolute; top: 0; bottom: 0; left: 50%; width: 2px; margin-left: -1px; border-radius: 2px; background: transparent; transition: background .12s; }
.colgrip:hover::after, .colgrip:focus-visible::after, .colgrip.on::after { background: var(--oh-color-primary, #7c9dff); }
.gripping { user-select: none; cursor: col-resize; }
.gripping * { pointer-events: none; }
.gripping .colgrip { pointer-events: auto; }
@media (max-width: 720px) { .colgrip { display: none; } }
`;

function el(tag, cls, content) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (content !== undefined) node.textContent = content;
  return node;
}

function avatar(address, size) {
  const wrap = el("span", `avatar${size ? ` ${size}` : ""}`);
  wrap.append(orbFor(address));
  return wrap;
}

export function activate(host, options = {}) {
  if (host.apiVersion !== "1") throw new Error("Bitkin requires Canvas host API 1.");
  return host.registerPage("bitsocial-hangout", (ctx) => mount(ctx.container, options, (ctx && ctx.navigate) || host.navigate, host));
}

const IDENTITY_KEY = "bitsocial-hangout:identity:v1";
const GUEST = { name: "You", address: "you.eth" };
const errText = (err) => (err && err.message ? err.message : String(err || "Unknown error"));
const shortAddress = (a) => (a && a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || "");

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

function mount(container, options, navigateHost, canvasHost = null) {
  container.append(el("style", "", CSS));
  const root = el("div", "bh");
  container.append(root);
  let disposed = false;
  let idCounter = 0;
  const timers = new Set();
  const later = (fn, ms = 0) => { const t = setTimeout(() => { timers.delete(t); if (!disposed) fn(); }, ms); timers.add(t); return t; };

  const readJson = (key) => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } };
  const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } };
  const saved = readJson(STORAGE_KEY) || {};
  const savedIdentity = readJson(IDENTITY_KEY);
  const strings = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x) : null);

  const state = {
    url: typeof saved.url === "string" && saved.url ? saved.url : DEFAULT_RPC_URL,
    name: saved.name || GUEST.name,
    welcomed: Boolean(saved.welcomed),
    welcomeStyle: saved.welcomeStyle === "smooth" ? "smooth" : "voxel", // the community cloud: voxel by default
    view: saved.welcomed ? "chat" : "welcome", // welcome | chat | settings
    status: "demo", // demo | connecting | connected
    error: "",
    starting: false, // a node launch is in flight: the setup card shows progress meanwhile
    identity: savedIdentity && typeof savedIdentity.privateKey === "string" && typeof savedIdentity.address === "string" && typeof savedIdentity.publicKey === "string" ? savedIdentity : null,
    joined: strings(saved.joined) || [], // communities joined by address on a node
    joinedDemo: strings(saved.joinedDemo) || demoCommunities().map((c) => c.address), // joined demo communities
    votes: isObject(saved.votes) ? saved.votes : {}, // comment cid -> 1 | -1 (this browser's own votes)
    activated: isObject(saved.activated) ? saved.activated : {}, // seed id -> address of the community created on the node
    spaces: strings(saved.spaces) || [], // addresses of spaces made with "New space" on the node
    ownAddresses: [], // communities hosted by the connected node
    pool: [...demoCommunities(), ...demoDirectory()], // all demo communities, in memory only
    selected: "",
    thread: "",
    replyTo: null,
    composerError: "",
  };
  const persist = () => writeJson(STORAGE_KEY, { url: state.url, name: state.name, welcomed: state.welcomed, welcomeStyle: state.welcomeStyle, joined: state.joined, joinedDemo: state.joinedDemo, votes: state.votes, activated: state.activated, spaces: state.spaces });
  const persistIdentity = () => { try { if (state.identity) localStorage.setItem(IDENTITY_KEY, JSON.stringify(state.identity)); else localStorage.removeItem(IDENTITY_KEY); } catch { /* storage unavailable */ } };

  let client = null;
  let api = null;
  let listWatch = null;
  let communityWatch = null;
  const known = new Map(); // address -> community object while connected

  const isConnected = () => state.status === "connected" && Boolean(api);
  function connectedList() {
    const seen = new Set();
    const out = [];
    [...state.ownAddresses, ...state.joined].forEach((address) => {
      if (seen.has(address)) return;
      seen.add(address);
      let c = known.get(address);
      if (!c) { c = { address, title: address, description: "", posts: [], loaded: false }; known.set(address, c); }
      c.owned = state.ownAddresses.includes(address);
      out.push(c);
    });
    return out;
  }
  const demoList = () => state.pool.filter((c) => c.owned || state.joinedDemo.includes(c.address));
  const communities = () => (state.status === "connected" ? connectedList() : demoList());
  const community = () => communities().find((c) => c.address === state.selected);
  const post = () => { const c = community(); return c && c.posts.find((p) => p.cid === state.thread); };
  /** Keeps the selection on a community that exists; true when it had to move. */
  function ensureSelected() {
    const list = communities();
    if (list.some((c) => c.address === state.selected)) return false;
    state.selected = list[0] ? list[0].address : "";
    state.thread = "";
    state.replyTo = null;
    return true;
  }
  ensureSelected();

  const authorName = () => state.name || GUEST.name;
  const me = () => ({ address: state.identity ? state.identity.address : GUEST.address, name: authorName() });
  const isMine = (m) => Boolean(m.mine) || Boolean(state.identity && m.author && m.author.address === state.identity.address);

  // ─── connection ───────────────────────────────────────────────────────────────────────
  async function stopLive() {
    const watches = [listWatch, communityWatch].filter(Boolean);
    listWatch = null; communityWatch = null;
    await Promise.all(watches.map((w) => w.stop().catch(() => {})));
    if (client) { client.close(); client = null; api = null; }
  }

  function useDemo(error = "") {
    state.status = "demo";
    state.error = error;
    state.ownAddresses = [];
    state.thread = "";
    state.replyTo = null;
    ensureSelected();
  }

  async function connect(url, manual = false) {
    state.url = url.trim() || DEFAULT_RPC_URL;
    persist();
    await stopLive();
    state.status = "connecting";
    state.error = "";
    renderChrome();
    try {
      client = createRpcClient(state.url, options.socketFactory ? { socketFactory: options.socketFactory } : {});
      api = createBitsocialApi(client);
      await client.connect();
      state.status = "connected";
      state.thread = "";
      state.replyTo = null;
      state.ownAddresses = [];
      known.clear();
      listWatch = await api.watchCommunityList((addresses) => {
        if (disposed) return;
        state.ownAddresses = addresses;
        if (ensureSelected()) watchSelected();
        render();
      });
      client.onState((s) => { if (s === "closed" && state.status === "connected" && !disposed) { useDemo("The node closed the connection. Showing demo data."); render(); } });
    } catch (err) {
      await stopLive();
      useDemo(err && err.message ? err.message : "Could not reach the node.");
      if (manual) state.view = "settings";
    }
    if (state.status === "connected") { state.view = "chat"; ensureSelected(); watchSelected(); }
    render();
  }

  // ─── starting a node ────────────────────────────────────────────────────────────────────
  // The RPC endpoint is a local daemon, so "no node" is a setup step, not an error state:
  // the settings card shows the two commands and a button that asks the host to run the
  // daemon (the same Canvas path Meet uses for its meeting server) and then polls the socket.
  const NODE_INSTALL = "npm install -g @bitsocial/bitsocial-cli";
  const NODE_COMMAND = "bitsocial daemon";
  const NODE_DOCS = "https://docs.bitsocial.net/developer-tools/cli";
  const NODE_BOOT_ATTEMPTS = 10;
  const NODE_BOOT_DELAY_MS = 2000;

  const hostCanRunCommands = () => Boolean(canvasHost && canvasHost.agentServer && canvasHost.agentServer.request);

  /** Launch the daemon through the host, then keep reconnecting while it boots. */
  async function startNode(url) {
    if (state.starting || !hostCanRunCommands()) return;
    state.starting = true;
    state.error = "";
    state.view = "settings";
    render();
    try {
      await canvasHost.agentServer.request({
        method: "POST",
        path: "/api/bash/start_bash_command",
        body: { command: NODE_COMMAND },
      });
    } catch (err) {
      state.starting = false;
      state.error = `Could not start the node: ${describeError(err)}`;
      render();
      return;
    }
    for (let i = 0; i < NODE_BOOT_ATTEMPTS && !disposed && state.status !== "connected"; i += 1) {
      await new Promise((resolve) => later(resolve, NODE_BOOT_DELAY_MS));
      if (disposed || state.status === "connected") break;
      await connect(url);
    }
    const connected = state.status === "connected";
    state.starting = false;
    if (!connected) {
      state.view = "settings";
      state.error = `Ran “${NODE_COMMAND}”, but ${url} still refuses. If the CLI is not installed yet, run the install command in step 1.`;
    }
    render();
  }

  async function watchSelected() {
    if (communityWatch) { await communityWatch.stop().catch(() => {}); communityWatch = null; }
    const c = community();
    if (!api || state.status !== "connected" || !c) return;
    try {
      communityWatch = await api.watchCommunity(c.address, (sub) => {
        if (disposed || !hasCommunityData(sub)) return;
        c.title = (sub && sub.title) || c.address;
        c.challenges = sub.challenges;
        c.settings = isObject(sub.settings) ? sub.settings : undefined; // only a node's own communities report these
        c.roles = isObject(sub.roles) ? sub.roles : {};
        c.rules = Array.isArray(sub.rules) ? sub.rules : [];
        c.description = (sub && sub.description) || "";
        const fetched = postsFromCommunity(sub);
        const pendingLocal = c.posts.filter((p) => p.pending || p.failed);
        c.posts = [...fetched, ...pendingLocal];
        c.loaded = true;
        render();
      }, (e) => { state.error = `Community ${c.address}: ${describeError(e)}`; render(); });
    } catch (err) {
      state.error = err && err.message ? err.message : String(err);
      render();
    }
  }

  async function loadReplies(p) {
    const c = community();
    if (!p || p.replies || !c) return;
    p.replies = repliesFromRaw(p.repliesRaw);
    render();
    if (!p.replies.length && p.replyCount && api && p.repliesRaw && p.repliesRaw.pageCids) {
      const cid = Object.values(p.repliesRaw.pageCids)[0];
      try {
        const page = await api.getCommentPage(c.address, p.cid, cid);
        p.replies = (page.comments || []).map((e) => ({ ...normalizeEntry(e), depth: 0 })).sort((a, b) => a.timestamp - b.timestamp);
      } catch (err) { state.error = `Could not load replies: ${describeError(err)}`; }
      render();
    }
  }

  // ─── dialogs ──────────────────────────────────────────────────────────────────────────
  const dialogs = [];
  function openDialog(title, build, opts = {}) {
    const opener = document.activeElement;
    const back = el("div", "dlgback");
    const dlg = el("div", "dlg");
    const titleId = `bh-d-${++idCounter}`;
    dlg.setAttribute("role", "dialog");
    dlg.setAttribute("aria-modal", "true");
    dlg.setAttribute("aria-labelledby", titleId);
    const dh = el("div", "dlghead");
    const h = el("h2", "", title);
    h.id = titleId;
    const x = el("button", "btn", "×");
    x.type = "button";
    x.setAttribute("aria-label", "Close dialog");
    dh.append(h, x);
    const dbody = el("div", "dlgbody");
    dlg.append(dh, dbody);
    back.append(dlg);
    let closed = false;
    const handle = { body: dbody, element: dlg, close: () => {} };
    handle.close = () => {
      if (closed) return;
      closed = true;
      const i = dialogs.indexOf(handle);
      if (i >= 0) dialogs.splice(i, 1);
      back.remove();
      if (opts.onClose) opts.onClose();
      if (opener && opener.focus && document.contains(opener)) opener.focus();
    };
    x.addEventListener("click", handle.close);
    if (!opts.sticky) back.addEventListener("mousedown", (e) => { if (e.target === back) handle.close(); });
    dlg.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.stopPropagation(); handle.close(); return; }
      if (e.key !== "Tab") return;
      const f = [...dlg.querySelectorAll('button:not([disabled]), input:not([disabled]):not([hidden]), textarea:not([disabled]), a[href]')].filter((n) => !n.closest("[hidden]"));
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    dialogs.push(handle);
    root.append(back);
    build(handle);
    const focusTarget = (opts.focus && dbody.querySelector(opts.focus)) || dbody.querySelector("input:not([hidden]), textarea, button");
    if (focusTarget) focusTarget.focus();
    return handle;
  }

  let fieldCounter = 0;
  function field(labelText, control, hint) {
    const wrap = el("div", "fld");
    control.id = `bh-f-${++fieldCounter}`;
    const l = el("label", "", labelText);
    l.htmlFor = control.id;
    wrap.append(l, control);
    if (hint) wrap.append(el("div", "hint", hint));
    return wrap;
  }
  function textInput(value = "", placeholder = "") {
    const i = el("input");
    i.type = "text";
    i.value = value;
    i.placeholder = placeholder;
    i.autocomplete = "off";
    i.spellcheck = false;
    return i;
  }
  function textBox(value = "", rows = 4) {
    const t = el("textarea");
    t.rows = rows;
    t.value = value;
    return t;
  }
  function button(label, cls = "btn") {
    const b = el("button", cls, label);
    b.type = "button";
    return b;
  }
  /** A pair of live regions for a form: an error line (role alert) and a success line (role status). */
  function messages() {
    const err = el("div", "errtext");
    err.setAttribute("role", "alert");
    const ok = el("div", "oktext");
    ok.setAttribute("role", "status");
    return {
      err, ok,
      error: (text) => { ok.textContent = ""; err.textContent = text; },
      success: (text) => { err.textContent = ""; ok.textContent = text; },
      clear: () => { err.textContent = ""; ok.textContent = ""; },
    };
  }
  async function withBusy(btn, busyLabel, fn) {
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = busyLabel;
    btn.setAttribute("aria-busy", "true");
    try { return await fn(); } finally { btn.disabled = false; btn.textContent = label; btn.removeAttribute("aria-busy"); }
  }

  // A short message above the thread for outcomes that have no form of their own.
  const noticeEl = el("div", "notice");
  noticeEl.hidden = true;
  let noticeTimer = null;
  function flash(text, kind = "info") {
    clearTimeout(noticeTimer);
    noticeEl.hidden = !text;
    noticeEl.textContent = text;
    noticeEl.dataset.kind = kind;
    noticeEl.setAttribute("role", kind === "error" ? "alert" : "status");
    if (text) noticeTimer = setTimeout(() => { noticeEl.hidden = true; noticeEl.textContent = ""; }, 9000);
  }

  // ─── identity ─────────────────────────────────────────────────────────────────────────
  let cryptoSupported = null;
  async function cryptoOk() {
    if (cryptoSupported === null) cryptoSupported = await ed25519Supported();
    return cryptoSupported;
  }
  function setIdentity(identity) {
    state.identity = identity;
    persistIdentity();
    render();
  }

  function openIdentityDialog() {
    return openDialog("Your identity", (dlg) => {
      let revealed = false;
      let armed = ""; // "replace" | "remove": the second click confirms
      const status = messages();
      const draw = () => {
        dlg.body.replaceChildren();
        const id = state.identity;
        const support = el("div", "warn", NO_ED25519_TEXT);
        support.hidden = true;
        support.setAttribute("role", "alert");
        cryptoOk().then((ok) => { support.hidden = ok; });
        dlg.body.append(support);
        dlg.body.append(el("p", "", "Your identity is a key pair that signs everything you publish. The private key stays in this browser (localStorage). It is never sent to the node: only the signed post is. Export it to use the same identity elsewhere."));

        if (id) {
          const box = el("div", "idbox");
          box.append(avatar(id.address, "sm"));
          const t = el("div", "t");
          t.append(el("b", "", authorName()), el("span", "mono", id.address));
          box.append(t);
          dlg.body.append(box);
        } else {
          dlg.body.append(el("div", "hint", "No identity yet. Create one to publish in Connected mode. Demo mode works without."));
        }

        const nameInput = textInput(state.name === GUEST.name ? "" : state.name, "Display name (optional)");
        const saveName = button("Save name");
        saveName.addEventListener("click", () => { state.name = nameInput.value.trim() || GUEST.name; persist(); render(); status.success("Display name saved. It is signed into new posts."); });
        const nameRow = el("div", "actions");
        nameRow.append(saveName);
        dlg.body.append(field("Display name", nameInput, "Shown next to your posts. Part of what you sign."), nameRow);

        const gen = button(id ? "Generate a new identity" : "Create identity", id ? "btn" : "btn primary");
        gen.addEventListener("click", async () => {
          if (id && armed !== "replace") { armed = "replace"; gen.textContent = "Replace? Export first. Click again"; return; }
          armed = "";
          await withBusy(gen, "Generating…", async () => {
            try { setIdentity(await generateIdentity()); revealed = false; draw(); } catch (err) { status.error(errText(err)); }
          });
        });
        const genRow = el("div", "actions");
        genRow.append(gen);
        dlg.body.append(el("hr", "sep"), genRow);

        const importBox = textBox("", 2);
        importBox.className = "mono";
        importBox.setAttribute("autocomplete", "off");
        const importBtn = button("Import identity");
        importBtn.addEventListener("click", () => withBusy(importBtn, "Importing…", async () => {
          try {
            const identity = await identityFromPrivateKey(extractPrivateKey(importBox.value));
            setIdentity(identity);
            revealed = false;
            draw();
            status.success(`Imported identity ${identity.address}.`);
          } catch (err) { status.error(errText(err)); }
        }));
        const impRow = el("div", "actions");
        impRow.append(importBtn);
        dlg.body.append(field("Import a private key", importBox, "Paste the base64 private key, or an exported account JSON with signer.privateKey."), impRow);

        if (id) {
          const reveal = button(revealed ? "Hide private key" : "Show private key to export");
          reveal.addEventListener("click", () => { revealed = !revealed; draw(); });
          const exportRow = el("div", "actions");
          exportRow.append(reveal);
          if (revealed) {
            const keyBox = textBox(id.privateKey, 2);
            keyBox.readOnly = true;
            keyBox.className = "mono";
            const copy = button("Copy private key");
            copy.addEventListener("click", async () => {
              try { await navigator.clipboard.writeText(id.privateKey); status.success("Private key copied. Keep it secret."); } catch { keyBox.select(); status.error("Could not copy automatically. The key is selected, copy it manually."); }
            });
            exportRow.append(copy);
            dlg.body.append(el("hr", "sep"), field("Private key (secret)", keyBox, "Anyone with this key can post as you. Store it in a password manager."), exportRow);
          } else dlg.body.append(el("hr", "sep"), exportRow);
          const remove = button("Remove identity from this browser", "btn");
          remove.addEventListener("click", () => {
            if (armed !== "remove") { armed = "remove"; remove.textContent = "Removes the key. Export first. Click again"; return; }
            armed = "";
            setIdentity(null);
            draw();
          });
          const rmRow = el("div", "actions");
          rmRow.append(remove);
          dlg.body.append(rmRow);
        }
        dlg.body.append(status.err, status.ok);
      };
      draw();
    });
  }

  // ─── publishing: sign, hand to the node (or the demo), handle challenges ───────────────
  const needIdentity = () => { const e = new Error("Create or import an identity first: everything you publish is signed with it."); e.needsIdentity = true; return e; };

  async function buildPublication(kind, fields) {
    const author = state.name && state.name !== GUEST.name ? { displayName: state.name } : {};
    if (state.identity) {
      if (!(await cryptoOk())) throw new Error(NO_ED25519_TEXT);
      return signPublication(kind, { ...fields, author }, state.identity);
    }
    if (state.status === "connected") throw needIdentity();
    // Demo mode without an identity: a guest, unsigned (the demo accepts it).
    return { ...fields, author: { address: GUEST.address, ...author }, protocolVersion: PROTOCOL_VERSION, timestamp: Math.floor(Date.now() / 1000) };
  }

  // Demo backend: the same event sequence a node produces, in memory.
  let demoSeq = 0;
  const demoPending = new Map();
  /** Why the demo community would turn this author away (ban, lock, invite-only), or "". Mirrors the node's behaviour. */
  function demoDenied(c, pub) {
    if (!c) return "";
    const address = pub && pub.author ? pub.author.address : "";
    const role = c.roles && c.roles[address] ? c.roles[address].role : "";
    const staff = STAFF_ROLES.includes(role);
    const banned = c.bans && c.bans[address];
    if (banned && banned > Math.floor(Date.now() / 1000)) return "Author is banned";
    const access = readAccess(c.settings && c.settings.challenges);
    if (access.locked && !staff) return LOCK_MESSAGE;
    if (access.private && !staff && !access.allow.includes(address)) return INVITE_ONLY_MESSAGE;
    return "";
  }
  const demoBackend = {
    async publish(kind, pub, onEvent) {
      const id = ++demoSeq;
      const c = state.pool.find((x) => x.address === pub.subplebbitAddress);
      const denied = kind === "comment" ? demoDenied(c, pub) : "";
      const challenge = !denied && kind === "comment" && c && c.challenge ? c.challenge : null;
      demoPending.set(id, { onEvent, challenge });
      if (denied) { later(() => onEvent("challengeverification", { challengeSuccess: false, reason: denied })); return { id, stop: async () => { demoPending.delete(id); } }; }
      const success = () => onEvent("challengeverification", { challengeSuccess: true, commentUpdate: kind === "comment" ? { cid: `demo-${id}` } : undefined });
      later(() => { if (challenge) onEvent("challenge", { challenges: [{ challenge: challenge.question, type: "text/plain" }] }); else success(); });
      return { id, stop: async () => { demoPending.delete(id); } };
    },
    async answer(sub, answers) {
      const entry = demoPending.get(sub.id);
      if (!entry) throw new Error("This publication is no longer waiting for an answer.");
      later(() => {
        const ok = String(answers[0] || "").trim().toLowerCase() === entry.challenge.answer;
        entry.onEvent("challengeverification", ok ? { challengeSuccess: true, commentUpdate: { cid: `demo-${sub.id}` } } : { challengeSuccess: false, reason: "The answer was wrong.", challengeErrors: { 0: "Wrong answer." } });
      });
    },
  };
  const rpcBackend = {
    publish: (kind, pub, onEvent) => api.publish(kind, pub, onEvent),
    answer: (sub, answers) => api.answerChallenge(sub.id, answers),
  };
  const backend = () => (state.status === "connected" && api ? rpcBackend : demoBackend);

  /** The dialog a community's challenge is answered in. Returns a handle to show the result. */
  function openChallengeDialog({ what, address, challenges, onSubmit, onCancel }) {
    let settled = false;
    let controller = null;
    const dlg = openDialog("Challenge", (d) => {
      const msg = messages();
      d.body.append(el("p", "", `# ${address} asks you to answer ${challenges.length === 1 ? "a challenge" : `${challenges.length} challenges`} before your ${what} is published.`));
      const inputs = challenges.map((ch, i) => {
        const set = el("fieldset");
        set.append(el("legend", "", `Challenge ${i + 1}${ch.type && ch.type !== "text/plain" ? ` (${ch.type})` : ""}`));
        if (/^image\//.test(ch.type || "") && /^[A-Za-z0-9+/=]+$/.test(ch.challenge || "")) {
          const img = el("img");
          img.src = `data:${ch.type};base64,${ch.challenge}`;
          img.alt = "Challenge image: type the text you see";
          set.append(img);
        } else {
          set.append(el("p", "", ch.challenge || ""));
          if (ch.type && ch.type !== "text/plain" && !/^image\//.test(ch.type)) set.append(el("div", "hint", "This challenge type is not interactive here. Answer as the community describes."));
        }
        const input = textInput("", "Your answer");
        input.setAttribute("aria-label", `Answer to challenge ${i + 1}`);
        set.append(input);
        d.body.append(set);
        return input;
      });
      const submit = button("Send answer", "btn primary");
      const cancel = button("Cancel");
      const actions = el("div", "actions");
      actions.append(submit, cancel);
      d.body.append(actions, msg.err, msg.ok);
      let sent = false;
      const submitAnswers = async () => {
        if (sent || settled) return;
        const answers = inputs.map((i) => i.value.trim());
        if (answers.some((a) => !a)) { msg.error("Answer every challenge."); return; }
        await withBusy(submit, "Sending…", async () => {
          try { await onSubmit(answers); sent = true; } catch (err) { msg.error(`Could not send the answer: ${errText(err)}`); }
        });
        if (sent && !settled) {
          inputs.forEach((i) => { i.disabled = true; });
          submit.disabled = true;
          msg.success("Answer sent. Waiting for the community to verify it…");
        }
      };
      submit.addEventListener("click", submitAnswers);
      d.body.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); submitAnswers(); } });
      cancel.addEventListener("click", () => d.close());
      controller = {
        result(ok, text) {
          settled = true;
          msg.clear();
          if (ok) msg.success(text); else msg.error(text);
          inputs.forEach((i) => { i.disabled = true; });
          submit.hidden = true;
          cancel.textContent = "Close";
          cancel.focus();
        },
      };
    }, { sticky: true, onClose: () => { if (!settled) { settled = true; onCancel(); } } });
    return { result: (ok, text) => controller.result(ok, text), close: dlg.close };
  }

  /**
   * Signs `fields` as a `kind` publication and publishes it. Resolves (never rejects) to
   * {ok, reason, cid} after the community verified it or it failed. Challenges open a dialog.
   */
  function runPublish({ kind, fields, what, address, onNote, onSigned }) {
    return new Promise((resolve) => {
      let pub;
      let subPromise = null;
      let finished = false;
      let dialog = null;
      const finish = (res) => {
        if (finished) return;
        finished = true;
        if (dialog) dialog.result(res.ok, res.ok ? `Accepted. Your ${what} is published.` : `Rejected${res.reason ? `: ${res.reason}` : "."}`);
        if (subPromise) subPromise.then((s) => s && s.stop()).catch(() => {});
        resolve(res);
      };
      const onEvent = (event, result) => {
        if (disposed || finished) return;
        if (event === "challenge") {
          const challenges = (result && result.challenges) || [];
          if (onNote) onNote("Waiting for your challenge answer…");
          dialog = openChallengeDialog({
            what, address, challenges,
            onSubmit: async (answers) => backend().answer(await subPromise, answers),
            onCancel: () => finish({ ok: false, reason: "The challenge was not answered." }),
          });
        } else if (event === "challengeverification") {
          const ok = !result || result.challengeSuccess !== false;
          const errors = result && result.challengeErrors ? Object.values(result.challengeErrors).join(" ") : "";
          finish({ ok, reason: ok ? "" : explainPublishError([result && result.reason, errors].filter(Boolean).join(" ")) || "The community rejected it.", cid: result && result.commentUpdate ? result.commentUpdate.cid : "" });
        } else if (event === "error") {
          finish({ ok: false, reason: explainPublishError(describeError(result)) });
        }
      };
      buildPublication(kind, fields).then((built) => {
        pub = built;
        if (onSigned) onSigned(true);
        try { subPromise = Promise.resolve(backend().publish(kind, pub, onEvent)); } catch (err) { subPromise = Promise.reject(err); }
        subPromise.catch((err) => finish({ ok: false, reason: `Your node did not accept it: ${explainPublishError(errText(err))}` }));
      }).catch((err) => {
        if (onSigned) onSigned(false);
        if (err && err.needsIdentity) openIdentityDialog();
        finish({ ok: false, reason: errText(err) });
      });
    });
  }

  // ─── sending posts and replies ────────────────────────────────────────────────────────
  function send({ content, title, link }) {
    const c = community();
    if (!c) { state.composerError = "Pick a community first."; return Promise.resolve(false); }
    const root = post();
    const isReply = Boolean(root);
    const parent = isReply ? state.replyTo || root : null;
    if (parent && String(parent.cid).startsWith("local-")) { state.composerError = "Wait until that message is published before replying to it."; return Promise.resolve(false); }
    if (state.status === "connected" && !state.identity) { state.composerError = "Create or import an identity to publish."; openIdentityDialog(); return Promise.resolve(false); }
    const msg = { cid: `local-${Date.now()}-${++idCounter}`, author: me(), title: isReply ? "" : title.trim(), content: content.trim(), link: isReply ? "" : link.trim(), timestamp: Date.now(), replyCount: 0, upvotes: 0, downvotes: 0, pinned: false, replies: isReply ? null : [], depth: isReply && parent !== root ? Math.min((parent.depth || 0) + 1, 4) : 0, pending: true, mine: true };
    if (isReply) { root.replies = root.replies || []; root.replies.push(msg); root.replyCount = root.replies.length; } else c.posts.push(msg);
    state.composerError = "";
    state.replyTo = null;
    render();
    const fields = { subplebbitAddress: c.address, content: msg.content || undefined, title: msg.title || undefined, link: msg.link || undefined };
    if (isReply) { fields.parentCid = parent.cid; fields.postCid = root.cid; }
    return runPublish({
      kind: "comment", fields, what: isReply ? "reply" : "post", address: c.address,
      onNote: (text) => { msg.note = text; render(); },
      onSigned: (ok) => setSendBusy(false, ok),
    }).then((res) => {
      msg.pending = false;
      if (res.ok) { msg.note = ""; if (res.cid) msg.cid = res.cid; } else { msg.failed = true; msg.note = res.reason; }
      render();
      return res.ok;
    });
  }

  // ─── votes, edits, deletes ────────────────────────────────────────────────────────────
  function applyVote(m, from, to) {
    if (from === 1) m.upvotes = Math.max(0, (m.upvotes || 0) - 1);
    if (from === -1) m.downvotes = Math.max(0, (m.downvotes || 0) - 1);
    if (to === 1) m.upvotes = (m.upvotes || 0) + 1;
    if (to === -1) m.downvotes = (m.downvotes || 0) + 1;
    if (to === 0) delete state.votes[m.cid]; else state.votes[m.cid] = to;
    persist();
  }
  async function vote(m, direction) {
    const c = community();
    if (!c || m.voting) return;
    if (!m.cid || String(m.cid).startsWith("local-")) { flash("Wait until it is published before voting.", "error"); return; }
    if (state.status === "connected" && !state.identity) { flash("Create or import an identity to vote.", "error"); openIdentityDialog(); return; }
    const prev = state.votes[m.cid] || 0;
    const next = prev === direction ? 0 : direction;
    m.voting = true;
    applyVote(m, prev, next);
    render();
    const res = await runPublish({ kind: "vote", fields: { subplebbitAddress: c.address, commentCid: m.cid, vote: next }, what: "vote", address: c.address });
    m.voting = false;
    if (!res.ok) { applyVote(m, next, prev); flash(`Your vote was not accepted: ${res.reason}`, "error"); }
    render();
  }

  function openEditDialog(m) {
    const c = community();
    if (!c) return;
    openDialog("Edit your post", (dlg) => {
      const box = textBox(m.content || "", 6);
      const save = button("Save edit", "btn primary");
      const cancel = button("Cancel");
      const msg = messages();
      const actions = el("div", "actions");
      actions.append(save, cancel);
      dlg.body.append(field("Text (markdown)", box, "Only the text can be edited. The community shows your latest edit."), actions, msg.err, msg.ok);
      cancel.addEventListener("click", dlg.close);
      save.addEventListener("click", () => withBusy(save, "Saving…", async () => {
        const content = box.value;
        if (!content.trim()) { msg.error("The text can't be empty. Use Delete to remove the post."); return; }
        if (content === m.content) { msg.error("Nothing changed."); return; }
        msg.clear();
        box.disabled = true;
        const res = await runPublish({ kind: "commentEdit", fields: { subplebbitAddress: c.address, commentCid: m.cid, content }, what: "edit", address: c.address });
        box.disabled = false;
        if (res.ok) { m.content = content; m.note = "Edited"; dlg.close(); flash("Edit published.", "info"); render(); } else msg.error(`The edit was not accepted: ${res.reason}`);
      }));
    }, { focus: "textarea" });
  }

  function openDeleteDialog(m) {
    const c = community();
    if (!c) return;
    openDialog("Delete this post?", (dlg) => {
      const yes = button("Delete", "btn primary");
      const no = button("Keep it");
      const msg = messages();
      const actions = el("div", "actions");
      actions.append(yes, no);
      dlg.body.append(el("p", "", "This publishes a signed delete. Peers may keep copies, but the community will show it as deleted."), actions, msg.err);
      no.addEventListener("click", dlg.close);
      yes.addEventListener("click", () => withBusy(yes, "Deleting…", async () => {
        const res = await runPublish({ kind: "commentEdit", fields: { subplebbitAddress: c.address, commentCid: m.cid, deleted: true }, what: "delete", address: c.address });
        if (res.ok) { m.deleted = true; m.content = "_[deleted]_"; m.link = ""; dlg.close(); flash("Deleted.", "info"); render(); } else msg.error(`The delete was not accepted: ${res.reason}`);
      }));
    }, { focus: "button.btn:not(.primary)" });
  }

  // ─── communities: create, edit, start, join, leave ───────────────────────────────────
  async function opCreateCommunity({ title, description, domain }) {
    if (isConnected()) {
      const options = {};
      if (title) options.title = title;
      if (description) options.description = description;
      const created = await api.createCommunity(options);
      const address = created && created.address;
      if (!address) throw new Error("The node did not return an address for the new community.");
      const started = await api.startCommunity(address);
      await started.stop(); // the node keeps the community running; only the event stream ends
      let finalAddress = address;
      let warning = "";
      if (domain) {
        try { await api.editCommunity(address, { address: domain }); finalAddress = domain; } catch (err) { warning = `The community runs as ${address}, but setting ${domain} failed: ${errText(err)}. Point the domain's DNS TXT record for the community address at it, then edit the address again.`; }
      }
      state.ownAddresses = [...state.ownAddresses.filter((a) => a !== address), finalAddress];
      known.set(finalAddress, { address: finalAddress, title: title || finalAddress, description: description || "", posts: [], loaded: true, owned: true });
      return { address: finalAddress, warning };
    }
    const address = domain || `12D3KooWdemo${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    state.pool.push({ address, title: title || address, description: description || "", posts: [], owned: true, started: true });
    return { address, warning: "" };
  }
  /** Removes the community's spam challenges so any identity can post (an owner-only node setting). */
  async function opAllowAnyonePost(address) {
    if (isConnected()) {
      await api.editCommunity(address, { settings: { challenges: [] } });
      const c = known.get(address);
      if (c) c.challenges = [];
      return;
    }
    const c = state.pool.find((x) => x.address === address);
    if (!c) throw new Error("That community no longer exists.");
    delete c.challenge;
    c.challenges = [];
  }
  async function opEditCommunity(address, props) {
    if (isConnected()) {
      await api.editCommunity(address, props);
      const c = known.get(address);
      if (c) { if ("title" in props) c.title = props.title || address; if ("description" in props) c.description = props.description || ""; }
      return;
    }
    const c = state.pool.find((x) => x.address === address);
    if (!c) throw new Error("That community no longer exists.");
    if ("title" in props) c.title = props.title || address;
    if ("description" in props) c.description = props.description || "";
  }
  async function opStartCommunity(address) {
    if (isConnected()) { const s = await api.startCommunity(address); await s.stop(); return; }
    const c = state.pool.find((x) => x.address === address);
    if (c) c.started = true;
  }
  /** Checks the community can be reached, then remembers it. Throws a readable error otherwise. */
  async function opJoin(input, onProgress) {
    const v = validateCommunityAddress(input);
    if (!v.ok) throw new Error(v.error);
    const address = v.address;
    if (communities().some((c) => c.address === address)) throw new Error(`You already have ${address}.`);
    if (isConnected()) {
      const timeoutMs = options.joinTimeoutMs || 15000;
      const sub = await new Promise((resolve, reject) => {
        let done = false;
        let watch = null;
        let lastError = "";
        let sawEmpty = false;
        const end = (err, value) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          if (watch) watch.stop().catch(() => {});
          if (err) reject(err); else resolve(value);
        };
        const timer = setTimeout(() => end(new Error(sawEmpty ? `Found ${address}, but its data did not arrive in time. Its owner may be offline; try again later.` : `Could not reach ${address}${lastError ? ` (${lastError})` : ""}. Check the address and that its owner is online.`)), timeoutMs);
        api.watchCommunity(address, (update) => { if (hasCommunityData(update)) end(null, update); else { sawEmpty = true; if (onProgress) onProgress("Loading community…"); } }, (e) => { lastError = describeError(e); }).then((w) => { watch = w; if (done) w.stop().catch(() => {}); }, (e) => end(new Error(errText(e))));
      });
      known.set(address, { address, title: sub.title || address, description: sub.description || "", posts: postsFromCommunity(sub), loaded: true, owned: false, challenges: sub.challenges });
      state.joined = [...state.joined, address];
    } else {
      const c = state.pool.find((x) => x.address === address);
      if (!c) throw new Error(`Can't reach ${address} in demo mode. Try music.eth or devs.eth, or connect a node to join real communities.`);
      state.joinedDemo = [...state.joinedDemo, address];
    }
    persist();
    return address;
  }
  function opLeave(address) {
    if (isConnected()) state.joined = state.joined.filter((a) => a !== address); else state.joinedDemo = state.joinedDemo.filter((a) => a !== address);
    persist();
  }
  function selectCommunity(address) {
    state.view = "chat"; state.selected = address; state.thread = ""; state.replyTo = null; state.welcomed = true; persist();
    watchSelected();
    render();
  }

  function openJoinDialog() {
    openDialog("Join a community", (dlg) => {
      const input = textInput("", "music.eth or 12D3KooW…");
      const join = button("Join", "btn primary");
      const cancel = button("Cancel");
      const msg = messages();
      const actions = el("div", "actions");
      actions.append(join, cancel);
      dlg.body.append(field("Community address", input, isConnected() ? "A name like music.eth, or the peer id of the community. Ask its owner to copy the address for you. Your node must be able to find it." : "Demo mode: try music.eth or devs.eth."), actions, msg.err, msg.ok);
      cancel.addEventListener("click", dlg.close);
      const run = () => withBusy(join, "Looking it up…", async () => {
        msg.clear();
        input.disabled = true;
        try {
          const address = await opJoin(input.value, (text) => { join.textContent = text; });
          dlg.close();
          selectCommunity(address);
          flash(`Joined ${address}.`);
        } catch (err) { msg.error(errText(err)); } finally { input.disabled = false; }
      });
      join.addEventListener("click", run);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); if (!join.disabled) run(); } });
    });
  }

  function openCreateCommunityDialog() {
    openDialog("Create a community", (dlg) => {
      const title = textInput("", "Community title");
      const description = textBox("", 3);
      const domain = textInput("", "optional, like mycommunity.eth");
      const create = button("Create and start", "btn primary");
      const cancel = button("Cancel");
      const msg = messages();
      const actions = el("div", "actions");
      actions.append(create, cancel);
      dlg.body.append(
        el("p", "", isConnected() ? "The community is created on your node and started. It gets a permanent peer-id address; you can point a name at it." : "Demo mode: the community lives in memory until you reload."),
        field("Title", title), field("Description", description),
        field("Name address (optional)", domain, "A name you own, like mycommunity.eth. Its DNS TXT record must point at the community, otherwise keep the peer-id address."),
        actions, msg.err, msg.ok,
      );
      cancel.addEventListener("click", dlg.close);
      create.addEventListener("click", () => withBusy(create, "Creating…", async () => {
        msg.clear();
        const domainText = domain.value.trim();
        if (!title.value.trim() && !description.value.trim()) { msg.error("Give the community a title or a description."); return; }
        if (domainText && !DOMAIN_NAME.test(domainText.toLowerCase())) { msg.error("The name address must look like mycommunity.eth."); return; }
        [title, description, domain].forEach((i) => { i.disabled = true; });
        try {
          const res = await opCreateCommunity({ title: title.value.trim(), description: description.value.trim(), domain: domainText.toLowerCase() });
          selectCommunity(res.address);
          if (res.warning) { msg.success(`Created ${res.address}.`); msg.error(res.warning); flash(`Created ${res.address}. ${res.warning}`, "error"); } else { dlg.close(); flash(`Created ${res.address}.`); }
        } catch (err) { msg.error(`Could not create the community: ${errText(err)}`); [title, description, domain].forEach((i) => { i.disabled = false; }); }
      }));
    });
  }

  /** The owner-only "Community settings" block: one clearly worded switch that opens posting to everyone. */
  function communitySettings(c) {
    const box = el("div", "fld settings");
    box.setAttribute("aria-label", "Community settings");
    box.append(el("b", "", "Community settings"));
    const open = Array.isArray(c.challenges) ? c.challenges.length === 0 : !c.challenge && c.challenges !== undefined;
    const label = el("label", "check");
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = open;
    toggle.disabled = open;
    label.append(toggle, document.createTextNode(" Allow anyone to post (remove spam challenges)"));
    const note = el("div", "hint", open ? "Anyone can post. To bring challenges back, change them on your node." : "New communities reject posts from identities that cannot pass the default challenges. This removes them, so anyone can post, spam included.");
    box.append(label, note);
    toggle.addEventListener("change", () => {
      if (!toggle.checked) return;
      toggle.checked = false;
      openDialog("Allow anyone to post?", (dlg) => {
        const yes = button("Allow anyone to post", "btn primary");
        const no = button("Cancel");
        const acts = el("div", "actions");
        acts.append(yes, no);
        dlg.body.append(el("p", "", `This removes all spam challenges from ${c.title || c.address}. Anyone, including spammers, will be able to post. You can add challenges back on your node.`), acts);
        no.addEventListener("click", dlg.close);
        yes.addEventListener("click", () => withBusy(yes, "Applying…", async () => {
          try {
            await opAllowAnyonePost(c.address);
            dlg.close();
            toggle.checked = true;
            toggle.disabled = true;
            note.textContent = "Anyone can post now. To bring challenges back, change them on your node.";
            render();
          } catch (err) { dlg.body.append(el("div", "errtext", `Could not change it: ${explainPublishError(errText(err))}`)); }
        }));
      });
    });
    return box;
  }

  function openMyCommunitiesDialog() {
    openDialog("Your communities", (dlg) => {
      const draw = () => {
        dlg.body.replaceChildren();
        const mine = communities().filter((c) => c.owned);
        dlg.body.append(el("p", "", isConnected() ? "Communities hosted on your node." : "Communities you created in demo mode (in memory)."));
        if (!mine.length) dlg.body.append(el("div", "empty", "You haven't created a community yet."));
        mine.forEach((c) => {
          const row = el("div", "ownrow");
          const top = el("div", "top");
          top.append(avatar(c.address, "sm"), el("b", "", c.title || c.address), el("span", "mono", shortAddress(c.address)));
          const open = button("Open");
          open.addEventListener("click", () => { dlg.close(); selectCommunity(c.address); });
          const edit = button("Edit");
          const start = button("Start");
          top.append(open, edit);
          if (isConnected()) top.append(start);
          row.append(top);
          const form = el("div", "fld");
          form.hidden = true;
          const t = textInput(c.title && c.title !== c.address ? c.title : "", "Title");
          const d = textBox(c.description || "", 3);
          const save = button("Save changes", "btn primary");
          const msg = messages();
          const acts = el("div", "actions");
          acts.append(save);
          form.append(field("Title", t), field("Description", d), acts, communitySettings(c));
          row.append(form, msg.err, msg.ok);
          edit.addEventListener("click", () => {
            form.hidden = !form.hidden;
            if (!form.hidden) { if (isConnected() && state.selected !== c.address) { state.selected = c.address; state.thread = ""; watchSelected(); } t.focus(); }
          });
          start.addEventListener("click", () => withBusy(start, "Starting…", async () => {
            try { await opStartCommunity(c.address); msg.success("Started. The node now serves this community."); } catch (err) { msg.error(`Could not start it: ${errText(err)}`); }
          }));
          save.addEventListener("click", () => withBusy(save, "Saving…", async () => {
            msg.clear();
            try { await opEditCommunity(c.address, { title: t.value.trim(), description: d.value.trim() }); msg.success("Saved."); render(); } catch (err) { msg.error(`Could not save: ${errText(err)}`); }
          }));
          dlg.body.append(row);
        });
        const create = button("Create a community", "btn primary");
        create.addEventListener("click", () => { dlg.close(); openCreateCommunityDialog(); });
        const acts = el("div", "actions");
        acts.append(create);
        dlg.body.append(acts);
      };
      draw();
    });
  }

  // ─── spaces: seeded communities, new spaces, invitations, room and attendee control ────
  const myAddress = () => (state.identity ? state.identity.address : isConnected() ? "" : GUEST.address);
  const myOwner = () => ({ [myAddress()]: { role: "owner" } });

  /** What the signed-in person may do here: "manage" (hosted on this node), "mod" (a role in someone else's room), or "". */
  function accessOf(c) {
    const entry = c.roles && c.roles[myAddress()];
    const role = (entry && entry.role) || "";
    if (c.owned) return { level: "manage", role: role || "host" };
    if (STAFF_ROLES.includes(role)) return { level: "mod", role };
    return { level: "", role: "" };
  }
  const accessInfo = (c) => readAccess(c.settings && c.settings.challenges);
  function challengesOf(c) {
    const list = c.settings && c.settings.challenges;
    if (Array.isArray(list)) return list;
    if (!isConnected()) return [];
    throw new Error("This space's settings have not loaded from your node yet. Open the space, wait a moment and try again.");
  }
  /** Applies an edit to a hosted community: through editSubplebbit when connected, in memory in Demo mode. */
  async function editProps(c, props) {
    let result = null;
    if (isConnected()) result = await api.editCommunity(c.address, props);
    if ("title" in props) c.title = props.title || c.address;
    if ("description" in props) c.description = props.description || "";
    if ("rules" in props) c.rules = props.rules;
    if ("roles" in props) c.roles = props.roles;
    if ("settings" in props) c.settings = { ...(c.settings || {}), ...props.settings };
    if (result && typeof result === "object") {
      if (isObject(result.roles)) c.roles = result.roles;
      if (isObject(result.settings)) c.settings = result.settings;
      if (Array.isArray(result.rules)) c.rules = result.rules;
    }
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  }
  function confirmDialog({ title, text, confirmLabel, build, run, danger = true }) {
    return openDialog(title, (dlg) => {
      const yes = button(confirmLabel, danger ? "btn danger" : "btn primary");
      const no = button("Cancel");
      const acts = el("div", "actions");
      acts.append(yes, no);
      const msg = messages();
      dlg.body.append(el("p", "", text));
      if (build) build(dlg.body);
      dlg.body.append(acts, msg.err);
      no.addEventListener("click", dlg.close);
      yes.addEventListener("click", () => withBusy(yes, "Working…", async () => {
        msg.clear();
        try { await run(); dlg.close(); render(); } catch (err) { msg.error(errText(err)); }
      }));
    }, { focus: "button.btn:not(.danger):not(.primary)" });
  }

  // Seeded topic communities: activate them on your node.
  function seedActivated(seed) {
    if (isConnected()) { const a = state.activated[seed.id]; return Boolean(a) && state.ownAddresses.includes(a); }
    const c = state.pool.find((x) => x.address === seed.address);
    return Boolean(c && c.owned);
  }
  const pendingSeeds = () => (state.status === "connecting" ? [] : SEEDED_COMMUNITIES.filter((s) => !seedActivated(s)));

  async function activateSeed(seed, onStep) {
    if (!isConnected()) {
      onStep("Demo: setting it up in memory…");
      const c = state.pool.find((x) => x.address === seed.address);
      if (!c) throw new Error("That seeded community is not available.");
      Object.assign(c, { owned: true, started: true, roles: myOwner(), rules: c.rules || [], settings: { challenges: [] } });
      delete c.challenge;
      if (!state.joinedDemo.includes(c.address)) { state.joinedDemo = [...state.joinedDemo, c.address]; persist(); }
      return { address: c.address };
    }
    const me = myAddress();
    if (!me) throw needIdentity();
    onStep("Creating it on your node…");
    const created = await api.createCommunity({ title: seed.title, description: seed.description });
    const address = created && created.address;
    if (!address) throw new Error("The node did not return an address for the new community.");
    state.ownAddresses = [...state.ownAddresses.filter((a) => a !== address), address];
    state.activated[seed.id] = address;
    persist();
    known.set(address, { address, title: seed.title, description: seed.description, posts: [], loaded: true, owned: true, roles: { [me]: { role: "owner" } }, settings: { challenges: [] }, rules: [] });
    try {
      onStep("Making it public: no spam challenges, anyone can post…");
      await api.editCommunity(address, { title: seed.title, description: seed.description, roles: { [me]: { role: "owner" } }, settings: { challenges: [] } });
      onStep("Starting it…");
      const started = await api.startCommunity(address);
      await started.stop();
    } catch (err) {
      const e = new Error(`It was created on your node as ${address}, but setup did not finish: ${errText(err)} Open Yours, then Edit, to finish (allow anyone to post).`);
      e.address = address;
      throw e;
    }
    return { address };
  }

  function openActivateDialog(seeds) {
    openDialog(seeds.length === 1 ? `Activate ${seeds[0].title}` : "Activate seeded communities", (dlg) => {
      const demo = !isConnected();
      dlg.body.append(el("p", "", demo
        ? "Demo: this is simulated in memory. Nothing is created on a node. Connect a node to activate for real."
        : "Each community is created on your node, made public (no spam challenges, so anyone can post) and started. You become its owner. It starts empty."));
      if (!demo && !myAddress()) {
        const err = el("div", "errtext", "Create an identity first: you become the owner of what you activate.");
        err.setAttribute("role", "alert");
        const make = button("Create identity", "btn primary");
        make.addEventListener("click", () => { dlg.close(); openIdentityDialog(); });
        dlg.body.append(err, make);
        return;
      }
      const list = el("ul", "steps");
      const rows = seeds.map((seed) => {
        const li = el("li");
        const status = el("span", "stepstatus", "Waiting…");
        status.setAttribute("role", "status");
        li.append(el("b", "", seed.title), status);
        list.append(li);
        return status;
      });
      const done = button("Done", "btn primary");
      done.disabled = true;
      done.addEventListener("click", dlg.close);
      const acts = el("div", "actions");
      acts.append(done);
      dlg.body.append(list, acts);
      (async () => {
        let last = "";
        for (let i = 0; i < seeds.length; i += 1) {
          try {
            const res = await activateSeed(seeds[i], (t) => { rows[i].textContent = t; });
            last = res.address;
            rows[i].textContent = demo ? `Demo: ${res.address} is now yours (in memory only).` : `Done. Address: ${res.address}`;
          } catch (err) {
            rows[i].textContent = `Could not activate: ${errText(err)}`;
            rows[i].dataset.kind = "error";
            rows.slice(i + 1).forEach((r) => { r.textContent = "Not started."; });
            break;
          }
        }
        if (disposed) return;
        done.disabled = false;
        done.focus();
        if (last && seeds.length === 1) selectCommunity(last); else render();
      })();
    });
  }

  // New space.
  async function opCreateSpace({ title, description, rules, visibility }) {
    const me = myAddress();
    if (isConnected()) {
      if (!me) throw needIdentity();
      const created = await api.createCommunity({ title, ...(description ? { description } : {}) });
      const address = created && created.address;
      if (!address) throw new Error("The node did not return an address for the new space.");
      state.ownAddresses = [...state.ownAddresses.filter((a) => a !== address), address];
      state.spaces = [...state.spaces, address];
      persist();
      const challenges = accessChallenges({ visibility, allow: [me] });
      known.set(address, { address, title, description, posts: [], loaded: true, owned: true, roles: { [me]: { role: "owner" } }, settings: { challenges }, rules });
      try {
        await api.editCommunity(address, { roles: { [me]: { role: "owner" } }, ...(rules.length ? { rules } : {}), settings: { challenges } });
        const started = await api.startCommunity(address);
        await started.stop();
      } catch (err) { throw new Error(`The space exists on your node as ${address}, but setting it up failed: ${errText(err)}`); }
      return address;
    }
    const address = `12D3KooWdemo${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    state.pool.push({ address, title, description, posts: [], owned: true, started: true, space: true, roles: myOwner(), rules, settings: { challenges: accessChallenges({ visibility, allow: [me] }) } });
    return address;
  }

  function accessChoice(groupName, initial) {
    const box = el("fieldset");
    box.append(el("legend", "", "Who can post"));
    const inputs = {};
    [["public", "Public", "Anyone with the address can read and post."], ["private", "Private", "Invite only. Anyone with the address can read; only invited people can post."]].forEach(([value, label, hint]) => {
      const row = el("label", "opt");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = groupName;
      input.value = value;
      input.checked = value === initial;
      inputs[value] = input;
      const text = el("span");
      text.append(el("b", "", label), el("small", "", hint));
      row.append(input, text);
      box.append(row);
    });
    return { box, value: () => (inputs.private.checked ? "private" : "public"), inputs };
  }

  function openNewSpaceDialog() {
    openDialog("New space", (dlg) => {
      const title = textInput("", "Name, like Friday co-working");
      const description = textBox("", 3);
      const rules = textBox("", 3);
      const choice = accessChoice(`bh-vis-${++idCounter}`, "public");
      const honesty = el("p", "hint", "");
      const create = button("Create space", "btn primary");
      const cancel = button("Cancel");
      const msg = messages();
      const acts = el("div", "actions");
      acts.append(create, cancel);
      const sync = () => { honesty.textContent = choice.value() === "private" ? `${PRIVATE_HONESTY} You are on the list automatically.` : "Public: nobody is turned away. Spam is possible, so you can lock or moderate the room later."; };
      Object.values(choice.inputs).forEach((i) => i.addEventListener("change", sync));
      sync();
      dlg.body.append(
        el("p", "", isConnected() ? "A space is a room of your own on your node: you own it, control who can post and manage the attendees." : "Demo: the space lives in memory until you reload. Connect a node to create it for real."),
        field("Name", title), field("Description", description), field("Rules (optional, one per line)", rules),
        choice.box, honesty, acts, msg.err, msg.ok,
      );
      cancel.addEventListener("click", dlg.close);
      create.addEventListener("click", () => withBusy(create, "Creating…", async () => {
        msg.clear();
        if (!title.value.trim()) { msg.error("Give the space a name."); return; }
        if (isConnected() && !myAddress()) { msg.error("Create an identity first: you become the owner of the space."); openIdentityDialog(); return; }
        try {
          const address = await opCreateSpace({ title: title.value.trim(), description: description.value.trim(), rules: rules.value.split("\n").map((r) => r.trim()).filter(Boolean), visibility: choice.value() });
          dlg.close();
          selectCommunity(address);
          flash(`Created the space ${title.value.trim()}. Use Invite people to bring others in.`);
        } catch (err) { msg.error(`Could not create the space: ${errText(err)}`); }
      }));
    });
  }

  // Invitations.
  function roomName(c) {
    const slug = String(c.title || "space").toLowerCase().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "space";
    return `${slug}-${String(c.address).slice(-6).toLowerCase()}`.slice(0, 64);
  }
  async function opAddInvitees(c, addresses) {
    const list = challengesOf(c);
    const access = readAccess(list);
    const merged = [...access.allow];
    const added = [];
    addresses.forEach((a) => { if (!merged.includes(a)) { merged.push(a); added.push(a); } });
    if (added.length) await editProps(c, { settings: { challenges: withAllowList(list, merged) } });
    return added;
  }
  async function opRemoveInvitee(c, address) {
    const list = challengesOf(c);
    await editProps(c, { settings: { challenges: withAllowList(list, readAccess(list).allow.filter((a) => a !== address)) } });
  }
  function nameOfAuthor(c, address) {
    let found = "";
    const look = (m) => { if (m.author && m.author.address === address) found = m.author.name; };
    c.posts.forEach((p) => { look(p); (p.replies || []).forEach(look); });
    return found || shortAddress(address);
  }
  function confirmRemoveInvitee(c, address, after) {
    confirmDialog({
      title: "Remove from the invite list?", confirmLabel: "Remove from list",
      text: `${nameOfAuthor(c, address)} will no longer be able to post in ${c.title || c.address}. They can still read it, and their earlier posts stay.`,
      run: async () => { await opRemoveInvitee(c, address); if (after) after(); },
    });
  }

  function openInviteDialog(c) {
    openDialog(`Invite people to ${c.title || c.address}`, (dlg) => {
      const draw = () => {
        dlg.body.replaceChildren();
        const access = accessInfo(c);
        const manage = accessOf(c).level === "manage";
        const msg = messages();
        dlg.body.append(el("p", "", access.private ? `This space is private. ${PRIVATE_HONESTY}` : "This space is public: anyone with the address can read and post."));
        const addr = textInput(c.address);
        addr.readOnly = true;
        const copyAddr = button("Copy address");
        const addrRow = field("Space address", addr);
        addrRow.append(copyAddr);
        const text = inviteMessage({ title: c.title || c.address, address: c.address, isPrivate: access.private });
        const note = textBox(text, 4);
        note.readOnly = true;
        const copyNote = button("Copy invitation");
        const noteRow = field("Invitation message", note);
        noteRow.append(copyNote);
        copyAddr.addEventListener("click", async () => (await copyText(c.address) ? msg.success("Address copied.") : msg.error(`Copy failed. The address is ${c.address}`)));
        copyNote.addEventListener("click", async () => (await copyText(text) ? msg.success("Invitation copied.") : msg.error("Copy failed. Select the message and copy it.")));
        dlg.body.append(addrRow, noteRow);
        if (access.private && manage) {
          const paste = textBox("", 3);
          paste.placeholder = "12D3KooW…, alice.eth";
          const add = button("Add to invite list", "btn primary");
          const addRow = field("Add people by author address", paste, "Paste one or more author addresses, separated by commas, spaces or new lines. Each person finds theirs under their identity in Bitkin.");
          addRow.append(add);
          add.addEventListener("click", () => withBusy(add, "Adding…", async () => {
            msg.clear();
            const { valid, invalid } = parseAddressList(paste.value);
            if (invalid.length) { msg.error(`Not valid author addresses: ${invalid.join(", ")}.`); return; }
            if (!valid.length) { msg.error("Paste at least one author address."); return; }
            try {
              const added = await opAddInvitees(c, valid);
              const skipped = valid.length - added.length;
              draw();
              const m2 = messages();
              m2.success(added.length ? `Invited ${added.length} ${added.length === 1 ? "person" : "people"}${skipped ? ` (${skipped} already on the list)` : ""}.` : "Everyone you pasted is already on the list.");
              dlg.body.append(m2.err, m2.ok);
            } catch (err) { msg.error(`Could not update the invite list: ${errText(err)}`); }
          }));
          dlg.body.append(addRow);
        }
        if (access.private) {
          const owners = Object.keys(c.roles || {}).filter((a) => c.roles[a].role === "owner");
          const invited = access.allow.filter((a) => !owners.includes(a));
          const box = el("div", "fld invitees");
          box.append(el("b", "", `Invite list (${invited.length})`));
          if (!invited.length) box.append(el("div", "hint", "Nobody is invited yet. You and the room's admins and moderators can always post."));
          const posted = new Set();
          c.posts.forEach((p) => { posted.add(p.author.address); (p.replies || []).forEach((r) => posted.add(r.author.address)); });
          invited.forEach((a) => {
            const row = el("div", "mrow");
            const t = el("div", "t", nameOfAuthor(c, a));
            t.append(el("small", "mono", a));
            row.append(avatar(a, "sm"), t, el("span", "pill", posted.has(a) ? "Member" : "Invited"));
            if (manage) {
              const rm = button("Remove");
              rm.setAttribute("aria-label", `Remove ${nameOfAuthor(c, a)} from the invite list`);
              rm.addEventListener("click", () => confirmRemoveInvitee(c, a, draw));
              row.append(rm);
            }
            box.append(row);
          });
          dlg.body.append(box);
        }
        const call = el("a", "btn", "Start a call");
        const path = `/extensions/meet/meet?room=${encodeURIComponent(roomName(c))}`;
        call.href = path;
        call.addEventListener("click", (e) => { if (navigateHost) { e.preventDefault(); dlg.close(); navigateHost(path); } });
        const callRow = el("div", "fld");
        callRow.append(call, el("div", "hint", "Opens the Meet extension on a room for this space. Meet must be installed."));
        dlg.body.append(callRow, msg.err, msg.ok);
      };
      draw();
    }, { focus: "input" });
  }

  // Moderation: remove a post, ban an author.
  async function moderate(c, cid, moderation) {
    const level = accessOf(c).level;
    if (!level) throw new Error("Only the owner, admins and moderators can do this.");
    if (isConnected()) {
      const res = await runPublish({ kind: "commentModeration", fields: { subplebbitAddress: c.address, commentCid: cid, commentModeration: moderation }, what: "moderation action", address: c.address });
      if (!res.ok) throw new Error(res.reason || "The community rejected it.");
    }
    const touch = (m) => {
      if (m.cid !== cid) return;
      if (moderation.removed) { m.removed = true; m.content = "_[removed]_"; m.title = ""; m.link = ""; }
      if (moderation.author && moderation.author.banExpiresAt && !isConnected()) { c.bans = { ...(c.bans || {}), [m.author.address]: moderation.author.banExpiresAt }; }
    };
    c.posts.forEach((p) => { touch(p); (p.replies || []).forEach(touch); });
  }
  function openRemoveDialog(c, m) {
    let reason = null;
    confirmDialog({
      title: "Remove this post?", confirmLabel: "Remove post",
      text: `It disappears from ${c.title || c.address} for everyone. This is a moderation action signed with your identity.`,
      build: (body) => { reason = textInput("", "Reason (optional)"); body.append(field("Reason", reason)); },
      run: async () => { await moderate(c, m.cid, moderationFor({ remove: true, reason: reason.value })); flash(isConnected() ? "Post removed." : "Demo: post removed in memory."); },
    });
  }
  function openBanDialog(c, author, cid, alsoRemove = false) {
    let duration = null;
    let reason = null;
    let remove = null;
    confirmDialog({
      title: `Ban ${author.name}?`, confirmLabel: "Ban author",
      text: `${author.name} will not be able to post in ${c.title || c.address} for the time you choose. The ban is attached to one of their posts and signed with your identity.`,
      build: (body) => {
        duration = document.createElement("select");
        BAN_DURATIONS.forEach((d) => { const o = document.createElement("option"); o.value = d.id; o.textContent = d.label; duration.append(o); });
        reason = textInput("", "Reason (optional)");
        const check = el("label", "check");
        remove = document.createElement("input");
        remove.type = "checkbox";
        remove.checked = alsoRemove;
        check.append(remove, document.createTextNode(" Also remove that post"));
        body.append(field("Ban for", duration), field("Reason", reason), check);
      },
      run: async () => {
        const d = BAN_DURATIONS.find((x) => x.id === duration.value) || BAN_DURATIONS[0];
        await moderate(c, cid, moderationFor({ remove: remove.checked, banSeconds: d.seconds, reason: reason.value }));
        flash(`${isConnected() ? "" : "Demo: "}${author.name} is banned for ${d.label}.`);
      },
    });
  }

  // Manage space: details, access, lock, attendees and roles.
  function attendeesOf(c) {
    const access = accessInfo(c);
    const posters = new Map();
    const walk = (m) => {
      if (!m.author) return;
      const e = posters.get(m.author.address) || { name: m.author.name, cid: "", n: 0 };
      e.n += 1;
      if (m.cid && !String(m.cid).startsWith("local-") && !m.removed) e.cid = m.cid;
      posters.set(m.author.address, e);
    };
    c.posts.forEach((p) => { walk(p); (p.replies || []).forEach(walk); });
    const addresses = new Set([...Object.keys(c.roles || {}), ...access.allow, ...posters.keys()]);
    const rank = (r) => { const i = STAFF_ROLES.indexOf(r); return i < 0 ? 9 : i; };
    return [...addresses].map((address) => {
      const role = (c.roles && c.roles[address] && c.roles[address].role) || "";
      const posted = posters.get(address);
      const onList = access.allow.includes(address);
      const badge = role || (access.private ? (onList ? (posted ? "member" : "invited") : "past poster") : "member");
      return { address, name: posted ? posted.name : shortAddress(address), role, onList, cid: posted ? posted.cid : "", badge };
    }).sort((a, b) => rank(a.role) - rank(b.role) || a.name.localeCompare(b.name));
  }
  const roleLabel = (r) => (r === "moderator" ? "Moderator" : r === "admin" ? "Admin" : r === "owner" ? "Owner" : "Member");

  function openManageDialog(c) {
    openDialog(`Manage ${c.title || c.address}`, (dlg) => {
      dlg.element.classList.add("wide");
      const draw = () => {
        dlg.body.replaceChildren();
        const acc = accessOf(c);
        const manage = acc.level === "manage";
        const access = accessInfo(c);
        const status = el("div", "pills");
        status.append(el("span", "pill", access.private ? "Private" : "Public"), el("span", "pill", `You: ${acc.role}`));
        if (access.locked) status.append(el("span", "pill bad", "Locked"));
        const msg = messages();
        dlg.body.append(status);
        if (!manage) dlg.body.append(el("p", "", "You have a moderator role here. You can see the room and attendees and remove posts or ban authors, but only the owner can change settings or roles."));

        if (manage && isConnected() && myAddress() && c.roles && !c.roles[myAddress()]) {
          const fix = el("div", "warn");
          fix.append(document.createTextNode("Your identity is not listed as this space's owner, so the node refuses moderation actions from it. "));
          const own = button("Make me owner");
          own.addEventListener("click", () => confirmDialog({ title: "Make your identity the owner?", confirmLabel: "Make me owner", danger: false, text: "This adds your identity to the roles of this space as owner. Existing roles stay.", run: async () => { await editProps(c, { roles: { ...c.roles, ...myOwner() } }); draw(); } }));
          fix.append(own);
          dlg.body.append(fix);
        }

        // Details
        const title = textInput(c.title && c.title !== c.address ? c.title : "", "Name");
        const description = textBox(c.description || "", 3);
        const rules = textBox((c.rules || []).join("\n"), 3);
        [title, description, rules].forEach((i) => { i.disabled = !manage; });
        const save = button("Save details", "btn primary");
        const detailActs = el("div", "actions");
        detailActs.append(save);
        dlg.body.append(el("div", "sectionlabel", "Details"), field("Name", title), field("Description", description), field("Rules (one per line)", rules));
        if (manage) {
          dlg.body.append(detailActs);
          save.addEventListener("click", () => withBusy(save, "Saving…", async () => {
            msg.clear();
            if (!title.value.trim()) { msg.error("The space needs a name."); return; }
            try {
              await editProps(c, { title: title.value.trim(), description: description.value.trim(), rules: rules.value.split("\n").map((r) => r.trim()).filter(Boolean) });
              render();
              msg.success("Saved.");
            } catch (err) { msg.error(`Could not save: ${errText(err)}`); }
          }));
        }

        // Access
        dlg.body.append(el("div", "sectionlabel", "Who can post"));
        dlg.body.append(el("p", "", access.private ? `Private. ${PRIVATE_HONESTY}` : "Public. Anyone with the address can read and post."));
        if (access.locked) dlg.body.append(el("p", "", "Locked: only the owner, admins and moderators can post right now. Everyone else is turned away until you unlock. The invite list is kept."));
        if (manage) {
          const accActs = el("div", "actions");
          const switchBtn = button(access.private ? "Make public" : "Make private");
          const lockBtn = button(access.locked ? "Unlock room" : "Lock room");
          accActs.append(switchBtn, lockBtn);
          dlg.body.append(accActs);
          switchBtn.addEventListener("click", () => {
            const toPrivate = !access.private;
            confirmDialog({
              title: toPrivate ? "Make this space private?" : "Make this space public?", confirmLabel: toPrivate ? "Make private" : "Make public", danger: !toPrivate,
              text: toPrivate
                ? `Only people on the invite list can post, plus you, admins and moderators. ${PRIVATE_HONESTY} This replaces the space's current spam challenges.`
                : "Anyone will be able to post, spam included. The invite list is dropped from the node's settings. Anyone with the address could already read.",
              run: async () => {
                const owners = Object.keys(c.roles || {}).filter((a) => c.roles[a].role === "owner");
                const allow = [...new Set([...owners, myAddress()].filter(Boolean))];
                await editProps(c, { settings: { challenges: accessChallenges({ visibility: toPrivate ? "private" : "public", allow, locked: access.locked }) } });
                flash(`${isConnected() ? "" : "Demo: "}This space is now ${toPrivate ? "private (invite-only to post)" : "public"}.`);
                draw();
              },
            });
          });
          lockBtn.addEventListener("click", () => {
            const lock = !access.locked;
            confirmDialog({
              title: lock ? "Lock this room?" : "Unlock this room?", confirmLabel: lock ? "Lock room" : "Unlock room", danger: lock,
              text: lock
                ? "While locked, the node turns away every post except from the owner, admins and moderators. People can still read, and the invite list and roles stay as they are. Unlock to let invited people post again."
                : "People allowed to post (everyone if public, the invite list if private) can post again.",
              run: async () => {
                await editProps(c, { settings: { challenges: withLock(challengesOf(c), lock) } });
                flash(`${isConnected() ? "" : "Demo: "}The room is ${lock ? "locked" : "unlocked"}.`);
                draw();
              },
            });
          });
          const invite = button("Invite people");
          invite.addEventListener("click", () => openInviteDialog(c));
          accActs.append(invite);
        }

        // Attendees
        const people = attendeesOf(c);
        dlg.body.append(el("div", "sectionlabel", `Attendees (${people.length})`));
        const list = el("div", "attendees");
        if (!people.length) list.append(el("div", "empty", "Nobody here yet."));
        people.forEach((p) => {
          const row = el("div", "mrow attendee");
          row.dataset.address = p.address;
          const t = el("div", "t", p.name);
          t.append(el("small", "mono", p.address));
          row.append(avatar(p.address, "sm"), t, el("span", `pill${p.role ? " role" : ""}`, p.badge));
          const mine = p.address === myAddress();
          if (manage && p.role !== "owner") {
            const sel = document.createElement("select");
            sel.setAttribute("aria-label", `Role for ${p.name}`);
            ["", "moderator", "admin"].forEach((r) => { const o = document.createElement("option"); o.value = r; o.textContent = roleLabel(r); sel.append(o); });
            sel.value = p.role;
            sel.disabled = mine;
            sel.addEventListener("change", () => {
              const next = sel.value;
              sel.value = p.role;
              confirmDialog({
                title: `Change ${p.name}'s role?`, confirmLabel: next ? `Make ${roleLabel(next).toLowerCase()}` : "Remove role", danger: !next,
                text: next ? `${p.name} becomes ${next === "admin" ? "an admin" : "a moderator"} of this space: they can post even when it is locked and can remove posts and ban authors.` : `${p.name} loses their ${p.role} role and becomes a normal member.`,
                run: async () => { await editProps(c, { roles: mergeRoles(c.roles, p.address, next) }); draw(); },
              });
            });
            row.append(sel);
            if (access.private && p.onList) {
              const rm = button("Remove from list");
              rm.setAttribute("aria-label", `Remove ${p.name} from the invite list`);
              rm.addEventListener("click", () => confirmRemoveInvitee(c, p.address, draw));
              row.append(rm);
            }
          }
          if (acc.level && p.role !== "owner" && !mine && p.cid) {
            const ban = button("Ban…");
            ban.setAttribute("aria-label", `Ban ${p.name}`);
            ban.addEventListener("click", () => openBanDialog(c, { name: p.name, address: p.address }, p.cid));
            row.append(ban);
          }
          list.append(row);
        });
        dlg.body.append(list, msg.err, msg.ok);
      };
      draw();
    }, { focus: "input, textarea, button" });
  }

  // ─── view ─────────────────────────────────────────────────────────────────────────────
  const side = el("aside", "side");
  const main = el("section", "main");
  const members = el("aside", "members");
  const shell = el("div", "shell");
  shell.append(side, main, members);
  root.append(shell);
  const grips = gripColumns({
    grid: shell, storageKey: "grip:bitsocial-hangout", narrowQuery: "(max-width: 900px)",
    columns: [
      { el: side, edge: "left", min: 200, max: 480, initial: 260, label: "communities list" },
      { el: members, edge: "right", min: 160, max: 420, initial: 240, label: "members panel" },
    ],
  });

  const head = el("div", "head");
  const body = el("div", "body");
  const composerWrap = el("div", "composerwrap");
  main.append(head, noticeEl, body, composerWrap);

  const replyChip = el("div", "replychip");
  replyChip.hidden = true;
  const replyChipText = el("span", "", "");
  const replyChipCancel = el("button", "linkbtn", "Cancel reply");
  replyChipCancel.type = "button";
  replyChipCancel.addEventListener("click", () => { state.replyTo = null; render(); });
  replyChip.append(replyChipText, replyChipCancel);

  const titleInput = el("input");
  titleInput.placeholder = "Title (optional)";
  titleInput.setAttribute("aria-label", "Post title");
  const linkInput = el("input");
  linkInput.placeholder = "Link (optional)";
  linkInput.type = "url";
  linkInput.setAttribute("aria-label", "Post link");
  const textarea = el("textarea");
  textarea.rows = 1;
  textarea.setAttribute("aria-label", "Message");
  const sendBtn = el("button", "send", "↑");
  sendBtn.type = "button";
  sendBtn.setAttribute("aria-label", "Send");
  sendBtn.title = "Send";
  const errLine = el("span", "err");
  errLine.setAttribute("role", "alert");
  const bar = el("div", "composerbar");
  // The title and link fields stay tucked behind chips until they are wanted.
  const fieldChip = (label, input) => {
    const chip = el("button", "tool", label);
    chip.type = "button";
    chip.setAttribute("aria-pressed", "false");
    input.hidden = true;
    chip.addEventListener("click", () => {
      input.hidden = !input.hidden;
      chip.setAttribute("aria-pressed", String(!input.hidden));
      chip.classList.toggle("on", !input.hidden);
      if (!input.hidden) input.focus();
    });
    return chip;
  };
  const titleChip = fieldChip("Title", titleInput);
  const linkChip = fieldChip("Link", linkInput);
  bar.append(titleChip, linkChip, errLine, el("span", "spacer"), sendBtn);
  const box = el("div", "composerbox");
  box.append(el("div", "grip"), titleInput, linkInput, textarea, bar);
  composerWrap.append(replyChip, box);
  function setSendBusy(busy, ok = true) {
    sendBtn.disabled = busy;
    sendBtn.textContent = busy ? "…" : "↑";
    sendBtn.title = busy ? "Sending…" : "Send";
    if (busy) sendBtn.setAttribute("aria-busy", "true"); else sendBtn.removeAttribute("aria-busy");
    if (!busy && !ok) renderComposerError();
  }
  const renderComposerError = () => { errLine.textContent = state.composerError || (state.error && state.status === "connected" ? state.error : ""); };
  const submit = async () => {
    if (sendBtn.disabled) return;
    const content = textarea.value;
    const title = titleInput.value;
    const link = linkInput.value;
    const problem = validateComposer({ content, title, link, isReply: Boolean(post()) });
    if (problem) { state.composerError = problem; renderComposerError(); return; }
    state.composerError = "";
    setSendBusy(true);
    const started = send({ content, title, link });
    if (state.composerError) { setSendBusy(false); renderComposerError(); return; }
    textarea.value = ""; titleInput.value = ""; linkInput.value = "";
    renderComposerError();
    await started;
  };
  sendBtn.addEventListener("click", submit);
  textarea.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } });

  /** The "Built with" row: Kamiji and Kosmos logos linking to their sites. */
  const poweredBy = () => {
    const d = el("div", "powered");
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

  function statusText() {
    if (state.status === "connected") return "Connected";
    if (state.status === "connecting") return "Connecting…";
    return "Demo mode";
  }

  function renderSide() {
    side.replaceChildren();
    const brand = el("div", "brand");
    brand.append(avatar("bitsocial", ""), el("h1", "", "Bitkin™"));
    const status = el("div", "status", statusText());
    status.dataset.state = state.status;
    status.setAttribute("role", "status");
    status.title = state.status === "connected" ? `Connected to ${state.url}` : state.error || "No node connected. Showing sample communities.";
    if (state.error && state.status === "demo") {
      const e = el("div", "status", state.error);
      e.style.cssText = "white-space: normal; border-radius: 10px; color: var(--bh-bad);";
      e.setAttribute("role", "alert");
      // The banner names the problem; this is the way out of it.
      const setup = el("button", "setupbtn", "Set up a node →");
      setup.type = "button";
      setup.addEventListener("click", () => { state.view = "settings"; render(); });
      side.append(brand, status, e, setup);
    } else side.append(brand, status);
    const list = el("div", "list");
    communities().forEach((c) => {
      const row = el("button", "row");
      row.type = "button";
      row.setAttribute("aria-current", String(state.view === "chat" && c.address === state.selected));
      row.dataset.address = c.address;
      row.append(avatar(c.address, "sm"));
      const t = el("span", "t");
      const name = el("b");
      name.append(el("i", "", "#"), document.createTextNode(c.title || c.address));
      if (c.owned) name.append(el("i", "tag", "yours"));
      if (c.seedId && !c.owned) name.append(el("i", "tag", "seeded"));
      if (c.owned && (c.space || state.spaces.includes(c.address))) name.append(el("i", "tag", "space"));
      if (accessInfo(c).private) name.append(el("i", "tag", "private"));
      t.append(name);
      if (c.description) t.append(el("small", "", c.description));
      row.append(t);
      row.addEventListener("click", () => selectCommunity(c.address));
      list.append(row);
    });
    if (!communities().length) list.append(el("div", "empty", state.status === "connected" ? "No communities yet. Create one or join by address." : "No communities. Join one by address."));
    const seeds = pendingSeeds();
    if (seeds.length) {
      const seedHead = el("div", "seedhead");
      seedHead.append(el("div", "sectionlabel", "Seeded communities"));
      if (seeds.length > 1) {
        const all = button("Activate all");
        all.title = "Create every seeded community on your node, one after the other";
        all.addEventListener("click", () => confirmDialog({
          title: `Activate all ${seeds.length} seeded communities?`, confirmLabel: "Activate all", danger: false,
          text: state.status === "connected" ? `This creates ${seeds.map((s) => s.title).join(", ")} on your node, one after the other, each public (anyone can post). It stops at the first error.` : "Demo: this simulates activating them all in memory.",
          run: async () => { openActivateDialog(seeds); },
        }));
        seedHead.append(all);
      }
      list.append(seedHead);
      seeds.forEach((seed) => {
        const row = el("div", "seedrow");
        row.dataset.seed = seed.id;
        const t = el("span", "t");
        const name = el("b", "", seed.title);
        name.append(el("i", "tag", "Seeded"));
        t.append(name, el("small", "", seed.description));
        const act = button("Activate");
        act.setAttribute("aria-label", `Activate ${seed.title}`);
        act.addEventListener("click", () => openActivateDialog([seed]));
        row.append(avatar(seed.address, "sm"), t, act);
        list.append(row);
      });
    }
    const btns = el("div", "sidebtns");
    const join = button("Join");
    join.title = "Join a community by address";
    join.addEventListener("click", openJoinDialog);
    const create = button("Create");
    create.title = "Create a community";
    create.addEventListener("click", openCreateCommunityDialog);
    const mine = button("Yours");
    mine.title = "Your communities";
    mine.addEventListener("click", openMyCommunitiesDialog);
    const space = button("New space");
    space.title = "Create a co-working space: a room you control";
    space.addEventListener("click", openNewSpaceDialog);
    btns.append(join, create, space, mine);
    const foot = el("div", "sidefoot");
    const chip = el("button", "idchip");
    chip.type = "button";
    chip.setAttribute("aria-label", "Your identity");
    chip.append(avatar(state.identity ? state.identity.address : "no-identity", "sm"));
    const ct = el("span", "t");
    ct.append(el("b", "", state.identity ? authorName() : "No identity"), el("small", "", state.identity ? shortAddress(state.identity.address) : "Set up to publish"));
    chip.append(ct);
    chip.addEventListener("click", openIdentityDialog);
    const settings = el("button", "btn", "Connection settings");
    settings.type = "button";
    settings.addEventListener("click", () => { state.view = "settings"; render(); });
    foot.append(chip, settings, poweredBy());
    side.append(el("div", "sectionlabel", "Communities"), list, btns, foot);
  }

  function voteControls(m) {
    const wrap = el("span", "vote");
    const mineVote = state.votes[m.cid] || 0;
    const up = el("button", "", "▲");
    up.type = "button";
    up.setAttribute("aria-label", "Upvote");
    up.setAttribute("aria-pressed", String(mineVote === 1));
    up.disabled = Boolean(m.voting);
    const down = el("button", "", "▼");
    down.type = "button";
    down.setAttribute("aria-label", "Downvote");
    down.setAttribute("aria-pressed", String(mineVote === -1));
    down.disabled = Boolean(m.voting);
    const score = el("output", "", String((m.upvotes || 0) - (m.downvotes || 0)));
    score.setAttribute("aria-label", "Score");
    up.addEventListener("click", () => vote(m, 1));
    down.addEventListener("click", () => vote(m, -1));
    wrap.append(up, score, down);
    return wrap;
  }

  function messageNode(m, opts = {}) {
    const row = el("div", `msg${m.pending ? " pending" : ""}${m.failed ? " failed" : ""}`);
    if (opts.depth) row.style.marginLeft = `${Math.min(opts.depth, 4) * 24}px`;
    row.dataset.cid = m.cid;
    const col = el("div", "col");
    const who = el("div", "who");
    who.append(el("b", "", m.author.name), el("span", "", relativeTime(m.timestamp)));
    if (m.pinned) who.append(el("span", "tag", "Pinned"));
    col.append(who);
    if (m.title) col.append(el("div", "ptitle", m.title));
    if (m.content) col.append(renderMarkdown(m.content));
    if (m.link) { const a = el("a", "", m.link); if (/^https?:\/\//i.test(m.link)) { a.href = m.link; a.target = "_blank"; a.rel = "noopener noreferrer"; } col.append(a); }
    if (m.pending && !m.note) col.append(el("div", "note", "Publishing…"));
    if (m.note) col.append(el("div", "note", m.note));
    const acts = el("div", "acts");
    if (opts.openThread) {
      const n = m.replyCount || (m.replies ? m.replies.length : 0);
      const b = el("button", "linkbtn", n ? `${n} ${n === 1 ? "reply" : "replies"}` : "Reply");
      b.type = "button";
      b.addEventListener("click", () => { state.thread = m.cid; state.replyTo = null; render(); loadReplies(m); });
      acts.append(b);
    } else if (opts.replyable && !m.pending && !m.failed) {
      const b = el("button", "linkbtn", "Reply");
      b.type = "button";
      b.addEventListener("click", () => { state.replyTo = m; render(); textarea.focus(); });
      acts.append(b);
    }
    if (!m.pending && !m.failed && !m.deleted) {
      acts.append(voteControls(m));
      if (isMine(m) && !String(m.cid).startsWith("local-")) {
        const edit = el("button", "linkbtn", "Edit");
        edit.type = "button";
        edit.addEventListener("click", () => openEditDialog(m));
        const del = el("button", "linkbtn danger", "Delete");
        del.type = "button";
        del.addEventListener("click", () => openDeleteDialog(m));
        acts.append(edit, del);
      }
    }
    const cm = community();
    if (cm && accessOf(cm).level && !m.pending && !m.failed && !m.removed && !String(m.cid).startsWith("local-") && !isMine(m)) {
      const rm = el("button", "linkbtn danger", "Remove");
      rm.type = "button";
      rm.addEventListener("click", () => openRemoveDialog(cm, m));
      const ban = el("button", "linkbtn danger", "Ban…");
      ban.type = "button";
      ban.addEventListener("click", () => openBanDialog(cm, m.author, m.cid, true));
      acts.append(rm, ban);
    }
    if (m.failed) {
      const dismiss = el("button", "linkbtn", "Dismiss");
      dismiss.type = "button";
      dismiss.addEventListener("click", () => {
        const c = community();
        if (c) { c.posts = c.posts.filter((x) => x !== m); const p = post(); if (p && p.replies) { p.replies = p.replies.filter((x) => x !== m); p.replyCount = p.replies.length; } }
        render();
      });
      acts.append(dismiss);
    }
    if (acts.children.length) col.append(acts);
    row.append(avatar(m.author.address), col);
    return row;
  }

  /** The tutorial behind "no node yet": what to install, what to run, and the docs. */
  function nodeSetupCard() {
    const box = el("div", "setup");
    box.append(el("div", "setuph", "No node yet? Start one"));
    const steps = el("ol", "steps");
    const step = (text, command) => {
      const li = el("li", "", text);
      if (!command) return li;
      const row = el("div", "cmd");
      const code = document.createElement("code");
      code.textContent = command;
      const copy = el("button", "btn", "Copy");
      copy.type = "button";
      copy.setAttribute("aria-label", `Copy ${command}`);
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(command);
          copy.textContent = "Copied";
        } catch (err) {
          // A webview can refuse the async clipboard; the copy command still reaches it, and if
          // that fails too the command is left selected so it can be copied by hand.
          let copied = false;
          try {
            const area = document.createElement("textarea");
            area.value = command;
            area.style.cssText = "position: fixed; top: -1000px";
            document.body.append(area);
            area.select();
            copied = document.execCommand("copy");
            area.remove();
          } catch (fallbackErr) {
            copied = false;
          }
          if (copied) {
            copy.textContent = "Copied";
          } else {
            const range = document.createRange();
            range.selectNodeContents(code);
            const sel = window.getSelection();
            if (sel) { sel.removeAllRanges(); sel.addRange(range); }
            copy.textContent = "Selected";
          }
        }
        later(() => { if (!disposed) copy.textContent = "Copy"; }, 1600);
      });
      row.append(code, copy);
      li.append(row);
      return li;
    };
    steps.append(
      step("Install the node. It needs Node.js 22.19 or newer.", NODE_INSTALL),
      step("Start it. It prints “pkc rpc: listening on ws://localhost:9138”.", NODE_COMMAND),
      step("Come back here and press Connect above.")
    );
    box.append(steps);
    const btns = el("div", "setupbtns");
    if (hostCanRunCommands()) {
      const start = el("button", "btn primary", state.starting ? "Starting the node…" : "Start a node");
      start.type = "button";
      start.disabled = state.starting;
      start.title = `Runs “${NODE_COMMAND}” and waits for it to answer`;
      start.addEventListener("click", () => startNode(state.url));
      btns.append(start);
    }
    const again = el("button", "btn", state.starting ? "Checking…" : "Check again");
    again.type = "button";
    again.disabled = state.starting;
    again.title = "Try the URL above once more";
    again.addEventListener("click", () => connect(state.url, true));
    const docs = document.createElement("a");
    docs.className = "btn";
    docs.href = NODE_DOCS;
    docs.target = "_blank";
    docs.rel = "noopener noreferrer";
    docs.textContent = "Node docs";
    btns.append(again, docs);
    box.append(btns);
    return box;
  }

  function settingsCard() {
    const card = el("div", "card");
    const label = el("label", "", "Node (RPC WebSocket URL)");
    label.htmlFor = "bh-rpc-url";
    const input = el("input");
    input.id = "bh-rpc-url";
    input.value = state.url;
    input.spellcheck = false;
    input.autocomplete = "off";
    const nameLabel = el("label", "", "Your display name");
    nameLabel.htmlFor = "bh-name";
    const nameInput = el("input");
    nameInput.id = "bh-name";
    nameInput.value = state.name;
    const actions = el("div", "actions");
    const connectBtn = el("button", "btn primary", state.status === "connected" ? "Reconnect" : "Connect");
    connectBtn.type = "button";
    connectBtn.addEventListener("click", () => { state.name = nameInput.value.trim() || GUEST.name; state.welcomed = true; persist(); connect(input.value, true); });
    const demoBtn = el("button", "btn", "Use demo mode");
    demoBtn.type = "button";
    demoBtn.addEventListener("click", async () => { state.name = nameInput.value.trim() || GUEST.name; await stopLive(); useDemo(); state.welcomed = true; state.view = "chat"; persist(); render(); });
    const idBtn = el("button", "btn", state.identity ? "Manage identity" : "Create identity");
    idBtn.type = "button";
    idBtn.addEventListener("click", openIdentityDialog);
    actions.append(connectBtn, demoBtn, idBtn);
    card.append(label, input, nameLabel, nameInput, actions);
    if (state.error) { const e = el("div", "errtext", state.error); e.setAttribute("role", "alert"); card.append(e); }
    card.append(el("div", "hint", state.status === "connected" ? `Connected to ${state.url}.` : "Not connected: showing in-memory demo communities. The URL is saved in this browser."));
    if (state.status !== "connected") card.append(nodeSetupCard());
    return card;
  }


  // ─── the voxel cloud: one blob per community, shown on the welcome page and the empty state ───
  let stopCloud = () => {};
  function cloudItems() {
    const out = [], seen = new Set();
    const add = (item) => { if (!seen.has(item.address)) { seen.add(item.address); out.push(item); } };
    SEEDED_COMMUNITIES.forEach((sd) => add({ id: sd.id, address: sd.address, title: sd.title, seed: sd }));
    communities().forEach((c) => add({ id: c.seedId || c.address, address: c.address, title: c.title || c.address }));
    return out;
  }
  /** Same actions as the sidebar: a listed community opens; a seeded one that is not yours yet opens the activate flow. Nothing is created here. */
  function pickCloudItem(item) {
    if (communities().some((c) => c.address === item.address)) selectCommunity(item.address);
    else if (item.seed) openActivateDialog([item.seed]);
  }
  function cloudStage() {
    stopCloud();
    const items = cloudItems();
    const stage = el("div", "cloudstage");
    const canvas = el("canvas");
    canvas.setAttribute("aria-hidden", "true");
    const list = el("ul", "cloudlist");
    list.setAttribute("aria-label", "Communities");
    const caption = el("span", "cloudcap");
    caption.setAttribute("aria-hidden", "true");
    const modes = el("div", "cloudmodes");
    modes.setAttribute("role", "group");
    modes.setAttribute("aria-label", "Cloud style");
    const modeBtns = [["smooth", "Smooth"], ["voxel", "Voxel"]].map(([id, label]) => {
      const b = el("button", "cloudmode", label);
      b.type = "button";
      b.dataset.mode = id;
      b.setAttribute("aria-pressed", String(state.welcomeStyle === id));
      modes.append(b);
      return b;
    });
    const corner = el("div", "cloudcorner");
    corner.append(modes, caption);
    stage.append(canvas, list, corner);

    const ctx = canvas.getContext ? canvas.getContext("2d") : null;
    const still = Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const off = document.createElement("canvas");
    let scene = null, raf = 0, last = 0, onScreen = true, ro = null, io = null, startTimer = 0, stopped = false;
    const paint = () => { if (ctx && scene) drawCloudScene(ctx, off, scene, state.welcomeStyle); };
    const setCaption = (i) => { caption.textContent = i >= 0 && scene && scene.blobs[i] ? scene.blobs[i].item.title : ""; };
    const size = () => {
      if (!ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scene = createCloudScene(items, w, h);
      for (let n = 0; n < 30; n += 1) stepCloudScene(scene, 0.1);
      if (still || !raf) paint();
    };
    const runnable = () => !stopped && !still && onScreen && !document.hidden && canvas.isConnected;
    const frame = (now) => {
      raf = 0;
      if (stopped) return;
      if (!canvas.isConnected) { stop(); return; }
      if (!runnable()) { last = 0; return; }
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
      last = now;
      stepCloudScene(scene, dt);
      paint();
      raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf && scene && runnable()) raf = requestAnimationFrame(frame); };
    const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; last = 0; } else kick(); };
    function stop() {
      stopped = true;
      cancelAnimationFrame(raf); raf = 0;
      clearTimeout(startTimer);
      if (ro) ro.disconnect();
      if (io) io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", size);
    }
    stopCloud = stop;

    items.forEach((item, i) => {
      const li = el("li");
      const b = el("button", "", item.title);
      b.type = "button";
      b.dataset.address = item.address;
      b.setAttribute("aria-label", `Open ${item.title}`);
      b.addEventListener("click", () => pickCloudItem(item));
      b.addEventListener("focus", () => { if (scene) scene.focus = i; setCaption(i); if (still) paint(); });
      b.addEventListener("blur", () => { if (scene) scene.focus = -1; setCaption(-1); if (still) paint(); });
      li.append(b);
      list.append(li);
    });
    modeBtns.forEach((b) => b.addEventListener("click", () => {
      state.welcomeStyle = b.dataset.mode; persist();
      modeBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      paint();
    }));
    const local = (ev) => { const r = canvas.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; };
    stage.addEventListener("pointermove", (ev) => {
      if (!scene) return;
      const p = local(ev);
      scene.pointer = p;
      const i = cloudHit(scene, p.x, p.y);
      canvas.dataset.hit = String(i >= 0);
      if (!list.contains(document.activeElement)) setCaption(i);
    });
    stage.addEventListener("pointerleave", () => { if (scene) scene.pointer = null; canvas.dataset.hit = "false"; if (!list.contains(document.activeElement)) setCaption(-1); });
    canvas.addEventListener("click", (ev) => {
      if (!scene) return;
      const p = local(ev);
      const i = cloudHit(scene, p.x, p.y);
      if (i >= 0) pickCloudItem(scene.blobs[i].item);
    });

    if (ctx) {
      // Sizing waits for layout; a static frame (reduced motion) is painted once and on resize, never in a loop.
      startTimer = setTimeout(() => { if (stopped || disposed) return; size(); kick(); }, 0);
      if (typeof ResizeObserver === "function") { ro = new ResizeObserver(() => { if (!stopped && scene) { size(); kick(); } }); ro.observe(stage); }
      else window.addEventListener("resize", size);
      if (typeof IntersectionObserver === "function") { io = new IntersectionObserver((e) => { onScreen = e.every((x) => x.isIntersecting) || e.some((x) => x.isIntersecting); if (onScreen) kick(); }); io.observe(stage); }
      document.addEventListener("visibilitychange", onVis);
    }
    return stage;
  }

  function headActions(c) {
    const wrap = el("span", "spacer");
    const group = el("span");
    group.style.cssText = "display:inline-flex;gap:6px;";
    const share = button("Copy address");
    share.title = "Copy this community's address. Anyone can join it with Join by address.";
    share.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(c.address); flash(`Copied ${c.address}. Share it: others use Join and paste it.`); } catch { flash(`Share this address: ${c.address}`); }
    });
    group.append(share);
    const acc = accessOf(c);
    if (acc.level === "manage") {
      const invite = button("Invite people");
      invite.title = "Share this space's address and manage who may post";
      invite.addEventListener("click", () => openInviteDialog(c));
      group.append(invite);
    }
    if (acc.level) {
      const manage = button("Manage space");
      manage.title = "Room settings, attendees and roles";
      manage.addEventListener("click", () => openManageDialog(c));
      group.append(manage);
    }
    if (c.owned) {
      const edit = button("Edit community");
      edit.addEventListener("click", openMyCommunitiesDialog);
      group.append(edit);
    } else {
      const leave = button("Leave");
      leave.title = `Leave ${c.address}`;
      leave.addEventListener("click", () => {
        opLeave(c.address);
        if (ensureSelected()) watchSelected();
        flash(`Left ${c.address}.`);
        render();
      });
      group.append(leave);
    }
    return [wrap, group];
  }

  function renderBody() {
    stopCloud(); stopCloud = () => {};
    body.replaceChildren();
    head.replaceChildren();
    if (state.view === "welcome" || state.view === "settings") {
      composerWrap.hidden = true;
      if (state.view === "settings") {
        head.append(el("h2", "", "Connection settings"));
        const page = el("div", "page");
        page.append(settingsCard());
        body.append(page);
        return;
      }
      const page = el("div", "page");
      const big = el("span", "avatar lg");
      big.append(orbSvg(BLOBS[0], 0));
      page.append(big, el("h2", "", "Welcome to Bitkin"), el("p", "", "Chat in Bitkin communities: each community is a channel, each post a thread, all peer to peer. No node yet? Start in demo mode. Got a community address from someone? Use Join by address."), settingsCard());
      body.append(cloudStage(), page);
      return;
    }
    const c = community();
    if (!c) {
      composerWrap.hidden = true;
      const empty = el("div", "empty", "Pick a community to start, or ");
      const join = el("button", "linkbtn", "join one by address");
      join.type = "button";
      join.addEventListener("click", openJoinDialog);
      empty.append(join, document.createTextNode("."));
      body.append(cloudStage(), empty);
      return;
    }
    composerWrap.hidden = false;
    const p = post();
    if (state.replyTo && (!p || !(p.replies || []).includes(state.replyTo)) && state.replyTo !== p) state.replyTo = null;
    if (p) {
      const back = el("button", "btn", "Back");
      back.type = "button";
      back.addEventListener("click", () => { state.thread = ""; state.replyTo = null; render(); });
      head.append(back, el("h2", "", "Thread"), el("span", "desc", `in # ${c.title || c.address}`));
      const list = el("div", "msgs");
      list.append(messageNode(p));
      list.append(el("div", "sectionlabel", `${(p.replies || []).length} replies`));
      (p.replies || []).forEach((r) => list.append(messageNode(r, { depth: r.depth, replyable: true })));
      body.append(list);
      textarea.placeholder = state.replyTo ? `Reply to ${state.replyTo.author.name}` : "Reply in thread";
      titleInput.hidden = true;
      linkInput.hidden = true;
      titleChip.hidden = true;
      linkChip.hidden = true;
    } else {
      head.append(el("h2", "", `# ${c.title || c.address}`), el("span", "desc", c.description || c.address), ...headActions(c));
      const list = el("div", "msgs");
      if (!c.posts.length) list.append(el("div", "empty", state.status === "connected" && !c.loaded ? "Loading community from the network…" : "No posts yet. Say hello!"));
      c.posts.forEach((m) => list.append(messageNode(m, { openThread: true })));
      body.append(list);
      textarea.placeholder = `Message # ${c.title || c.address}`;
      titleChip.hidden = false;
      linkChip.hidden = false;
      titleInput.hidden = titleChip.getAttribute("aria-pressed") !== "true";
      linkInput.hidden = linkChip.getAttribute("aria-pressed") !== "true";
    }
    replyChip.hidden = !state.replyTo;
    replyChipText.textContent = state.replyTo ? `Replying to ${state.replyTo.author.name}` : "";
    renderComposerError();
    body.scrollTop = body.scrollHeight;
  }

  function renderMembers() {
    members.replaceChildren();
    const c = state.view === "chat" ? community() : null;
    if (!c) return;
    const p = post();
    const counts = new Map();
    const count = (m) => { const e = counts.get(m.author.address) || { author: m.author, n: 0 }; e.n += 1; counts.set(m.author.address, e); };
    (p ? [p, ...(p.replies || [])] : c.posts.flatMap((x) => [x, ...(x.replies || [])])).forEach(count);
    members.append(el("div", "mhead", `Members (${counts.size})`));
    [...counts.values()].sort((a, b) => b.n - a.n).forEach(({ author, n }) => {
      const row = el("div", "mrow");
      const t = el("div", "t", author.name);
      const role = c.roles && c.roles[author.address] ? c.roles[author.address].role : "";
      t.append(el("small", "", `${n} ${n === 1 ? "message" : "messages"}${role ? `, ${role}` : ""}`));
      row.append(avatar(author.address, "sm"), t);
      members.append(row);
    });
  }

  function renderChrome() { renderSide(); }
  /** Fill the visible page below wherever the host put us (hosts may not give a definite height). */
  function fit() {
    if (disposed) return;
    const top = Math.max(0, root.getBoundingClientRect().top);
    root.style.height = `${Math.max(480, (window.innerHeight || 800) - top)}px`;
  }
  function render() {
    if (disposed) return;
    fit();
    renderSide();
    renderBody();
    renderMembers();
    grips.refresh();
  }

  render();
  window.addEventListener("resize", fit);
  let sizeWatch = null;
  if (typeof ResizeObserver === "function" && container.parentElement) { sizeWatch = new ResizeObserver(fit); sizeWatch.observe(container.parentElement); }
  // Try the saved node quietly; fall back to demo mode if it is not there.
  if (saved.url && saved.autoconnect !== false && options.autoConnect !== false && saved.welcomed) connect(state.url);

  const splashLogo = (() => {
    const d = root.ownerDocument, NS = "http://www.w3.org/2000/svg";
    const svg = d.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("width", "52"); svg.setAttribute("height", "52"); svg.setAttribute("aria-hidden", "true");
    for (const [k, v] of Object.entries({ fill: "none", stroke: "#fff", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" })) svg.setAttribute(k, v);
    const r = d.createElementNS(NS, "rect");
    for (const [k, v] of Object.entries({ x: "4", y: "4", width: "16", height: "16", rx: "4" })) r.setAttribute(k, v);
    const p = d.createElementNS(NS, "path"); p.setAttribute("d", "M9 10v3M15 10v3");
    svg.append(r, p);
    const wrap = d.createElement("span");
    wrap.style.cssText = "display:inline-flex;align-items:center;gap:14px";
    wrap.append(svg, d.createTextNode("Bitkin™"));
    return wrap;
  })();
  const splash = mountComingSoonSplash(root, { brand: "bitkin", name: "Bitkin™", tagline: "Peer-to-peer social communities, with a built-in Demo mode.", tint: "#a855f7", logoNode: splashLogo });

  return () => {
    disposed = true;
    splash.destroy();
    stopCloud();
    timers.forEach(clearTimeout);
    clearTimeout(noticeTimer);
    dialogs.slice().forEach((d) => d.close());
    stopLive();
    grips.dispose();
    window.removeEventListener("resize", fit);
    if (sizeWatch) sizeWatch.disconnect();
    root.remove();
  };
}
