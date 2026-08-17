---
id: 2
title: Where and how are rulebook PDFs linked/hosted for Ark Nova, Darwin's Journey, and Wingspan?
status: closed
labels: [wayfinder:research]
assignee: research-agent
blocked_by: []
---

## Question

For each of Ark Nova, Darwin's Journey, and Wingspan:

- Find the exact page and DOM location where BGA links the official rulebook (and FAQ,
  if present) — expected to be the game's `gamepanel` page per general BGA research,
  not the live game-table screen. Note a CSS selector or structural landmark an
  extension could target.
- Note the hosting domain(s) the PDF link(s) point to (publisher site, BGG, Dropbox,
  etc.) and whether fetching it via a background service worker `fetch()` returns raw
  PDF bytes (`Content-Type: application/pdf`) or redirects to an HTML interstitial that
  would break naive `pdf.js` parsing.
- Note language variants (e.g. multiple `_ENG`/`_ITA`-style links) and how to pick the
  right one.

Report back: per-game link location + selector, hosting domain + content-type
behavior, and a recommended `host_permissions` list (or fallback: optional/runtime-
requested permissions) needed to fetch these three specific PDFs.

## Resolution

Verified directly against live, **unauthenticated** BGA gamepanel HTML (curl, 2026-08-17)
for all three games, plus header checks (`curl -I`) against candidate PDF URLs. No BGA
login was available, so the logged-in DOM is unverified — see follow-up ticket.

**Premise correction — important:** none of the three gamepanel pages contain an
"Official Rule Book" PDF link at all in the logged-out view. Each has exactly one
relevant section, `<h3 class="pagesection__title">Rules summary</h3>` wrapping
`#rules_summary_wrapper` — BGA's own MediaWiki-rendered plain-text paraphrase of the
rules (same-origin, easy to read, not a PDF). The only other relevant link is a
`Publisher` row pointing to the publisher's homepage, not a rulebook.

**Actual PDF hosting, found via web search + publisher sites (not the BGA page):**
- **Ark Nova**: `cdn.shopify.com/.../Ark-Nova-Rulebook.pdf` (via capstone-games.com) —
  verified 200, `Content-Type: application/pdf`, direct bytes. Best case.
- **Darwin's Journey**: publisher's current official path is a **Dropbox folder**
  (`thundergryph.com/rulebooks/` → dropbox.com SPA, returns `text/html`, not fetchable
  as a PDF without extra handling). A direct WordPress-hosted PDF also resolves (200,
  `application/pdf`) but may be a stale/superseded copy.
- **Wingspan**: official path is also a **Dropbox folder** (via stonemaiergames.com),
  same SPA problem. A third-party fan-mirror PDF (`cdn.1j1ju.com`) works directly (200,
  `application/pdf`) but isn't authoritative and may go stale on errata updates.

**Implication:** there is no generic "find the PDF link on the BGA page" mechanism —
BGA doesn't reliably link one at all (at least logged-out), and even the publisher's
own official path is often a Dropbox folder a plain `fetch()` can't resolve to a file.
A workable v1 approach is per-game curated PDF URLs (verified once, stored in the
per-game plugin config) with BGA's own same-origin `#rules_summary_wrapper` text as an
always-available same-origin fallback/first-pass context source — not a generic
"scrape whatever link BGA shows" mechanism as originally assumed.

**Recommended `host_permissions`** (per-domain, not a broad wildcard — only 3 games in
scope, better for Web Store review):
`en.boardgamearena.com`, `en.doc.boardgamearena.com`, `cdn.shopify.com`,
`capstone-games.com`, `thundergryph.com`, `cdn.1j1ju.com`, `stonemaiergames.com`,
`*.dropbox.com`/`*.dropboxusercontent.com` (latter two need extra SPA-handling logic,
not a plain fetch, to actually be useful).

Full agent report on file. **Open follow-up, human-only**: verify whether a genuine
rulebook PDF link appears on the *logged-in* gamepanel DOM (BGA login required) —
this could change the "no generic PDF link" conclusion above.
