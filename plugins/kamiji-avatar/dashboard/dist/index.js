// Kamiji avatar for the Hermes dashboard — a slot-only dashboard plugin.
//
// The Hermes *WebUI* extension this was ported from upgrades `.role-icon.assistant` in an HTML
// transcript and wraps `window.EventSource('api/chat/stream')`. Neither exists here: the dashboard
// chat is the embedded `hermes --tui` PTY (`web/AGENTS.md`), so this bundle renders the avatar in
// the `chat:top` slot and drives it from the dashboard's own event fan-out instead:
//
//   tui_gateway/server.py::_emit → event_publisher (WS) → /api/pub → /api/events?channel=<chat>
//   frame: {"jsonrpc":"2.0","method":"event","params":{"type":…,"session_id":…,"payload":…}}
//
// The chat channel is published by ChatPage through the plugin SDK (`SDK.chat`), because it is not
// in the DOM and is chosen after this bundle loads.
(function () {
  "use strict";

  const SDK = window.__HERMES_PLUGIN_SDK__;
  const registry = window.__HERMES_PLUGINS__;
  if (!SDK || !registry) return;

  const React = SDK.React;
  const { useState, useEffect, useRef } = SDK.hooks;

  const TAG = "[kamiji-avatar]";
  const ME = document.currentScript;
  const BASE = (ME && ME.src ? ME.src : location.origin + "/dashboard-plugins/kamiji-avatar/dist/index.js")
    .replace(/[?#].*$/, "")
    .replace(/[^/]*$/, "");

  // three.js is bundled inside the runtime (0.186.1); importing it once per page defines the
  // <kamiji-avatar> custom element. A failed import leaves the element's lettered fallback visible.
  let runtime = null;
  function loadRuntime() {
    if (!runtime) {
      runtime = import(BASE + "kamiji-runtime.js").catch(function (err) {
        console.warn(TAG + " runtime failed to load from " + BASE + "kamiji-runtime.js: " + (err && err.message));
        return null;
      });
    }
    return runtime;
  }

  // Turn events, from tui_gateway/agent_callbacks.py + session_notifications.py.
  const RUNNING = {
    "message.start": true,
    "thinking.delta": true,
    "reasoning.delta": true,
    "tool.start": true,
    "tool.complete": true,
    "tool.generating": true,
    "status.update": true,
  };
  const WAITING = { "connection.request": true, "notification.show": true };
  const FINISH_CELEBRATION_MS = 2500;

  /** Kamiji protocol v1 status for one dashboard event, or null when it carries no signal. */
  function statusFor(type, payload) {
    if (type === "error") return "error";
    if (type === "message.complete") {
      return payload && payload.status === "error" ? "error" : "finished";
    }
    if (WAITING[type]) return "waiting";
    if (RUNNING[type]) return "running";
    return null;
  }

  const LABEL = { idle: "idle", running: "working", waiting: "needs you", finished: "done", error: "error" };

  function KamijiAvatarWidget() {
    const [status, setStatus] = useState("idle");
    const [degraded, setDegraded] = useState(false);

    useEffect(function () {
      let alive = true;
      loadRuntime().then(function (mod) {
        if (!alive || !mod) return;
        // WebGL or the model may still be unavailable; the element reports it and keeps its
        // lettered fallback, so the widget never goes blank.
        if (typeof mod.KamijiAvatar.supported === "function" && !mod.KamijiAvatar.supported()) {
          setDegraded(true);
        }
      });
      const onError = function (ev) {
        const detail = (ev && ev.detail) || {};
        console.warn(TAG + " 3D unavailable (" + (detail.phase || "?") + "); showing the fallback");
        setDegraded(true);
      };
      document.addEventListener("kamiji-error", onError, true);
      return function () {
        alive = false;
        document.removeEventListener("kamiji-error", onError, true);
      };
    }, []);

    // Live status: one socket per chat channel, re-dialled with backoff.
    useEffect(function () {
      let closed = false;
      let socket = null;
      let retry = null;
      let attempt = 0;
      let settle = null;

      function apply(next) {
        setStatus(next);
        clearTimeout(settle);
        if (next === "finished") {
          settle = setTimeout(function () { setStatus("idle"); }, FINISH_CELEBRATION_MS);
        }
      }

      function dial(channel) {
        if (closed || !channel) return;
        SDK.buildWsUrl("/api/events", { channel: channel })
          .then(function (url) {
            if (closed) return;
            socket = new WebSocket(url);
            socket.onmessage = function (ev) {
              let frame = null;
              try {
                frame = JSON.parse(ev.data);
              } catch (err) {
                return;
              }
              if (!frame || frame.method !== "event" || !frame.params) return;
              const next = statusFor(frame.params.type, frame.params.payload);
              if (next) apply(next);
            };
            socket.onclose = function () {
              if (closed) return;
              attempt += 1;
              retry = setTimeout(function () { dial(channel); }, Math.min(1000 * attempt, 8000));
            };
          })
          .catch(function (err) {
            console.warn(TAG + " events socket failed: " + (err && err.message));
          });
      }

      const off = SDK.chat.subscribe(function (channel) { dial(channel); });
      dial(SDK.chat.channel());

      return function () {
        closed = true;
        clearTimeout(retry);
        clearTimeout(settle);
        off();
        if (socket) socket.close();
      };
    }, []);

    return React.createElement(
      "div",
      {
        className: "hermes-kamiji",
        "data-degraded": degraded ? "true" : "false",
        title: "Kamiji avatar — " + (LABEL[status] || status),
      },
      React.createElement("kamiji-avatar", {
        size: "30",
        shape: "sphere",
        src: BASE + "assets/",
        status: status,
        // Driven by the attribute/state above, never by the element's global bus.
        listen: "none",
      }, "K"),
      React.createElement("span", null, LABEL[status] || status),
    );
  }

  // ─── Feed: the session transcript, one Kamiji per turn ──────────────────────
  //
  // The SVG face engine is the one the Canvas Kamiji work uses (28 shapes × 16 expressions, exported
  // by apps/hangout/extension.js), copied to faces.js. Feed rows use SVG rather than the WebGL
  // element: a transcript can hold hundreds of rows and WebGL contexts are capped per page.
  const FACE_EXPRESSION = {
    running: "attentive",
    waiting: "curious",
    finished: "happy",
    error: "sad",
    idle: "neutral",
  };

  let faces = null;
  function loadFaces() {
    if (!faces) {
      faces = import(BASE + "faces.js").catch(function (err) {
        console.warn(TAG + " face engine failed to load: " + (err && err.message));
        return null;
      });
    }
    return faces;
  }

  function hashOf(text) {
    let h = 0;
    for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
    return h;
  }

  /** One agent's Kamiji, deterministic from its name, showing the turn's status. */
  function Face(props) {
    const nodeRef = useRef(null);
    const [missing, setMissing] = useState(false);
    useEffect(function () {
      let alive = true;
      loadFaces().then(function (mod) {
        const node = nodeRef.current;
        if (!alive || !node) return;
        if (!mod || typeof mod.kamijiFace !== "function") {
          setMissing(true);
          return;
        }
        const h = hashOf(String(props.name || "agent"));
        const shapes = mod.LOOK_SHAPES || [];
        const colors = mod.LOOK_COLORS || [];
        node.replaceChildren(
          mod.kamijiFace({
            shape: shapes.length ? shapes[h % shapes.length][0] : "circle",
            expression: FACE_EXPRESSION[props.status] || "neutral",
            color: colors.length ? colors[h % colors.length] : "#f2b51d",
          }),
        );
      });
      return function () {
        alive = false;
      };
    }, [props.name, props.status]);

    return React.createElement(
      "span",
      {
        className: "kamiji-face",
        ref: nodeRef,
        style: { width: props.size + "px", height: props.size + "px" },
        "data-fallback": missing ? "true" : "false",
        title: props.name,
      },
      missing ? String(props.name || "?").slice(0, 1).toUpperCase() : null,
    );
  }

  function FeedPage() {
    const [sessions, setSessions] = useState(null);
    const [openId, setOpenId] = useState(null);
    const [messages, setMessages] = useState(null);
    const [error, setError] = useState(null);

    useEffect(function () {
      SDK.api
        .getSessions(30)
        .then(function (resp) {
          const list = (resp && (resp.sessions || resp.items)) || [];
          setSessions(list);
          // Open a session that has turns; an empty transcript reads as broken.
          const withTurns =
            list.find(function (session) { return (session.message_count || 0) > 0; }) || list[0];
          if (withTurns) setOpenId(withTurns.id);
        })
        .catch(function (err) {
          setError(err.message);
        });
    }, []);

    useEffect(
      function () {
        if (!openId) return undefined;
        let alive = true;
        setMessages(null);
        SDK.api
          .getSessionMessages(openId)
          .then(function (resp) {
            if (alive) setMessages((resp && resp.messages) || []);
          })
          .catch(function (err) {
            if (alive) setError(err.message);
          });
        return function () {
          alive = false;
        };
      },
      [openId],
    );

    const lastAssistant = messages
      ? messages.map(function (m) { return m.role; }).lastIndexOf("assistant")
      : -1;

    return React.createElement(
      "div",
      { className: "kamiji-feed" },
      React.createElement(
        "header",
        { className: "kamiji-feed__head" },
        React.createElement("h2", null, "Kamiji feed"),
        React.createElement("span", null, sessions ? sessions.length + " sessions" : "loading…"),
      ),
      error ? React.createElement("p", { className: "kamiji-feed__error" }, error) : null,
      React.createElement(
        "div",
        { className: "kamiji-feed__grid" },
        React.createElement(
          "ul",
          { className: "kamiji-feed__sessions" },
          (sessions || []).map(function (session) {
            return React.createElement(
              "li",
              { key: session.id },
              React.createElement(
                "button",
                {
                  type: "button",
                  "data-active": session.id === openId ? "true" : "false",
                  onClick: function () { setOpenId(session.id); },
                },
                React.createElement(Face, {
                  name: session.title || session.id,
                  status: "idle",
                  size: 22,
                }),
                React.createElement("span", { className: "kamiji-feed__title" }, session.title || session.id),
                React.createElement(
                  "span",
                  { className: "kamiji-feed__meta" },
                  session.message_count ? session.message_count + " msgs" : "",
                ),
              ),
            );
          }),
        ),
        React.createElement(
          "div",
          { className: "kamiji-feed__transcript" },
          !openId
            ? React.createElement("p", { className: "kamiji-feed__hint" }, "Pick a session to see its turns.")
            : !messages
              ? React.createElement("p", { className: "kamiji-feed__hint" }, "Loading turns…")
              : messages.length === 0
                ? React.createElement("p", { className: "kamiji-feed__hint" }, "This session has no stored turns.")
                : messages.map(function (message, index) {
                  const isAgent = message.role === "assistant";
                  const status = isAgent
                    ? index === lastAssistant
                      ? "finished"
                      : "idle"
                    : message.role === "tool"
                      ? "running"
                      : "idle";
                  return React.createElement(
                    "article",
                    { key: index, className: "kamiji-feed__row", "data-role": message.role },
                    React.createElement(Face, {
                      name: message.tool_name || (isAgent ? "Hermes" : message.role),
                      status: status,
                      size: 30,
                    }),
                    React.createElement(
                      "div",
                      { className: "kamiji-feed__body" },
                      React.createElement(
                        "span",
                        { className: "kamiji-feed__role" },
                        (message.tool_name || message.role) +
                          (message.timestamp ? " · " + new Date(message.timestamp).toLocaleTimeString() : ""),
                      ),
                      React.createElement(
                        "div",
                        { className: "kamiji-feed__text" },
                        String(message.content || "").slice(0, 4000),
                      ),
                    ),
                  );
                }),
        ),
      ),
    );
  }

  registry.register("kamiji-avatar", FeedPage);
  registry.registerSlot("kamiji-avatar", "chat:top", KamijiAvatarWidget);
})();
