/* Office suite host package.
 *
 * This plugin is hidden from the left nav: it owns what the six per-app plugins share — the Canvas
 * host module (dist/host.js), the committed app bundles (dist/apps/) and the workspace filesystem
 * backend (plugin_api.py). Each app has its own plugin and its own tab:
 * plugins/office-{docs,sheets,slides,notes,calendar,doctransit}.
 */
