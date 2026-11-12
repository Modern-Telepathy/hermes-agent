/* Holons™ — the Canvas App with its own dashboard tab, fitted to the whole content area.
 *
 * The bundle itself is the committed Canvas App (plugins/social-apps/dashboard/dist/apps/holons);
 * the Canvas host, Agent Server adapter and stage fitting are shared from
 * ../social-apps/dist/host.js.
 */
(function () {
  "use strict";

  const SDK = window.__HERMES_PLUGIN_SDK__;
  const registry = window.__HERMES_PLUGINS__;
  if (!SDK || !registry) return;

  const NAME = "social-holons";
  const APP = "holons";
  const LABEL = "Holons™";
  const script = document.currentScript;
  const HOST_URL = new URL(
    "../../social-apps/dist/host.js",
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
          return host.mountSocialApp(mountRef.current, APP).then(function (teardown) {
            dispose = teardown;
            if (alive) setState("ready");
          });
        })
        .catch(function (err) {
          if (!alive) return;
          console.warn("[social] " + APP + " failed: " + (err && err.message));
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
      { className: "social-app", "data-state": state },
      state === "error"
        ? SDK.React.createElement("p", { className: "social-app__error" }, LABEL + " could not start: " + error)
        : null,
      SDK.React.createElement("div", { className: "social-app__mount", ref: mountRef }),
    );
  }

  registry.register(NAME, Page);
})();
