/* Holons — the Hangout / Team Chat experience, built on Holons.
 *
 * A Holon is a workspace (left icon rail); its feed, courses and modules are channels; its
 * members are the team; feed posts are threaded messages (comments are the replies).
 *
 * Browser-only, dependency-free ESM. Styles are scoped under `.hh`; text is always set with
 * textContent. The holons-api base URL (and a sign-in token) are kept in this browser's
 * localStorage. With no reachable API it runs in Demo mode on in-memory sample Holons.
 *
 * API endpoints VERIFIED against holons-api config/routes.rb (resources + devise_for :users), the
 * controllers' permitted params, the Pundit policies and test/test_helper.rb:
 *   POST /users/tokens/sign_in {email,password}        GET /up
 *   GET|POST /holons {holon:{name,description}}         GET /holons?scope=created|joined
 *   PATCH|DELETE /holons/:id (creator or admin only)
 *   GET|POST /posts {post:{holon_id,title,content}}     PATCH|DELETE /posts/:id
 *   GET|POST /comments {comment:{post_id,content}}      PATCH|DELETE /comments/:id
 *   GET|POST /holon_memberships {holon_membership:{holon_id,member_id}}   DELETE /holon_memberships/:id
 * UNVERIFIED (the devise-api gem source is not installed here; config/initializers/devise.rb enables
 * sign_up with extra_fields name, nickname): POST /users/tokens/sign_up, POST /users/tokens/revoke,
 * GET /users/tokens/info and the `resource_owner` object in the token answer.
 * holons-api has no course or module endpoints (the React front end keeps those in Firestore), so
 * courses are Demo-only, or "Local only" in this browser when connected. It has no invite endpoint.
 * Its jbuilder views omit post title and author ids, so ownership comes from scope=created, from
 * what this browser created, and the server's own 403 is the final word.
 */

const STORAGE_KEY = "holons-hangout:v1";
const SVG_NS = "http://www.w3.org/2000/svg";

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
const ORB_PATHS = [
  "M32 6C45 5 58 15 58 31C58 47 46 58 31 58C17 58 6 47 6 32C6 17 18 7 32 6Z",
  "M30 5C44 4 59 17 58 33C57 48 44 59 30 58C16 57 5 46 6 31C7 17 17 6 30 5Z",
  "M34 6C47 8 58 19 57 34C56 49 43 58 29 57C15 56 6 44 7 29C8 15 21 4 34 6Z",
];

const shade = (hex, k) => `#${[1, 3, 5].map((i) => { const v = parseInt(hex.slice(i, i + 2), 16); return Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)).toString(16).padStart(2, "0"); }).join("")}`;
// Light-to-dark tones for a voxel sphere lit from the top left.
const VOXEL_TONES = [0.5, 0.18, -0.12, -0.4];

/** Draws a disc of square voxels (the Hangout "voxel" welcome look): hard-edged cells, shaded in four tones like a sphere. */
function voxelDisc(parent, add, cx, cy, radius, cell, color, attrs = {}) {
  const half = Math.ceil(radius / cell);
  const paths = VOXEL_TONES.map(() => "");
  for (let gy = -half; gy <= half; gy += 1) {
    for (let gx = -half; gx <= half; gx += 1) {
      const nx = gx * cell / radius;
      const ny = gy * cell / radius;
      const d = Math.hypot(nx, ny);
      if (d <= 1) {
        const lit = (-nx * 0.55 - ny * 0.65) * 0.5 + 0.5 - d * d * 0.35;
        const tone = Math.min(VOXEL_TONES.length - 1, Math.max(0, Math.floor((1 - lit) * VOXEL_TONES.length)));
        paths[tone] += `M${+(cx + gx * cell - cell / 2).toFixed(2)} ${+(cy + gy * cell - cell / 2).toFixed(2)}h${cell}v${cell}h${-cell}z`;
      }
    }
  }
  const g = add(parent, "g", { "shape-rendering": "crispEdges", ...attrs });
  paths.forEach((d, i) => { if (d) add(g, "path", { d, fill: shade(color, VOXEL_TONES[i]) }); });
  return g;
}

// Mesh nodes around the orb (viewBox units). Each avatar rotates the ring a little so a column of them does not look stamped.
const MESH_NODES = [[32, 5, 3.6], [58, 21, 3], [53, 53, 3.6], [11, 53, 3], [6, 21, 3.6]];

/**
 * The avatar as a voxel mesh: the Hangout voxel orb (a sphere of hard square cells with two pill eyes that glance
 * around and blink) at the centre of a ring of small voxel orbs, each linked to its neighbours and to the centre.
 */
function orbSvg(blob, index) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("data-style", "voxel-orb");
  const delay = `${-((index * 7 + 3) % 53) / 10}s`;
  const add = (parent, tag, attrs) => {
    const n = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, String(v)));
    parent.append(n);
    return n;
  };
  const turn = (index % MESH_NODES.length) * 7;
  const mesh = add(svg, "g", { transform: `rotate(${turn} 32 33)` });
  const links = add(mesh, "g", { class: "mesh-links", stroke: blob.fill, "stroke-width": 1.4, opacity: 0.5 });
  MESH_NODES.forEach(([x, y], i) => {
    const [nx, ny] = MESH_NODES[(i + 1) % MESH_NODES.length];
    add(links, "line", { x1: 32, y1: 33, x2: x, y2: y });
    add(links, "line", { x1: x, y1: y, x2: nx, y2: ny });
  });
  MESH_NODES.forEach(([x, y, r], i) => {
    const node = voxelDisc(mesh, add, x, y, r, 2, blob.fill, { class: "mesh-node" });
    node.style.animationDelay = `${-((index * 3 + i * 7) % 29) / 10}s`;
  });
  const body = add(svg, "g", { class: "orb-body" });
  body.style.animationDelay = delay;
  voxelDisc(body, add, 32, 33, 16, 3, blob.fill);
  const look = add(body, "g", { class: "orb-look" });
  look.style.animationDelay = delay;
  const blink = add(look, "g", { class: "orb-blink" });
  blink.style.animationDelay = delay;
  [25, 34].forEach((x) => add(blink, "rect", { class: "pill-eye", x, y: 27, width: 5, height: 12, rx: 0, fill: "#1a0f33" }));
  return svg;
}

// ─── Flux avatars: the Hangout orb engine, ported from examples/canvas-apps/hangout (keep in sync) ──
// A metaball mass whose colours drift and whose body wobbles, with pill eyes that glance and blink.
function hashOf(text) {
  let h = 0;
  for (let i = 0; i < String(text).length; i += 1) h = (h * 31 + String(text).charCodeAt(i)) >>> 0;
  return h;
}

function seededRandom(seed = 7) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


// ─── Pill eyes on the blob: they blink, look around and curve with a sphere ──

const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function createEyes(rand) {
  return { yaw: 0, pitch: 0, vy: 0, vp: 0, ty: 0, tp: 0, look: 0.6, blinkAt: 1.5 + rand() * 2, blinkP: -1, again: false, closed: 0, pointer: null };
}

/** Moves the gaze toward its target, picks new glances, and runs blinks (a quick close and open, sometimes twice). */
function stepEyes(s, dt) {
  const e = s.eyes;
  const { rand, t } = s;
  const fresh = e.pointer && t - e.pointer.at < 2.5;
  if (fresh) {
    const R = s.eyeR;
    e.ty = clampN(((e.pointer.x - s.fx) / R) * 1.1, -0.55, 0.55);
    e.tp = clampN(((e.pointer.y - s.fy) / R) * 0.9, -0.38, 0.38);
  } else {
    e.look -= dt;
    if (e.look <= 0) {
      e.look = 0.9 + rand() * 2.4;
      e.ty = (rand() - 0.5) * 1.0;
      e.tp = (rand() - 0.5) * 0.6;
      if (rand() < 0.3) { e.ty = 0; e.tp = 0; }
    }
  }
  // A spring with damping: the eyes arrive quickly and settle without snapping.
  e.vy += (e.ty - e.yaw) * 90 * dt; e.vp += (e.tp - e.pitch) * 90 * dt;
  const damp = Math.max(0, 1 - 11 * dt);
  e.vy *= damp; e.vp *= damp;
  e.yaw += e.vy * dt; e.pitch += e.vp * dt;
  e.blinkAt -= dt;
  if (e.blinkP < 0 && e.blinkAt <= 0) { e.blinkP = 0; e.again = rand() < 0.2; }
  if (e.blinkP >= 0) {
    e.blinkP += dt / 0.18;
    e.closed = Math.sin(Math.PI * Math.min(1, e.blinkP));
    if (e.blinkP >= 1) {
      e.blinkP = -1; e.closed = 0;
      e.blinkAt = e.again ? 0.12 : 2 + rand() * 3.5;
      e.again = false;
    }
  }
}

/** The outline of one pill eye, bent onto the sphere: [{x, y}], for an eye centred at (yaw, pitch). */
function eyeOutline(s, yaw, pitch, squash = 1) {
  const R = s.eyeR;
  const a = 0.1, b = 0.27;
  const pts = [];
  const N = 14;
  const add = (u, v) => {
    const lat = pitch + v * squash;
    const lon = yaw + u / Math.max(0.3, Math.cos(pitch));
    pts.push({ x: s.fx + R * Math.sin(lon) * Math.cos(lat), y: s.fy + R * Math.sin(lat) });
  };
  for (let k = 0; k <= N; k += 1) { const f = (Math.PI * k) / N; add(a * Math.cos(f), -(b - a) - a * Math.sin(f)); }
  for (let k = 0; k <= N; k += 1) { const f = (Math.PI * k) / N; add(-a * Math.cos(f), b - a + a * Math.sin(f)); }
  return pts;
}

/** Both eyes for the current gaze and blink. */
function eyesOf(s) {
  const e = s.eyes;
  const squash = 1 - e.closed * 0.92;
  return [-0.3, 0.3].map((dx) => eyeOutline(s, e.yaw + dx, e.pitch, squash));
}

function drawEyes(ctx, s, color) {
  ctx.fillStyle = color || "#1a0f33";
  eyesOf(s).forEach((pts) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
  });
}

function createBlobScene(w, h, rand = Math.random) {
  const base = Math.min(w, h) * 0.105;
  const lobes = Array.from({ length: LOBE_COUNT }, (_, i) => ({ a: (i / LOBE_COUNT) * Math.PI * 2, d: base * 0.42, r: base * (0.5 + 0.12 * (i % 3)), sp: 0.4 + i * 0.07, ph: i * 1.3, ox: null, oy: null, or: base * 0.5 }));
  const scene = { w, h, base, rand, t: 0, lobes, minis: [], next: 0.6, bump: 0, balls: [], melted: 0, shed: 0, eyes: createEyes(rand), fx: w / 2, fy: h * 0.4, eyeR: base * 2, variant: null, shape: null, mainR: base };
  setBlobVariant(scene, "solid");
  scene.shape = BLOB_SHAPES[0];
  stepBlobScene(scene, 0);
  return scene;
}

const MAX_MINIS = 16;
const BLOB_RGB = [139, 92, 246];
const MINI_HUES = [[244, 114, 182], [52, 211, 153], [251, 191, 36], [56, 189, 248], [251, 113, 133], [163, 230, 53], [34, 211, 238], [249, 115, 22]];
const mixRgb = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));

/** Advances the scene by dt seconds: the mass wobbles, small blobs leave it or approach it, and melt when they arrive. */
function stepBlobScene(s, dt) {
  s.t += dt;
  const { t, base, w, h, rand } = s;
  const cx = w / 2 + Math.sin(t * 0.7) * base * 0.1;
  const cy = h * 0.4 + Math.cos(t * 0.55) * base * 0.08;
  s.fx = cx; s.fy = cy;
  stepEyes(s, dt);
  s.bump = Math.max(0, s.bump - dt * 0.35);
  s.next -= dt;
  if (s.next <= 0 && s.minis.length < MAX_MINIS) {
    s.next = 0.5 + rand() * 0.8;
    if (rand() < 0.78) {
      // Shed: a small blob pinches off the edge and drifts away. Sometimes two or three leave together.
      const burst = rand() < 0.35 ? 2 + Math.floor(rand() * 2) : 1;
      const a0 = rand() * Math.PI * 2;
      for (let k = 0; k < burst && s.minis.length < MAX_MINIS; k += 1) {
        const a = a0 + (k - (burst - 1) / 2) * 0.55 + (rand() - 0.5) * 0.3;
        const sp = 75 + rand() * 80;
        s.minis.push({ x: cx + Math.cos(a) * base * 0.95, y: cy + Math.sin(a) * base * 0.95, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: base * (0.13 + rand() * 0.2), state: "out", age: 0, ttl: 2.4 + rand() * 3, ph: rand() * 6, hue: MINI_HUES[Math.floor(rand() * MINI_HUES.length)] });
        s.shed += 1;
      }
    } else {
      const a = rand() * Math.PI * 2;
      const far = Math.max(w, h) * 0.5;
      s.minis.push({ x: cx + Math.cos(a) * far, y: cy + Math.sin(a) * far * 0.7, vx: 0, vy: 0, r: base * (0.13 + rand() * 0.2), state: "in", age: 0, ttl: 0, ph: rand() * 6, hue: MINI_HUES[Math.floor(rand() * MINI_HUES.length)] });
    }
  }
  s.minis.forEach((m) => {
    m.age += dt;
    if (m.state === "out") {
      m.x += m.vx * dt; m.y += m.vy * dt;
      const drag = Math.max(0, 1 - 0.45 * dt);
      m.vx *= drag; m.vy *= drag;
      if (m.age > m.ttl) m.state = "in";
    } else {
      const dx = cx - m.x, dy = cy - m.y;
      const d = Math.hypot(dx, dy) || 1;
      m.vx += (dx / d) * 170 * dt; m.vy += (dy / d) * 170 * dt;
      const drag = Math.max(0, 1 - 0.8 * dt);
      m.vx *= drag; m.vy *= drag;
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (d < base * 0.62) {
        const before = m.r;
        m.r *= Math.max(0, 1 - 2.4 * dt);
        s.bump = Math.min(0.4, s.bump + (before - m.r) / base);
      }
    }
  });
  const gone = s.minis.filter((m) => m.state === "in" && m.r < base * 0.035).length;
  s.melted += gone;
  s.minis = s.minis.filter((m) => !(m.state === "in" && m.r < base * 0.035));
  const baseRgb = (s.variant && s.variant.base) || BLOB_RGB;
  const grow = 1 + s.bump * 0.3;
  const sh = s.shape || BLOB_SHAPES[0];
  const ease = dt === 0 ? 1 : Math.min(1, dt * 6);
  const mainTarget = base * grow * (sh.pts ? sh.main : 1) * (1 + 0.05 * Math.sin(t * 1.9));
  s.mainR += (mainTarget - s.mainR) * ease;
  const balls = [{ x: cx, y: cy, r: s.mainR, rgb: baseRgb }];
  s.lobes.forEach((l, i) => {
    let tx, ty, tr;
    if (sh.pts) {
      const p = sh.pts[i % sh.pts.length];
      tx = p[0] * base * sh.k + Math.sin(t * 1.3 + l.ph) * base * 0.07;
      ty = p[1] * base * sh.k + Math.cos(t * 1.1 + l.ph) * base * 0.07;
      tr = base * sh.lr * (1 + 0.1 * Math.sin(t * 2.1 + l.ph));
    } else {
      const reach = l.d * (1 + 0.28 * Math.sin(t * 1.3 + l.ph)) * grow;
      tx = Math.cos(l.a + t * l.sp) * reach;
      ty = Math.sin(l.a + t * l.sp * 0.9) * reach;
      tr = l.r * (1 + 0.14 * Math.sin(t * 2.1 + l.ph));
    }
    if (l.ox === null) { l.ox = tx; l.oy = ty; l.or = tr; }
    l.ox += (tx - l.ox) * ease; l.oy += (ty - l.oy) * ease; l.or += (tr - l.or) * ease;
    balls.push({ x: cx + l.ox, y: cy + l.oy, r: l.or, rgb: baseRgb });
  });
  s.minis.forEach((m) => {
    // Violet at the surface, its own hue once it is clear of the mass, violet again as it melts back in.
    const away = clampN((Math.hypot(m.x - cx, m.y - cy) - s.eyeR * 1.15) / (s.eyeR * 0.7), 0, 1);
    m.rgb = mixRgb(baseRgb, m.hue || baseRgb, away);
    balls.push({ x: m.x, y: m.y, r: m.r * (1 + 0.1 * Math.sin(t * 3 + m.ph)), rgb: m.rgb });
  });
  // Vibration: every blob's radius shakes at the variation's frequency, and some jitter in place.
  const vibe = s.variant && s.variant.vibe;
  if (vibe) {
    balls.forEach((b, i) => {
      b.r *= 1 + vibe.amp * Math.sin(t * vibe.freq * Math.PI * 2 + i * 1.7);
      if (vibe.jit) { b.x += Math.sin(t * 47 + i * 5) * base * 0.02; b.y += Math.cos(t * 53 + i * 3) * base * 0.02; }
    });
  }
  s.balls = balls;
  // The eyes live on a sphere that is the mass itself: centred on the mass's real centroid, with its radius measured from there.
  const mass = balls.slice(0, 1 + s.lobes.length);
  let sx = 0, sy = 0, n = 0;
  const grid = base * 0.2, span = base * 4;
  for (let y = cy - span; y <= cy + span; y += grid) {
    for (let x = cx - span; x <= cx + span; x += grid) {
      if (blobField(mass, x, y) >= 1) { sx += x; sy += y; n += 1; }
    }
  }
  if (n) { s.fx = sx / n; s.fy = sy / n; }
  let sum = 0;
  for (let k = 0; k < 12; k += 1) {
    const ang = (k / 12) * Math.PI * 2;
    let r = base * 0.4;
    while (r < base * 5 && blobField(mass, s.fx + Math.cos(ang) * r, s.fy + Math.sin(ang) * r) >= 1) r += base * 0.04;
    sum += r;
  }
  s.eyeR += (sum / 12 * 0.9 - s.eyeR) * Math.min(1, dt * 8 + (dt === 0 ? 1 : 0));
}

