---
id: 11
title: DOM/load mechanics and hosting domain(s) of the "How to play" > COMPLETE RULES link list
status: closed
labels: [wayfinder:task]
assignee: null
blocked_by: []
---

## Question

The user confirmed every BGA game's gamepanel has a "How to play?" tab containing a
"COMPLETE RULES:" section — a community-submitted, vote-ranked, per-language list of
rulebook document links (screenshot evidence: Ark Nova shows entries like "Rulebook",
"Marine Worlds rulebook", "Glossary", each tagged with a language code and a
thumbs-up count, plus a "See 30 more..." expander). This looks like a generic,
scalable rulebook-discovery mechanism if it holds structurally across games — a much
better fit than ticket 002's per-game curated external-PDF-URL approach.

Pin down, for Ark Nova, Darwin's Journey, and Wingspan (using a real logged-in browser
session this time, not a raw HTML fetch — the earlier research's `curl`-based approach
demonstrably missed this tab's content):

- Is the "COMPLETE RULES" list present in the tab panel's DOM on initial page load
  (just hidden/inactive until the tab is clicked), or does clicking the tab trigger an
  AJAX request that populates it? If AJAX, capture the request URL/shape (a content
  script could call it directly rather than simulating a click).
- What does each list entry's underlying `href` actually point to — is it hosted on
  BGA's own domain (e.g. a community file-upload/attachment system) or does it link
  out to external sites (Google Drive, Dropbox, publisher domains, etc.)? Check a few
  entries per game, not just the top one.
- Is there a stable selector/structure for: the tab trigger itself, the "COMPLETE
  RULES:" heading, and each row's language tag + vote count + title + link — enough to
  reliably pick e.g. "the highest-voted `(en)` entry" programmatically?
- Does the list content or structure vary at all across the three sample games, or is
  it a genuinely shared BGA-wide component (as the user's "all games have this"
  observation suggests)?

This directly determines whether ticket 002's per-publisher-domain `host_permissions`
list and Dropbox-SPA workaround are still needed, or whether they're superseded by a
single same-origin (or small, BGA-controlled) mechanism.

## Resolution

Confirmed directly via a live, authenticated BGA session (Ark Nova) — Note: this
session turned out to already be logged in as the user's account inside the sandboxed
browser tool; the game's live table page was reached incidentally while investigating
the gamepanel, and the session was navigated away afterward without taking any action
in the game.

**DOM location and load mechanics:** the game runs inside an `<iframe id="gameIframe">`
on the live table page. Within it, the help panel is a static, already-rendered block —
`<div id="pagesection_howtoplay" style="display: block;">` — **present at initial load,
not populated via a later AJAX call on tab click.** Its structure:

```html
<div id="pagesection_howtoplay" style="display: block;">
  <div class="pagesection">
    <h2>Complete rules:</h2>
    <div id="game-links">
      <div id="link_34788" class="weblink">
        <div class="link_thumb">
          <span class="smalltext" id="thumbup_current_34788">22</span>
          <div id="thumbup_link_34788" class="thumbuplink icon20 icon20_reputup imgtxt"></div>
        </div>
        <div class="link_lang">(en)</div>
        <div class="link_link">
          <a href="https://boardgamearena.com/link?url=<url-encoded-target>&id=34788" target="_blank">Rulebook</a>
        </div>
      </div>
      <!-- one .weblink div per submitted rules document -->
    </div>
  </div>
</div>
```

Selector: `#game-links > .weblink`, with vote count in `.link_thumb .smalltext`,
language in `.link_lang`, and title + wrapped href in `.link_link a`.

**Hosting/href pattern:** every entry's `href` is a **same-origin BGA redirector**,
`https://boardgamearena.com/link?url=<url-encoded target>&id=<n>`, regardless of what
site the actual document lives on (confirmed targets here: Feuerland's own PDF,
multiple BoardGameGeek filepage URLs). The real destination is recoverable generically
by URL-decoding the `url` query parameter — no per-game/per-publisher domain knowledge
needed to *discover* the link. (Actually *fetching* the decoded target still needs
`host_permissions` for whatever domain it turns out to be, which will vary per
document — but discovery itself is fully generic.)

**Cross-context consistency:** the same link ids (28123, 34788, 35695, 35860) and vote
counts appeared identically in this live-table view and in the standalone gamepanel's
"Game rules" widget seen earlier — this is one shared, reusable BGA component/dataset,
not something bespoke per page or per game.

**Supersedes ticket 002:** ticket 002's conclusion (no PDF link exists; per-publisher
curated URLs needed) was an artifact of its unauthenticated-`curl` research method,
which never rendered this iframe's content. The real mechanism is: generic same-origin
discovery via `#game-links .weblink a[href^="https://boardgamearena.com/link?url="]`,
decode the `url` param, then fetch/parse whatever document type is behind it (PDF,
or an HTML filepage on BGG that itself links a file — BGG filepage links are **not**
direct PDF bytes and need their own extra hop). Ticket 002's specific verified PDF URLs
for the three sample games remain useful as a fallback/cache, but not as the primary
discovery mechanism.

**New follow-up worth noting for the state-access/architecture side:** since the whole
game (and this help panel) lives inside `#gameIframe`, any MV3 `world: "MAIN"` script
injection for reading `gameui`/`gamedatas` (ticket 001) must target that iframe
specifically (`chrome.scripting.executeScript` supports a `frameIds` option), not the
top-level page.
