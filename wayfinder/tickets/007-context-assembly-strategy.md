---
id: 7
title: Context assembly and prompt-building strategy
status: closed
labels: [wayfinder:grilling]
assignee: null
blocked_by: [1, 2, 10, 11]
---

## Question

Once the shape of extracted game state (from "How is live game state exposed...") and
rulebook text extraction (from "Where and how are rulebook PDFs linked/hosted...") are
known, decide how a single LLM prompt/context gets assembled from: current game state,
relevant rulebook excerpts (fetched on demand per the map's Notes), and prior chat
history for this table.

Cover: what a "turn" of context looks like (full state dump each message vs. diffs
since last message); how rulebook text gets chunked/selected on demand (whole-PDF text
vs. some retrieval step) given real-world model context limits; and a rough token
budget split across state / rules / history so a long game doesn't blow the context
window.

## Resolution

Confirmed with user. Approach:

**Turn representation:** full re-extraction of live state + a fresh per-game-plugin
summary on every user message, not incremental diffs. Extraction is cheap (a MAIN-world
read of `gameui.gamedatas`), and full-dump avoids diff logic silently drifting out of
sync with reality over a long game.

**Rulebook inclusion:** on-demand only (per the map's Notes), triggered by a
rules-sounding question or an explicit "explain this rule" action — not injected into
every prompt. When triggered: follow the highest-voted `(en)` entry under `#game-links`
(ticket 011), resolve to actual text (pdf.js for direct PDFs; one extra hop for BGG
filepage HTML wrapping a file), and cache the extracted text per-table
(`cachedRulebookExcerpt`, ticket 006) so repeat questions in the same game don't
re-fetch/re-parse. Include the **whole** cached text in the prompt rather than building
retrieval/chunking — modern model context windows comfortably fit a full rulebook
alongside state and history; only truncate if a specific rulebook proves unusually
long (past a size threshold), rather than building keyword-window retrieval logic
upfront for an MVP-scope tool.

**Chat history:** kept verbatim per table, FIFO-trimmed (oldest turns dropped first)
once a budget cap is hit. No summarization pipeline — unjustified complexity for a
personal tool at this scope.

**Token budget** (soft guidance, not hard-enforced quotas): small fixed reserve for
system prompt + state summary (~1-2k tokens); rulebook context capped around ~15k
tokens when included; chat history fills the remainder up to a conservative overall
ceiling (~100k tokens) well under any provider's advertised maximum, since real-world
usable context quality reportedly degrades before the advertised limit (per earlier
LLM-context research).

This is a first-pass strategy, not a final-tuned budget — expected to need adjustment
once real usage shows actual token costs per game/rulebook.

**Addendum (from ticket 008's permission-model decision):** rulebook *acquisition*
changed — the extension generally can't auto-fetch third-party-hosted PDFs under the
constrained permission set, so the on-demand rulebook source is BGA's same-origin
"Rules summary" text and/or a user-uploaded PDF (ticket 013), not a generic fetch of
`#game-links` targets. The assembly logic here (include whole cached text, on-demand
trigger, budget) is unaffected — only where that cached text comes from changes.
