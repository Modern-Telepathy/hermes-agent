/* DocTransit™ — the doctransit Canvas App with its own dashboard tab.
 *
 * The bundle itself is the committed Canvas App (plugins/office-suite/dashboard/dist/apps/doctransit);
 * the Canvas host, workspace adapter and stage fitting are shared from
 * ../office-suite/dist/host.js.
 */
(function () {
  "use strict";

  const SDK = window.__HERMES_PLUGIN_SDK__;
  const registry = window.__HERMES_PLUGINS__;
  if (!SDK || !registry) return;

  const NAME = "office-doctransit";
  const APP = "doctransit";
  const LABEL = "DocTransit™";
  const MOUNT = "mountDocTransit";
  const script = document.currentScript;
  const HOST_URL = new URL(
    "../../office-suite/dist/host.js",
    script && script.src ? script.src : location.href,
  ).href;

  function Page() {
    const mountRef = SDK.hooks.useRef(null);
    const [state, setState] = SDK.hooks.useState("loading");
    const [error, setError] = SDK.hooks.useState("");

    SDK.hooks.useEffect(function () {
      let alive = true;
      let dispose = null;
      import(HOST_URL)
        .then(function (host) {
          if (!alive || !mountRef.current) return undefined;
          return host[MOUNT](mountRef.current, APP).then(function (teardown) {
            dispose = teardown;
            if (alive) setState("ready");
          });
        })
        .catch(function (err) {
          if (!alive) return;
          console.warn("[office-suite] " + APP + " failed: " + (err && err.message));
          setError((err && err.message) || String(err));
          setState("error");
        });
      return function () {
        alive = false;
        if (dispose) dispose();
      };
    }, []);

    return SDK.React.createElement(
      "div",
      { className: "office-app", "data-state": state },
      state === "error"
        ? SDK.React.createElement("p", { className: "office-app__error" }, LABEL + " could not start: " + error)
        : null,
      SDK.React.createElement("div", { className: "office-app__mount", ref: mountRef }),
    );
  }

  registry.register(NAME, Page);
})();
