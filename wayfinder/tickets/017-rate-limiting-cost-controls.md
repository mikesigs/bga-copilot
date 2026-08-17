---
id: 17
title: Rate limiting and cost controls for cloud LLM usage
status: closed
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

## Resolution

**Minimal guardrails, no cost-tracking UI:**

- **Simple client-side rate limit:** yes, but only as a bug guard, not an abuse
  system — disable the send action for roughly a second after sending (or an
  equivalent debounce) to prevent accidental double-sends/request storms from a UI
  glitch. Not a real rate limiter, since there's no adversarial user here.
- **Running cost/usage estimate:** skip. Building an accurate client-side token/cost
  estimate is real effort the user's own provider dashboard already gives them for
  free — out of scope as over-engineering for a personal tool.
- **Guard against resending an oversized rulebook every message:** yes, worth doing
  cheaply. Since ticket 007 already establishes a rough token budget (~100k ceiling),
  reuse that same estimate: if an assembled request would exceed the threshold, show a
  lightweight warning before sending rather than silently sending an oversized request
  every time. No new estimation logic needed — just a threshold check against numbers
  the context-assembly step already computes.
- **Hard spending cap:** out of scope. "The user holds their own key and can set
  provider-side spending limits" fully covers this — not the extension's
  responsibility to duplicate.
