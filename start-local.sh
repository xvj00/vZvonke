#!/bin/sh
# Запуск локально на любом компе с Docker.
# Использование: sh start-local.sh
set -e

COMPOSE_FILE="docker-compose.local.yml"

# Генерируем APP_KEY автоматически если не задан
if ! grep -q "^APP_KEY=base64:" "$COMPOSE_FILE" 2>/dev/null || grep -q "ЗАМЕНИТЕ" "$COMPOSE_FILE"; then
  echo "Генерируем APP_KEY..."
  KEY=$(docker run --rm php:8.2-cli php -r "echo 'base64:'.base64_encode(random_bytes(32));")
  # Подставляем в docker-compose.local.yml
  if [ "$(uname)" = "Darwin" ]; then
    sed -i '' "s|APP_KEY: base64:.*|APP_KEY: ${KEY}|" "$COMPOSE_FILE"
  else
    sed -i "s|APP_KEY: base64:.*|APP_KEY: ${KEY}|" "$COMPOSE_FILE"
  fi
  echo "APP_KEY установлен: $KEY"
fi

echo "Собираем и запускаем..."
docker compose -f "$COMPOSE_FILE" up --build -d

echo ""
echo "==========================================="
echo "  Готово! Открывайте: http://localhost"
echo "  Логин: admin@vzvonke.ru / password"
echo "==========================================="
echo ""
echo "Логи: docker compose -f docker-compose.local.yml logs -f"
echo "Стоп: docker compose -f docker-compose.local.yml down"