/** The blob field at a point: 1 or more is inside the mass. */
function blobField(balls, x, y) {
  let f = 0;
  for (let i = 0; i < balls.length; i += 1) {
    const b = balls[i];
    const dx = x - b.x, dy = y - b.y;
    f += (b.r * b.r) / (dx * dx + dy * dy + 1);
  }
  return f;
}


// ─── Variations of the blob: colours, gradients and vibrations ───────────────

const hslToRgb = (h, sat, l) => {
  const hh = (((h % 360) + 360) % 360) / 30;
  const a = sat * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + hh) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
};
const stops = (list, u) => {
  const x = clampN(u, 0, 1) * (list.length - 1);
  const i = Math.min(list.length - 2, Math.floor(x));
  return mixRgb(list[i], list[i + 1], x - i);
};

/** A point on the mass as a point on a sphere: unit-sphere x, y and depth, longitude and latitude. Points outside the rim sit on the rim. */
function sphereCoords(s, x, y) {
  const R = Math.max(1, s.eyeR / 0.9);
  let u = (x - s.fx) / R, v = (y - s.fy) / R;
  const r = Math.hypot(u, v);
  if (r > 1) { u /= r; v /= r; }
  const w = Math.sqrt(Math.max(0, 1 - u * u - v * v));
  return { u, v, w, lon: Math.atan2(u, w), lat: Math.asin(v) };
};

const DEG = 180 / Math.PI;

/**
 * Each variation is a look for the mass: a flat base colour, or a colour function of position and time,
 * and how much it vibrates (radius wobble at a frequency in Hz, and optional jitter). The gradients are
 * drawn on a sphere, so their bands curve around the mass and bunch up toward its edge.
 */
const BLOB_VARIANTS = [
  { id: "solid", label: "Violet", dot: "#8b5cf6", base: [139, 92, 246] },
  { id: "rainbow", label: "Rainbow", dot: "#f59e0b", color: (x, y, t, s) => { const c = sphereCoords(s, x, y); return hslToRgb(t * 40 + c.lon * 110 + c.lat * 50, 0.85, 0.6); } },
  { id: "gradient", label: "Gradient", dot: "#ec4899", color: (x, y, t, s) => { const c = sphereCoords(s, x, y); const a = t * 0.3; const g = (c.u * Math.cos(a) + c.v * Math.sin(a)) * 0.8 + c.w * 0.6; return stops([[139, 92, 246], [236, 72, 153], [249, 115, 22]], (g + 0.9) / 1.9); } },
  { id: "aurora", label: "Aurora", dot: "#2dd4bf", color: (x, y, t, s) => { const c = sphereCoords(s, x, y); return hslToRgb(150 + 110 * (0.5 + 0.5 * Math.sin(c.lon * 2.4 + t * 0.9)) + 36 * Math.sin(c.lat * 3.2 - t * 0.6), 0.75, 0.58); } },
  { id: "sunset", label: "Sunset", dot: "#f97316", color: (x, y, t, s) => { const c = sphereCoords(s, x, y); const e = s.eyes; const sun = (c.u * Math.sin(e.yaw) * Math.cos(e.pitch) + c.v * Math.sin(e.pitch) + c.w * Math.cos(e.yaw) * Math.cos(e.pitch)); return stops([[76, 29, 149], [219, 39, 119], [249, 115, 22], [253, 224, 71]], (sun + 0.2) / 1.2); } },
  { id: "prism", label: "Prism", dot: "#3b82f6", color: (x, y, t, s) => { const c = sphereCoords(s, x, y); const a = t * 0.7; const lon = Math.atan2(c.u * Math.cos(a) + c.w * Math.sin(a), c.w * Math.cos(a) - c.u * Math.sin(a)); return hslToRgb(lon * DEG * 2 + c.lat * 40, 0.8, 0.6); } },
  { id: "neon", label: "Neon", dot: "#22d3ee", base: [34, 211, 238], color: (x, y, t) => mixRgb([34, 211, 238], [205, 255, 255], 0.18 + 0.17 * Math.sin(t * 6)), vibe: { amp: 0.05, freq: 6 } },
  { id: "jelly", label: "Jelly", dot: "#4ade80", base: [52, 211, 153], vibe: { amp: 0.1, freq: 2.2 } },
  { id: "fizz", label: "Fizz", dot: "#f43f5e", base: [244, 63, 94], vibe: { amp: 0.07, freq: 22, jit: true } },
  { id: "paper", label: "Paper", dot: "#efece4", base: [239, 236, 228], eye: "#2b2433" },
];

function setBlobVariant(scene, id) {
  scene.variant = BLOB_VARIANTS.find((v) => v.id === id) || BLOB_VARIANTS[0];
}

/** The colour a variation gives a point: its own function, or the blobs' flat colours. */
function variantColorAt(scene, x, y) {
  const v = scene.variant;
  return v.color ? v.color(x, y, scene.t, scene) : blobColorAt(scene.balls, x, y, v.base || BLOB_RGB);
}


// ─── Shapes the mass can take: each is an SVG outline, and the lobes glide to points along it ──

const perimeter = (poly, n) => {
  const pts = [...poly, poly[0]];
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const total = lens.reduce((a, b) => a + b, 0);
  return Array.from({ length: n }, (_, k) => {
    let d = (k / n) * total;
    let i = 0;
    while (i < lens.length - 1 && d > lens[i]) { d -= lens[i]; i += 1; }
    const f = lens[i] ? d / lens[i] : 0;
    return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
  });
};
const around = (n, f) => Array.from({ length: n }, (_, i) => f((i / n) * Math.PI * 2, i));
const LOBE_COUNT = 10;

/** The outlines, in unit coordinates (about -1 to 1), as polygons. The same points draw the rail icons and place the lobes. */
const SHAPE_POLYS = {
  square: [[-0.95, -0.95], [0.95, -0.95], [0.95, 0.95], [-0.95, 0.95]],
  triangle: [[0, -1.12], [1.05, 0.82], [-1.05, 0.82]],
  star: around(10, (a, i) => { const r = i % 2 ? 0.42 : 1.2; const t = a - Math.PI / 2; return [Math.cos(t) * r, Math.sin(t) * r]; }),
  heart: around(32, (a) => [(16 * Math.sin(a) ** 3) / 16 * 1.05, -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16 * 1.05 + 0.08]),
  cross: [[-0.36, -1], [0.36, -1], [0.36, -0.36], [1, -0.36], [1, 0.36], [0.36, 0.36], [0.36, 1], [-0.36, 1], [-0.36, 0.36], [-1, 0.36], [-1, -0.36], [-0.36, -0.36]],
  pill: [...Array.from({ length: 11 }, (_, i) => { const a = -Math.PI / 2 + (i / 10) * Math.PI; return [0.95 + Math.cos(a) * 0.46, Math.sin(a) * 0.46]; }), ...Array.from({ length: 11 }, (_, i) => { const a = Math.PI / 2 + (i / 10) * Math.PI; return [-0.95 + Math.cos(a) * 0.46, Math.sin(a) * 0.46]; })],
  hexagon: around(6, (a) => { const t = a - Math.PI / 2; return [Math.cos(t) * 1.08, Math.sin(t) * 1.08]; }),
  drop: around(32, (a) => [Math.sin(a) * Math.sin(a / 2) * 1.2, -Math.cos(a) * 1.08]),
};

// How each outline is built from blobs: how far out the lobes sit (k), how big they are (lr) and how much the centre fills (main).
const SHAPE_TUNING = {
  square: { k: 1.25, lr: 0.6, main: 0.75 },
  triangle: { k: 1.45, lr: 0.5, main: 0.5 },
  star: { k: 1.7, lr: 0.4, main: 0.3 },
  heart: { k: 1.45, lr: 0.52, main: 0.55 },
  cross: { k: 1.6, lr: 0.5, main: 0.55 },
  pill: { k: 1.6, lr: 0.56, main: 0.6 },
  hexagon: { k: 1.35, lr: 0.6, main: 0.7 },
  drop: { k: 1.5, lr: 0.5, main: 0.55 },
};

const BLOB_SHAPES = [
  { id: "blob", label: "Blob" },
  ...Object.keys(SHAPE_POLYS).map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1), poly: SHAPE_POLYS[id], pts: perimeter(SHAPE_POLYS[id], LOBE_COUNT), ...SHAPE_TUNING[id] })),
];

function setBlobShape(scene, id) {
  scene.shape = BLOB_SHAPES.find((sh) => sh.id === id) || BLOB_SHAPES[0];
  scene.bump = Math.min(0.4, scene.bump + 0.25);
}

/** An SVG icon for a shape: its outline, or a loose blob for the organic one. */
function shapeIcon(shape) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linejoin", "round");
  if (shape.poly) {
    const poly = document.createElementNS(SVG_NS, "polygon");
    poly.setAttribute("points", shape.poly.map(([x, y]) => `${(12 + x * 9).toFixed(1)},${(12 + y * 9).toFixed(1)}`).join(" "));
    svg.append(poly);
  } else {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", "M12 3c4 0 8 2.2 8.6 6.4.5 3.5-1.7 4.6-1.6 7C18.8 20 14.8 21.5 11 21 6.6 20.4 3.4 17.6 3.5 13.4 3.6 10 6 8.8 6.4 6.6 6.8 4.4 9 3 12 3Z");
    svg.append(path);
  }
  return svg;
}

/** The flat colour at a point: each blob's colour weighted by how much of the field it supplies there. */
function blobColorAt(balls, x, y, fallback = BLOB_RGB) {
  let f = 0, r = 0, g = 0, b = 0;
  for (let i = 0; i < balls.length; i += 1) {
    const ball = balls[i];
    const dx = x - ball.x, dy = y - ball.y;
    const c = (ball.r * ball.r) / (dx * dx + dy * dy + 1);
    const rgb = ball.rgb || fallback;
    f += c; r += c * rgb[0]; g += c * rgb[1]; b += c * rgb[2];
  }
  return f ? [Math.round(r / f), Math.round(g / f), Math.round(b / f)] : fallback;
}

/** Draws the scene in one flat colour per blob. Smooth mode softens the edge; voxel mode keeps hard square cells. */
function drawBlobScene(ctx, off, scene, mode, rgb, cellSize) {
  const voxel = mode === "voxel";
  const cell = cellSize || (voxel ? 14 : 4);
  const gw = Math.ceil(scene.w / cell), gh = Math.ceil(scene.h / cell);
  if (off.width !== gw || off.height !== gh) { off.width = gw; off.height = gh; }
  const octx = off.getContext("2d");
  const img = octx.createImageData(gw, gh);
  for (let gy = 0; gy < gh; gy += 1) {
    for (let gx = 0; gx < gw; gx += 1) {
      const f = blobField(scene.balls, (gx + 0.5) * cell, (gy + 0.5) * cell);
      const a = voxel ? (f > 1 ? 255 : 0) : Math.max(0, Math.min(1, (f - 0.9) / 0.18)) * 255;
      if (a) {
        const i = (gy * gw + gx) * 4;
        const c = variantColorAt(scene, (gx + 0.5) * cell, (gy + 0.5) * cell);
        img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = a;
      }
    }
  }
  octx.putImageData(img, 0, 0);
  ctx.clearRect(0, 0, scene.w, scene.h);
  ctx.imageSmoothingEnabled = !voxel;
  ctx.drawImage(off, 0, 0, gw * cell, gh * cell);
}

// ─── Flux orbs: the welcome blob in miniature, with its own colour variation and shape ──
const fluxLive = new Set();
let fluxTimer = 0;
const FLUX_VARIANTS = ["aurora", "sunset", "prism", "gradient", "rainbow", "neon"];

function fluxTick() {
  fluxLive.forEach((orb) => {
    if (!orb.canvas.isConnected) { fluxLive.delete(orb); return; }
    const r = orb.canvas.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    stepBlobScene(orb.scene, 0.05);
    orb.paint();
  });
  if (!fluxLive.size) { clearInterval(fluxTimer); fluxTimer = 0; }
}

const FREE_COUNT = 9;

/**
 * Orbs that float freely in 3D around the orb: every orb wanders on its own slow, non-repeating path (sums of sines
 * at unrelated speeds) through a shell of space, so nothing circles in a lane. Depth sets size and brightness, and
 * orbs pass in front of or behind the core, and every so often one merges into it and pulls back out. They are softly shaded discs in the core's colours, like the orbs it sheds.
 */
function createFreeOrbs(rand) {
  const axis = () => ({ f: 0.12 + rand() * 0.3, p: rand() * 6.3, g: 0.07 + rand() * 0.18, q: rand() * 6.3 });
  const orbs = Array.from({ length: FREE_COUNT }, () => ({ x: axis(), y: axis(), z: axis(), r: axis(), size: 0.9 + rand() * 0.6, cycle: 16 + rand() * 20, at: rand(), c: MINI_HUES[Math.floor(rand() * MINI_HUES.length)] }));
  return { orbs, t: rand() * 50 };
}

const freeAt = (o, t) => {
  const wave = (a) => Math.sin(a.f * t + a.p) + 0.6 * Math.sin(a.g * t * 2.3 + a.q);
  let x = wave(o.x), y = wave(o.y), z = wave(o.z);
  const len = Math.hypot(x, y, z) || 1;
  const r = 0.78 + 0.22 * (0.5 + 0.5 * Math.sin(o.r.f * t * 1.7 + o.r.p));
  x = (x / len) * r; y = (y / len) * r; z = (z / len) * r;
  // Now and then an orb dives into the core and pulls back out: `dive` rises 0 -> 1 -> 0 over a third of its cycle.
  const u = ((t / o.cycle + o.at) % 1 + 1) % 1;
  const dive = u < 0.34 ? Math.sin((u / 0.34) * Math.PI) ** 1.5 : 0;
  const pull = 1 - 0.95 * dive;
  x *= pull; y *= pull; z *= pull;
  const k = 1 / (1 - z * 0.2);
  return { x, y, z, k, dive };
};

/** How much the core swells as orbs melt into it (about 0 to 0.1). */
const freeBulge = (m) => m.orbs.reduce((sum, o) => sum + freeAt(o, m.t).dive ** 5 * 0.05, 0);

/**
 * Draws the orbs behind the core (front = false) or in front of it (front = true). Each orb is a soft disc with a halo,
 * in the same colours as the core and the orbs it sheds (`tint` gives the core's colour at a point).
 */
function drawFreeOrbs(ctx, m, size, front, tint) {
  const c = size / 2;
  const R = size * 0.31;
  // A soft body with a wide halo of the same colour: blurred at the edge and glowing, but still the core's flat colours.
  const disc = (x, y, r, col) => {
    const halo = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 1.7);
    halo.addColorStop(0, rgba(col, 0.28));
    halo.addColorStop(0.5, rgba(col, 0.07));
    halo.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.7, 0, Math.PI * 2);
    ctx.fill();
    // Subtle depth: lit from the top left, a little darker toward the lower right.
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, 0, x, y, r * 1.05);
    g.addColorStop(0, rgba(mixRgb(col, [255, 255, 255], 0.3), 1));
    g.addColorStop(0.5, rgba(col, 1));
    g.addColorStop(0.9, rgba(mixRgb(col, [0, 0, 0], 0.3), 0.92));
    g.addColorStop(1, rgba(mixRgb(col, [0, 0, 0], 0.3), 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.05, 0, Math.PI * 2);
    ctx.fill();
  };
  m.orbs.forEach((o) => {
    const p = freeAt(o, m.t);
    // Only orbs well clear of the core are drawn over it; one diving in sinks behind the face, never across it.
    if ((p.z >= 0 && p.dive < 0.04) !== front) return;
    const x = c + p.x * R * p.k;
    const y = c + p.y * R * p.k;
    const col = tint(x, y);
    if (!front && p.dive > 0.04) {
      // A neck of the same flat colour between the core and the orb while it dives in or climbs out.
      const neck = 4 * p.dive * (1 - p.dive) + p.dive * 0.4;
      for (let n = 1; n < 9; n += 1) {
        const w = n / 9;
        disc(c + (x - c) * w, c + (y - c) * w, size * 0.03 * o.size * (1 - w * 0.4) * neck, col);
      }
    }
    disc(x, y, size * 0.036 * o.size * p.k * (1 + p.dive * 0.2), col);
  });
}

const MESH_COUNT = 8;
const BEADS = 5;
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/**
 * A small web in orbit around the orb: a ring of nodes joined by strands of glowing beads (no drawn lines) with spokes running in to a hub behind the orb. Glowing particle orbs travel the strands; a traveller that
 * reaches a node hops onto one of that node's other strands.
 */
function createOrbitMesh(rand) {
  const nodes = Array.from({ length: MESH_COUNT }, (_, i) => ({ phase: (i / MESH_COUNT) * Math.PI * 2 + (rand() - 0.5) * 0.35, wob: rand() * 6, rad: 0.88 + rand() * 0.24, c: MINI_HUES[Math.floor(rand() * MINI_HUES.length)] }));
  nodes.push({ hub: true, wob: 0, c: [255, 255, 255] });
  const links = [];
  nodes.slice(0, MESH_COUNT).forEach((_, i) => { links.push([i, (i + 1) % MESH_COUNT]); if (i % 2 === 0) links.push([i, MESH_COUNT]); if (i % 4 === 1) links.push([i, (i + 3) % MESH_COUNT]); });
  const hop = (from) => {
    const options = links.filter(([a, b]) => a === from || b === from);
    const [a, b] = options[Math.floor(rand() * options.length)];
    return { from, to: a === from ? b : a, at: 0, speed: 0.3 + rand() * 0.45 };
  };
  const travellers = Array.from({ length: 9 }, (_, i) => { const t = hop(i % MESH_COUNT); t.at = rand(); return t; });
  return { nodes, links, travellers, hop, t: 0 };
}

