# FoNix

A fictional electric-hypercar marque, built as a full-stack learning and
portfolio project: a Django REST Framework API and a React front end, joined
by a scroll-driven cinematic homepage.

FoNix is invented. That is deliberate - putting a real manufacturer's
trademarked name and design language on a public portfolio would be borrowing
someone else's intellectual property rather than demonstrating anything.

### The documentation

| File | What it is |
|---|---|
| **README.md** (this file) | How to run it, the API, the design decisions |
| [ARCHITECTURE.md](ARCHITECTURE.md) | A request traced end to end; the data model and every security measure explained |
| [ROLES.md](ROLES.md) | The four account tiers, the control panel, the permission matrix and every guardrail |
| [LEARNING.md](LEARNING.md) | Nine hands-on Django exercises with exact commands - start here if you're learning |
| [DATABASE.md](DATABASE.md) | What database you're using, SQLite vs Postgres, how to switch, fix and reset it, and how to reach the Django admin |
| [REVIEW_NOTES.md](REVIEW_NOTES.md) | Bugs found and fixed, and the results of an adversarial security probe |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Production checklist: Railway API, Vercel SPA, required env vars |

### Verified

- **140** backend tests (`python manage.py test`)
- **52** frontend unit tests (`npm test` in `frontend/`)
- **32** end-to-end browser checks (`node tools/e2e-checklist.mjs`)
- **21** adversarial security checks (`node tools/security-probe.mjs`)

---

## Running it

Two processes. Both need to be running.

### Backend

```bash
python -m venv backend_venv
backend_venv/Scripts/pip install -r backend/requirements.txt   # Linux/macOS: backend_venv/bin/pip

cd backend
cp .env.example .env          # then set SECRET_KEY - see the file for how
python manage.py migrate
python manage.py seed_catalog # populates the six models and their imagery
python manage.py createsuperuser
python manage.py runserver
```

The API is then at `http://127.0.0.1:8000/api/`, the Django admin at
`http://127.0.0.1:8000/admin/`.

`createsuperuser` does not ask for the custom `role` field, so a new superuser
has `role="customer"`. That is handled - `User.is_fonix_admin` treats
superusers as admins regardless - but to give an ordinary account staff rights,
set its role to **Admin** in the Django admin.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env          # defaults already point at the Django dev server
npm run dev
```

Then open `http://localhost:5173`.

The port matters: Django's `CORS_ALLOWED_ORIGINS` names `localhost:5173`
explicitly rather than using a wildcard, and Vite is configured with
`strictPort` so a clash fails loudly instead of silently moving to 5174 and
producing confusing CORS errors.

### Tests

```bash
cd backend
python manage.py test
```

140 tests covering models, serializers, permissions, the N+1 query counts,
auth (including password reset and refresh-token blacklist), and the full
order-creation path.

Uploads made during tests are redirected to a temporary directory by a custom
test runner (`config/test_runner.py`), so running the suite never scatters
files into `backend/media/`.

### End-to-end browser checklist

`tools/e2e-checklist.mjs` drives a real Chromium session through the full
user journey - hero timing and scroll lock, reduced motion, the store, the
cart's localStorage persistence, register/login, checkout, order history,
the admin-permission boundary, the mobile viewport, and console cleanliness.
It needs both servers running:

```bash
npm install playwright        # in any scratch directory
node tools/e2e-checklist.mjs
```

It prints PASS/FAIL per item and exits non-zero on any failure. Note that the
contact-form checks consume part of the endpoint's 5/hour rate limit, so
back-to-back runs will legitimately hit a 429 - restart the Django server to
reset the in-memory throttle counter.

---

## Architecture

