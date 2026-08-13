# FoNix - hands-on review notes

Written after driving the running site in a real browser and running an
adversarial probe against the API. This is the "I actually used it and tried to
break it" pass, separate from the automated checklist.

---

## Bugs found and fixed this round

All three you reported were reproduced in a real browser, root-caused, fixed,
and re-verified.

### 1. Homepage buttons led to a blank white page - **FIXED**

**Severity: high.** This made the whole site look broken from the hero.

**Root cause.** GSAP's `ScrollTrigger` with `pin: true` inserts a wrapper
`<div class="pin-spacer">` into the DOM to hold the pinned section's space.
React does not know that wrapper exists. When you navigated away, React tried to
remove the hero `<section>` from the parent *it* remembered - hit the
pin-spacer instead - and threw:

```
NotFoundError: Failed to execute 'removeChild' on 'Node':
The node to be removed is not a child of this node.
```

React's response to an uncaught error during unmount is to tear down the
**entire** root, which is the blank page.

**Fix.** Two parts:
- The GSAP setup moved from `useEffect` to **`useLayoutEffect`**. Its cleanup
  runs *synchronously before* React removes DOM nodes, so `ctx.revert()` unwraps
  the pin-spacer first and React then removes a node exactly where it expects
  it. (`useEffect` cleanup runs too late, after the DOM has already changed.)
- An **`ErrorBoundary`** now wraps the app, so any future render crash shows a
  recoverable error screen instead of a white void.

### 2. Page froze on refresh - **FIXED**

**Root cause.** Browsers restore scroll position on reload. If you refreshed
while scrolled into the pinned hero, the page was restored mid-section and *then*
the scroll-lock engaged - trapping you at a position the sequence could not
drive from.

**Fix.** The hero now takes manual control of scroll restoration
(`history.scrollRestoration = "manual"`) and forces the page to the top before
locking. It also plays the intro **once per tab** (`sessionStorage`), so a
refresh drops you straight into the interactive state instead of replaying the
whole cinematic.

### 3. Page stretched after opening devtools (F5 + inspect) - **FIXED**

**Root cause.** The `<canvas>` has two independent sizes - its CSS box and its
internal pixel buffer. The old code only resized on the `window.resize` event,
but opening devtools resizes the *element* without firing a clean window resize
the code caught. The buffer stayed at the old dimensions and the browser
stretched it to fill the new box.

**Fix.** A **`ResizeObserver`** now watches the canvas element itself (not the
window) and re-syncs the pixel buffer to the CSS box on any size change, then
calls `ScrollTrigger.refresh()` so the pin re-measures. Verified: shrink the
viewport and the buffer tracks it exactly.

---

## Security probe - 21/21 held

I ran an adversarial script (`tools/security-probe.mjs`) firing the requests a
malicious client would actually send. Every one was refused. This is authorized
testing against my own local instance.

| Area | Attack | Result |
|---|---|---|
| **Access control** | Customer creates/edits/deletes a car | 403 |
| | IDOR: read another user's order by id | **404** (not 403 - doesn't even confirm it exists) |
| | Order list leaks other users' orders | Scoped, empty |
| | Anonymous lists orders | 401 |
| **Privilege escalation** | Register with `role: admin, is_superuser: true` | Ignored - stays customer |
| | `PATCH /me/` to elevate role | Ignored |
| **Price tampering** | Send own `price_at_purchase: 1.00` | Ignored - charged full £2.4m |
| | Negative / overflow quantity | 400 |
| | Inject `user` field to order as someone else | Ignored - owned by caller |
| **Injection** | SQL injection in the slug | Clean 404, parameterised |
| | Stored XSS payload via contact form | Stored as inert data, no 500 |
| **Auth/tokens** | Tampered JWT signature | 401 |
| | `alg: none` forgery (the classic JWT bypass) | 401 |
| | Access token used at the refresh endpoint | 401 |
| **Hardening** | Malformed JSON body | 400, no traceback leaked |
| | `X-Content-Type-Options` header | `nosniff` present |
| **Rate limiting** | Flood the contact form | 429 after 5 |

**One honest caveat.** In local development `DEBUG = True`, so a genuinely
unhandled 500 *would* render a full traceback. That is expected and correct for
a dev machine - `production.py` sets `DEBUG = False` and adds HSTS, secure
cookies and SSL redirect. The probe confirmed no *easy* 500 path leaks anything;
the point stands that this is a dev config, not a deployed one.

---

## UX notes from driving the site

Things I changed based on actually using it:

- **The intro was too long.** Swapped to your 3.9s cut (from 6.2s) and re-timed
  the title reveal to 1.4s so it still lands on the headlights. A hero that
  locks scroll is borrowing the visitor's patience - the shorter the better.
- **The page felt flat and closed.** The background is now lit: two large,
  faint radial washes (one ember, one cold blue) fixed behind the content, plus
  alternating tonal bands that fade at their edges instead of hard 1px rules.
  This is the single biggest "cheap vs. luxury" lever on a dark site, and it's
  drawn straight from how Porsche and Lamborghini build depth.
- **Numbers now count up** when scrolled into view, easing to a stop like an
  instrument needle rather than ticking linearly.
- **Cards lift and sheen on hover**, and the navbar deepens its glass once you
  scroll off the hero.
- **Navbar spacing is even** - the old double `ml-auto` put a bigger gap before
  "Cart"; now one wrapper with a single gap spaces every item identically.

## What I would still do next (not blocking)

1. **Real reference-site polish is iterative** - the marques refine spacing over
   years. The system is right; individual sections can always be tuned.
2. **Frontend tests** - the count-up and cart logic deserve Vitest coverage.
3. **A cookie/consent banner** if this ever handles real analytics.
4. **`Permissions-Policy` / `Content-Security-Policy` headers** for production -
   `production.py` has the transport-security ones but not CSP yet.
