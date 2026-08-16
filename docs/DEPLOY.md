# Deploying FoNix

The site is two programs. The React app is a static build. The Django API is a
container (or a VM running that container). They talk over HTTPS; they do not
share a process.

This file is the production checklist. It is not a "click deploy" script.

## Recommended: free and lasting

Railway is optional. For something **free and as permanent as a portfolio
site can be**, use:

| Piece | Host | Why |
|---|---|---|
| Frontend | **Vercel** (Hobby) or **Cloudflare Pages** | Static SPA. The free tier is enough forever at this scale. |
| API + Postgres | **Oracle Cloud Always Free** ARM VM | A real VM that stays on. Ampere A1: up to 4 OCPU / 24 GB in the always-free basket. You install Docker, run the `backend/Dockerfile`, and run Postgres on the same box (or Oracle's always-free Autonomous DB). |

That combination is the one that stays up without a credit card billing you
monthly. Oracle still asks for a card at signup to stop spam accounts; they
do not charge the always-free VM if you stay inside the cap. Keep a monthly
calendar reminder to log in — unused always-free accounts can be reclaimed.

### Easier API host (not strictly free-forever)

**Fly.io** runs the existing Dockerfile with almost no ceremony (`fly launch`
in `backend/`). Machines can scale to zero. The free allowance is real but
it is an allowance, not a contract: fine for a demo, weaker as a "this will
still be here in two years" promise than Oracle's always-free SKU.

Render, Railway and similar PaaS free tiers sleep, expire, or start billing.
Use them if you want convenience and are willing to pay later.

## What this deploy does not include yet

These are deliberate deferrals, not forgotten work:

- **Object storage.** Car thumbnails live on the container disk and vanish
  on redeploy. Add S3 (or equivalent) before treating the catalog as durable.
- **A real payment processor.** Checkout is a Stripe-shaped **replica**: it
  authorises a demonstration 10% reservation, stores brand + last4, and never
  talks to a bank. Do not point it at live Stripe keys.
- **Transactional email.** Password-reset mail uses Django's email backend.
  The production default is the console backend (messages appear in the API
  logs). Point `EMAIL_BACKEND` at SMTP when you want real delivery.
- **Email verification at register.** Couples to checkout; not in this slice.
- **Content-Security-Policy `connect-src`.** The API host is chosen at
  frontend *build* time (`VITE_API_BASE_URL`). A CSP baked into `vercel.json`
  would have to name that host, and a wrong one would block the catalog.
  Add CSP after the API URL is stable.

## Backend (Oracle Always Free, or Fly.io)

Set the service **root directory** to `backend/`. The Dockerfile lives there.
Run `migrate` **once** per deploy as a release step, then start gunicorn.
Do not add migrate to `CMD` — workers would race.

Required variables:

| Variable | Example |
|---|---|
| `SECRET_KEY` | A new key, not the local one. Generate with Django's `get_random_secret_key`. |
| `DATABASE_URL` | Postgres URL. There is **no SQLite fallback** in production. |
| `ALLOWED_HOSTS` | Public API hostname, comma-separated if more than one. |
| `CORS_ALLOWED_ORIGINS` | The frontend origin, e.g. `https://www.example.com`. No trailing slash. |
| `CSRF_TRUSTED_ORIGINS` | The API origin with scheme, e.g. `https://api.example.com`. Needed for `/admin/`. |
| `FRONTEND_ORIGIN` | Same as the frontend origin. Password-reset emails link here. Localhost is refused. |

Optional:

| Variable | Default | Notes |
|---|---|---|
| `RAILWAY_PUBLIC_DOMAIN` | (unset) | Only if you still use Railway. Appended to `ALLOWED_HOSTS` / `CSRF_TRUSTED_ORIGINS`. |
| `DEFAULT_FROM_EMAIL` | `FoNix <noreply@localhost>` | From-address on password-reset mail. |
| `EMAIL_BACKEND` | console | Switch to SMTP when mail should actually leave the box. |
| `PORT` | `8000` | gunicorn binds to it. Fly.io and most VMs set this. |

`GET /api/health/` returns `{"ok": true}` and is exempt from the HTTP→HTTPS
redirect so a mesh probe is not 301'd into a false-unhealthy loop.

`seed_team` and `seed_catalog` refuse to run when `DEBUG` is False.

### Oracle Always Free, short version

1. Create an Always Free Ampere A1 instance in a region that still has ARM
   quota (Phoenix, Chicago, or Frankfurt are the usual bets).
2. Open ingress 80/443 (and 22 for you). Point a DNS name at the public IP.
3. Install Docker. Copy `backend/.env` onto the box (never commit it).
4. Run Postgres and the API:

```bash
docker compose up -d   # or: docker run ... for the API image plus a postgres container
```

5. Put Caddy or nginx in front for TLS (`caddy reverse-proxy --from api.example.com --to localhost:8000`).
6. Confirm `GET https://api.example.com/api/health/` is 200.

A 1-click Marketplace image is not required. Ubuntu + Docker is enough.

### Fly.io, short version

From `backend/`:

```bash
fly launch --no-deploy
fly postgres create
fly secrets set SECRET_KEY=... DATABASE_URL=... ALLOWED_HOSTS=... CORS_ALLOWED_ORIGINS=... CSRF_TRUSTED_ORIGINS=... FRONTEND_ORIGIN=...
fly deploy
```

Confirm `https://<app>.fly.dev/api/health/` is 200. Then put that origin in
the frontend build as `VITE_API_BASE_URL`.

## Frontend (Vercel or Cloudflare Pages)

Set the project **root directory** to `frontend/`. Vite bakes `VITE_*`
variables into the bundle at **build** time. Changing them later requires a
rebuild; runtime env on the CDN does nothing.

| Variable | Example |
|---|---|
| `VITE_API_BASE_URL` | `https://api.example.com/api` |
| `VITE_SITE_URL` | `https://www.example.com` (no trailing slash). Used for `sitemap.xml`. |

`VITE_API_ORIGIN` is derived from `VITE_API_BASE_URL` during the build and
injected into `index.html` as the API `preconnect`. Do not hardcode
`127.0.0.1` in the built HTML.

`vercel.json` rewrites unknown paths to `index.html` so a refresh on
`/store/ignis` does not 404. Security headers are set there except CSP
(see above). Cloudflare Pages needs an equivalent `_redirects` / `_headers`
file if you use that host instead; the Vite build already emits `robots.txt`.

`robots.txt` disallows `/dashboard`, `/account`, `/checkout`, `/login`,
`/register`, `/forgot-password`, and `/reset-password`.

## First-boot order

1. Provision Postgres. Copy `DATABASE_URL`.
2. Set the backend env vars. Deploy the API. Confirm `GET /api/health/` is 200.
3. Open `/admin/` over HTTPS and confirm CSRF login works.
4. Set the frontend env vars. Deploy the SPA.
5. Confirm the store loads against the live API, not `127.0.0.1`.
6. Request a password reset and read the API logs until SMTP is configured.
   Console mail quoted-printable-wraps long URLs; if the link looks broken,
   use the `uid:` and `token:` lines in the same message on `/reset-password`.

## JWT storage

Access and refresh tokens live in `localStorage`. That is an accepted SPA
trade-off for this project, documented in `frontend/src/api/tokens.js`.
Refresh tokens rotate and the previous one is blacklisted. Access tokens
remain valid until they expire (30 minutes) even after a password reset.
Do not switch to cookies in this slice without a CSRF plan.
