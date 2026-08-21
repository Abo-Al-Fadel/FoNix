#!/usr/bin/env sh
# Start command for Render (or any single-container free host with an ephemeral
# filesystem). Set this as the service's start / Docker command.
#
# Why it reseeds on every boot: a free Render instance gets a fresh filesystem
# each time it spins up from sleep, so the car images written under MEDIA_ROOT
# are gone. Reseeding rewrites them (and the demo catalogue and team) on a clean
# media dir, which also keeps the thumbnail filenames deterministic so they
# resolve. Demo orders are cleared first, because seed_catalog --reset deletes
# CarModel rows and OrderItem.car is PROTECT -- an order referencing a car would
# block the reset. This resets demo data on each cold start, which is what a
# portfolio demo wants; for persistent uploads, move media to object storage
# (see DEPLOY.md) and drop the --reset.
set -e

python manage.py migrate --noinput

python manage.py shell -c "from orders.models import Order; Order.objects.all().delete()"
python manage.py seed_catalog --reset --force
python manage.py seed_team --force

exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers 2 \
  --timeout 60 \
  --access-logfile - \
  --error-logfile -