function stepOrbitMesh(m, dt) {
  m.t += dt;
  m.nodes.forEach((n) => { if (n.flash) n.flash = Math.max(0, n.flash - dt * 2.2); });
  m.travellers.forEach((tr, i) => {
    tr.at += tr.speed * dt;
    if (tr.at >= 1) { m.nodes[tr.to].flash = 1; m.travellers[i] = m.hop(tr.to); }
  });
}

function drawOrbitMesh(ctx, m, size) {
  const c = size / 2;
  const R = size * 0.36;
  const at = (n) => {
    if (n.hub) return [c, c];
    const a = n.phase + m.t * 0.2;
    const r = R * n.rad * (1 + Math.sin(m.t * 0.9 + n.wob) * 0.05);
    return [c + Math.cos(a) * r, c + Math.sin(a) * r];
  };
  const pts = m.nodes.map(at);
  // A strand runs straight between its two nodes.
  const strand = (a, b, u) => {
    const [x1, y1] = pts[a];
    const [x2, y2] = pts[b];
    const sag = 0;
    const cx = (x1 + x2) / 2 + (c - (x1 + x2) / 2) * sag;
    const cy = (y1 + y2) / 2 + (c - (y1 + y2) / 2) * sag;
    const v = 1 - u;
    return [v * v * x1 + 2 * v * u * cx + u * u * x2, v * v * y1 + 2 * v * u * cy + u * u * y2];
  };
  // Particle material: each orb is a soft additive glow with a hot core, and shed sparks that twinkle around the nodes.
  const glow = (x, y, r, col, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${a * 0.8})`);
    g.addColorStop(0.18, rgba(col, a));
    g.addColorStop(0.55, rgba(col, a * 0.85));
    g.addColorStop(0.8, rgba(col, a * 0.3));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  ctx.globalCompositeOperation = "lighter";
  // The web itself is made of orbs: each strand is a string of small glowing beads (no drawn line) that shimmer in
  // a wave, tinted by the two nodes it joins, with a soft halo behind the whole web.
  glow(c, c, R * 1.35, [120, 110, 255], 0.16);
  m.links.forEach(([a, b], li) => {
    const mix = mixRgb(m.nodes[a].c, m.nodes[b].c, 0.5);
    for (let k = 1; k < BEADS; k += 1) {
      const [x, y] = strand(a, b, k / BEADS);
      const wave = 0.5 + 0.5 * Math.sin(m.t * 2.4 - k * 0.9 + li);
      glow(x, y, size * (0.03 + 0.016 * wave), mix, 0.45 + 0.45 * wave);
    }
  });
  m.nodes.forEach((n, i) => {
    if (n.hub) return;
    glow(pts[i][0], pts[i][1], size * 0.125, n.c, 1);
    for (let k = 0; k < 2; k += 1) {
      const a = m.t * (0.9 + k * 0.35) + n.wob * (k + 1);
      const d = size * (0.08 + 0.03 * Math.sin(m.t * 1.7 + k + n.wob));
      glow(pts[i][0] + Math.cos(a) * d, pts[i][1] + Math.sin(a * 1.3) * d, size * 0.034, n.c, 0.4 + 0.4 * Math.sin(m.t * 3 + k * 2 + n.wob) ** 2);
    }
  });
  m.travellers.forEach((tr) => {
    const col = m.nodes[tr.to].hub ? m.nodes[tr.from].c : m.nodes[tr.to].c;
    for (let k = 5; k >= 0; k -= 1) {
      const [x, y] = strand(tr.from, tr.to, Math.max(0, tr.at - k * 0.04));
      glow(x, y, size * (k ? 0.05 - k * 0.006 : 0.085), col, k ? 0.6 - k * 0.08 : 1);
    }
  });
  ctx.globalCompositeOperation = "source-over";
}

/**
 * Experiment: the orbit web as an energy network. Links are thin crackling arcs, streams of tiny particles run along
 * them, travelling pulses flash a node when they arrive and the node throws off sparks.
 */
function drawEnergyMesh(ctx, m, size) {
  const c = size / 2;
  const R = size * 0.36;
  const pts = m.nodes.map((n) => {
    if (n.hub) return [c, c];
    const a = n.phase + m.t * 0.2;
    const r = R * n.rad * (1 + Math.sin(m.t * 0.9 + n.wob) * 0.05);
    return [c + Math.cos(a) * r, c + Math.sin(a) * r];
  });
  const px = Math.max(1, size / 170);
  const tick = Math.floor(m.t * 16);
  const spot = (x, y, r, col, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(0.35, rgba(col, a * 0.8));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  m.links.forEach(([a, b], li) => {
    const [x1, y1] = pts[a];
    const [x2, y2] = pts[b];
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = -(y2 - y1) / len;
    const ny = (x2 - x1) / len;
    const col = mixRgb(m.nodes[a].c, m.nodes[b].c, 0.5);
    const live = 0.55 + 0.45 * Math.sin(m.t * 5 + li * 2.1) ** 2;
    const SEG = 9;
    ctx.beginPath();
    for (let k = 0; k <= SEG; k += 1) {
      const u = k / SEG;
      const hash = Math.sin((tick + li * 7 + k * 13) * 12.9898) * 43758.5453;
      const jitter = (hash - Math.floor(hash) - 0.5) * size * 0.03 * Math.sin(u * Math.PI);
      const x = x1 + (x2 - x1) * u + nx * jitter;
      const y = y1 + (y2 - y1) * u + ny * jitter;
      if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.strokeStyle = rgba(col, 0.16 * live);
    ctx.lineWidth = px * 3.2;
    ctx.stroke();
    ctx.strokeStyle = rgba(mixRgb(col, [255, 255, 255], 0.5), 0.55 * live);
    ctx.lineWidth = px * 0.9;
    ctx.stroke();
    // A stream of tiny particles flowing along the link.
    for (let i = 0; i < 7; i += 1) {
      const u = (m.t * (0.18 + (li % 3) * 0.05) + i / 7 + li * 0.17) % 1;
      const wob = Math.sin(m.t * 6 + i * 3 + li) * size * 0.008;
      spot(x1 + (x2 - x1) * u + nx * wob, y1 + (y2 - y1) * u + ny * wob, px * 2.4, col, 0.85);
    }
  });
  m.nodes.forEach((n, i) => {
    if (n.hub) return;
    const [x, y] = pts[i];
    const flash = n.flash || 0;
    spot(x, y, size * (0.035 + 0.03 * flash), n.c, 0.8 + 0.2 * flash);
    // Sparks thrown outward from the node, brighter right after a pulse lands.
    for (let k = 0; k < 6; k += 1) {
      const life = (m.t * (0.7 + (k % 3) * 0.25) + k / 6 + i * 0.31) % 1;
      const ang = k * 1.047 + n.wob + i;
      const d = size * (0.015 + life * 0.07);
      spot(x + Math.cos(ang) * d, y + Math.sin(ang) * d, px * 1.8 * (1 - life * 0.6), n.c, (1 - life) * (0.45 + flash));
    }
  });
  m.travellers.forEach((tr) => {
    const [x1, y1] = pts[tr.from];
    const [x2, y2] = pts[tr.to];
    const col = m.nodes[tr.to].hub ? m.nodes[tr.from].c : m.nodes[tr.to].c;
    for (let k = 6; k >= 0; k -= 1) {
      const u = Math.max(0, tr.at - k * 0.03);
      spot(x1 + (x2 - x1) * u, y1 + (y2 - y1) * u, size * (k ? 0.02 * (1 - k * 0.1) : 0.04), col, k ? 0.4 * (1 - k * 0.12) : 1);
    }
  });
  ctx.globalCompositeOperation = "source-over";
}

/** An animated orb avatar: colours that drift and a body that wobbles, with a mesh of nodes and travelling orbs in orbit. */
function fluxOrb({ variant = "aurora", shape = "blob", seed = "orb", size = 72, orbit = "web" } = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = "flux";
  // Backing store at device resolution, so a big orb stays sharp on dense screens; drawing stays in `size` units.
  const dpr = Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
  canvas.width = Math.round(size * dpr); canvas.height = Math.round(size * dpr);
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.variant = variant;
  canvas.dataset.shape = shape;
  const ctx = canvas.getContext?.("2d");
  if (!ctx) return canvas;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // A finer field for big orbs, so the edge of the mass is smooth rather than stepped.
  const W = size > 200 ? 480 : 320;
  const cell = size > 200 ? 2 : size > 100 ? 3 : 5;
  const scene = createBlobScene(W, W, seededRandom(hashOf(seed)));
  setBlobVariant(scene, variant);
  setBlobShape(scene, shape);
  for (let i = 0; i < 40; i += 1) stepBlobScene(scene, 0.1);
  const big = document.createElement("canvas");
  big.width = W; big.height = W;
  const bctx = big.getContext("2d");
  bctx.imageSmoothingQuality = "high";
  const off = document.createElement("canvas");
  const mesh = createOrbitMesh(seededRandom(hashOf(`${seed}mesh`)));
  const free = orbit === "free" ? createFreeOrbs(seededRandom(hashOf(`${seed}free`))) : null;
  const core = size * (free ? 0.44 : 0.58);
  const paint = () => {
    drawBlobScene(bctx, off, scene, "smooth", BLOB_RGB, cell);
    drawEyes(bctx, scene, scene.variant.eye);
    ctx.imageSmoothingQuality = "high";
    const side = scene.base * 6.8;
    const tint = (px, py) => variantColorAt(scene, scene.fx + ((px - size / 2) * side) / core, scene.fy + ((py - size / 2) * side) / core);
    ctx.clearRect(0, 0, size, size);
    if (free) {
      free.t += 0.05;
      drawFreeOrbs(ctx, free, size, false, tint);
    } else {
      stepOrbitMesh(mesh, 0.05);
      if (orbit === "energy") drawEnergyMesh(ctx, mesh, size);
      else drawOrbitMesh(ctx, mesh, size);
    }
    const swell = free ? core * (1 + Math.min(0.12, freeBulge(free))) : core;
    ctx.drawImage(big, scene.fx - side / 2, scene.fy - side / 2, side, side, (size - swell) / 2, (size - swell) / 2, swell, swell);
    if (free) drawFreeOrbs(ctx, free, size, true, tint);
  };
  paint();
  fluxLive.add({ canvas, scene, paint });
  if (!fluxTimer) fluxTimer = setInterval(fluxTick, 50);
  return canvas;
}

/** The original Holons avatar, saved as the "orb" style: one flat blob that wobbles, with two pill eyes that glance around and blink. */
function flatOrbSvg(blob, index) {
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
  const halo = add(svg, "circle", { cx: 32, cy: 33, r: 31, fill: blob.fill, opacity: 0.16 });
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

/** The avatar for an agent, tinted per agent: the Hangout voxel orb at the centre of a small mesh of linked voxel orbs. */
export function blobSvg(blobId) {
  const blob = BLOBS.find((b) => b.id === blobId) || BLOBS[0];
  return orbSvg(blob, BLOBS.indexOf(blob));
}

const isObject = (v) => v && typeof v === "object" && !Array.isArray(v);

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
const HTTP_URL = /^https?:\/\//i;
let urlPolicy = SAFE_URL; // set per renderMarkdown call; the docs reader allows http(s) only
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

/** Renders markdown into a container element. Tolerates half-finished text, so it is safe to call as a reply streams in.
 *  `httpOnly` limits links to http(s) (the docs reader); the default also allows mailto:. */
export function renderMarkdown(source, { httpOnly = false } = {}) {
  const previous = urlPolicy;
  urlPolicy = httpOnly ? HTTP_URL : SAFE_URL;
  try { return buildMarkdown(source); } finally { urlPolicy = previous; }
}

function buildMarkdown(source) {
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

/** A one-line plain version of a message, for the list preview. */
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



// ─── holons-api client ────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(message, status = 0) { super(message); this.name = "ApiError"; this.status = status; }
}

export const normalizeBase = (url) => String(url || "").trim().replace(/\/+$/, "");

/** A small client for holons-api. `fetchFn` is injectable for tests. Rails answers JSON; errors are { error } or field errors. */
export function createClient({ baseUrl, token = "", fetchFn = (...a) => globalThis.fetch(...a) } = {}) {
  const base = normalizeBase(baseUrl);
  async function request(method, path, body, { auth = true } = {}) {
    if (!base) throw new ApiError("No API address set.");
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth && token) headers.Authorization = `Bearer ${token}`;
    let res;
    try {
      res = await fetchFn(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new ApiError(`Could not reach ${base}. Is holons-api running, and does it allow this origin (CORS)?`);
    }
    let data = null;
    try { data = res.status === 204 ? null : await res.json(); } catch { /* empty or non-JSON body */ }
    if (!res.ok) {
      const detail = data && (data.error || data.errors || (typeof data === "object" ? Object.entries(data).map(([k, v]) => `${k} ${[].concat(v).join(", ")}`).join("; ") : ""));
      const msg = res.status === 401 ? "Not signed in, or the token expired." : `holons-api answered ${res.status}${detail ? `: ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`;
      throw new ApiError(msg, res.status);
    }
    return data;
  }
  return {
    mode: "live",
    base,
    health: () => request("GET", "/up", undefined, { auth: false }).then(() => true),
    /** devise-api token call; the JSON answer carries `token` and (unverified) `resource_owner`. */
    async authenticate(path, body) {
      const data = await request("POST", path, body, { auth: false });
      const token = data && (typeof data.token === "string" ? data.token : data.token && data.token.access_token);
      if (!token) return { token: "", owner: null, data };
      const o = data.resource_owner;
      return { token, owner: o && o.id !== undefined ? { id: o.id, email: o.email || body.email, name: o.name || o.nickname || "" } : null, data };
    },
    async signIn(email, password) {
      const { token } = await this.authenticate("/users/tokens/sign_in", { email, password });
      if (!token) throw new ApiError("Signed in, but the server returned no token.");
      return token;
    },
    /** UNVERIFIED route: devise-api sign_up (enabled in holons-api's devise.rb). Top-level params, like sign_in. */
    signUp(fields) { return this.authenticate("/users/tokens/sign_up", fields); },
    /** UNVERIFIED route: revokes the current token. */
    signOut: () => request("POST", "/users/tokens/revoke"),
    /** UNVERIFIED route: the signed-in user, used only when the token answer has no resource_owner. */
    async whoami() {
      const d = await request("GET", "/users/tokens/info");
      const o = d && (d.resource_owner || d.user);
      return o && o.id !== undefined ? { id: o.id, email: o.email || "", name: o.name || o.nickname || "" } : null;
    },
    listHolons: (scope) => request("GET", `/holons${scope ? `?scope=${encodeURIComponent(scope)}` : ""}`),
    createHolon: (holon) => request("POST", "/holons", { holon }),
    updateHolon: (id, holon) => request("PATCH", `/holons/${encodeURIComponent(id)}`, { holon }),
    deleteHolon: (id) => request("DELETE", `/holons/${encodeURIComponent(id)}`),
    // Rails exposes every post / comment; the holon or post filter happens here (no server-side filter exists).
    listPosts: async (holonId) => (await request("GET", "/posts")).filter((p) => p.holon_id === holonId),
    createPost: (post) => request("POST", "/posts", { post }),
    updatePost: (id, post) => request("PATCH", `/posts/${encodeURIComponent(id)}`, { post }),
    deletePost: (id) => request("DELETE", `/posts/${encodeURIComponent(id)}`),
    listComments: async (postId) => (await request("GET", "/comments")).filter((c) => c.post_id === postId),
    createComment: (comment) => request("POST", "/comments", { comment }),
    updateComment: (id, comment) => request("PATCH", `/comments/${encodeURIComponent(id)}`, { comment }),
    deleteComment: (id) => request("DELETE", `/comments/${encodeURIComponent(id)}`),
    listMemberships: (holonId) => request("GET", `/holon_memberships?holon_id=${encodeURIComponent(holonId)}`),
    createMembership: (holon_membership) => request("POST", "/holon_memberships", { holon_membership }),
    deleteMembership: (id) => request("DELETE", `/holon_memberships/${encodeURIComponent(id)}`),
    inviteSupported: false,
    listCourses: async () => [],
    listModules: async () => [],
    coursesSupported: false,
  };
}

// ─── Courses and modules: no holons-api routes, so an in-memory (Demo) or browser-local store ─────

const COURSES_KEY = "holons-hangout:local-courses:v1";
const blank = (v) => !String(v || "").trim();

/** Courses and modules with create, reorder and complete. `save` (optional) persists the whole state. */
export function createCourseStore(seed, { save, idPrefix = "" } = {}) {
  const st = { courses: (seed.courses || []).map((c) => ({ ...c })), modules: (seed.modules || []).map((m) => ({ ...m })), next: seed.next || 100 };
  const persist = () => { if (save) save(st); };
  const newId = () => (idPrefix ? `${idPrefix}${st.next++}` : st.next++);
  const find = (id) => st.modules.findIndex((m) => String(m.id) === String(id));
  return {
    state: st,
    listCourses: async (holonId) => st.courses.filter((c) => c.holon_id === holonId),
    listModules: async (courseId) => st.modules.filter((m) => String(m.course_id) === String(courseId)),
    createCourse: async ({ holon_id, name, description = "" }) => {
      if (blank(name)) throw new ApiError("Course name can't be blank.", 422);
      const row = { id: newId(), holon_id, name: name.trim(), description: description.trim(), local: Boolean(idPrefix) };
      st.courses.push(row); persist();
      return { ...row };
    },
    createModule: async ({ course_id, name, body = "" }) => {
      if (blank(name)) throw new ApiError("Module name can't be blank.", 422);
      if (!st.courses.some((c) => String(c.id) === String(course_id))) throw new ApiError("Pick a course first.", 422);
      const row = { id: newId(), course_id, name: name.trim(), body, completed: false };
      st.modules.push(row); persist();
      return { ...row };
    },
    /** Moves a module one step earlier (-1) or later (+1) within its course. */
    moveModule: async (id, dir) => {
      const i = find(id);
      if (i < 0) throw new ApiError("That module no longer exists.", 404);
      const sibs = st.modules.map((m, n) => ({ m, n })).filter((x) => String(x.m.course_id) === String(st.modules[i].course_id));
      const at = sibs.findIndex((x) => x.n === i);
      const other = sibs[at + dir];
      if (!other) return false;
      [st.modules[i], st.modules[other.n]] = [st.modules[other.n], st.modules[i]];
      persist();
      return true;
    },
    setComplete: async (id, completed) => {
      const i = find(id);
      if (i < 0) throw new ApiError("That module no longer exists.", 404);
      st.modules[i] = { ...st.modules[i], completed: Boolean(completed) };
      persist();
    },
  };
}

