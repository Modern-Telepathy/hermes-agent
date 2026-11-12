/* Canvas Extensions host (API v1) for the Kosmos Suite apps and DocTransit.
 *
 * Each app is a committed Canvas App bundle in ./apps/<id>/extension.js, copied byte for byte
 * from OpenHands canvas-apps (MIT). Canvas activates them with `activate(host)`; this module
 * supplies that host.
 *
 * The suite apps never touch `host.agentServer` for their files: `connectSuite` in
 * packages/suite-kit prefers a page-wide adapter when `globalThis.__SUITE_SHARED_ADAPTER__` is
 * set, which is the seam Agent Canvas uses for its own all-apps harness. We install a Hermes
 * filesystem adapter there (backed by /api/plugins/office-suite/) before the bundle mounts, so
 * the apps get list/stat/read/compare-and-swap writes instead of the Agent Server's shell.
 * DocTransit needs no filesystem at all; it talks to api.doctransit.com directly.
 */

const SELF = import.meta.url;
const API = "/api/plugins/office-suite";

function sdk() {
  return window.__HERMES_PLUGIN_SDK__;
}

function httpStatus(error) {
  const match = /^(\d{3})/.exec(String((error && error.message) || ""));
  return match ? Number(match[1]) : 0;
}

function fsError(code, message, extra) {
  const error = new Error(message);
  error.name = code === "ECONFLICT" ? "ConflictError" : "FsError";
  error.code = code;
  Object.assign(error, extra || {});
  return error;
}

function mapError(error, path) {
  const status = httpStatus(error);
  if (status === 404) return fsError("ENOENT", "no such file: " + path, { path });
  if (status === 400) return fsError("EINVAL", String(error.message).replace(/^400:\s*/, ""));
  if (status === 409) return fsError("EEXIST", "already exists: " + path, { path });
  return fsError("EIO", (error && error.message) || String(error), { path });
}

/** workspace-fs adapter contract: init/stat/list/listTree/readBytes/writeBytes/mkdir/move/remove. */
function createWorkspaceAdapter() {
  const capabilities = {
    atomicWrite: true,
    list: true,
    stat: true,
    move: true,
    remove: true,
    binary: true,
    bash: false,
  };
  let root = "";
  const q = encodeURIComponent;
  const json = (path, init) => sdk().fetchJSON(API + path, init);

  const adapter = {
    name: "hermes-suite",
    capabilities,
    get root() {
      return root;
    },

    async init() {
      const where = await json("/where");
      root = where.root;
      return { root, capabilities };
    },

    async stat(path) {
      try {
        return (await json("/stat?path=" + q(path))).stat;
      } catch (error) {
        throw mapError(error, path);
      }
    },

    async list(dir) {
      return adapter.listTree(dir, { maxdepth: 1 });
    },

    async listTree(dir = "", options = {}) {
      const maxdepth = options.maxdepth || 0;
      const includeInternal = options.includeInternal ? "&include_internal=true" : "";
      const query = "?dir=" + q(dir) + "&depth=" + maxdepth + includeInternal;
      try {
        return (await json("/tree" + query)).entries || [];
      } catch (error) {
        throw mapError(error, dir);
      }
    },

    async readBytes(path) {
      const response = await sdk().authedFetch(API + "/file?path=" + q(path));
      if (response.status === 404) throw fsError("ENOENT", "no such file: " + path, { path });
      if (!response.ok) throw fsError("EIO", "read failed (" + response.status + "): " + path, { path });
      const bytes = new Uint8Array(await response.arrayBuffer());
      const version = response.headers.get("x-suite-version") || "unknown";
      return {
        bytes,
        stat: {
          path,
          type: "file",
          size: bytes.length,
          mtimeMs: Number(response.headers.get("x-suite-mtime") || 0),
          version,
        },
      };
    },

    async writeBytes(path, data, options = {}) {
      const expected = options.expected || "*";
      const bytes =
        typeof data === "string"
          ? new TextEncoder().encode(data)
          : data instanceof Uint8Array
            ? data
            : new Uint8Array(data);
      try {
        const written = await json(
          "/write?path=" + q(path) + "&expected=" + q(expected),
          {
            method: "POST",
            headers: { "content-type": "application/octet-stream" },
            body: bytes,
          },
        );
        return written.stat;
      } catch (error) {
        if (httpStatus(error) === 409) {
          const current = await adapter.stat(path).catch(() => null);
          throw fsError("ECONFLICT", path + " changed on disk since it was read", {
            path,
            expected,
            current,
          });
        }
        throw mapError(error, path);
      }
    },

    async mkdir(path) {
      try {
        await json("/mkdir?path=" + q(path), { method: "POST" });
      } catch (error) {
        throw mapError(error, path);
      }
    },

    async move(from, to, options = {}) {
      const query = "/move?from=" + q(from) + "&to=" + q(to);
      try {
        await json(query + (options.overwrite ? "&overwrite=true" : ""), { method: "POST" });
      } catch (error) {
        throw mapError(error, to);
      }
    },

    async remove(path, options = {}) {
      const query = "/remove?path=" + q(path) + (options.recursive ? "&recursive=true" : "");
      try {
        await json(query, { method: "POST" });
      } catch (error) {
        throw mapError(error, path);
      }
    },
  };

  return adapter;
}

