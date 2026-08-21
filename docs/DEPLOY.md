# Deploying FoNix

The site is two programs. The React app is a static build. The Django API is a
container (or a VM running that container). They talk over HTTPS; they do not
share a process.

This file is the production checklist.

## Fastest free path: Render + Vercel (no credit card)

Render's free tier deploys straight from GitHub, needs no card, and gives you a
free Postgres. The frontend goes on Vercel (also free, no card). This is the
quickest way to get FoNix live. The trade-offs: the API sleeps after 15 minutes
idle and takes ~40s to wake on the next request, and the free Postgres is wiped
after 90 days (Render emails first; you create a new one and redeploy).

The repo already carries what Render needs: `render.yaml` (a Blueprint),
`backend/Dockerfile`, and `backend/render-start.sh` (migrate, seed the demo
catalogue and team, then gunicorn). `production.py` auto-detects Render's
hostname, so you do not have to know the URL in advance.

### Part A — the backend on Render

1. Push to GitHub (already done). Sign up at **render.com** with your GitHub
   account. No card.
2. **New > Blueprint**, pick the `FoNix` repo, and **Apply**. Render reads
   `render.yaml` and creates two things: the `fonix-api` web service and a free
   `fonix-db` Postgres, already linked by `DATABASE_URL`.
3. First build fails or the app 400s until the origin vars are set — that is
   expected; you set them in step 6 after the frontend exists. Let the build
   finish; note the service URL, e.g. `https://fonix-api.onrender.com`.
4. Confirm the API is alive: open `https://fonix-api.onrender.com/api/health/`.
   It returns `{"ok": true}`. (First hit after idle takes ~40s — that is the
   free-tier cold start, not a bug.)

If you would rather not use the Blueprint, create the service by hand: **New >
Web Service**, the repo, **Root Directory** `backend`, **Runtime** Docker,
**Docker Command** `sh render-start.sh`, **Health Check Path** `/api/health/`,
plan Free; then **New > Postgres** (free) and copy its Internal Database URL into
the service's `DATABASE_URL`. Set the env vars from the table below.

### Part B — the frontend on Vercel

5. Sign up at **vercel.com** with GitHub. **Add New > Project**, pick `FoNix`,
   set **Root Directory** to `frontend`. Vercel detects Vite. Add one env var:

   | Key | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://fonix-api.onrender.com/api` (your Render URL + `/api`) |
   | `VITE_SITE_URL` | your Vercel URL, e.g. `https://fonix.vercel.app` (optional; used for `sitemap.xml`) |

   Deploy. Note the Vercel URL, e.g. `https://fonix.vercel.app`.

### Part C — tell the API about the frontend

6. Back in Render, open `fonix-api` > **Environment**, and set both to your
   Vercel URL (no trailing slash):

   | Key | Value |
   |---|---|
   | `CORS_ALLOWED_ORIGINS` | `https://fonix.vercel.app` |
   | `FRONTEND_ORIGIN` | `https://fonix.vercel.app` |

   Save. Render redeploys. `SECRET_KEY`, `DATABASE_URL`, `SERVE_MEDIA`, and
   `DJANGO_SETTINGS_MODULE` were set by the Blueprint already.
7. Open the Vercel URL. The store loads six cars from the live API. Sign in with
   the demo owner (`owner` / `owner-demo-2049`) and open `/dashboard`. Django
   admin is at `https://fonix-api.onrender.com/admin/` — the boot script created
   the demo accounts, and the `fonix` superuser exists if you also run
   `createsuperuser` from the Render shell.

### What reseeds, and the one caveat

`render-start.sh` reseeds the catalogue on every boot **on purpose**: a free
Render instance gets a fresh disk each time it wakes, so the car images under
`/media/` are gone, and reseeding rewrites them. The cost is that demo orders
placed by a visitor are cleared when the instance next sleeps. For a portfolio
that is fine. To make orders and uploaded images durable, move media to object
storage (Cloudinary has a free, no-card tier) with `django-storages`, then drop
`--reset` from `render-start.sh` so the seed becomes create-if-missing. That is
the only change needed for persistence; the rest of this deploy is unaffected.

## If you want always-on later (Oracle needs a card at signup)