/** Wraps a live client with browser-local courses for one base URL. Nothing here is sent to the server. */
export function withLocalCourses(client, storage = globalThis.localStorage) {
  let all = {};
  try { all = JSON.parse(storage.getItem(COURSES_KEY) || "{}"); } catch { all = {}; }
  const mine = all[client.base] || {};
  const store = createCourseStore({ ...mine, next: mine.next || 1 }, {
    idPrefix: "L",
    save: (st) => { all[client.base] = { courses: st.courses, modules: st.modules, next: st.next }; try { storage.setItem(COURSES_KEY, JSON.stringify(all)); } catch { /* storage blocked */ } },
  });
  return Object.assign(client, { localCourses: true, ...Object.fromEntries(["listCourses", "listModules", "createCourse", "createModule", "moveModule", "setComplete"].map((k) => [k, store[k]])) });
}

// ─── Demo mode: in-memory sample Holons that answer like the client ──────────

const ago = (min) => new Date(Date.now() - min * 60000).toISOString();

export function createDemo() {
  const users = [
    { id: 1, name: "Ada Lovelace", role: "moderator" }, { id: 2, name: "Grace Hopper", role: "moderator" },
    { id: 3, name: "Alan Turing", role: "member" }, { id: 4, name: "Katherine Johnson", role: "member" },
    { id: 5, name: "Linus Torvalds", role: "member" }, { id: 6, name: "You", role: "member" },
  ];
  const holons = [
    { id: 1, creator_id: 1, name: "Open Source Academy", description: "Learn to contribute to open source.", created_at: ago(9000), updated_at: ago(60) },
    { id: 2, creator_id: 4, name: "Garden Circle", description: "Permaculture, seeds and soil, together.", created_at: ago(7000), updated_at: ago(300) },
    { id: 3, creator_id: 3, name: "Night Owls Chess", description: "Weekly puzzles and game reviews.", created_at: ago(5000), updated_at: ago(1500) },
  ];
  const memberships = [
    ...[1, 2, 3, 4, 6].map((m, i) => ({ id: i + 1, holon_id: 1, member_id: m })),
    ...[2, 4, 5, 6].map((m, i) => ({ id: i + 10, holon_id: 2, member_id: m })),
    ...[3, 5, 6].map((m, i) => ({ id: i + 20, holon_id: 3, member_id: m })),
  ];
  const posts = [
    { id: 1, holon_id: 1, author_id: 1, title: "Welcome to Open Source Academy", content: "Say hi and tell us what you want to **ship** this term.\n\n- Pick a project\n- Read `CONTRIBUTING.md`\n- Open a first PR", created_at: ago(900), updated_at: ago(900) },
    { id: 2, holon_id: 1, author_id: 2, title: "Office hours moved", content: "Thursday at 17:00 UTC. Notes land in [the wiki](https://example.com/wiki).", created_at: ago(240), updated_at: ago(240) },
    { id: 3, holon_id: 2, author_id: 4, title: "Seed swap Saturday", content: "Bring **tomatoes**, basil, anything heirloom.", created_at: ago(700), updated_at: ago(700) },
    { id: 4, holon_id: 3, author_id: 3, title: "Puzzle of the week", content: "White to move and mate in three:\n\n```\n8/8/8/3k4/8/3K4/3Q4/8 w - - 0 1\n```", created_at: ago(1600), updated_at: ago(1600) },
  ];
  const comments = [
    { id: 1, post_id: 1, author_id: 3, content: "Hi! I want to fix a docs bug first.", created_at: ago(800), updated_at: ago(800) },
    { id: 2, post_id: 1, author_id: 1, content: "Great pick. Start with the *good first issue* label.", created_at: ago(780), updated_at: ago(780) },
  ];
  const courseStore = createCourseStore({
    courses: [
      { id: 1, holon_id: 1, instructor_id: 1, name: "Git and Pull Requests", description: "From `git init` to a merged PR." },
      { id: 2, holon_id: 1, instructor_id: 2, name: "Reading Large Codebases", description: "Navigate unfamiliar code with confidence." },
      { id: 3, holon_id: 2, instructor_id: 4, name: "Soil Science 101", description: "What lives under your feet." },
    ],
    modules: [
      { id: 1, course_id: 1, name: "Branching", body: "## Branching\n\nA branch is a movable pointer to a commit.\n\n```bash\ngit switch -c my-fix\n```" },
      { id: 2, course_id: 1, name: "Opening a PR", body: "## Opening a PR\n\n1. Push your branch\n2. Describe the **why**\n3. Request review" },
      { id: 3, course_id: 2, name: "Start from the tests", body: "Tests show intent. Read them first." },
      { id: 4, course_id: 3, name: "Compost", body: "## Compost\n\nGreens and browns, about 1:3." },
    ],
    next: 100,
  });
  const ME = 6;
  let next = { post: 100, comment: 100, holon: 100, membership: 100 };
  const now = () => new Date().toISOString();
  const need = (v, what) => { if (blank(v)) throw new ApiError(`${what} can't be blank.`, 422); };
  const find = (list, id, what) => { const row = list.find((x) => x.id === id); if (!row) throw new ApiError(`${what} not found.`, 404); return row; };
  const ownerOnly = (row, what) => { if (row.author_id !== ME) throw new ApiError(`holons-api answered 403: you can only change your own ${what}.`, 403); };
  return {
    mode: "demo",
    base: "",
    coursesSupported: true,
    users,
    me: { id: ME, name: "You", email: "you@demo.local" },
    ...courseStore,
    listHolons: async (scope) => holons.filter((h) => (scope === "created" ? h.creator_id === ME : scope === "joined" ? memberships.some((m) => m.holon_id === h.id && m.member_id === ME) : true)),
    createHolon: async (h) => {
      need(h.name, "Name");
      if (holons.some((x) => x.name.toLowerCase() === h.name.trim().toLowerCase())) throw new ApiError("holons-api answered 422: name has already been taken", 422);
      const row = { id: next.holon++, creator_id: ME, name: h.name.trim(), description: (h.description || "").trim(), created_at: now(), updated_at: now() };
      holons.push(row);
      return { ...row };
    },
    updateHolon: async (id, h) => {
      const row = find(holons, id, "Holon");
      if (row.creator_id !== ME) throw new ApiError("holons-api answered 403: only the creator can change a Holon.", 403);
      need(h.name, "Name");
      Object.assign(row, { name: h.name.trim(), description: (h.description || "").trim(), updated_at: now() });
      return { ...row };
    },
    deleteHolon: async (id) => {
      const row = find(holons, id, "Holon");
      if (row.creator_id !== ME) throw new ApiError("holons-api answered 403: only the creator can delete a Holon.", 403);
      holons.splice(holons.indexOf(row), 1);
      [posts, memberships].forEach((l) => { for (let i = l.length - 1; i >= 0; i--) if (l[i].holon_id === id) l.splice(i, 1); });
    },
    listPosts: async (holonId) => posts.filter((p) => p.holon_id === holonId),
    createPost: async (post) => {
      if (!post.content || !post.title) throw new ApiError("Title and content can't be blank.", 422);
      const row = { id: next.post++, author_id: ME, created_at: now(), updated_at: now(), ...post };
      posts.push(row);
      return row;
    },
    updatePost: async (id, patch) => {
      const row = find(posts, id, "Post");
      ownerOnly(row, "posts");
      if (blank(patch.title) || blank(patch.content)) throw new ApiError("Title and content can't be blank.", 422);
      Object.assign(row, { title: patch.title, content: patch.content, updated_at: now() });
      return { ...row };
    },
    deletePost: async (id) => {
      const row = find(posts, id, "Post");
      ownerOnly(row, "posts");
      posts.splice(posts.indexOf(row), 1);
      for (let i = comments.length - 1; i >= 0; i--) if (comments[i].post_id === id) comments.splice(i, 1);
    },
    listComments: async (postId) => comments.filter((c) => c.post_id === postId),
    createComment: async (comment) => {
      if (!comment.content) throw new ApiError("Content can't be blank.", 422);
      const row = { id: next.comment++, author_id: ME, created_at: now(), updated_at: now(), ...comment };
      comments.push(row);
      return row;
    },
    updateComment: async (id, patch) => {
      const row = find(comments, id, "Comment");
      ownerOnly(row, "comments");
      need(patch.content, "Content");
      Object.assign(row, { content: patch.content, updated_at: now() });
      return { ...row };
    },
    deleteComment: async (id) => {
      const row = find(comments, id, "Comment");
      ownerOnly(row, "comments");
      comments.splice(comments.indexOf(row), 1);
    },
    listMemberships: async (holonId) => memberships.filter((m) => m.holon_id === holonId).map((m) => ({ ...m, role: users.find((u) => u.id === m.member_id)?.role })),
    createMembership: async ({ holon_id, member_id }) => {
      find(holons, holon_id, "Holon");
      if (memberships.some((m) => m.holon_id === holon_id && m.member_id === member_id)) throw new ApiError("holons-api answered 422: holon has already been taken", 422);
      const row = { id: next.membership++, holon_id, member_id };
      memberships.push(row);
      return { ...row };
    },
    deleteMembership: async (id) => {
      const row = find(memberships, id, "Membership");
      memberships.splice(memberships.indexOf(row), 1);
    },
    inviteSupported: false,
  };
}

/** Picks the live client when the API answers and the token is accepted, else Demo. Returns { backend, notice }. */
export async function chooseBackend({ baseUrl, token, fetchFn }) {
  const base = normalizeBase(baseUrl);
  if (!base) return { backend: createDemo(), notice: "" };
  if (!token) return { backend: createDemo(), notice: "Sign in to connect to holons-api. Showing the demo." };
  const client = createClient({ baseUrl: base, token, fetchFn });
  try {
    await client.listHolons();
    return { backend: withLocalCourses(client), notice: "" };
  } catch (e) {
    return { backend: createDemo(), notice: `${e.message} Showing the demo.` };
  }
}

// ─── Mapping Holons onto chat ────────────────────────────────────────────────

export const orbFor = (id) => BLOBS[Math.abs(Number(id) || 0) % BLOBS.length].id;
export const initialsOf = (name) => String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

