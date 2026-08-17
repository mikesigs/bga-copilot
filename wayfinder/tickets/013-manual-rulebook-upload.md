---
id: 13
title: Manual rulebook PDF upload feature
status: closed
labels: [wayfinder:grilling]
assignee: null
blocked_by: []
---

## Question

Given the permission model decision (extension only holds `host_permissions` for
`boardgamearena.com`, `api.anthropic.com`, `api.openai.com` — no third-party rulebook
domains), auto-downloading the actual rulebook PDFs linked from BGA's `#game-links`
list generally isn't possible (they resolve to BoardGameGeek/publisher/Dropbox
domains). The user wants a manual upload feature as the primary way real rulebook text
gets into context, with the extension pointing at (but not fetching) the discovered
links so the user knows what to go download.

Design this feature:

- Where does the upload UI live — the side panel itself, a dedicated options page, or
  both?
- Upload is scoped to what — per game (shared across all tables of that game) or
  per table? (Per-game seems more natural: a rulebook doesn't change between plays of
  the same game, and re-uploading per table would be repetitive — but per-game storage
  needs its own keying scheme distinct from the per-table chat model in ticket 006.)
- Local extraction: bundle pdf.js, run `getDocument()`/`getTextContent()` against the
  uploaded file's bytes entirely client-side — no network call needed, confirm this
  fits within MV3's local-script-only CSP already established in ticket 001/011's
  research.
- How does the extracted text get surfaced into the context-assembly pipeline (ticket
  007) — does an uploaded rulebook take priority over BGA's same-origin "Rules
  summary" text when both exist, or are they offered as separate context sources?
- What happens to an uploaded rulebook if the user later plays a different table of
  the same game — is it reused automatically (per-game storage) with no re-upload
  needed?

## Resolution

Confirmed with user.

**UI location:** the side panel itself — an "Upload rulebook" prompt shown alongside
the (non-auto-fetchable) `#game-links` entries from ticket 008, so discovery and
upload live in one combined flow: "here's where to find it, here's how to give it to
us."

**Scope:** per-game, keyed by `gameSlug` — a separate storage namespace from the
per-table chat model in ticket 006 (e.g. `bga_copilot:rulebook:<gameSlug>`). One
upload covers every future table of that same game automatically, no re-upload needed.

**Extraction:** bundled pdf.js, `getDocument()`/`getTextContent()` against the
uploaded file's bytes entirely client-side inside the side panel — no network call, no
permission implications.

**Priority vs. BGA's same-origin "Rules summary" text:** an uploaded PDF wins when
present (real rulebook text over a community paraphrase); the same-origin summary
remains the fallback when nothing's uploaded yet for that game. Not concatenated by
default — keeps the ~15k rulebook token budget (ticket 007) spent on the better
source rather than split across both.