```
backend/            Django + DRF API
  config/           project package: split settings, urls, test runner
    settings/       base.py / local.py / production.py
  accounts/         custom User model, JWT auth endpoints
  cars/             CarModel + CarImage, catalog API, seed command
  orders/           Order + OrderItem, checkout endpoint
  contact/          enquiry form persistence
frontend/           React + Vite SPA
  src/api/          axios client, token handling, endpoint functions
  src/context/      auth and cart providers
  src/components/   layout, hero, store, ui primitives
  src/pages/        one file per route
tools/              build + test scripts (logo rasters, mobile frames, e2e, security)
assets/brand/       the raw logo concept the production vector was traced from
```

The 215-frame hero sequence and the intro video live (committed) under
`frontend/public/`, which is the single canonical home for both. The Django
`seed_catalog` command reads the flagship's stills straight from there, so there
is no second copy to drift out of sync.

### API

| Method | Endpoint | Auth |
|---|---|---|
| POST | `/api/auth/register/` | Public |
| POST | `/api/auth/login/` | Public |
| POST | `/api/auth/refresh/` | Public (refresh token) |
| GET/PATCH | `/api/auth/me/` | Authenticated |
| GET | `/api/cars/` | Public |
| GET | `/api/cars/{slug}/` | Public |
| POST/PATCH/DELETE | `/api/cars/{slug}/` | Staff and above |
| GET/POST | `/api/orders/` | Authenticated. Staff see every order; `?mine=1` always own |
| GET | `/api/orders/{id}/` | Owner, or staff and above |
| POST | `/api/orders/{id}/cancel/` | Buyer, pending only (restores the slot) |
| PATCH | `/api/orders/{id}/status/` | Admin/owner fulfilment |
| GET/PATCH | `/api/admin/users/` `…/{id}/` | Admin only (user & role management) |
| POST | `/api/contact/` | Public, rate-limited |

Catalogue writes (`POST/PATCH/DELETE /api/cars/`) are open to **staff and
above**, not just admins — managing the catalogue is the Staff tier's job. See
[ROLES.md](ROLES.md) for the full four-tier model and its guardrails.

---

## The control panel

A role-aware admin dashboard is built into the React app at **`/dashboard`**
(staff and above see a link in the navbar). It is a bespoke panel in the site's
own design language — not Django's admin, which stays available to superusers at
`/admin/` on the API.

Four account tiers — **Customer → Staff → Admin → Owner** — decide what each
account can reach: staff manage the catalogue and can read every allocation;
admins also advance fulfilment and manage users; owners additionally grant the
Owner role. Every rule is enforced server-side and mirrored in the UI.
The full matrix and its guardrails (no self-management, owners protected from
admins, last-owner protection, deactivate-not-delete) are in [ROLES.md](ROLES.md).

To try it locally, seed a demo team and sign in:

```bash
cd backend
python manage.py seed_team   # creates owner/admin/staff demos, promotes your superuser to Owner
```

---

## Decisions worth knowing about

These were open questions or judgement calls. Each is documented in the code at
the point it applies; this is the summary.

### Every model has real imagery, and each car is visually distinct

The flagship Ignis uses stills pulled from the hero frame sequence. The other
five (Aurea, Cinder, Vesper, Lumen, Atlas) use generated studio photography,
each with a distinct character so they never look like the same car relabelled:
the Aurea a champagne-graphite grand tourer, the Cinder a matte-black track car
with a carbon wing, the Vesper a four-door saloon, the Atlas a raised off-road
SUV, the Lumen a lighter compact coupe.

The generation prompts are kept in [IMAGE_PROMPTS.md](IMAGE_PROMPTS.md); the raw
outputs are optimised to ~65 KB WebPs by `tools/process_product_images.py` and
committed under `frontend/public/product/`, which the Django `seed_catalog`
command reads from.

The seed command still supports a stylised placeholder path
(`backend/cars/management/commands/_placeholder_art.py`) for any future model
added before its photography exists, so the store never has to show a broken or
borrowed image.

### The logo was vectorised, not traced by eye

`assets/brand/logo-concept-raw.jpeg` is a raster concept. It was converted to a production
vector by thresholding the image to a binary mask, walking the boundary with a
marching-squares edge trace, and simplifying the outline with Douglas-Peucker.
The mark turned out to be two straight-edged blades of 6 and 5 points - so the
SVG carries the real geometry rather than an approximation of it, and stays
crisp at 16px.