export function shortTime(iso, now = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** The API needs a title on every post; a chat message has none, so the first line becomes it. */
export function titleFrom(text) {
  const first = String(text).trim().split("\n")[0].replace(/^#+\s*/, "");
  return first.length > 60 ? `${first.slice(0, 57)}...` : first;
}

/** Loads everything a Holon shows: team, courses with modules, and the feed with comments. */
export async function loadHolon(backend, holon) {
  const [memberships, courses, posts] = await Promise.all([backend.listMemberships(holon.id), backend.listCourses(holon.id), backend.listPosts(holon.id)]);
  const nameOf = (id) => (backend.users && backend.users.find((u) => u.id === id)?.name) || `Member #${id}`;
  const members = memberships.map((m) => ({ id: m.member_id, membershipId: m.id, name: nameOf(m.member_id), role: m.role || "member" }));
  const withModules = await Promise.all(courses.map(async (c) => ({ ...c, modules: await backend.listModules(c.id) })));
  const feed = await Promise.all(posts.map(async (p) => ({
    ...p,
    authorName: p.author_id ? nameOf(p.author_id) : "Member",
    comments: (await backend.listComments(p.id)).map((c) => ({ ...c, authorName: nameOf(c.author_id) })),
  })));
  feed.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  return { members, courses: withModules, feed, nameOf };
}

// ─── UI ──────────────────────────────────────────────────────────────────────

function el(tag, cls, content) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (content !== undefined) node.textContent = content;
  return node;
}

/** Avatar looks: "flux-energy" is the Hangout orb inside a crackling particle-energy mesh (experiment); "flux-free" is the Hangout orb with orbs floating freely in 3D; "flux" is the same orb with a web of orbs in orbit; "orb" is the original flat blob with pill eyes; "voxel-mesh" is the stashed voxel orb ringed by a mesh of linked voxel orbs. */
export const AVATAR_STYLES = ["flux-energy", "flux-free", "flux", "voxel-mesh", "orb"];
const AVATAR_STYLE = "flux-energy";
/** One avatar node for a blob id in the given style. */
export function avatarNode(blobId, style = AVATAR_STYLE, size = 96) {
  if (style === "voxel-mesh") return blobSvg(blobId);
  if (style === "orb") { const blob = BLOBS.find((b) => b.id === blobId) || BLOBS[0]; return flatOrbSvg(blob, BLOBS.indexOf(blob)); }
  const n = Math.max(0, BLOBS.findIndex((b) => b.id === blobId));
  return fluxOrb({ variant: FLUX_VARIANTS[n % FLUX_VARIANTS.length], shape: "blob", seed: `holons${blobId}`, size, orbit: style === "flux" ? "web" : style === "flux-energy" ? "energy" : "free" });
}
const avatar = (id, small) => { const w = el("span", `avatar${small ? " sm" : ""}`); w.append(avatarNode(orbFor(id))); return w; };

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

function poweredBy(cls = "") {
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



// <docs:generated>
// Generated by scripts/embed-docs.mjs from docs/*.md. Do not edit by hand; run `npm run embed-docs`.
export const DOCS = [
  { id: "index", title: "Holons documentation", markdown: "# Holons documentation\n\n> Authored for this app (not imported). It lists the pages and says where they come from.\n\nThis reader has the pages below. All of them were written for this client, from reading its code and README.\n\n| Page | Kind | What it covers |\n|---|---|---|\n| About this implementation | Authored here | What this app is, what works, Demo versus connected, what is real, storage, security |\n| How it works | Authored here | Architecture, modes, the holons-api calls, how Holons map onto chat |\n| Getting started with others | Authored here | Reaching a holons-api server, signing in, sharing a Holon with other people |\n\n## Imported documentation\n\nNone. No protocol or product documentation for Holons was found to import. What exists was checked when these pages were written:\n\n| Repository | What it contains | Licence found | Used here |\n|---|---|---|---|\n| `https://github.com/openartist/holons` (local clone `holons`) | A React front end; its README is the two words \"Holons LMS\" | None stated in the README; no LICENSE file in the clone | No, nothing to import |\n| `https://github.com/matrix9180/holons-api` (local clone `holons-api`) | The Rails API this app talks to; its README is the unedited Rails template | No LICENSE file in the clone, none stated | No, nothing to import. The code itself was read to write these pages |\n| `https://github.com/FraterCCCLXIII/holons-p2p` | A fork of OrbitDB with peer-to-peer chat examples; its docs describe OrbitDB | MIT (Protocol Labs and Haja Networks) | No. It is a different codebase, not the API this app uses, so its pages would not describe this app |\n| `https://github.com/FraterCCCLXIII/test-holons` | Empty repository | none | No |\n\nThe MESH protocol documentation in the sibling MESH app (`mesh-protocol`) is about a different system and is not part of Holons.\n\n## Reading order\n\n1. About this implementation\n2. How it works\n3. Getting started with others\n\nStatements marked **unverified** were not confirmed by running anything. The README of this app says the same about the sign-up, sign-out and \"who am I\" routes.\n" },
  { id: "about", title: "About this implementation", markdown: "# About this implementation\n\n> Authored for this app, from reading `extension.js` and `README.md` in the `holons-hangout` folder. Not imported from another repository.\n\n## What it is\n\nHolons is a Canvas app: one browser-only JavaScript file (`extension.js`, no dependencies) that shows a Holons community as a team chat. It is a client for a server called `holons-api`. It is not a server and stores no community data of its own.\n\nHow Holons are shown as chat:\n\n| In Holons | In this app |\n|---|---|\n| A Holon (community) | A workspace: one round button in the left icon rail |\n| Its feed | The channel named `feed` |\n| Its courses and their modules | Channels listed under \"Courses\" in the second column |\n| Its members | The team panel on the right |\n| A post (title and Markdown text) | A message |\n| A comment on a post | A reply under that message |\n\n## Two modes\n\n| | Demo | Connected |\n|---|---|---|\n| Data | Sample Holons built in memory when the app opens | Whatever your `holons-api` server returns |\n| Who you are | A made-up user called \"You\" | The account you signed in with |\n| Saved after reload | No | Yes, on the server (courses excepted, see below) |\n| Header chip | \"Demo\" | \"Connected\" |\n\nDemo has three sample Holons (Open Source Academy, Garden Circle, Night Owls Chess), sample people, posts, replies, and a course with modules. All of that is invented sample data. Everything you do in Demo works the same way as when connected, but disappears when you reload.\n\n## What works\n\n- Browse Holons, the feed, courses, modules and team members.\n- Create, edit and delete a Holon (only its creator, or an admin, can on the server).\n- Join and leave a Holon.\n- Write, edit and delete posts, and reply, edit and delete replies. Messages are shown as Markdown.\n- Create courses and modules, reorder modules and mark them complete.\n- Sign in, sign up and sign out against a server.\n- Read these docs, and drag the column edges to resize the Holons list and the team panel.\n\n## What is real and what is not\n\n- **Courses and modules are never saved on the server.** `holons-api` has no course or module routes. When connected, the app keeps them in this browser only and labels them \"Local only, not saved to the server\". Nobody else sees them.\n- **Inviting people is not available.** The server has no invite route, and a membership needs a numeric user id with no way to look a person up. The team panel says so.\n- **Post titles and author ids are missing from the server's answers.** The app remembers the titles it wrote in this session, treats a Holon as yours when the server lists it under your created Holons, and treats a post or reply as yours when this browser created it. The server's refusal (HTTP 403) is always the final word.\n- **Sign up, sign out and learning your own user id use routes that were not verified.** See the README of this app.\n\n## What is stored in your browser\n\n| Key (localStorage) | Contents |\n|---|---|\n| `holons-hangout:v1` | Server address, sign-in token, email, your user id (when known), and the ids of posts and replies this browser created |\n| `holons-hangout:local-courses:v1` | Courses and modules you made while connected, per server address |\n| `grip:holons-hangout` | The widths you dragged the Holons list and team panel to |\n\nThe password is sent once to the server and never stored.\n\n## Security notes\n\n- Text is put on the page as text. Markdown from posts and from these docs is built as page elements, never as HTML, so a post cannot inject script. Links in posts may be `http`, `https` or `mailto`; links in these docs may only be `http` or `https`. Links open in a new tab with `noopener noreferrer`.\n- The sign-in token is kept in `localStorage`, which any script on the same page origin can read. Use a server you trust.\n- The app talks to whatever address you type. The `holons-api` clone this was written against allows requests from any origin (CORS `*`, marked FIXME in its source), which is what lets a browser page call it; that is a server setting, not something this app controls.\n- Connecting over plain `http://` sends your password and token unencrypted. Use `https://` anywhere beyond your own machine.\n\n## Limits\n\n- Everything is fetched in full: the app asks for all posts and all comments and filters them by Holon in the browser, because the server has no filter. Large communities will be slow.\n- There is no live update. You see new content after an action or a reload.\n- Not run against a real server by the author of these pages; see the README's list of verified and unverified routes.\n" },
  { id: "how-it-works", title: "How it works", markdown: "# How it works\n\n> Authored for this app, from reading `extension.js`. Not imported from another repository.\n\n## Overview\n\n```\n browser (this app)                              holons-api (Ruby on Rails)\n┌───────────────────────────┐   HTTP + JSON      ┌───────────────────────────┐\n│ UI (DOM) + state          │ ─────────────────▶ │ /holons  /posts           │\n│ createClient (HTTP)       │ ◀───────────────── │ /comments                 │\n│ localStorage: token,      │   Bearer token     │ /holon_memberships        │\n│   local courses, widths   │                    │ /users/tokens/sign_in     │\n└───────────────────────────┘                    └───────────────────────────┘\n        │  no server address, no token, or server unreachable\n        ▼\n in-memory Demo backend (same methods, sample data)\n```\n\nThe UI talks to a backend object. There are two with the same methods: the live client for `holons-api`, and the Demo backend. That is why every flow works in both modes.\n\n## Choosing the mode\n\nOn open (and after sign-in or sign-out) the app picks a backend:\n\n1. No server address saved: Demo.\n2. An address but no token: Demo, with the notice \"Sign in to connect to holons-api. Showing the demo.\"\n3. Both: the app lists Holons from the server. If that works it is **Connected**; if it fails (server down, token rejected) it falls back to Demo and shows the error in a notice.\n\nThe \"Connected\" or \"Demo\" chip in the header, and the Sign in / Sign up buttons, open the account dialog. \"Use demo\" in that dialog forgets the saved address and token.\n\n## Calls to the server\n\nAll requests are JSON with `Authorization: Bearer <token>` once you have one.\n\n| Action | Request |\n|---|---|\n| Sign in | `POST /users/tokens/sign_in` with `{email, password}` |\n| Health | `GET /up` |\n| List Holons | `GET /holons`, or `?scope=created` or `?scope=joined` |\n| Create, edit, delete a Holon | `POST /holons`, `PATCH /holons/:id`, `DELETE /holons/:id` |\n| Posts | `GET /posts`, `POST /posts`, `PATCH` and `DELETE /posts/:id` |\n| Replies | `GET /comments`, `POST /comments`, `PATCH` and `DELETE /comments/:id` |\n| Team | `GET /holon_memberships?holon_id=`, `POST /holon_memberships`, `DELETE /holon_memberships/:id` |\n\nCreate and update bodies are wrapped the way Rails expects, for example `{\"post\": {\"holon_id\": 1, \"title\": \"...\", \"content\": \"...\"}}`.\n\nRoutes the README marks **unverified**: `POST /users/tokens/sign_up`, `POST /users/tokens/revoke` (sign out), and `GET /users/tokens/info` (to learn your user id when the sign-in answer does not carry it).\n\n## Opening a Holon\n\nWhen you open a Holon the app loads, at the same time, its memberships, its courses, and the posts, then the replies of each post. Posts are shown oldest first. The server returns every post and reply, so the app keeps only those for the Holon you opened.\n\n## Ownership and permissions\n\nThe server decides who may do what. The app only decides which buttons to show:\n\n- **Owner**: the Holon appears in your `?scope=created` list. You see Edit and Delete.\n- **Member**: it appears in your `?scope=joined` list. You see Leave.\n- **Neither**: you see Join (disabled with an explanation if the app does not know your user id).\n- Edit and Delete on a post or reply appear when this browser created it (or the server names you as author), and on every post if you own the Holon.\n\nIf you try something the server refuses, the error text from the server is shown in a red banner.\n\n## Writing\n\nCreating a post, editing, deleting and replying are applied to the screen at once and then confirmed with the server; if the server refuses, the change is rolled back and the error is shown. A message waiting for the server is marked \"Sending...\". A post written in the composer gets the first line of its text as its title (the server requires one).\n\n## Courses\n\n```\nDemo:       courses + modules  ──▶  in memory (lost on reload)\nConnected:  courses + modules  ──▶  localStorage, per server address, never sent\n```\n\nA course store handles create, reorder (Move up, Move down) and \"Mark complete\". The same code serves both modes; only where it keeps the data differs.\n\n## The columns\n\n```\n┌────┬──────────────┬──────────────────────────────┬──────────────┐\n│rail│ list         │ main                         │ team         │\n│    │ channels,    │ header, thread or welcome,   │ members and  │\n│    │ courses,     │ composer                     │ roles        │\n│    │ Docs link    │ (or the documentation reader)│              │\n└────┴──────────────┴──────────────────────────────┴──────────────┘\n```\n\nThe edges of the list and the team panel can be dragged (or focused and moved with the arrow keys); the widths are remembered. Below 900 pixels wide the team panel is hidden.\n\n## The docs reader\n\nThe pages you are reading are Markdown files in the `docs/` folder, embedded into `extension.js` by `scripts/embed-docs.mjs` so the extension stays one file. A test checks that the embedded copy matches the files. Back returns to where you were; Copy Markdown and Download .md act on the page being shown.\n" },
  { id: "getting-started", title: "Getting started with others", markdown: "# Getting started with others\n\n> Authored for this app, from `README.md` and `extension.js`, and from reading the `holons-api` source on this machine. Steps marked **unverified** were not run by the author.\n\n## What you need\n\nA running `holons-api` server that you and the other people can reach over HTTP(S), an account on it, and a browser. This app is only a client, so \"working with others\" means everyone signs in to the same server. Without a reachable server the app is a one-person demo.\n\n## 1. Run or find a server\n\n`holons-api` is a separate project (a Ruby on Rails app, `https://github.com/matrix9180/holons-api`). This app does not start it. From its source:\n\n- It listens on port 3000 by default (`PORT` in `config/puma.rb`, `EXPOSE 3000` in its Dockerfile).\n- It uses PostgreSQL (`config/database.yml`).\n- Its CORS settings allow any origin, which lets this page call it from another address.\n\nHow to install, migrate and start it is not documented in that repository (its README is the unedited Rails template), and was not run by the author (**unverified**). If someone else runs a server, ask them for its address and an account.\n\nTo let other people in, the server must be reachable from their machines. Prefer an `https://` address; the app sends your password and token to whatever address you give it.\n\n## 2. Connect\n\n1. Open **Holons** from the Canvas navigation. You start in Demo.\n2. Press **Sign in** in the header (or the Demo chip).\n3. Enter the **holons-api base URL** (for example `http://localhost:3000`), your email and password, and submit.\n4. The chip changes to **Connected** and your Holons load. A notice appears instead if the server cannot be reached or rejects the token.\n\nTo create an account instead, choose \"New here? Sign up\". Sign-up and sign-out use routes the README marks **unverified**.\n\n## 3. Check the connection\n\n| Chip | Meaning |\n|---|---|\n| Connecting... | Waiting for the server |\n| Connected | The server answered and accepted your token |\n| Demo | Sample data; a notice says why, for example \"Showing the demo\" |\n\n## 4. Work with others\n\n1. Press **+** in the rail to create a Holon (name and optional description). You become its owner.\n2. Other people who have accounts on the same server see it in their rail and press **Join**. Joining needs your user id; if the server did not give it, Join is disabled and says so.\n3. Everyone posts in the `feed` channel and replies under posts. You see other people's posts after you open the Holon again or act in it.\n4. The team panel lists members by name where known (otherwise \"Member #id\") and their role.\n\nWhat you cannot do from here:\n\n- **Invite by email or handle.** The server has no invite route. Memberships are made by each person pressing Join.\n- **Share courses.** Courses and modules you create while connected stay in your browser.\n- **Moderate beyond what the server allows.** Editing or deleting someone else's post only works if the server says you may (you own the Holon, or you are an admin).\n\n## Troubleshooting\n\n| You see | Likely cause |\n|---|---|\n| \"Could not reach ... Is holons-api running, and does it allow this origin (CORS)?\" | Wrong address or port, server not running, or a block from the browser (for example an `https` page calling an `http` server) |\n| \"Not signed in, or the token expired.\" | Sign in again |\n| \"holons-api answered 403\" | The server refuses that action for your account |\n| Join is disabled | The server did not tell the app your user id (that route is **unverified**) |\n| Courses missing for a teammate | Courses are local to each browser by design |\n\n## Your data\n\nYour server address, token and email stay in this browser (see \"About this implementation\"). Signing out clears the token and the ids of posts this browser created; local courses stay.\n" },
];
// </docs:generated>

const CSS = `
.hh { --hh-bg: var(--oh-color-base, #171717); --hh-panel: var(--oh-color-base-secondary, #212121); --hh-raised: var(--oh-surface-raised, #2a2a2a);
  --hh-text: var(--oh-foreground, #eee); --hh-contrast: var(--oh-contrast, #fff); --hh-muted: var(--oh-muted, #9a9a9a);
  --hh-border: var(--oh-border-subtle, #3a3a3a); --hh-primary: var(--oh-accent, var(--oh-color-primary, #fff)); --hh-on-primary: var(--oh-accent-foreground, #111);
  --hh-on-contrast: var(--oh-contrast-foreground, #111);
  --hh-success: var(--oh-success, #34d399); --hh-warn: #f2b51d; --hh-link: var(--oh-info-soft-foreground, #7c9dff);
  box-sizing: border-box; position: sticky; top: 0; color: var(--hh-text); background: var(--hh-bg); font: 14px/1.45 system-ui, sans-serif;
  height: 100%; min-height: 480px; overflow: hidden; }
.hh *, .hh *::before, .hh *::after { box-sizing: border-box; }
.hh [hidden] { display: none !important; }
.hh button, .hh input, .hh textarea { font: inherit; color: inherit; }
.hh .shell { position: relative; display: grid; grid-template-columns: 56px var(--grip-0, 300px) minmax(0, 1fr) var(--grip-1, 280px); height: 100%; min-height: 0; }
.hh .rail { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 0; border-right: 1px solid var(--hh-border); overflow-y: auto; scrollbar-width: none; }
.hh .rbtn { position: relative; width: 40px; height: 40px; border: 0; border-radius: 12px; background: transparent; color: var(--hh-muted); display: grid; place-items: center; cursor: pointer; padding: 0; }
.hh .rbtn .avatar { width: 30px; height: 30px; }
.hh .rbtn:hover { background: var(--hh-panel); color: var(--hh-contrast); }
.hh .rbtn[aria-pressed="true"] { background: var(--hh-raised); color: var(--hh-contrast); }
.hh .rbtn[aria-pressed="true"]::before { content: ""; position: absolute; left: -8px; top: 10px; bottom: 10px; width: 3px; border-radius: 3px; background: var(--hh-primary); }
.hh .rspacer { flex: 1; }
.hh .rsep { width: 24px; height: 1px; background: var(--hh-border); margin: 6px 0; }
.hh .list { display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--hh-border); background: var(--hh-bg); }
.hh .lhead { padding: 14px 16px 8px; }
.hh .lhead h2 { margin: 0; font-size: 16px; font-weight: 650; color: var(--hh-contrast); }
.hh .lhead p { margin: 2px 0 0; color: var(--hh-muted); font-size: 12px; }
.hh .rows { flex: 1; overflow-y: auto; padding: 4px 8px; min-height: 0; }
.hh .lsect { margin: 12px 8px 4px; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--hh-muted); }
.hh .row { display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 10px; border: 0; border-radius: 10px; background: transparent; text-align: left; cursor: pointer; }
.hh .row:hover { background: var(--hh-panel); }
.hh .row[aria-current="true"] { background: var(--hh-raised); color: var(--hh-contrast); }
.hh .row .glyph { width: 18px; text-align: center; color: var(--hh-muted); flex: none; }
.hh .row .rt { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hh .row.sub { padding-left: 32px; font-size: 13px; color: var(--hh-muted); }
.hh .row .count { font-size: 11px; color: var(--hh-muted); }
.hh .powered { display: flex; align-items: center; gap: 6px; color: var(--hh-muted); font-size: 12px; }
.hh .plogo { display: inline-flex; color: inherit; opacity: .7; }
.hh .plogo:hover { opacity: 1; }
.hh .plogo svg { height: 16px; width: auto; }
.hh .plogo.artec { color: var(--oh-contrast, currentColor); opacity: .85; }
.hh .plogo.artec svg { height: 20px; }
.hh .lpowered { flex: none; justify-content: center; padding: 8px 10px; border-top: 1px solid var(--hh-border); }
.hh .kosmos { letter-spacing: .06em; }
.hh .main { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.hh .mhead { display: flex; align-items: center; gap: 10px; padding: 12px 18px; border-bottom: 1px solid var(--hh-border); }
.hh .mhead h3 { margin: 0; font-size: 15px; color: var(--hh-contrast); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hh .status { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--hh-border); background: transparent; font-size: 12px; cursor: pointer; }
.hh .status i { width: 8px; height: 8px; border-radius: 50%; background: var(--hh-warn); }
.hh .status[data-mode="live"] i { background: var(--hh-success); }
.hh .banner { margin: 10px 18px 0; padding: 8px 12px; border-radius: 10px; border: 1px solid var(--hh-border); background: var(--hh-panel); font-size: 13px; }
.hh .banner.error { border-color: #ef4444; }
.hh .thread { flex: 1; overflow-y: auto; padding: 14px 18px; display: grid; align-content: start; gap: 16px; min-height: 0; }
.hh .msg { display: grid; grid-template-columns: 40px minmax(0, 1fr); gap: 10px; }
.hh .avatar { flex: none; width: 40px; height: 40px; }
.hh .avatar svg { width: 100%; height: 100%; display: block; }
.hh .flux { width: 100%; height: 100%; display: block; border-radius: 50%; object-fit: contain; }
.hh .avatar.sm { width: 28px; height: 28px; }
.hh .mmeta { display: flex; gap: 8px; align-items: baseline; }
.hh .mname { font-weight: 650; color: var(--hh-contrast); }
.hh .mtime { color: var(--hh-muted); font-size: 12px; }
.hh .mtitle { font-weight: 650; color: var(--hh-contrast); margin: 2px 0; }
.hh .replies { margin-top: 8px; display: grid; gap: 10px; border-left: 2px solid var(--hh-border); padding-left: 12px; }
.hh .reply { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 8px; }
.hh .linkbtn { border: 0; background: transparent; color: var(--hh-muted); cursor: pointer; padding: 2px 0; font-size: 12px; }
.hh .linkbtn:hover { color: var(--hh-contrast); }
.hh .rform { display: flex; gap: 6px; margin-top: 6px; }
.hh .empty { color: var(--hh-muted); text-align: center; padding: 40px 10px; }
.hh .composer { display: flex; gap: 8px; padding: 12px 18px; border-top: 1px solid var(--hh-border); align-items: flex-end; }
.hh .composer textarea, .hh .rform input, .hh .setform input { flex: 1; min-width: 0; resize: none; background: var(--hh-panel); border: 1px solid var(--hh-border); border-radius: 12px; padding: 9px 12px; }
.hh .composer textarea { min-height: 40px; max-height: 140px; }
.hh .send, .hh .primary { border: 0; border-radius: 10px; background: var(--hh-contrast); color: var(--hh-on-contrast); padding: 8px 16px; font-weight: 600; cursor: pointer; }
.hh .send:disabled { opacity: .4; cursor: default; }
.hh .ghost { border: 1px solid var(--hh-border); border-radius: 10px; background: transparent; padding: 8px 14px; cursor: pointer; }
.hh .note { padding: 12px 18px; border-top: 1px solid var(--hh-border); color: var(--hh-muted); font-size: 12.5px; }
.hh .team { border-left: 1px solid var(--hh-border); padding: 14px; overflow-y: auto; }
.hh .team h4 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--hh-muted); }
.hh .member { display: flex; align-items: center; gap: 10px; padding: 6px 0; }
.hh .member small { color: var(--hh-muted); display: block; }
.hh .welcome { flex: 1; position: relative; display: grid; place-items: center; align-content: center; text-align: center; gap: 12px; padding: 24px; background: radial-gradient(circle at 50% 35%, color-mix(in srgb, #8B5CF6 28%, var(--hh-bg)), var(--hh-bg) 70%); overflow: auto; }
.hh .welcome > canvas.wnet { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.hh .welcome > :not(canvas):not(.wpowered) { position: relative; }
.hh .welcome h1 { margin: 0; font-size: 28px; font-weight: 500; color: var(--hh-contrast); }
.hh .welcome p { margin: 0; color: color-mix(in srgb, var(--hh-contrast) 78%, transparent); max-width: 420px; }
.hh .wbig { width: min(660px, 60vh, 90vw); height: min(660px, 60vh, 90vw); }
.hh .wbig svg, .hh .wbig .flux { width: 100%; height: 100%; }
.hh .wpowered { position: absolute; left: 0; right: 0; bottom: 16px; justify-content: center; color: color-mix(in srgb, var(--hh-contrast) 75%, transparent); }
.hh .wactions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 4px; }
.hh .welcome .wdocs { border: 1px solid color-mix(in srgb, var(--hh-contrast) 35%, transparent); border-radius: 999px; background: transparent; color: var(--hh-contrast); padding: 10px 18px; cursor: pointer; }
.hh .welcome .wdocs:hover { background: color-mix(in srgb, var(--hh-contrast) 12%, transparent); }
.hh .docslink { flex: none; align-self: flex-start; margin: 0 12px 4px; border: 0; background: transparent; color: var(--hh-muted); font-size: 12px; padding: 2px 6px; border-radius: 6px; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
.hh .docslink:hover { background: var(--hh-panel); color: var(--hh-contrast); }
.hh .shell.docsopen { grid-template-columns: 56px var(--grip-0, 300px) minmax(0, 1fr); }
.hh .docs { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.hh .docs .headbtn { border: 1px solid var(--hh-border); background: var(--hh-raised); border-radius: 8px; padding: 4px 12px; cursor: pointer; }
.hh .docs .dbody { flex: 1; min-height: 0; display: grid; grid-template-columns: 240px minmax(0, 1fr); }
.hh .docs .dnav { overflow-y: auto; padding: 8px; display: grid; align-content: start; gap: 2px; }
.hh .docs .dlink[aria-current="page"] { background: var(--hh-raised); color: var(--hh-contrast); }
.hh .docs .dlink { white-space: normal; font-size: 13px; line-height: 18px; }
.hh .docs .dpage { overflow-y: auto; padding: 12px 24px 32px; min-width: 0; }
.hh .docs .dpage > h2 { margin: 12px 0; font-size: 20px; line-height: 28px; color: var(--hh-contrast); outline: none; }
.hh .docs .dpage > h2:focus-visible { outline: 2px solid #7c9dff; outline-offset: 4px; border-radius: 4px; }
.hh .docs .dtools { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.hh .docs .dpage .md { max-width: 820px; }
@media (max-width: 700px) { .hh .docs .dbody { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); } .hh .docs .dnav { max-height: 30vh; border-bottom: 1px solid var(--hh-border); } .hh .docs .dpage { padding: 12px 16px 24px; } }
.hh .setform { display: grid; gap: 8px; padding: 14px 18px; border-bottom: 1px solid var(--hh-border); background: var(--hh-panel); }
.hh .setform label { display: grid; gap: 3px; font-size: 12px; color: var(--hh-muted); }
.hh .setform .btns { display: flex; gap: 8px; }
.hh .orb-body { transform-box: view-box; transform-origin: 32px 34px; animation: hhOrb 5s ease-in-out infinite alternate; }
.hh .orb-look { animation: hhLook 8s ease-in-out infinite; }
.hh .orb-blink { transform-box: view-box; transform-origin: 32px 33px; animation: hhBlink 6s infinite; }
.hh .mesh-node { transform-box: fill-box; transform-origin: center; animation: hhNode 3.4s ease-in-out infinite alternate; }
@keyframes hhNode { 0% { transform: scale(1); } 100% { transform: scale(1.3); } }
@keyframes hhOrb { 0% { transform: scale(1, 1) rotate(0deg); } 100% { transform: scale(1.05, .95) rotate(-3deg); } }
@keyframes hhLook { 0%, 38% { transform: translateX(0); } 46%, 66% { transform: translateX(3px); } 76%, 92% { transform: translateX(-3px); } 100% { transform: translateX(0); } }
@keyframes hhBlink { 0%, 91%, 100% { transform: scaleY(1); } 94% { transform: scaleY(.1); } }
@media (prefers-reduced-motion: reduce) { .hh .orb-body, .hh .orb-look, .hh .orb-blink, .hh .mesh-node { animation: none; } }
.hh .banner.ok { border-color: var(--hh-success); }
.hh .rbtn.add { border: 1px dashed var(--hh-border); font-size: 20px; line-height: 1; }
.hh .who { color: var(--hh-muted); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
.hh .sm { padding: 4px 10px; font-size: 12px; }
.hh .hactions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 8px; }
.hh .badge { font-size: 11px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--hh-border); color: var(--hh-muted); }
.hh .localtag { font-size: 12px; color: var(--hh-warn); margin: 4px 8px; }
.hh .hint { padding: 6px 18px 0; color: var(--hh-muted); font-size: 12px; }
.hh .ctools { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.hh .done { color: var(--hh-success); }
.hh .dlg { position: absolute; inset: 0; z-index: 10; display: grid; place-items: center; background: rgba(0,0,0,.55); padding: 16px; overflow: auto; }
.hh .dialog { width: min(480px, 100%); display: grid; gap: 10px; padding: 18px; border-radius: 14px; background: var(--hh-panel); border: 1px solid var(--hh-border); }
.hh .dialog h2 { margin: 0; font-size: 16px; color: var(--hh-contrast); }
.hh .dialog p { margin: 0; color: var(--hh-muted); font-size: 13px; }
.hh .dialog label { display: grid; gap: 3px; font-size: 12px; color: var(--hh-muted); }
.hh .dialog input, .hh .dialog textarea { background: var(--hh-bg); border: 1px solid var(--hh-border); border-radius: 10px; padding: 8px 10px; min-width: 0; }
.hh .dialog textarea { min-height: 110px; resize: vertical; }
.hh .dialog [aria-invalid="true"] { border-color: #ef4444; }
.hh .dialog .derr { color: var(--oh-danger-soft-foreground, #ef4444); font-size: 13px; min-height: 0; }
.hh .dialog .btns { display: flex; gap: 8px; justify-content: flex-end; }
.hh .dialog .primary.danger { background: #dc2626; color: #fff; }
.hh .dialog .primary:disabled { opacity: .5; cursor: default; }
.hh .md { display: grid; gap: 8px; min-width: 0; line-height: 1.5; }
.hh .md p, .hh .md ul, .hh .md ol, .hh .md blockquote, .hh .md h3, .hh .md h4, .hh .md h5, .hh .md h6, .hh .md hr { margin: 0; }
.hh .md h3, .hh .md h4, .hh .md h5, .hh .md h6 { font-weight: 650; color: var(--hh-contrast); }
.hh .md strong { font-weight: 650; color: var(--hh-contrast); }
.hh .md a { color: var(--hh-link); text-decoration: underline; text-underline-offset: 2px; }
.hh .md ul, .hh .md ol { padding-left: 22px; display: grid; gap: 3px; }
.hh .md blockquote { border-left: 3px solid var(--hh-border); padding: 2px 0 2px 12px; color: var(--hh-muted); }
.hh .md hr { border: 0; border-top: 1px solid var(--hh-border); }
.hh .md code { font: 12.5px ui-monospace, SF Mono, Menlo, monospace; background: rgba(255,255,255,.08); border-radius: 5px; padding: 1px 5px; overflow-wrap: anywhere; }
.hh .md .mdcode { border: 1px solid var(--hh-border); border-radius: 10px; overflow: hidden; background: #0e0e10; color: #eee; }
.hh .md .mdcodebar { display: flex; justify-content: space-between; padding: 4px 10px; font-size: 11px; color: #9a9a9a; border-bottom: 1px solid var(--hh-border); }
.hh .md .mdcodebar button { border: 0; background: transparent; color: #9a9a9a; cursor: pointer; font-size: 11px; }
.hh .md pre { margin: 0; padding: 10px 12px; overflow-x: auto; font: 12.5px/1.55 ui-monospace, SF Mono, Menlo, monospace; }
.hh .md pre code { background: none; padding: 0; }
.hh .md .mdtable { overflow-x: auto; border: 1px solid var(--hh-border); border-radius: 10px; }
.hh .md table { border-collapse: collapse; width: 100%; font-size: 13px; }
.hh .md th, .hh .md td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--hh-border); }
.hh .md .mdnote { font-size: 12px; color: var(--hh-muted); }
@media (max-width: 900px) { .hh .shell { grid-template-columns: 56px 220px minmax(0, 1fr); } .hh .team { display: none; } }
/* Draggable column dividers. */
.grip { position: absolute; top: 0; bottom: 0; width: 11px; z-index: 6; cursor: col-resize; touch-action: none; outline: 0; }
.grip-left { transform: translateX(-50%); }
.grip-right { transform: translateX(50%); }
.grip::after { content: ""; position: absolute; top: 0; bottom: 0; left: 50%; width: 2px; margin-left: -1px; border-radius: 2px; background: transparent; transition: background .12s; }
.grip:hover::after, .grip:focus-visible::after, .grip.on::after { background: var(--oh-color-primary, #7c9dff); }
.gripping { user-select: none; cursor: col-resize; }
.gripping * { pointer-events: none; }
.gripping .grip { pointer-events: auto; }
@media (max-width: 720px) { .grip { display: none; } }

/* Feed app sizing: 14px text, 12px meta, 16px gutters, 12px gaps, 32px avatars, 16px section titles. */
.hh { font-size: 14px; line-height: 20px; }
.hh small, .hh .sub, .hh .sectionlabel, .hh .sect { font-size: 12px; line-height: 16px; }
.hh h1, .hh .lhead h2, .hh .chead h2, .hh .mhead h2, .hh .brand h1 { font-size: 16px; line-height: 24px; font-weight: 600; }
.hh .lhead, .hh .chead, .hh .mhead, .hh .brand { padding-left: 16px; padding-right: 16px; }
.hh .msg { gap: 12px; }
.hh .thread, .hh .body { padding: 12px 16px; gap: 12px; }
.hh .composerwrap { padding: 8px 16px 14px; }
.hh .row { gap: 12px; padding-left: 12px; padding-right: 12px; }
.hh .avatar { width: 32px; height: 32px; }
/* Fewer rules: the rails separate from the page by tone, not by lines. */
.hh .rail, .hh .list, .hh .team { border: 0; background: var(--hh-panel); }
.hh .lpowered, .hh .mhead, .hh .composer, .hh .note, .hh .setform { border: 0; }
.hh .replies { border-left: 0; padding-left: 0; }
`;

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

/**
 * A network cloud for the welcome page: a slowly turning 3D mesh of glowing nodes, with coloured
 * orbs hopping along its connections. Drawn on a 2D canvas with a perspective projection. The loop
 * ends by itself once the canvas has been taken out of the page, and holds still for reduced motion.
 */
export function networkCanvas() {
  const canvas = el("canvas", "wnet");
  canvas.setAttribute("aria-hidden", "true");
  const ctx = canvas.getContext && canvas.getContext("2d");
  if (!ctx) return canvas;
  let a = 7;
  const rand = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const colors = ["#38bdf8", "#f472b6", "#fbbf24", "#34d399", "#a78bfa", "#fb7185", "#22d3ee", "#f97316", "#a3e635"];
  const count = 34;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const nodes = Array.from({ length: count }, (_, i) => {
    const y = 1 - (i / (count - 1)) * 2, ring = Math.sqrt(1 - y * y), ang = i * golden, r = 0.7 + rand() * 0.35;
    return { x: Math.cos(ang) * ring * r, y: y * r, z: Math.sin(ang) * ring * r, phase: rand() * Math.PI * 2, color: colors[i % colors.length] };
  });
  const seen = new Set(), edges = [];
  nodes.forEach((n, i) => {
    nodes.map((m, j) => ({ j, d: (n.x - m.x) ** 2 + (n.y - m.y) ** 2 + (n.z - m.z) ** 2 })).filter((o) => o.j !== i).sort((p, q) => p.d - q.d).slice(0, 3).forEach(({ j }) => {
      const key = i < j ? i + "-" + j : j + "-" + i;
      if (!seen.has(key)) { seen.add(key); edges.push([i, j]); }
    });
  });
  const orbFrom = (from) => {
    const [p, q] = edges[Math.floor(rand() * edges.length)];
    const start = from === undefined ? (rand() < 0.5 ? p : q) : from;
    return { from: start, to: start === p ? q : p, at: 0, speed: 0.25 + rand() * 0.35, color: nodes[start].color };
  };
  const hop = (node) => {
    const opts = edges.filter(([p, q]) => p === node || q === node);
    const [p, q] = opts[Math.floor(rand() * opts.length)];
    return { from: node, to: p === node ? q : p, at: 0, speed: 0.25 + rand() * 0.35, color: nodes[node].color };
  };
  const orbs = Array.from({ length: 26 }, () => { const o = orbFrom(); o.at = rand(); return o; });
  let w = 1, h = 1, t = 0, last = 0, raf = 0, seenInPage = false, waited = 0;
  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const size = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), rect = canvas.getBoundingClientRect();
    w = Math.max(1, Math.round(rect.width)); h = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const project = (n, i) => {
    const k = 0.04, x = n.x + Math.sin(t * 0.6 + n.phase) * k, y = n.y + Math.cos(t * 0.5 + n.phase) * k, z = n.z + Math.sin(t * 0.4 + n.phase * 1.3) * k;
    const yaw = t * 0.12, tilt = 0.35 + Math.sin(t * 0.07) * 0.12;
    const x1 = x * Math.cos(yaw) + z * Math.sin(yaw), z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
    const y2 = y * Math.cos(tilt) - z1 * Math.sin(tilt), z2 = y * Math.sin(tilt) + z1 * Math.cos(tilt);
    const s = 2.6 / (2.6 + z2), unit = Math.min(w, h) * 0.42;
    return { x: w / 2 + x1 * s * unit, y: h / 2 + y2 * s * unit, s, depth: Math.max(0, Math.min(1, (1 - z2) / 2)) };
  };
  const glow = (x, y, r, color, alpha) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.3, color); g.addColorStop(1, color + "00");
    ctx.globalAlpha = alpha; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  };
  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    const pts = nodes.map(project);
    ctx.lineWidth = 1;
    edges.forEach(([i, j]) => {
      ctx.strokeStyle = "rgba(190,200,255," + (0.06 + 0.2 * ((pts[i].depth + pts[j].depth) / 2)) + ")";
      ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
    });
    const layers = nodes.map((n, i) => ({ z: pts[i].depth, run: () => glow(pts[i].x, pts[i].y, 3 + 5 * pts[i].s, n.color, 0.35 + 0.5 * pts[i].depth) }));
    orbs.forEach((o) => {
      const p = pts[o.from], q = pts[o.to], x = p.x + (q.x - p.x) * o.at, y = p.y + (q.y - p.y) * o.at, d = p.depth + (q.depth - p.depth) * o.at;
      layers.push({ z: d + 0.01, run: () => {
        const back = Math.max(0, o.at - 0.14);
        ctx.strokeStyle = o.color; ctx.globalAlpha = 0.5 * (0.4 + d); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p.x + (q.x - p.x) * back, p.y + (q.y - p.y) * back); ctx.lineTo(x, y); ctx.stroke();
        ctx.globalAlpha = 1; glow(x, y, 6 + 6 * d, o.color, 0.95);
      } });
    });
    layers.sort((m, n) => m.z - n.z).forEach((l) => l.run());
  };
  const tick = (now) => {
    if (canvas.isConnected) seenInPage = true;
    else if (seenInPage || ++waited > 120) { window.removeEventListener("resize", size); return; }
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now; t += dt;
    orbs.forEach((o, i) => { o.at += o.speed * dt; if (o.at >= 1) orbs[i] = hop(o.to); });
    if (canvas.isConnected) draw();
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(() => {
    size(); window.addEventListener("resize", size);
    if (still) { t = 6; draw(); return; }
    raf = requestAnimationFrame(tick);
  });
  return canvas;
}