let installed = null;

/** Install the filesystem adapter the suite apps pick up from their shared seam. */
export function installSuiteAdapter() {
  if (!installed) {
    installed = createWorkspaceAdapter();
    globalThis.__SUITE_SHARED_ADAPTER__ = installed;
  }
  return installed;
}

function makeHost(id, root) {
  const pages = new Map();
  const intents = new Set();
  const createActions = [];
  const listeners = new Map();
  const fire = (type, event) => (listeners.get(type) || []).forEach((fn) => fn(event));
  root.addEventListener("pointermove", (event) => fire("pointermove", event));
  root.addEventListener("pointerleave", (event) => fire("pointerleave", event));

  return {
    apiVersion: "1",
    // suite-links tags its BroadcastChannel messages with the extension name.
    extension: { name: id },
    backend: { kind: "local" },
    isConnected: true,
    // Notes' "Ask the agent" and Calendar's automations probe this. Hermes runs turns in
    // sessions, not in an Agent Server, so they fall back to their own copy-prompt paths.
    agentServer: {
      async request() {
        throw new Error(
          "Hermes has no Agent Server; the office suite talks to its filesystem API instead.",
        );
      },
    },
    registerPage(pageId, mount) {
      pages.set(pageId, mount);
      return () => pages.delete(pageId);
    },
    navigate() {
      /* one page per tab: the shell owns navigation */
    },
    addEventListener(type, fn) {
      listeners.set(type, [...(listeners.get(type) || []), fn]);
    },
    removeEventListener(type, fn) {
      listeners.set(type, (listeners.get(type) || []).filter((entry) => entry !== fn));
    },
    /* DocTransit's New Chat entries: Hermes has no New Chat menu, so the tab renders them. */
    onIntent(fn) {
      intents.add(fn);
      return () => intents.delete(fn);
    },
    registerCreateAction(action) {
      createActions.push(action);
      return () => {
        const index = createActions.indexOf(action);
        if (index >= 0) createActions.splice(index, 1);
      };
    },
    _pages: pages,
    _intents: intents,
    _createActions: createActions,
  };
}

const activated = new Map();

/** Activate a bundle once per page: registerPage() runs during activate(), not at mount. */
function activateApp(id) {
  if (!activated.has(id)) {
    activated.set(
      id,
      import(new URL("apps/" + id + "/extension.js", SELF).href).then((module) => {
        if (typeof module.activate !== "function") throw new Error(id + " exports no activate()");
        const host = makeHost(id, document.createElement("div"));
        module.activate(host);
        return host;
      }),
    );
  }
  return activated.get(id);
}

