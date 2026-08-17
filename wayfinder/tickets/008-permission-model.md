---
id: 8
title: Extension permission model (content scripts + third-party PDF fetch)
status: closed
labels: [wayfinder:grilling]
assignee: null
blocked_by: [1, 2, 10, 11]
---

## Question

BGA game pages need content-script access across (eventually) all BGA game URLs, and
rulebook PDFs are hosted on inconsistent third-party domains (publisher sites, Dropbox,
possibly BGG) rather than a single BGA CDN. Decide the permission model:

- Broad `host_permissions` (e.g. `https://*.boardgamearena.com/*` plus a wide net for
  PDF domains) declared upfront, vs. narrower permissions requested at runtime
  (`chrome.permissions.request`) only when a specific PDF domain is first encountered.
- How this tradeoff interacts with the user's stated future intent to publish on the
  Chrome Web Store (broad host permissions draw more review scrutiny and a more
  alarming install-time prompt) — decide now given the destination is a spec meant to
  be forward-compatible, even though publishing itself is out of scope for this map.
- Fallback behavior if a PDF domain isn't covered by granted permissions (skip
  rulebook context gracefully, or prompt the user to grant it).

## Resolution

**Decision, confirmed with user — narrower than originally proposed:** `host_permissions`
stay fixed to exactly three domains, no runtime-requested permissions for third-party
rulebook domains at all:
- `*.boardgamearena.com` (state extraction, the `/link` redirector, same-origin
  "Rules summary" text)
- `api.anthropic.com`
- `api.openai.com`

**Practical consequence, worth being explicit about:** since every real rulebook link
discovered via `#game-links` resolves to a third-party domain (BoardGameGeek,
publisher sites, Dropbox — confirmed in ticket 011's live check, none were
`boardgamearena.com` itself), this means the extension **will not auto-download any
of those PDFs** under this permission model. Auto-fetchable rulebook context is
limited to BGA's own same-origin "Rules summary" text (`#rules_summary_wrapper`,
ticket 002) — always available, no extra permission needed.

**Fallback UX:** when a `#game-links` entry is detected but not fetchable (i.e.
essentially always, per above), the panel shows the candidate link(s) as plain
clickable links (opens in a normal browser tab, outside extension permission
concerns) with a note that automatic download isn't available, alongside a prompt to
use the new **manual rulebook upload** feature — the user downloads the PDF
themselves via the shown link and uploads it into the extension directly. A local
file upload needs no network permission at all (pdf.js runs against the local file
bytes), so this fully sidesteps the third-party-domain permission question while still
getting real rulebook text into context. Spun off as its own ticket since it's now a
first-class feature, not just a fallback footnote.

This keeps the permission set minimal and stable regardless of how many games get
added later (no manifest changes, no scary runtime permission prompts), which was the
user's priority over maximizing auto-fetch coverage.
