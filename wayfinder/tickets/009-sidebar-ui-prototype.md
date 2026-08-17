---
id: 9
title: Sidebar chat UI/UX prototype
status: closed
labels: [wayfinder:prototype]
assignee: user-session
blocked_by: [4]
---

## Question

Using the sidebar mechanism decided in "Sidebar mechanism — chrome.sidePanel API vs.
injected custom panel", build a rough, throwaway prototype of the chat sidebar's look
and behavior: layout of the chat thread, how a "suggest my next move" quick-action is
surfaced, how it indicates it's using rulebook context vs. general knowledge, and how
per-table history is presented when reopening an in-progress game. This is about
raising the fidelity of the UI discussion, not production code.

## Resolution

Built three structurally different variants (chat-first with a status strip; tabbed
Chat/Game State/Rulebook; a permanent dark "game context" panel above the chat) as a
throwaway HTML prototype against realistic Ark Nova mock data. Full prototype (all
three variants + switcher) preserved as a primary source on the `prototype/sidebar-ui`
branch — dropped from `main`.

**User's verdict — a blend of A and B:**
- **Primary layout is chat-first (variant A):** a callout bubble at the top of the
  chat thread when a rulebook couldn't be auto-downloaded (with "Open the link" /
  "Upload the PDF"), the chat thread itself below, and quick-action chips ("Suggest my
  next move", "Explain this rule", "What just happened?") above the composer.
- **Keep a Rulebook tab (from variant B)** as a place to manage rulebooks for the
  current game (view what's linked, upload a PDF, see what's cached) — separate from
  the main chat-first view.
- **Drop the Game State tab entirely** — the user watches the actual BGA board
  directly and has no need for the extension to mirror state back at them; a
  dedicated state view is unnecessary surface area.
- **Variant C (permanent context panel) rejected outright** — too cluttered/busy at
  the top, actively worse than not having it.

**Resulting shape for the real design:** two views, not three — a default chat view
(rulebook-status callout + chat + quick actions + composer, per variant A) and a
Rulebook management view (per variant B's Rulebook tab), reachable via a lightweight
switch (e.g. a small tab strip with just those two entries, or a header icon — left as
an implementation-detail choice, not itself in question here). No structured
game-state view ships at all.