const STYLE_ID = "office-suite-host-style";

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .office-app[data-stage="full"] {
      position: fixed;
      z-index: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--color-background, #0b0d10);
    }
    .office-app[data-stage="full"] .office-app__mount {
      flex: 1 1 auto;
      min-height: 0;
      height: 100%;
    }
    .office-app__mount { min-height: 540px; display: flex; flex-direction: column; }
    /* One app root fills the stage. DocTransit adds a toolbar above its page, so those two
       children are laid out as a column instead of being each forced to full height. */
    .office-app[data-stage="full"] .office-app__mount > * {
      width: 100% !important;
    }
    .office-app[data-stage="full"] .office-app__mount > *:not(.office-intents):not(.office-app__page) {
      height: 100% !important;
    }
    .office-app__page { flex: 1 1 auto; min-height: 0; overflow: hidden; }
    /* DocTransit's own fit() sizes itself to window.innerHeight, which is taller than this tab's
       page area; clamp the root to the box it was given so its footer is not clipped. */
    .office-app__page > * { width: 100% !important; height: 100% !important; }
    /* The suite kit reads the host's --oh-* tokens, with its own fallback palette. */
    .office-app {
      --oh-color-base: var(--color-background, #0b0d10);
      --oh-color-base-secondary: var(--color-card, #161a23);
      --oh-surface-raised: var(--color-accent, #1e2330);
      --oh-surface-deep: var(--color-background, #0b0d12);
      --oh-foreground: var(--color-foreground, #e8ebf2);
      --oh-contrast: var(--color-foreground, #ffffff);
      /* DocTransit paints primary buttons with --fg and inks them with this token; without it
         the label falls back to #fff on the light button and disappears. */
      --oh-contrast-foreground: var(--color-background, #0b0d10);
      --oh-muted: var(--color-muted-foreground, #9aa3b5);
      --oh-border: var(--color-border, #2a3040);
      --oh-border-subtle: var(--color-border, #212635);
      --oh-danger: var(--color-destructive, #ec7063);
      --oh-success: #6fcf97;
      --oh-warning: #e5c07b;
    }
    .office-app__error {
      font-family: var(--font-mono, ui-monospace, monospace);
      font-size: 11px;
      color: var(--color-destructive, #ef4444);
    }
    .office-intents {
      display: flex;
      flex: 0 0 auto;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-bottom: 1px solid var(--color-border, #2a3040);
      background: var(--color-card, #161a23);
    }
    .office-intents:empty { display: none; }
    .office-intents__button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border: 1px solid var(--color-border, #2a3040);
      border-radius: var(--radius, 8px);
      background: transparent;
      color: var(--color-foreground, #e8ebf2);
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    .office-intents__button:hover { background: var(--color-accent, #1e2330); }
    .office-intents__button svg { width: 14px; height: 14px; }
  `;
  document.head.append(style);
}

/**
 * Pin the plugin's page to the shell's content column instead of the padded page column, so a
 * full-page editor gets the whole right-hand area. Measured, not hardcoded: the shell's padding
 * is its own responsive utility classes.
 */
function fitStage(node) {
  const root = node.closest(".office-app");
  if (!root) return () => {};
  const main = node.closest("main");
  const stage = (main && main.parentElement) || main || document.body;

  const apply = () => {
    const rect = stage.getBoundingClientRect();
    root.dataset.stage = "full";
    root.style.left = rect.left + "px";
    root.style.top = rect.top + "px";
    root.style.width = rect.width + "px";
    root.style.height = rect.height + "px";
  };

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      apply();
    });
  };

  apply();
  const observer = new ResizeObserver(schedule);
  observer.observe(stage);
  if (main && main !== stage) observer.observe(main);
  if (stage.parentElement) observer.observe(stage.parentElement);
  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, true);
  // Rows above the stage appear once data loads, which moves it without resizing it.
  const settle = setInterval(apply, 250);
  setTimeout(() => clearInterval(settle), 6000);
  window.dispatchEvent(new Event("resize"));

  return () => {
    observer.disconnect();
    clearInterval(settle);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("scroll", schedule, true);
    delete root.dataset.stage;
    root.style.left = "";
    root.style.top = "";
    root.style.width = "";
    root.style.height = "";
  };
}

/** Mount one suite app's page into `node`; returns a disposer. */
export async function mountOfficeApp(node, id) {
  installSuiteAdapter();
  injectStyle();
  const host = await activateApp(id);
  const pageId = [...host._pages.keys()][0];
  if (!pageId) throw new Error(id + " registered no page");
  const dispose = host._pages.get(pageId)({
    container: node,
    path: "/main",
    navigate: () => {},
  });
  const fitted = fitStage(node);
  return () => {
    if (typeof dispose === "function") dispose();
    fitted();
  };
}

const DOCTRANSIT = "doctransit";

/** DocTransit, plus a toolbar for the New Chat entries it registers (Hermes has no such menu). */
export async function mountDocTransit(node) {
  injectStyle();
  const host = await activateApp(DOCTRANSIT);
  const pageId = [...host._pages.keys()][0];
  if (!pageId) throw new Error("doctransit registered no page");

  const bar = document.createElement("div");
  bar.className = "office-intents";
  const page = document.createElement("div");
  page.className = "office-app__page";
  node.replaceChildren(bar, page);

  let dispose = null;
  const open = (intent) => {
    if (typeof dispose === "function") dispose();
    dispose = host._pages.get(pageId)({
      container: page,
      path: "/doctransit",
      navigate: () => {},
      intent,
    });
    host._intents.forEach((fn) => {
      try {
        fn(intent);
      } catch (error) {
        console.warn("[office-suite] intent listener failed", error);
      }
    });
  };

  for (const action of host._createActions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "office-intents__button";
    button.title = action.description || "";
    if (action.icon && action.icon.svg) {
      // The icon is the vendored bundle's own SVG string, not user input.
      const icon = document.createElement("span");
      icon.innerHTML = action.icon.svg;
      button.append(icon);
    }
    button.append(document.createTextNode(action.label));
    button.addEventListener("click", () => open(action.intent));
    bar.append(button);
  }

  open(undefined);
  const fitted = fitStage(node);
  return () => {
    if (typeof dispose === "function") dispose();
    fitted();
    node.replaceChildren();
  };
}