Render sleeps when idle. If you later want a backend that never sleeps and never
expires, without a monthly bill, the choice is an **Oracle Cloud Always Free**
ARM VM running the `backend/docker-compose.yml` stack (Postgres + API + Caddy
for TLS). Ampere A1 gives up to 4 OCPU / 24 GB in the always-free basket. Oracle
asks for a card at signup to stop spam accounts but does not charge the
always-free VM inside the cap. Frontend stays on Vercel either way.

**Fly.io** is a middle ground: it runs the existing Dockerfile with `fly launch`
in `backend/` and can scale to zero. Its free allowance is real but is an
allowance, not a contract.

Railway also runs the Dockerfile, but its free credit lasts about a month, so it
is not a lasting free host.

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

## Backend environment variables (all hosts)

Set the service **root directory** to `backend/`. The Dockerfile lives there.
The Render Blueprint and `render-start.sh` handle migrate + seed on boot; on
Oracle/Fly, run `migrate` once per deploy as a release step, then start gunicorn
(do not put migrate in `CMD` — parallel workers would race it).

Required variables:

| Variable | Example |
|---|---|
| `SECRET_KEY` | A new key, not the local one. Generate with Django's `get_random_secret_key`. On Render the Blueprint generates it. |
| `DATABASE_URL` | Postgres URL. There is **no SQLite fallback** in production. On Render the Blueprint wires it from `fonix-db`. |
| `ALLOWED_HOSTS` | Public API hostname, comma-separated if more than one. **Optional on Render** — `RENDER_EXTERNAL_HOSTNAME` is appended automatically. |
| `CORS_ALLOWED_ORIGINS` | The frontend origin, e.g. `https://fonix.vercel.app`. No trailing slash. |
| `CSRF_TRUSTED_ORIGINS` | The API origin with scheme, e.g. `https://api.example.com`. Needed for `/admin/`. **Optional on Render** — the onrender.com origin is added automatically. |
| `FRONTEND_ORIGIN` | Same as the frontend origin. Password-reset emails link here. Localhost is refused. |

Optional:

| Variable | Default | Notes |
|---|---|---|
| `SERVE_MEDIA` | `0` | Set to `1` on a single-container host (Render, Fly) so Django serves `/media/`. The Compose deploy leaves it off and lets Caddy serve media. |
| `RENDER_EXTERNAL_HOSTNAME` | (set by Render) | Auto-added to `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS`. You do not set this yourself. |
| `RAILWAY_PUBLIC_DOMAIN` | (unset) | Same auto-append, for Railway. You do not set this yourself. |
| `DEFAULT_FROM_EMAIL` | `FoNix <noreply@localhost>` | From-address on password-reset mail. |
| `EMAIL_BACKEND` | console | Switch to SMTP when mail should actually leave the box. |
| `PORT` | `8000` | gunicorn binds to it. Render, Fly and most VMs set this. |

`GET /api/health/` returns `{"ok": true}` and is exempt from the HTTP→HTTPS
redirect so a mesh probe is not 301'd into a false-unhealthy loop.

`seed_team` and `seed_catalog` refuse to run when `DEBUG` is False, unless you
pass `--force`. Only the portfolio-demo boot script (`backend/render-start.sh`)
does that, because its whole point is a reset demo with published logins.

### Oracle Always Free — what runs on the VM

Files live in `backend/`: `docker-compose.yml`, `Caddyfile`,
`entrypoint.prod.sh`, `.env.oracle.example`.

On the box, after Docker is installed and DNS points at the public IP:

```bash
git clone https://github.com/Abo-Al-Fadel/FoNix.git
cd FoNix/backend
cp .env.oracle.example .env
nano .env   # SECRET_KEY, POSTGRES_PASSWORD, API_DOMAIN, Vercel origin

docker compose up -d --build
docker compose logs -f api caddy
```

Confirm `https://$API_DOMAIN/api/health/` returns `{"ok": true}`.

Create an admin (not `seed_team` — that command refuses in production):

```bash
docker compose exec api python manage.py createsuperuser
```

Car images are stored in the `media_data` volume and served by Caddy at
`/media/`. Add models through `https://$API_DOMAIN/admin/`.

Caddy obtains a Let's Encrypt certificate for `API_DOMAIN`. That name must
resolve to the VM before `docker compose up`. Open **80 and 443** in the
Oracle security list; Ubuntu on OCI often also needs:

```bash
sudo iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 1 -p tcp --dport 443 -j ACCEPT
```

Then set Vercel `VITE_API_BASE_URL=https://$API_DOMAIN/api` and redeploy.

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
