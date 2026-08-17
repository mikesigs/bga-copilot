---
id: 17
title: Rate limiting and cost controls for cloud LLM usage
status: open
labels: [wayfinder:grilling]
assignee: null
blocked_by: []
---

## Question

Since the user pays directly via their own API key (ticket 005), decide what guards
against runaway spend:

- Should there be a simple client-side rate limit (e.g. minimum interval between
  requests, or a max-requests-per-minute) to prevent accidental request storms (e.g.
  a UI bug that fires repeated calls)?
- Should the panel show any running cost/usage estimate (e.g. rough token count per
  message, derived from the context-assembly budget in ticket 007), or is that
  over-engineering for a personal tool where the user can just watch their provider
  dashboard directly?
- Given full state + rulebook context gets rebuilt on every message (ticket 007's
  full-re-extraction approach), is there a cheap client-side guard against
  accidentally re-sending a very large rulebook repeatedly (e.g. warn if a single
  request's estimated tokens exceed some threshold before sending)?
- Is a hard spending cap in scope at all, or does "the user holds their own key and can
  set provider-side spending limits" fully cover this concern?