export function activate(host) {
  if (host.apiVersion !== "1") throw new Error("Holons requires Canvas host API 1.");
  return host.registerPage("holons-hangout", ({ container }) => mount(container));
}

const emptyMine = () => ({ posts: [], comments: [] });
function readSaved() {
  const base = { baseUrl: "", token: "", email: "", me: null, mine: emptyMine() };
  try { return { ...base, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") }; } catch { return base; }
}
// Only the base URL, token, email, user id and ids this browser created are stored. Never the password.
function writeSaved(saved) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch { /* storage blocked */ } }

const LOCAL_LABEL = "Local only, not saved to the server";
const NO_INVITE = "Invite by email or handle is not available: holons-api has no invite endpoint, and a membership needs a numeric member_id.";

function mount(container) {
  const shellHost = el("div", "hhshell");
  shellHost.style.height = "100%";
  const dialogHost = el("div", "hhdialogs");
  const root = el("div", "hh");
  root.append(shellHost, dialogHost);
  container.append(el("style", "", CSS), root);
  let disposed = false;
  let tmp = 0;
  const saved = readSaved();
  saved.mine = { ...emptyMine(), ...(saved.mine || {}) };
  const state = {
    backend: null, notice: "", error: "", success: "", holons: [], holonId: null, channel: "welcome", data: null, loading: true,
    openReplies: new Set(), refocus: false, docs: { open: false, page: DOCS[0].id, opener: "" }, me: null, owned: new Set(), joined: new Set(), titles: new Map(), busy: 0, dialog: null,
  };

  const holon = () => state.holons.find((h) => h.id === state.holonId);
  const live = () => state.backend && state.backend.mode === "live";
  const iso = () => new Date().toISOString();
  const safe = (fn) => async (...a) => { try { state.error = ""; state.success = ""; await fn(...a); } catch (e) { state.error = e.message || String(e); } if (!disposed) render(); };
  const remember = (kind, id) => { if (live() && id !== undefined) { saved.mine[kind].push(id); writeSaved(saved); } };
  const forget = (kind, id) => { saved.mine[kind] = saved.mine[kind].filter((x) => x !== id); writeSaved(saved); };
  const isMine = (kind, row) => (row.author_id !== undefined && row.author_id !== null ? Boolean(state.me) && row.author_id === state.me.id : saved.mine[kind].includes(row.id));
  const isOwner = () => state.owned.has(state.holonId);
  const isMember = () => state.joined.has(state.holonId);
  const canManagePost = (p) => !p.pending && (isMine("posts", p) || isOwner());
  const canManageComment = (c) => !c.pending && isMine("comments", c);

  async function connect(creds) {
    state.loading = true; render();
    const { backend, notice } = await chooseBackend({ baseUrl: creds.baseUrl, token: creds.token });
    if (disposed) return;
    state.backend = backend; state.notice = notice; state.error = "";
    if (backend.mode === "live") {
      if (saved.me) backend.me = saved.me;
      else {
        try { const me = await backend.whoami(); if (me) { saved.me = me; backend.me = me; writeSaved(saved); } } catch { /* UNVERIFIED route; joining stays disabled without a user id */ }
      }
    }
    state.me = backend.me || null;
    try { state.holons = await backend.listHolons(); } catch (e) { state.holons = []; state.error = e.message; }
    const ids = async (scope) => { try { return new Set((await backend.listHolons(scope)).map((h) => h.id)); } catch { return new Set(); } };
    [state.owned, state.joined] = await Promise.all([ids("created"), ids("joined")]);
    if (disposed) return;
    state.holonId = null; state.channel = "welcome"; state.data = null; state.loading = false;
    render();
  }

  const openHolon = safe(async (id) => {
    state.holonId = id; state.channel = "feed"; state.data = null; render();
    await refresh();
  });

  const refresh = async () => {
    const h = holon();
    if (!h) return;
    const data = await loadHolon(state.backend, h);
    // The API's JSON omits post titles, so keep the ones this browser wrote.
    data.feed.forEach((p) => { if (!p.title && state.titles.has(p.id)) p.title = state.titles.get(p.id); });
    state.data = data;
  };

  /** Optimistic write: apply now, call the API, restore everything if it fails (and rethrow), then reload. */
  async function mutate(apply, call, after) {
    const snap = { data: state.data, joined: new Set(state.joined), holons: state.holons, error: state.error };
    state.busy += 1; state.error = ""; state.success = "";
    apply(); render();
    let result;
    try { result = await call(); } catch (e) { Object.assign(state, snap, { error: "" }); state.busy -= 1; render(); throw e; }
    state.busy -= 1;
    if (after) after(result);
    try { await refresh(); } catch (e) { state.error = e.message; }
    return result;
  }
  const withFeed = (fn) => { state.data = { ...state.data, feed: fn(state.data.feed) }; };
  const mapPost = (id, fn) => withFeed((feed) => feed.map((p) => (p.id === id ? fn(p) : p)));
  const myName = () => (state.me && (state.me.name || state.me.email)) || "You";

  const post = safe((text) => createPostFlow(titleFrom(text), text).then(() => { state.refocus = true; }));
  function createPostFlow(title, content) {
    const holonId = state.holonId;
    const row = { id: `tmp-${++tmp}`, holon_id: holonId, title, content, author_id: state.me ? state.me.id : undefined, authorName: myName(), created_at: iso(), comments: [], pending: true };
    return mutate(() => withFeed((f) => [...f, row]), () => state.backend.createPost({ holon_id: holonId, title, content }), (r) => { remember("posts", r && r.id); if (r && r.id !== undefined) state.titles.set(r.id, title); });
  }
  const editPostFlow = (p, title, content) => mutate(
    () => mapPost(p.id, (x) => ({ ...x, title, content })),
    () => state.backend.updatePost(p.id, { title, content }),
    () => state.titles.set(p.id, title));
  const deletePostFlow = (p) => mutate(() => withFeed((f) => f.filter((x) => x.id !== p.id)), () => state.backend.deletePost(p.id), () => forget("posts", p.id));
  const reply = safe(async (postId, text) => {
    state.openReplies.add(postId);
    const row = { id: `tmp-${++tmp}`, post_id: postId, content: text, author_id: state.me ? state.me.id : undefined, authorName: myName(), created_at: iso(), pending: true };
    await mutate(() => mapPost(postId, (p) => ({ ...p, comments: [...p.comments, row] })), () => state.backend.createComment({ post_id: postId, content: text }), (r) => remember("comments", r && r.id));
  });
  const editCommentFlow = (postId, c, content) => mutate(
    () => mapPost(postId, (p) => ({ ...p, comments: p.comments.map((x) => (x.id === c.id ? { ...x, content } : x)) })),
    () => state.backend.updateComment(c.id, { content }));
  const deleteCommentFlow = (postId, c) => mutate(
    () => mapPost(postId, (p) => ({ ...p, comments: p.comments.filter((x) => x.id !== c.id) })),
    () => state.backend.deleteComment(c.id), () => forget("comments", c.id));

  const join = safe(async () => {
    if (!state.me) throw new Error("Joining needs your user id, which the server did not return. Sign in again.");
    const holonId = state.holonId;
    const me = state.me;
    await mutate(() => {
      state.joined.add(holonId);
      state.data = { ...state.data, members: [...state.data.members, { id: me.id, membershipId: null, name: myName(), role: "member" }] };
    }, () => state.backend.createMembership({ holon_id: holonId, member_id: me.id }));
    state.success = `You joined ${holon() ? holon().name : "the Holon"}.`;
  });
  const leave = safe(async () => {
    const holonId = state.holonId;
    const mine = () => state.data.members.find((m) => state.me && String(m.id) === String(state.me.id));
    if (!state.me || !mine() || !mine().membershipId) { await refresh(); if (!mine() || !mine().membershipId) throw new Error("Could not find your membership in this Holon."); }
    const membershipId = mine().membershipId;
    const name = holon().name;
    await mutate(() => {
      state.joined.delete(holonId);
      state.data = { ...state.data, members: state.data.members.filter((m) => m.membershipId !== membershipId) };
    }, () => state.backend.deleteMembership(membershipId));
    state.success = `You left ${name}.`;
  });

  // — dialogs —
  function closeDialog() {
    const d = state.dialog;
    state.dialog = null;
    dialogHost.replaceChildren();
    if (d && d.opener && d.opener.isConnected && d.opener.focus) d.opener.focus();
  }

  /** A modal form: validation, busy state, inline error, Escape to close, focus kept inside. */
  function openDialog(spec) {
    const opener = document.activeElement;
    dialogHost.replaceChildren();
    const overlay = el("div", "dlg");
    const form = el("form", "dialog");
    form.noValidate = true;
    form.setAttribute("role", "dialog"); form.setAttribute("aria-modal", "true");
    const titleId = `hhd-${++tmp}`;
    const h = el("h2", "", spec.title); h.id = titleId;
    form.setAttribute("aria-labelledby", titleId);
    form.append(h);
    if (spec.intro) form.append(el("p", "", spec.intro));
    const inputs = {};
    (spec.fields || []).forEach((f) => {
      const label = el("label", "", f.label + (f.required ? " (required)" : ""));
      const input = el(f.multiline ? "textarea" : "input");
      if (!f.multiline) input.type = f.type || "text";
      input.name = f.name; input.value = f.value || ""; input.autocomplete = f.autocomplete || "off";
      if (f.placeholder) input.placeholder = f.placeholder;
      if (f.required) input.setAttribute("aria-required", "true");
      label.append(input);
      inputs[f.name] = input;
      form.append(label);
    });
    if (spec.extra) spec.extra(form, inputs);
    const err = el("div", "derr"); err.setAttribute("role", "alert");
    const btns = el("div", "btns");
    const cancel = el("button", "ghost", "Cancel"); cancel.type = "button";
    const submit = el("button", `primary${spec.danger ? " danger" : ""}`, spec.submitLabel || "Save"); submit.type = "submit";
    btns.append(cancel, submit);
    form.append(err, btns);
    overlay.append(form);
    let busy = false;
    const setBusy = (on) => { busy = on; submit.disabled = on; cancel.disabled = on; form.setAttribute("aria-busy", String(on)); submit.textContent = on ? "Working..." : spec.submitLabel || "Save"; };
    cancel.addEventListener("click", closeDialog);
    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !busy) { e.preventDefault(); closeDialog(); return; }
      if (e.key !== "Tab") return;
      const items = [...form.querySelectorAll("input, textarea, button")].filter((n) => !n.disabled);
      if (!items.length) return;
      const first = items[0]; const last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (busy) return;
      err.textContent = "";
      Object.values(inputs).forEach((i) => i.removeAttribute("aria-invalid"));
      const values = Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.type === "password" ? i.value : i.value.trim()]));
      const missing = (spec.fields || []).find((f) => f.required && !values[f.name]);
      const problem = missing ? `${missing.label} is required.` : spec.validate ? spec.validate(values) : "";
      if (problem) {
        err.textContent = problem;
        const bad = missing ? inputs[missing.name] : inputs[(spec.invalidField && spec.invalidField(values)) || ""] || Object.values(inputs)[0];
        if (bad) { bad.setAttribute("aria-invalid", "true"); bad.focus(); }
        return;
      }
      setBusy(true);
      try {
        const message = await spec.onSubmit(values);
        closeDialog();
        state.error = "";
        state.success = typeof message === "string" ? message : spec.success || "";
        render();
      } catch (ex) {
        err.textContent = ex.message || String(ex);
        if (!disposed) setBusy(false);
      }
    });
    dialogHost.append(overlay);
    state.dialog = { opener };
    const firstField = form.querySelector("input, textarea") || submit;
    firstField.focus();
  }

  const confirmDialog = (title, intro, label, run, success) => openDialog({ title, intro, submitLabel: label, danger: true, onSubmit: async () => { await run(); return success; } });

  function accountDialog(mode = "signin", prefill = {}) {
    const signedIn = live() && saved.token;
    const up = mode === "signup";
    openDialog({
      title: signedIn ? "Account" : up ? "Sign up to holons-api" : "Sign in to holons-api",
      intro: signedIn ? `Signed in as ${saved.email || (state.me && state.me.email) || "your account"} on ${state.backend.base}.` : up ? "Create an account on the server. Sign-up is unverified against holons-api (devise-api source not available here). The password is sent once and never stored." : "The URL and token stay in this browser. The password is sent once and not stored.",
      submitLabel: signedIn ? "Sign out" : up ? "Sign up" : "Sign in",
      fields: signedIn ? [] : [
        { name: "base", label: "holons-api base URL", type: "url", value: prefill.base ?? saved.baseUrl, required: true, placeholder: "http://localhost:3000" },
        { name: "email", label: "Email", type: "email", value: prefill.email ?? saved.email, required: true, autocomplete: "email" },
        { name: "password", label: up ? "Password (at least 6 characters)" : "Password", type: "password", required: true, autocomplete: up ? "new-password" : "current-password" },
        ...(up ? [{ name: "name", label: "Name (optional)" }, { name: "nickname", label: "Nickname (optional)" }] : []),
      ],
      validate: (v) => (signedIn ? "" : !/^https?:\/\//i.test(v.base) ? "Base URL must start with http:// or https://." : !/^\S+@\S+\.\S+$/.test(v.email) ? "Enter a valid email address." : up && v.password.length < 6 ? "Password must be at least 6 characters." : ""),
      invalidField: (v) => (!/^https?:\/\//i.test(v.base) ? "base" : !/^\S+@\S+\.\S+$/.test(v.email) ? "email" : "password"),
      extra: (form) => {
        if (signedIn) return;
        const row = el("div", "btns");
        const other = el("button", "linkbtn", up ? "Have an account? Sign in" : "New here? Sign up"); other.type = "button";
        other.addEventListener("click", () => { const f = form.elements; accountDialog(up ? "signin" : "signup", { base: f.base.value.trim(), email: f.email.value.trim() }); });
        const demo = el("button", "linkbtn", "Use demo"); demo.type = "button";
        demo.addEventListener("click", async () => { closeDialog(); saved.baseUrl = ""; saved.token = ""; saved.me = null; writeSaved(saved); await connect(saved); state.success = "Using the in-memory demo."; render(); });
        row.append(other, demo);
        form.append(row);
      },
      onSubmit: async (v) => {
        if (signedIn) return signOutFlow();
        const base = normalizeBase(v.base);
        const client = createClient({ baseUrl: base });
        const body = up ? { email: v.email, password: v.password, ...(v.name ? { name: v.name } : {}), ...(v.nickname ? { nickname: v.nickname } : {}) } : { email: v.email, password: v.password };
        const { token, owner } = up ? await client.signUp(body) : await client.authenticate("/users/tokens/sign_in", body);
        if (!token) {
          if (up) return "Account created. Sign in to continue.";
          throw new ApiError("Signed in, but the server returned no token.");
        }
        if (!saved.me || !owner || saved.me.id !== owner.id) saved.mine = emptyMine();
        Object.assign(saved, { baseUrl: base, token, email: v.email, me: owner });
        writeSaved(saved);
        closeDialog();
        await connect(saved);
        return `${up ? "Account created and signed in" : "Signed in"} as ${v.email}.`;
      },
    });
  }

  async function signOutFlow() {
    let revoked = true;
    try { await state.backend.signOut(); } catch { revoked = false; }
    Object.assign(saved, { token: "", me: null, mine: emptyMine() });
    writeSaved(saved);
    closeDialog();
    await connect(saved);
    state.notice = "";
    return revoked ? "Signed out." : "Signed out here. The server could not revoke the token (that route is unverified); it will expire on its own.";
  }

  function holonDialog(h) {
    const editing = Boolean(h);
    openDialog({
      title: editing ? `Edit ${h.name}` : "Create a Holon",
      submitLabel: editing ? "Save" : "Create Holon",
      fields: [{ name: "name", label: "Name", value: h ? h.name : "", required: true }, { name: "description", label: "Description", value: h ? h.description || "" : "", multiline: true }],
      onSubmit: async (v) => {
        const body = { name: v.name, description: v.description };
        if (editing) {
          const row = await state.backend.updateHolon(h.id, body);
          state.holons = state.holons.map((x) => (x.id === h.id ? { ...x, ...body, ...(row && typeof row === "object" ? row : {}) } : x));
          return `Saved ${v.name}.`;
        }
        const row = await state.backend.createHolon(body);
        if (!row || row.id === undefined) throw new ApiError("The server did not return the new Holon.");
        state.holons = [...state.holons, row];
        state.owned.add(row.id);
        closeDialog();
        await openHolon(row.id);
        state.success = `Created ${v.name}. You are its owner.`;
        return state.success;
      },
    });
  }
  const deleteHolonDialog = (h) => confirmDialog(`Delete ${h.name}?`, "This removes the Holon and its posts. It cannot be undone.", "Delete Holon", async () => {
    await state.backend.deleteHolon(h.id);
    state.holons = state.holons.filter((x) => x.id !== h.id);
    state.owned.delete(h.id); state.joined.delete(h.id);
    state.holonId = null; state.channel = "welcome"; state.data = null;
  }, `Deleted ${h.name}.`);

  function postDialog(p) {
    openDialog({
      title: p ? "Edit post" : `New post in ${holon().name}`,
      submitLabel: p ? "Save post" : "Post",
      intro: "The body supports markdown.",
      fields: [{ name: "title", label: "Title", value: p ? p.title || "" : "", required: true }, { name: "content", label: "Body (markdown)", value: p ? p.content : "", multiline: true, required: true }],
      onSubmit: async (v) => { await (p ? editPostFlow(p, v.title, v.content) : createPostFlow(v.title, v.content)); return p ? "Post updated." : "Post published."; },
    });
  }
  const deletePostDialog = (p) => confirmDialog("Delete this post?", "Its replies go too.", "Delete post", () => deletePostFlow(p), "Post deleted.");
  const commentDialog = (postId, c) => openDialog({
    title: "Edit reply", submitLabel: "Save reply",
    fields: [{ name: "content", label: "Reply (markdown)", value: c.content, multiline: true, required: true }],
    onSubmit: async (v) => { await editCommentFlow(postId, c, v.content); return "Reply updated."; },
  });
  const deleteCommentDialog = (postId, c) => confirmDialog("Delete this reply?", "", "Delete reply", () => deleteCommentFlow(postId, c), "Reply deleted.");

  function courseDialog() {
    const localOnly = Boolean(state.backend.localCourses);
    openDialog({
      title: "New course", submitLabel: "Create course",
      intro: localOnly ? `${LOCAL_LABEL}. holons-api has no course routes.` : "Demo data lives in memory and resets when you reload.",
      fields: [{ name: "name", label: "Name", required: true }, { name: "description", label: "Description (markdown)", multiline: true }],
      onSubmit: async (v) => {
        const row = await state.backend.createCourse({ holon_id: state.holonId, name: v.name, description: v.description });
        await refresh();
        state.channel = `course:${row.id}`;
        return `Course "${v.name}" created${localOnly ? ` (${LOCAL_LABEL.toLowerCase()})` : ""}.`;
      },
    });
  }
  function moduleDialog(course) {
    openDialog({
      title: `New module in ${course.name}`, submitLabel: "Create module",
      intro: state.backend.localCourses ? `${LOCAL_LABEL}.` : "",
      fields: [{ name: "name", label: "Name", required: true }, { name: "body", label: "Content (markdown)", multiline: true }],
      onSubmit: async (v) => {
        const row = await state.backend.createModule({ course_id: course.id, name: v.name, body: v.body });
        await refresh();
        state.channel = `module:${row.id}`;
        return `Module "${v.name}" created.`;
      },
    });
  }
  const moveModule = safe(async (m, dir) => { await state.backend.moveModule(m.id, dir); await refresh(); });
  const toggleComplete = safe(async (m) => { await state.backend.setComplete(m.id, !m.completed); await refresh(); state.success = m.completed ? `"${m.name}" marked incomplete.` : `"${m.name}" marked complete.`; });

  // — pieces —
  const btn = (label, action, cls, onClick, aria) => {
    const b = el("button", cls || "ghost sm", label);
    b.type = "button"; b.dataset.action = action;
    if (aria) b.setAttribute("aria-label", aria);
    b.addEventListener("click", onClick);
    return b;
  };

  function railView() {
    const rail = el("nav", "rail");
    rail.setAttribute("aria-label", "Holons");
    const home = el("button", "rbtn");
    home.type = "button"; home.title = "Home"; home.setAttribute("aria-label", "Home");
    home.setAttribute("aria-pressed", String(state.channel === "welcome"));
    home.append(avatar(0, false));
    home.addEventListener("click", () => { state.holonId = null; state.channel = "welcome"; render(); });
    rail.append(home, el("div", "rsep"));
    state.holons.forEach((h) => {
      const b = el("button", "rbtn");
      b.type = "button"; b.title = h.name; b.setAttribute("aria-label", h.name); b.dataset.holon = String(h.id);
      b.setAttribute("aria-pressed", String(h.id === state.holonId));
      b.append(avatar(h.id + 1, false));
      b.addEventListener("click", () => openHolon(h.id));
      rail.append(b);
    });
    const add = el("button", "rbtn add", "+");
    add.type = "button"; add.title = "Create a Holon"; add.setAttribute("aria-label", "Create a Holon"); add.dataset.action = "new-holon";
    add.addEventListener("click", () => holonDialog());
    rail.append(add);
    return rail;
  }

  function holonActions(h) {
    const bar = el("div", "hactions");
    const owner = isOwner();
    bar.append(el("span", "badge", owner ? "Owner" : isMember() ? "Member" : "Not a member"));
    if (!owner && !isMember()) {
      const j = btn("Join", "join", "primary sm", join, `Join ${h.name}`);
      j.disabled = state.busy > 0 || !state.me;
      if (!state.me) j.title = "Joining needs your user id, which the server did not return.";
      bar.append(j);
    }
    if (!owner && isMember()) { const l = btn("Leave", "leave", "ghost sm", leave, `Leave ${h.name}`); l.disabled = state.busy > 0; bar.append(l); }
    if (owner) bar.append(btn("Edit", "edit-holon", "ghost sm", () => holonDialog(h), `Edit ${h.name}`), btn("Delete", "delete-holon", "ghost sm", () => deleteHolonDialog(h), `Delete ${h.name}`));
    return bar;
  }

  function listView() {
    const col = el("aside", "list");
    const head = el("div", "lhead");
    const h = holon();
    head.append(el("h2", "", h ? h.name : "Holons"), el("p", "", h ? h.description || "" : "Communities you belong to"));
    if (h) head.append(holonActions(h));
    const rows = el("div", "rows");
    const row = (glyph, label, key, cls = "", count) => {
      const b = el("button", `row ${cls}`.trim());
      b.type = "button"; b.dataset.channel = key;
      if (state.channel === key) b.setAttribute("aria-current", "true");
      b.append(el("span", "glyph", glyph), el("span", "rt", label));
      if (count !== undefined) b.append(el("span", "count", String(count)));
      b.addEventListener("click", () => { state.channel = key; render(); });
      return b;
    };
    if (!h) {
      state.holons.forEach((x) => {
        const b = el("button", "row");
        b.type = "button"; b.dataset.holon = String(x.id);
        b.append(avatar(x.id + 1, true), el("span", "rt", x.name));
        b.addEventListener("click", () => openHolon(x.id));
        rows.append(b);
      });
      if (!state.holons.length && !state.loading) rows.append(el("div", "empty", "No Holons yet. Use + to create one."));
    } else {
      rows.append(el("div", "lsect", "Channels"), row("#", "feed", "feed", "", state.data ? state.data.feed.length : undefined));
      rows.append(el("div", "lsect", "Courses"));
      if (state.data) {
        const b = state.backend;
        if (!b.coursesSupported) rows.append(el("div", "empty", b.localCourses ? "holons-api has no courses endpoint, so anything you create here stays in this browser." : "holons-api has no courses endpoint."));
        else if (!state.data.courses.length) rows.append(el("div", "empty", "No courses yet."));
        if (b.localCourses) rows.append(el("div", "localtag", LOCAL_LABEL));
        if (b.coursesSupported || b.localCourses) rows.append(btn("+ New course", "new-course", "ghost sm", courseDialog));
        state.data.courses.forEach((c) => {
          rows.append(row("▸", c.name, `course:${c.id}`));
          c.modules.forEach((m) => rows.append(row(m.completed ? "✓" : "•", m.name, `module:${m.id}`, "sub")));
        });
      }
    }
    col.append(head, rows, btn("Docs", "docs", "docslink", () => openDocs("index", ".docslink")), poweredBy("lpowered"));
    return col;
  }

  function messageView(name, authorId, time, bodyNode, small, pending) {
    const m = el("div", small ? "reply" : "msg");
    if (pending) m.setAttribute("aria-busy", "true");
    m.append(avatar(authorId, small));
    const body = el("div", "mbody");
    const meta = el("div", "mmeta");
    meta.append(el("span", "mname", name), el("span", "mtime", pending ? "Sending..." : time));
    body.append(meta, bodyNode);
    m.append(body);
    return m;
  }

  function feedView(thread) {
    if (!state.data.feed.length) thread.append(el("div", "empty", "No posts yet. Start the conversation."));
    state.data.feed.forEach((p) => {
      const body = el("div");
      body.append(el("div", "mtitle", p.title || ""), renderMarkdown(p.content || ""));
      const msg = messageView(p.authorName, p.author_id, shortTime(p.created_at), body, false, p.pending);
      msg.dataset.post = String(p.id);
      const open = state.openReplies.has(p.id);
      const toggle = el("button", "linkbtn", `${open ? "Hide" : "Show"} replies (${p.comments.length})`);
      toggle.type = "button";
      toggle.addEventListener("click", () => { if (open) state.openReplies.delete(p.id); else state.openReplies.add(p.id); render(); });
      const tools = el("div", "ctools");
      tools.append(toggle);
      if (canManagePost(p)) tools.append(btn("Edit", "edit-post", "linkbtn", () => postDialog(p), "Edit post"), btn("Delete", "delete-post", "linkbtn", () => deletePostDialog(p), "Delete post"));
      body.append(tools);
      if (open) {
        const replies = el("div", "replies");
        p.comments.forEach((c) => {
          const r = messageView(c.authorName, c.author_id, shortTime(c.created_at), renderMarkdown(c.content || ""), true, c.pending);
          r.dataset.comment = String(c.id);
          if (canManageComment(c)) r.querySelector(".mbody").append(btn("Edit", "edit-comment", "linkbtn", () => commentDialog(p.id, c), "Edit reply"), btn("Delete", "delete-comment", "linkbtn", () => deleteCommentDialog(p.id, c), "Delete reply"));
          replies.append(r);
        });
        const form = el("form", "rform");
        const input = el("input"); input.placeholder = "Reply..."; input.setAttribute("aria-label", "Reply");
        const go = el("button", "ghost", "Reply"); go.type = "submit"; go.disabled = state.busy > 0;
        form.append(input, go);
        form.addEventListener("submit", (e) => { e.preventDefault(); const t = input.value.trim(); if (t && !state.busy) reply(p.id, t); });
        replies.append(form);
        body.append(replies);
      }
      thread.append(msg);
    });
  }

  function courseView(thread, course) {
    const local = state.backend.localCourses;
    const intro = el("div");
    intro.append(renderMarkdown(`**${course.name}**\n\n${course.description || ""}`));
    const tools = el("div", "ctools");
    tools.append(btn("+ New module", "new-module", "ghost sm", () => moduleDialog(course)));
    if (local) tools.append(el("span", "localtag", LOCAL_LABEL));
    intro.append(tools);
    thread.append(messageView("Course", course.instructor_id || course.id, "", intro));
    course.modules.forEach((m, i) => {
      const body = el("div");
      body.append(renderMarkdown(m.body || m.description || ""), moduleTools(m, i, course.modules.length));
      const msg = messageView(m.name, m.id, "", body);
      msg.dataset.module = String(m.id);
      thread.append(msg);
    });
  }
  function moduleTools(m, i, n) {
    const tools = el("div", "ctools");
    const up = btn("Move up", "module-up", "linkbtn", () => moveModule(m, -1), `Move ${m.name} up`); up.disabled = i === 0;
    const down = btn("Move down", "module-down", "linkbtn", () => moveModule(m, 1), `Move ${m.name} down`); down.disabled = i === n - 1;
    const done = btn(m.completed ? "Completed (undo)" : "Mark complete", "module-complete", `linkbtn${m.completed ? " done" : ""}`, () => toggleComplete(m), `${m.completed ? "Mark incomplete" : "Mark complete"}: ${m.name}`);
    done.setAttribute("aria-pressed", String(Boolean(m.completed)));
    tools.append(up, down, done);
    return tools;
  }

  // ── Documentation reader: replaces the main column; the page list sits at its left ────────
  function openDocs(pageId = state.docs.page, opener = "") {
    state.docs.opener = opener;
    state.docs.page = DOCS.some((d) => d.id === pageId) ? pageId : DOCS[0].id;
    state.docs.open = true;
    render();
    focusDocHeading();
  }

  function closeDocs() {
    state.docs.open = false;
    render();
    if (state.docs.opener) root.querySelector(state.docs.opener)?.focus?.();
  }

  function focusDocHeading() { root.querySelector(".dpage h2")?.focus?.(); }

  function chooseDoc(id) {
    state.docs.page = id;
    render();
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

  function docsView() {
    const page = DOCS.find((d) => d.id === state.docs.page) || DOCS[0];
    const main = el("main", "main");
    const wrap = el("div", "docs");
    wrap.dataset.page = page.id;
    const head = el("div", "mhead");
    head.append(btn("Back", "docs-back", "headbtn docsback", closeDocs), el("h3", "", "Documentation"));
    const body = el("div", "dbody");

    const nav = el("nav", "dnav");
    nav.setAttribute("aria-label", "Documentation pages");
    DOCS.forEach((d) => {
      const b = btn(d.title, "docs-page", "row dlink", () => chooseDoc(d.id));
      if (d.id === page.id) b.setAttribute("aria-current", "page");
      nav.append(b);
    });

    const article = el("article", "dpage");
    const tools = el("div", "dtools");
    const note = el("span", "hint");
    note.setAttribute("role", "status");
    note.setAttribute("aria-live", "polite");
    note.style.padding = "0";
    tools.append(
      btn("Copy Markdown", "docs-copy", "headbtn dcopy", async () => {
        try { await navigator.clipboard.writeText(page.markdown); note.textContent = "Copied."; } catch { note.textContent = "Copy is not available in this browser."; }
      }),
      btn("Download .md", "docs-download", "headbtn ddownload", () => { note.textContent = downloadText(`holons-${page.id}.md`, page.markdown) ? "Download started." : "Download is not available in this browser."; }),
      note,
    );
    const title = el("h2", "", page.title);
    title.tabIndex = -1;
    // The page title is the heading above; drop the Markdown's own leading "# " line from the rendered body.
    const shown = page.markdown.replace(/^# .*\n+/, "");
    article.append(tools, title, renderMarkdown(shown, { httpOnly: true }));
    body.append(nav, article);
    wrap.append(head, body);
    main.append(wrap);
    return main;
  }

  function mainView() {
    if (state.docs.open) return docsView();
    const main = el("main", "main");
    const head = el("div", "mhead");
    const h = holon();
    const course = state.data && state.channel.startsWith("course:") ? state.data.courses.find((c) => `course:${c.id}` === state.channel) : null;
    const mod = state.data && state.channel.startsWith("module:") ? state.data.courses.flatMap((c) => c.modules.map((m) => ({ ...m, course: c }))).find((m) => `module:${m.id}` === state.channel) : null;
    const title = state.channel === "welcome" || !h ? "Welcome" : course ? course.name : mod ? `${mod.course.name} / ${mod.name}` : `${h.name} / feed`;
    head.append(el("h3", "", title));
    if (h && state.channel === "feed" && state.data) head.append(btn("New post", "new-post", "ghost sm", () => postDialog()));
    const who = state.me ? (live() ? `Signed in as ${saved.email || state.me.email || `user #${state.me.id}`}` : `Demo user: ${state.me.name}`) : live() ? "Signed in" : "Not signed in";
    head.append(el("span", "who", who));
    if (live()) head.append(btn("Sign out", "sign-out", "ghost sm", () => accountDialog()));
    else head.append(btn("Sign in", "sign-in", "ghost sm", () => accountDialog("signin")), btn("Sign up", "sign-up", "ghost sm", () => accountDialog("signup")));
    const status = el("button", "status");
    status.type = "button"; status.dataset.mode = state.backend ? state.backend.mode : "demo";
    status.title = "Account and connection";
    status.append(el("i"), el("span", "", state.loading ? "Connecting..." : live() ? "Connected" : "Demo"));
    status.addEventListener("click", () => accountDialog("signin"));
    head.append(status);
    main.append(head);
    if (state.notice) main.append(el("div", "banner", state.notice));
    if (state.success) { const b = el("div", "banner ok", state.success); b.setAttribute("role", "status"); main.append(b); }
    if (state.error) { const b = el("div", "banner error", state.error); b.setAttribute("role", "alert"); main.append(b); }

    if (state.channel === "welcome" || !h) {
      const w = el("div", "welcome");
      const big = el("span", "wbig"); big.append(avatarNode("violet", AVATAR_STYLE, 660));
      w.append(big, el("h1", "", "Holons™"),
        el("p", "", live() ? `Connected to ${state.backend.base}. Pick a Holon on the left, or press + to create one.` : "Chat with your Holons: feeds, courses and the people in them. You are in Demo mode with sample Holons."),
        poweredBy("wpowered"));
      const actions = el("div", "wactions");
      actions.append(btn("Learn about Holons", "docs-open", "wdocs", () => openDocs("index", ".wdocs")));
      w.insertBefore(actions, w.querySelector(".wpowered"));
      main.append(w);
      return main;
    }
    const thread = el("div", "thread");
    if (!state.data) thread.append(el("div", "empty", "Loading..."));
    else if (state.channel === "feed") feedView(thread);
    else if (course) courseView(thread, course);
    else if (mod) {
      const idx = mod.course.modules.findIndex((m) => m.id === mod.id);
      const body = el("div");
      body.append(renderMarkdown(mod.body || ""), moduleTools(mod, idx, mod.course.modules.length));
      thread.append(messageView(mod.name, mod.id, "", body));
    } else thread.append(el("div", "empty", "Nothing here."));
    main.append(thread);

    if (state.channel === "feed" && state.data) {
      if (!isOwner() && !isMember()) main.append(el("div", "hint", "You have not joined this Holon, so the server may refuse your post. Use Join in the left column."));
      const form = el("form", "composer");
      const ta = el("textarea"); ta.placeholder = `Post to ${h.name}`; ta.rows = 1; ta.setAttribute("aria-label", "Message");
      const send = el("button", "send", state.busy ? "Sending..." : "Send"); send.type = "submit"; send.disabled = state.busy > 0;
      form.append(ta, send);
      ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true })); } });
      form.addEventListener("submit", (e) => { e.preventDefault(); const t = ta.value.trim(); if (t && !state.busy) post(t); });
      main.append(form);
    } else if (state.backend && state.backend.localCourses) main.append(el("div", "note", `${LOCAL_LABEL}.`));
    return main;
  }

  function teamView() {
    const col = el("aside", "team");
    col.append(el("h4", "", `Team${state.data ? ` (${state.data.members.length})` : ""}`));
    if (state.data) state.data.members.forEach((m) => {
      const r = el("div", "member");
      const who = el("div");
      who.append(el("span", "", m.name), el("small", "", m.role));
      r.append(avatar(m.id, true), who);
      col.append(r);
    });
    else col.append(el("div", "empty", holon() ? "Loading..." : "Pick a Holon."));
    if (holon()) { const n = el("p", "hint invite-note", NO_INVITE); n.style.padding = "10px 0 0"; col.append(n); }
    return col;
  }

  let grips = { dispose() {} };
  function render() {
    if (disposed) return;
    fitRoot();
    grips.dispose();
    const shell = el("div", "shell");
    shell.classList.toggle("docsopen", state.docs.open);
    shell.append(railView(), listView(), mainView());
    if (!state.docs.open) shell.append(teamView());
    shellHost.replaceChildren(shell);
    grips = gripColumns({
      grid: shell, storageKey: "grip:holons-hangout", centerMin: 56 + 320, narrowQuery: "(max-width: 900px)",
      columns: [
        { el: shell.querySelector(":scope > .list"), edge: "left", min: 200, max: 480, initial: 300, label: "holons list" },
        ...(state.docs.open ? [] : [{ el: shell.querySelector(":scope > .team"), edge: "right", min: 160, max: 420, initial: 280, label: "team panel" }]),
      ],
    });
    // The rail sits left of the list, so its handle is 56px further in.
    shell.querySelectorAll(":scope > .grip-left").forEach((h) => { h.style.left = "calc(56px + var(--grip-0, 300px))"; });
    const ta = root.querySelector(".composer textarea");
    if (ta && state.refocus && !state.dialog) { ta.focus(); state.refocus = false; }
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

  render();
  connect(saved);
  const splash = mountComingSoonSplash(root, { brand: "holons", name: "Holons™", tint: "#6366f1", tagline: "Holons social graph hangout, with a built-in docs reader." });
  return () => { splash.destroy(); disposed = true; window.removeEventListener("resize", onWinResize); roFit?.disconnect(); grips.dispose(); root.remove(); };
}
