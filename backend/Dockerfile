# Production image for the Django API. The React app is built separately
# (Vercel). Do not copy the frontend into this image.

FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DJANGO_SETTINGS_MODULE=config.settings.production

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements/prod.txt requirements/base.txt /tmp/requirements/
RUN pip install --no-cache-dir -r /tmp/requirements/prod.txt

COPY . /app

# collectstatic needs Django to boot. The dummy values exist only for this
# RUN -- they are not baked into the runtime image as defaults. A real
# SECRET_KEY / DATABASE_URL must be injected by the host.
RUN SECRET_KEY=build-time-only-not-used-at-runtime \
    DATABASE_URL=sqlite:////tmp/build.db \
    ALLOWED_HOSTS=localhost \
    CORS_ALLOWED_ORIGINS=http://localhost \
    CSRF_TRUSTED_ORIGINS=http://localhost \
    FRONTEND_ORIGIN=http://example.invalid \
    python manage.py collectstatic --noinput

RUN adduser --disabled-password --gecos "" appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["sh", "-c", "gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2 --timeout 60 --access-logfile - --error-logfile -"]
