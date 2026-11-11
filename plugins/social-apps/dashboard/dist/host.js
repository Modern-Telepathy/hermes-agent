/* Canvas Extensions host (API v1), shared by the per-app dashboard plugins.
 *
 * Each social app is its own dashboard plugin with its own left-nav tab; this module holds the
 * one piece they share — activating a Canvas App bundle with the host object it expects, the
 * Agent Server adapter that answers the OpenHands API from Hermes, and the stage fitting that makes
 * an app occupy the whole right-hand content area instead of the shell's padded page column.
 *
 * The apps are the committed bundles in ./apps/<id>/extension.js (MIT, copied verbatim).
 */

const SELF = import.meta.url;

function sdk() {
  return window.__HERMES_PLUGIN_SDK__;
}

/** OpenHands conversations from Hermes sessions. */
function toConversation(session) {
  return {
    id: session.id,
    title: session.title || session.display_name || session.id,
    created_at: session.created_at || session.updated_at || new Date().toISOString(),
    updated_at: session.updated_at || session.created_at || new Date().toISOString(),
    execution_status: "finished",
    current_model_name: session.model || "",
    workspace: { working_dir: session.workspace || "" },
    tags: {},
  };
}

/** Hermes transcript rows as the Agent Server's MessageEvents. */
function toEvent(message, index) {
  return {
    id: "hermes-" + index,
    kind: "MessageEvent",
    source: message.role === "user" ? "user" : "assistant",
    timestamp: message.timestamp || "",
    llm_message: { content: [{ type: "text", text: String(message.content || "") }] },
  };
}

function makeAgentServer() {
  const SDK = sdk();
  const postJSON = (url, payload) =>
    SDK.fetchJSON(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

  return {
    async request(options) {
      const path = (options && options.path) || "";
      const method = (options && options.method) || "GET";
      const body = (options && options.body) || null;

      const send = path.match(/^\/api\/conversations\/([^/]+)\/events$/);
      if (send && method === "POST") {
        const text = ((body && body.content) || [])
          .map((part) => (part && part.text) || "")
          .join("")
          .trim();
        // A real Hermes turn in that session (plugins/social-apps/dashboard/plugin_api.py).
        return postJSON("/api/plugins/social-apps/send", {
          session_id: decodeURIComponent(send[1]),
          text: text,
        });
      }

      const events = path.match(/^\/api\/conversations\/([^/]+)\/events\/search/);
      if (events) {
        const resp = await SDK.api.getSessionMessages(decodeURIComponent(events[1]));
        return { items: ((resp && resp.messages) || []).map(toEvent) };
      }

      if (path.indexOf("/api/conversations/search") === 0) {
        const resp = await SDK.api.getSessions(40);
        const rows = (resp && (resp.sessions || resp.items)) || [];
        return { items: rows.map(toConversation) };
      }

      if (path.indexOf("/api/agent-profiles") === 0) return [];

      if (path.indexOf("/api/bash/start_bash_command") === 0) {
        return postJSON("/api/plugins/social-apps/bash", {
          command: (body && body.command) || "",
          cwd: (body && body.cwd) || null,
        });
      }

      throw new Error("unsupported Agent Server path: " + path);
    },
  };
}

/** Canvas host API v1: only the members these six bundles touch. */
function makeHost(root) {
  const pages = new Map();
  const listeners = new Map();
  const fire = (type, event) => (listeners.get(type) || []).forEach((fn) => fn(event));
  root.addEventListener("pointermove", (event) => fire("pointermove", event));
  root.addEventListener("pointerleave", (event) => fire("pointerleave", event));

  return {
    apiVersion: "1",
    agentServer: makeAgentServer(),
    isConnected: true,
    registerPage(id, mount) {
      pages.set(id, mount);
      return { id };
    },
    navigate() {
      /* one page per tab: the shell owns navigation */
    },
    addEventListener(type, fn) {
      listeners.set(type, [...(listeners.get(type) || []), fn]);
    },
    removeEventListener(type, fn) {
      listeners.set(type, (listeners.get(type) || []).filter((candidate) => candidate !== fn));
    },
    _mount(id, node) {
      const mount = pages.get(id);
      if (!mount) throw new Error("app registered no page " + id);
      return mount({ container: node, navigate: () => {} });
    },
  };
}

const STYLE_ID = "social-app-host-style";
function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .social-app[data-stage="full"] {
      position: fixed;
      z-index: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--color-background, #0b0d10);
    }
    .social-app[data-stage="full"] .social-app__mount {
      flex: 1 1 auto;
      min-height: 0;
      height: 100%;
    }
    .social-app__mount { min-height: 540px; }
    .social-app[data-stage="full"] .social-app__mount > *:not(style) {
      width: 100% !important;
      height: 100% !important;
    }
    .social-app__error {
      font-family: var(--font-mono, ui-monospace, monospace);
      font-size: 11px;
      color: var(--color-destructive, #ef4444);
    }
  `;
  document.head.append(style);
}

/**
 * Pin the plugin's page to the shell's scroll viewport (``main``) instead of the padded page
 * column, so a full-page app gets the whole right-hand area. The page padding is the shell's own
 * responsive utility classes, so the box is measured rather than offset by hardcoded values.
 */
function fitStage(node) {
  const root = node.closest(".social-app");
  if (!root) return () => {};
  // A full-page app draws its own toolbar, so it replaces the page's header row as well: fill the
  // content column that holds <main> rather than the padded scroll viewport inside it.
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

  // Coalesce: app renders and our own style writes both come in bursts.
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
  // Rows above the stage (banners, the page header) appear once data loads, which moves the stage
  // without resizing it, so poll briefly instead of trusting the first paint. Bounded on purpose:
  // a MutationObserver here feeds back on our own style writes and locks up the page.
  const settle = setInterval(apply, 250);
  setTimeout(() => clearInterval(settle), 6000);
  // Apps measure their own frame on a resize event; our change does not fire one by itself.
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

const activated = new Map();

/** Activate the app bundle once per page, mount its page into `node`, and fit it to the stage.
 *  Returns a disposer the plugin calls on unmount. */
export function mountSocialApp(node, id) {
  injectStyle();
  if (!activated.has(id)) {
    activated.set(
      id,
      import(new URL("apps/" + id + "/extension.js", SELF).href).then((mod) => {
        if (typeof mod.activate !== "function") throw new Error(id + " exports no activate()");
        const pages = new Map();
        const host = makeHost(document.createElement("div"));
        const registerPage = host.registerPage;
        host.registerPage = (pageId, mount) => {
          pages.set(pageId, mount);
          return registerPage(pageId, mount);
        };
        mod.activate(host);
        const pageId = [...pages.keys()][0];
        if (!pageId) throw new Error(id + " registered no page");
        return pages.get(pageId);
      }),
    );
  }
  return activated.get(id).then((mount) => {
    mount({ container: node, navigate: () => {} });
    return fitStage(node);
  });
}
