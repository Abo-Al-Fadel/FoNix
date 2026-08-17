#!/bin/sh
# Single-replica boot: migrate once, then gunicorn. Do not use this as the
# image CMD when several workers start in parallel (they would race migrate).
set -e
python manage.py migrate --noinput
exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers 2 \
  --timeout 60 \
  --access-logfile - \
  --error-logfile -
