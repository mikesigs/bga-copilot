---
id: map
title: BGA Copilot Extension Spec
labels: [wayfinder:map]
---

# BGA Copilot Extension Spec

## Destination

An implementation-ready spec for a Manifest V3 Chrome extension ("BGA Copilot") that
adds a persistent AI chat sidebar to BoardGameArena.com. The spec covers: how the
extension extracts live game state (validated against Ark Nova, Darwin's Journey, and
Wingspan, deciding generic-engine vs. per-game-plugin architecture), how it locates and
uses rulebook PDF links on demand, how it assembles LLM prompts from state + rules +
chat history, how chat persists per game-table across sessions, and how it calls a
cloud LLM using the user's own API key. The spec must be detailed enough to hand off to
a build phase — no extension code is written as part of this map.

## Notes

- Domain: Chrome extension development (Manifest V3), BoardGameArena's client-side game
  architecture.
- Skills every session should consult: `/research` for factual/DOM investigation,
  `/grilling` + `/domain-modeling` for decision tickets, `/prototype` for UI/UX
  questions.
- Standing preferences:
  - This is a personal/toy project for now. BGA's Terms are ambiguous about exporting
    game data off-platform to a third-party LLM API; the user has accepted that risk
    for personal use and wants it revisited only if/when this is prepared for Chrome
    Web Store publishing.
  - Read-only advisory tool: it must never submit moves or send messages on the user's
    behalf.
  - LLM backend: cloud API with the user's own key (not a local model) is the chosen
    near-term direction.
  - Sample games for the generic-vs-plugin research: Ark Nova, Darwin's Journey,
    Wingspan.

## Decisions so far

