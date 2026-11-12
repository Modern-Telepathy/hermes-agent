/* MeetRightHere™ — the Canvas App with its own dashboard tab, fitted to the whole content area.
 *
 * The bundle itself is the committed Canvas App (plugins/social-apps/dashboard/dist/apps/meet);
 * the Canvas host, Agent Server adapter and stage fitting are shared from
 * ../social-apps/dist/host.js.
 */
(function () {
  "use strict";

  const SDK = window.__HERMES_PLUGIN_SDK__;
  const registry = window.__HERMES_PLUGINS__;
  if (!SDK || !registry) return;

  const NAME = "social-meet";
  const APP = "meet";
  const LABEL = "MeetRightHere™";
  const script = document.currentScript;
  const HOST_URL = new URL(
    "../../social-apps/dist/host.js",
    script && script.src ? script.src : location.href,
  ).href;

  /** The app paints itself from `.mt`'s own custom properties, so read them back and hand the
   *  window chrome the same palette, font, size and corner radius while this tab is open. */
  function chromeFromApp(container) {
    const app = container.querySelector(".mt");
    if (!app) return null;
    const css = window.getComputedStyle(app);
    const token = function (name, fallback) {
      const value = (css.getPropertyValue(name) || "").trim();
      return value || fallback;
    };
    const font = css.fontFamily || "system-ui, sans-serif";
    const panel = token("--mt-panel", "#212121");
    const bg = token("--mt-bg", "#171717");
    const text = token("--mt-text", "#eeeeee");
    return {
      "--theme-font-sans": font,
      "--theme-font-display": font,
      "--theme-base-size": css.fontSize || "14px",
      "--theme-letter-spacing": "0",
      "--theme-radius": "0.75rem",
      "--radius": "0.75rem",
      "--background-base": bg,
      "--midground-base": text,
      "--foreground-base": token("--mt-contrast", "#ffffff"),
      "--component-sidebar-background": panel,
      "--component-header-background": panel,
      "--theme-terminal-background": bg,
      "--theme-terminal-foreground": text,
    };
  }

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
          return host.mountSocialApp(mountRef.current, APP, { chrome: chromeFromApp }).then(function (teardown) {
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
