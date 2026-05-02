#!/bin/sh
set -e

if [ -z "$APP_KEY" ]; then
  echo "ERROR: set APP_KEY (run: php artisan key:generate --show)."
  exit 1
fi

chown -R www-data:www-data /var/www/storage /var/www/bootstrap/cache

php artisan migrate --force
php artisan storage:link 2>/dev/null || true

if [ "$APP_ENV" = "production" ]; then
  php artisan config:cache
  php artisan route:cache
  php artisan view:cache
fi

exec docker-php-entrypoint "$@"
