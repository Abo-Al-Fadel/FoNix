# Deploying FoNix

The site is two programs. The React app is a static build on Vercel. The
Django API is a container on Railway (or any host that can run the
`backend/Dockerfile`). They talk over HTTPS; they do not share a process.

This file is the production checklist. It is not a "click deploy" script.
Do not run `railway up` until the env vars below are set.

## What this deploy does not include yet

These are deliberate deferrals, not forgotten work:

- **Object storage.** Car thumbnails live on the container disk and vanish
  on redeploy. Add S3 (or equivalent) before treating the catalog as durable.
- **Stripe.** Checkout still records an order and takes no money.
- **Transactional email.** Password-reset mail uses Django's email backend.
  The production default is the console backend (messages appear in Railway
  logs). Point `EMAIL_BACKEND` at SMTP when you want real delivery.
- **Email verification at register.** Couples to checkout; not in this slice.
- **Content-Security-Policy `connect-src`.** The API host is chosen at
  frontend *build* time (`VITE_API_BASE_URL`). A CSP baked into `vercel.json`
  would have to name that host, and a wrong one would block the catalog.
  Add CSP after the API URL is stable.

## Backend (Railway)

Set the service **root directory** to `backend/`. The Dockerfile and
`railway.toml` live there. `releaseCommand` runs `migrate` once per deploy;
the start command is gunicorn only. Do not add migrate to `CMD` — workers
would race.

Required variables:

| Variable | Example |
|---|---|
| `SECRET_KEY` | A new key, not the local one. Generate with Django's `get_random_secret_key`. |
| `DATABASE_URL` | Railway Postgres URL. There is **no SQLite fallback** in production. |
| `ALLOWED_HOSTS` | Public API hostname, comma-separated if more than one. |
| `CORS_ALLOWED_ORIGINS` | The Vercel origin, e.g. `https://www.example.com`. No trailing slash. |
| `CSRF_TRUSTED_ORIGINS` | The API origin with scheme, e.g. `https://api.example.com`. Needed for `/admin/`. |
| `FRONTEND_ORIGIN` | Same as the Vercel origin. Password-reset emails link here. Localhost is refused. |

Optional:

| Variable | Default | Notes |
|---|---|---|
| `RAILWAY_PUBLIC_DOMAIN` | (unset) | Injected by Railway. Appended to `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` so the platform health check is not a `DisallowedHost`. |
| `DEFAULT_FROM_EMAIL` | `FoNix <noreply@localhost>` | From-address on password-reset mail. |
| `EMAIL_BACKEND` | console | Switch to SMTP when mail should actually leave the box. |
| `PORT` | `8000` | Railway sets this. gunicorn binds to it. |

`GET /api/health/` returns `{"ok": true}` and is exempt from the HTTP→HTTPS
redirect so the mesh probe is not 301'd into a false-unhealthy loop.

`seed_team` and `seed_catalog` refuse to run when `DEBUG` is False.

## Frontend (Vercel)

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
(see above).

`robots.txt` disallows `/dashboard`, `/account`, `/checkout`, `/login`,
`/register`, `/forgot-password`, and `/reset-password`.

## First-boot order

1. Provision Postgres. Copy `DATABASE_URL`.
2. Set the backend env vars. Deploy the API. Confirm `GET /api/health/` is 200.
3. Open `/admin/` over HTTPS and confirm CSRF login works.
4. Set the Vercel env vars. Deploy the frontend.
5. Confirm the store loads against the live API, not `127.0.0.1`.
6. Request a password reset and read the Django console / Railway logs
   until SMTP is configured. Console mail quoted-printable-wraps long URLs;
   if the link looks broken, use the `uid:` and `token:` lines in the same
   message on `/reset-password`.

## JWT storage

Access and refresh tokens live in `localStorage`. That is an accepted SPA
trade-off for this project, documented in `frontend/src/api/tokens.js`.
Refresh tokens rotate and the previous one is blacklisted. Access tokens
remain valid until they expire (30 minutes) even after a password reset.
Do not switch to cookies in this slice without a CSRF plan.
