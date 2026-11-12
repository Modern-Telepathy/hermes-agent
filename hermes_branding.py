"""The visible product brand — one switch point.

Everything a person reads (system identity, CLI banner and welcome, dashboard and
desktop chrome, docs title, README) derives its product name from here. Changing the
brand to Techne, Tekne or Tekno is this constant plus the front-end mirrors
(``web/src/lib/brand.ts``, ``apps/desktop/src/lib/brand.ts``, the ``brand`` /
``brandShort`` keys in ``web/src/i18n/*.ts``, and the docs site title).

Technical identifiers are deliberately NOT brand and must not be renamed with it:

* the ``hermes`` command and ``hermes-agent`` package/distribution,
* ``HERMES_*`` environment variables and the ``~/.hermes`` home (``get_hermes_home()``),
* the ``hermes-agent`` skill and the documentation URLs,
* log/telemetry field names and the updater's frozen compat surface
  (``tests/compat/old_updater_surface.json``).

Renaming those breaks installs, profile routing and mid-update compatibility — a brand
change is a display change.
"""

from __future__ import annotations

PRODUCT_NAME = "Techno"
# Where the old name read "<Name> Agent" (titles, welcome, identity line).
PRODUCT_AGENT_NAME = f"{PRODUCT_NAME} Agent"
PRODUCT_TAGLINE = "The self-improving AI agent"
PRODUCT_GLYPH = "☤"