- [How is live game state exposed and accessible for Ark Nova, Darwin's Journey, and Wingspan?](tickets/001-state-access-research.md) — shared `gamedatas.gamestate`/notification stream is generic across all BGA games (turn, state, action names, log); board/hand content is per-game with no shared schema. Recommends MV3 `world: "MAIN"` script injection + postMessage relay to read it, and a generic-core-plus-per-game-plugin architecture over a single fully-generic engine or bga-assistant's log-only approach. Live-table devtools verification for these three games is still an open follow-up.
- [Where and how are rulebook PDFs linked/hosted for Ark Nova, Darwin's Journey, and Wingspan?](tickets/002-rulebook-pdf-research.md) — **superseded**: this research used a raw unauthenticated `curl` fetch and missed a tab/AJAX-loaded section entirely (see next entry). Its per-publisher-domain-PDF conclusion should not be treated as final.
- [Verify whether a rulebook PDF link appears on the logged-in BGA gamepanel](tickets/010-verify-logged-in-rulebook-access.md) — user confirmed (screenshot) every game's gamepanel has a "How to play?" tab with a "COMPLETE RULES:" section: a community-submitted, vote-ranked, per-language list of rulebook links. Overturns ticket 002's "no PDF link exists" conclusion, which was an artifact of the fetch method.
- [DOM/load mechanics and hosting domain(s) of the "How to play" > COMPLETE RULES link list](tickets/011-complete-rules-tab-mechanics.md) — confirmed live: the list (`#game-links > .weblink`) is statically rendered at load (not AJAX-on-click), and every link routes through a generic same-origin redirector `boardgamearena.com/link?url=<encoded-target>&id=<n>` regardless of destination domain. This is one shared, reusable BGA component (verified identical link ids across the gamepanel widget and the live table's help panel) — fully supersedes ticket 002's per-game-curated-PDF-URL approach with generic same-origin discovery. Also surfaced: the whole game (and this panel) runs inside `<iframe id="gameIframe">`, which the state-access approach (ticket 001) must target explicitly via `frameIds`.
- [Generic state-extraction engine vs. per-game plugin architecture](tickets/003-generic-vs-plugin-architecture.md) — confirmed live across Ark Nova and Ticket to Ride (standing in for Darwin's Journey): both share identical framework-level `gamedatas` keys (`gamestate.name`/`possibleactions`, `gamestates`, `players`, `notifications`, `playerorder`, `decision`) with zero overlap in everything else (board/hand content keys, and the entire shape of `gamestate.args`, differ completely per game and per state). Decision: generic core for the shared fields + a per-game plugin (keyed by BGA's game slug) that interprets bespoke `gamedatas`/`args` content and numeric code lookups, with graceful degrade-to-generic-only for any game with no plugin yet.
- [Sidebar mechanism — chrome.sidePanel API vs. injected custom panel](tickets/004-sidebar-ui-mechanism.md) — decided `chrome.sidePanel`, confirmed with user. BGA's own UI already crowds the screen edge, so a native panel avoids fighting page layout/CSS; the required content-script↔background messaging relay is needed anyway for state extraction, so the panel's DOM isolation costs nothing extra. Full message-passing architecture (content script → MAIN-world extractor → background → side panel, scoped per tab via `chrome.tabs.onActivated`) recorded on the ticket.
- [LLM provider abstraction and API key storage](tickets/005-llm-provider-and-key-storage.md) — decided, confirmed with user: support both Anthropic and OpenAI at MVP via a thin provider interface, user-selectable; keys stored in `chrome.storage.local` (not `sync`); calls made from the background service worker using each vendor's documented browser-direct-call flag (`anthropic-dangerous-direct-browser-access` / `dangerouslyAllowBrowser`).
- [Per-game-table chat persistence data model](tickets/006-chat-persistence-model.md) — table identity confirmed live as `gameui.table_id`/`game_id`; storage keyed `bga_copilot:table:<table_id>` in `chrome.storage.local`, holding chat turns + cached rulebook excerpt (not live state snapshots, which are always re-extracted fresh). Finish detection via BGA's standard `gameEnd` framework state (confirmed present in Ark Nova's state list), backstopped by a 90-day TTL sweep for tables that never reach it. Finished tables render read-only.
- [Context assembly and prompt-building strategy](tickets/007-context-assembly-strategy.md) — confirmed with user: full state re-extraction (not diffs) on every message; rulebook text fetched/cached on demand and included whole rather than chunked/retrieved; chat history kept verbatim with FIFO trim under a token cap. First-pass token budget: ~1-2k system/state, ~15k rulebook when included, rest of a ~100k ceiling for history. Flagged as a first pass expected to need tuning once real usage data exists.
- [Extension permission model](tickets/008-permission-model.md) — **narrowed by user preference**: `host_permissions` fixed to exactly `*.boardgamearena.com`, `api.anthropic.com`, `api.openai.com` — no runtime-requested permissions for third-party rulebook domains at all. Practical consequence: since real rulebook links resolve to third-party domains, auto-fetch is effectively limited to BGA's own same-origin "Rules summary" text; discovered links are shown to the user as plain clickable links with a note that auto-download isn't available, backed by a new manual-upload feature spun off as [Manual rulebook PDF upload feature](tickets/013-manual-rulebook-upload.md).
- [Per-game plugin interface design](tickets/012-plugin-interface-design.md) — confirmed with user: plugins export `{ gameSlug, summarizeState(gamedatas, gamestate), codeLookups }`, with per-state dispatch handled inside each plugin (not the registry); lookup tables are hand-authored bundled assets, not scraped; all plugins bundle at build time (no dynamic loading, better for Web Store review); degrade-to-generic is a default no-op plugin the registry falls back to, not a branch scattered through the assembly pipeline.
- [Manual rulebook PDF upload feature](tickets/013-manual-rulebook-upload.md) — confirmed with user: upload UI lives in the side panel alongside the non-fetchable `#game-links` entries; storage is per-game (`gameSlug`-keyed, distinct from per-table chat storage), reused automatically across future tables of that game; extraction via bundled pdf.js entirely client-side; an uploaded PDF takes priority over BGA's same-origin rules-summary text when both exist, rather than combining them.
- [Sidebar chat UI/UX prototype](tickets/009-sidebar-ui-prototype.md) — three variants prototyped (full set preserved on the `prototype/sidebar-ui` branch, not main); user picked a blend: chat-first default view (rulebook-not-fetched callout + chat + quick-action chips + composer) plus a separate Rulebook management view, with no dedicated game-state view at all (the user watches the real board directly, doesn't need it mirrored). Two views total, not three.

## Not yet specified

_(empty — everything graduated to tickets)_

## Out of scope

- Firefox/cross-browser support — explicitly a later goal, not part of this
  destination.
- Automating moves or sending messages on the user's behalf — the tool is read-only
  advisory by hard constraint.
- Local/offline LLM backend support — cloud API with a user-supplied key is the chosen
  path for this spec.
- Actually submitting to the Chrome Web Store, and the review process that entails —
  a separate future effort once the MVP proves out.
- Formally resolving the ambiguity in BGA's Terms of Service (e.g. contacting BGA
  staff) — deferred; the user has accepted the risk for personal use.