The same coordinates drive the React component
(`src/components/brand/FoNixMark.jsx`), the standalone SVGs, the PNG/ICO
favicons (`tools/build_logo_rasters.py`) and the placeholder artwork. One source
of truth; they cannot drift apart.

### Mobile hero: reduced frame subset, at reduced resolution

The desktop sequence is 215 WebP stills at 1600×900, about 12MB. Defensible over
broadband for the one page the site is built around; not defensible on mobile
data.

The brief offered a reduced frame subset or a simplified cross-fade. This takes
the subset, but applies two reductions at once, because halving the frame count
alone still leaves ~6MB:

| | Desktop | Mobile |
|---|---|---|
| Frames | 215 | 108 (every second frame) |
| Resolution | 1600×900 | 1200×675 |
| Payload | ~12MB | **~2.9MB** |

That keeps the real scroll-scrub - the thing actually worth showing - rather
than degrading it to a cross-fade, while cutting the download by ~76%. The
mobile frames are held at 1200 wide rather than a lighter 800 so they stay crisp
on a high-DPR phone screen. Rebuild the mobile set with
`tools/build_mobile_frames.py`.

### Staff see every order; `/account` does not

`GET /api/orders/` returns all orders to staff and above, and only their own to
a customer. Fulfilment is an admin action; staff need the list to answer the
phone. `/account` always calls `?mine=1`, so an admin's personal page never
dumps everyone else's allocations.

A customer may cancel **while the order is pending**. That returns the held
build slot. After confirm, only admin/owner can cancel, and a delivered order
is terminal.

Requesting another customer's order returns **404, not 403** - a 403 would
confirm that the order exists, which a stranger has no business learning.

### Order prices are snapshotted server-side

`OrderItem.price_at_purchase` is written from the database record at the moment
of ordering, never from the request body. A client that could send its own price
could buy a hypercar for a pound. It is also why a later catalog price change
does not silently rewrite historical orders. Both are covered by tests.

### `PROTECT` on the order foreign keys

`Order.user` and `OrderItem.car` are `PROTECT`. Deleting a user account or
retiring a car from the catalog must never cascade away the financial record of
a sale that really happened - it raises instead, forcing a deliberate decision.
`CarImage.car` and `OrderItem.order` are `CASCADE`, because a gallery image and
a line item have no existence independent of their parent.

### Tokens live in localStorage

Readable by any script on the page, so an XSS bug leaks them - an httpOnly
cookie would not. Cookies would in turn need CSRF handling and a shared parent
domain, which a decoupled SPA on a different origin does not have. For this
project localStorage is the right trade, and the 30-minute access token limits
what a leak is worth. A system handling real payments should revisit it.

Refreshes are deduplicated through a single shared promise: with
`ROTATE_REFRESH_TOKENS` on, four parallel refreshes would invalidate each
other and log the user out at random.

### Colour contrast

The ember accent `#E8623D` on near-black is fine for large UI elements and
borders, but white text on it falls short of WCAG AA at body sizes. Solid
buttons therefore use `--color-ember-deep` (`#C74A27`), with raw ember reserved
for hover, hairlines, focus rings and large type.

---

## Deliberately out of scope

Not omissions - decisions, recorded so they read as such:

- **Payment processing.** Checkout records an order and takes no money.
- **A live host.** Docker + Vercel are documented in [docs/DEPLOY.md](docs/DEPLOY.md);
  nothing is pointed at a public URL until you run that checklist.
- **A server-side cart.** The cart is React state plus localStorage until
  checkout, which posts the whole thing in one request. There is no `Cart`
  model.
- **Colour and trim configurators.**
- **Object storage / Stripe / SMTP.** Password-reset mail uses Django's email
  backend (console locally and, until you change it, in production). Contact
  enquiries are persisted and read in the Django admin.
