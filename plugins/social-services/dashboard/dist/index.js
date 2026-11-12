/* Local services — the servers the social apps talk to, installed and run from one page.
 *
 * Each app reports its own outage from inside a tab ("Can't reach the node at ws://localhost:9138",
 * "The meeting server isn't running") with nowhere to act on it. This page is the action: one row per
 * service with the endpoint the app dials, the exact command that installs it, Start and Stop for the
 * process started from here, that command's log, and a link into the app that needs it.
 *
 * Anything already running is reported as running and left alone — Stop only ends a process this page
 * launched, matching the backend's rule, so Meet's own Start it keeps working the way it always has.
 */
(function () {
  "use strict";

  const SDK = window.__HERMES_PLUGIN_SDK__;
  const registry = window.__HERMES_PLUGINS__;
  if (!SDK || !registry) return;

  const React = SDK.React;
  const h = React.createElement;
  const NAME = "social-services";
  const API = "/api/plugins/social-services";
  const POLL_MS = 4000;

  const api = (path, options) => SDK.fetchJSON(API + path, options);
  const post = (path, body) =>
    api(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body || {}),
    });

  function legacyCopy(text) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    try {
      document.execCommand("copy");
    } finally {
      area.remove();
    }
  }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
    }
    legacyCopy(text);
    return Promise.resolve();
  }

  function CopyButton({ text }) {
    const [done, setDone] = React.useState(false);
    return h(
      "button",
      {
        type: "button",
        className: "ss-btn",
        onClick: () => {
          copy(text).then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1400);
          });
        },
      },
      done ? "Copied" : "Copy",
    );
  }

  function commandLine(command) {
    return h("div", { className: "ss-cmd" }, h("code", null, command), h(CopyButton, { text: command }));
  }

  function Page() {
    const [rows, setRows] = React.useState([]);
    const [error, setError] = React.useState("");
    const [busy, setBusy] = React.useState({});
    const [custom, setCustom] = React.useState({});
    const [openLog, setOpenLog] = React.useState({});

    const load = React.useCallback(
      () =>
        api("/services")
          .then((payload) => {
            setRows((payload && payload.services) || []);
            setError("");
          })
          .catch((err) => setError((err && err.message) || String(err))),
      [],
    );

    React.useEffect(() => {
      let alive = true;
      const tick = () => {
        if (alive) load();
      };
      tick();
      const timer = setInterval(tick, POLL_MS);
      return () => {
        alive = false;
        clearInterval(timer);
      };
    }, [load]);

    const run = (id, step) => {
      const body = { step };
      if (step === "command") body.command = (custom[id] || "").trim();
      if (step === "command" && !body.command) return;
      setBusy((prev) => ({ ...prev, [id]: step }));
      post(`/services/${id}/run`, body)
        .then(() => {
          load();
          setTimeout(() => setBusy((prev) => ({ ...prev, [id]: "" })), 2500);
        })
        .catch((err) => {
          setError((err && err.message) || String(err));
          setBusy((prev) => ({ ...prev, [id]: "" }));
        });
    };

    const stop = (id) => {
      setBusy((prev) => ({ ...prev, [id]: "stop" }));
      post(`/services/${id}/stop`)
        .then(() => load())
        .catch((err) => setError((err && err.message) || String(err)))
        .finally(() => setBusy((prev) => ({ ...prev, [id]: "" })));
    };

    const renderRow = (item) => {
      const pending = busy[item.id] || "";
      const endpoint = item.endpoint ? `${item.endpoint.host}:${item.endpoint.port}` : "no local endpoint";
      const pill = item.running ? "is-on" : item.pid ? "is-starting" : "is-off";
      const label = item.running ? "running" : item.pid ? "starting…" : "not running";

      return h(
        "article",
        { className: "ss-row", key: item.id },
        h(
          "header",
          { className: "ss-row__head" },
          h("h3", null, item.app),
          h("span", { className: `ss-pill ${pill}` }, label),
          h("span", { className: "ss-row__endpoint" }, `${item.service} · ${endpoint}`),
        ),
        h("p", { className: "ss-row__why" }, item.requirement),
        item.install ? commandLine(item.install) : null,
        item.start ? commandLine(item.start) : null,
        item.install && item.installed === false
          ? h("p", { className: "ss-row__hint" }, `No ${item.probe_binary || "binary"} on PATH yet — install it first.`)
          : null,
        h(
          "div",
          { className: "ss-row__actions" },
          item.install
            ? h(
                "button",
                { type: "button", className: "ss-btn", disabled: pending !== "", onClick: () => run(item.id, "install") },
                pending === "install" ? "Installing…" : "Install",
              )
            : null,
          item.start
            ? h(
                "button",
                {
                  type: "button",
                  className: "ss-btn ss-btn--primary",
                  disabled: pending !== "",
                  onClick: () => run(item.id, "start"),
                },
                pending === "start" ? "Starting…" : "Start",
              )
            : null,
          h(
            "button",
            { type: "button", className: "ss-btn", disabled: !item.pid || pending !== "", onClick: () => stop(item.id) },
            "Stop",
          ),
          item.log_tail
            ? h(
                "button",
                {
                  type: "button",
                  className: "ss-btn",
                  onClick: () => setOpenLog((prev) => ({ ...prev, [item.id]: !prev[item.id] })),
                },
                openLog[item.id] ? "Hide log" : "Log",
              )
            : null,
          item.route ? h("a", { className: "ss-link", href: item.route }, `Open ${item.app}`) : null,
          item.docs
            ? h("a", { className: "ss-link", href: item.docs, target: "_blank", rel: "noreferrer" }, "Docs")
            : null,
        ),
        !item.start
          ? h(
              "div",
              { className: "ss-cmd" },
              h("input", {
                className: "ss-input",
                placeholder: `command to run for ${item.service}`,
                value: custom[item.id] || "",
                onChange: (event) => {
                  const value = event.target.value;
                  setCustom((prev) => ({ ...prev, [item.id]: value }));
                },
                onKeyDown: (event) => {
                  if (event.key === "Enter") run(item.id, "command");
                },
              }),
              h(
                "button",
                {
                  type: "button",
                  className: "ss-btn",
                  disabled: !(custom[item.id] || "").trim() || pending !== "",
                  onClick: () => run(item.id, "command"),
                },
                pending === "command" ? "Running…" : "Run",
              ),
            )
          : null,
        openLog[item.id] && item.log_tail ? h("pre", { className: "ss-pre" }, item.log_tail) : null,
      );
    };

    return h(
      "section",
      { className: "ss-page" },
      h("h1", null, "Local services"),
      h(
        "p",
        { className: "ss-lede" },
        "The social apps run in this window but talk to servers on this machine. Install and start the ones you need here; each app picks it up on its own, and anything already running is left alone.",
      ),
      error ? h("p", { className: "ss-error" }, error) : null,
      rows.length ? rows.map(renderRow) : h("p", { className: "ss-lede" }, "Checking services…"),
    );
  }

  registry.register(NAME, Page);
})();
