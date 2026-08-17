---
id: 10
title: Verify whether a rulebook PDF link appears on the logged-in BGA gamepanel
status: closed
labels: [wayfinder:task]
assignee: null
blocked_by: []
---

## Question

The rulebook PDF research (ticket 002) found that the **logged-out** BGA gamepanel for
Ark Nova, Darwin's Journey, and Wingspan has no "Official Rule Book" PDF link at all —
only a same-origin "Rules summary" text section (`#rules_summary_wrapper`). This
contradicts the original assumption that BGA displays PDF rulebook links on the game
page, so it needs a human check before the spec commits to "no generic PDF link
exists":

- Log into BoardGameArena and open the gamepanel (`en.boardgamearena.com/gamepanel?game=<slug>`)
  for Ark Nova, Darwin's Journey, and Wingspan while authenticated.
- Look for any rulebook/FAQ PDF link not present in the logged-out HTML (check near the
  "Rules summary" section, any "Help"/"Files"/"Documents" area, and the live game
  table's own help panel, since that's a different page from the gamepanel).
- If found: note its exact location, the `href` (hosting domain), and whether it
  differs from the logged-out view.
- If not found: this confirms the research's conclusion — the spec should treat curated
  per-game PDF URLs (found via the publisher, as ticket 002 already did for these three)
  plus BGA's own same-origin rules-summary text as the actual rulebook-context source,
  not "scrape whatever PDF link BGA shows."

## Resolution

Confirmed by the user directly in-browser (screenshot). The gamepanel has a **"How to
play?" tab** (alongside "Competition", "Strategy tips") containing a **"COMPLETE
RULES:"** section — a community-submitted, vote-ranked, per-language list of rulebook
document links (e.g. for Ark Nova: "Rulebook", "Marine Worlds rulebook", "Glossary",
"Marine Worlds Glossary", "Rules in English", each tagged `(en)` with a thumbs-up vote
count, plus a "See 30 more..." expander). The user reports **all games have this
section**, i.e. it appears to be a standard, generic BGA page feature — not something
specific to these three titles.

This overturns ticket 002's "no PDF link exists on the BGA page" conclusion. That
research fetched the gamepanel via a raw unauthenticated `curl`, which only sees
initial page HTML — it evidently missed this content because it's tab/AJAX-loaded
and/or the fetch method doesn't execute the page's JS at all. Since the actual
extension will run as a content script inside a real, logged-in browser session (not
a raw HTML fetch), it will see this tab's content the same way the user's screenshot
does. The earlier conclusion was an artifact of the research method, not a real
limitation of the BGA page.

**New open question this surfaces** (tracked in a follow-up ticket): is this
"COMPLETE RULES" list present in the tab's initial DOM (just hidden until the tab is
clicked) or does clicking the tab trigger an AJAX fetch that populates it — and are
these links hosted on BGA's own domain (community uploads) or external? That
determines whether the generic engine can just click-then-read this list uniformly
across all games, and whether it removes the messy per-publisher-domain permission
list ticket 002 proposed.
