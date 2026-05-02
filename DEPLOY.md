# GitHub и деплой на VPS

Корень проекта с Docker: каталог **`diplomSam`** (там `docker-compose.yml`).

---

## Часть 1. Залить код на GitHub

### 1.1. Один раз на вашем ПК

Из каталога **`mediasoupDiplom`** (родитель `diplomSam`):

```bash
git init
git add .
git status
```

Проверьте в списке **нет** файлов `.env`, паролей и `node_modules`. Если `.env` попал — выполните `git reset HEAD .env` и убедитесь, что он в `.gitignore`.

```bash
git commit -m "Initial commit: vZvonke stack"
```

На GitHub создайте **новый репозиторий** (можно Private), **без** README/license, если хотите пуш без конфликтов.

```bash
git remote add origin https://github.com/<USER>/<REPO>.git
git branch -M main
git push -u origin main
```

Дальнейшие изменения:

```bash
git add .
git commit -m "Краткое описание"
git push
```

---

## Часть 2. Сервер (Docker)

### 2.1. Требования

- Docker и Docker Compose v2.
- Открыты порты: **80** (HTTP), **443** (если терминируете HTTPS на хосте), **4001/tcp** (сигналинг mediasoup), **UDP диапазон RTP** (по умолчанию в compose **40000–49999**).

### 2.2. Клонирование

```bash
git clone https://github.com/<USER>/<REPO>.git
cd <REPO>/diplomSam
```

### 2.3. Переменные окружения

```bash
cp env.docker.example .env
nano .env   # или другой редактор
```

Обязательно задайте:

| Переменная | Смысл |
|------------|--------|
| `APP_KEY` | `php artisan key:generate --show` на любой машине с PHP/Laravel |
| `APP_URL` | Публичный URL сайта, например `https://ваш-домен.ru` |
| Пароли MySQL | `DB_ROOT_PASSWORD`, `DB_PASSWORD` |
| `MEDIASOUP_ANNOUNCED_IP` | Публичный IPv4 сервера |
| `VITE_MEDIASOUP_SIGNALING_URL` | URL сигналинга для браузера, например `https://ваш-домен.ru:4001` или если спрячете за прокси — итоговый WSS-URL |
| `SANCTUM_STATEFUL_DOMAINS` | Домен SPA без схемы |
| `MEDIASOUP_INTERNAL_SECRET` | Одинаковая длинная случайная строка для Laravel и mediasoup (если включили защиту `join`/`leave`/`close`) |

Пересборка фронта нужна при изменении любых **`VITE_*`**.

### 2.4. Запуск

```bash
docker compose build --no-cache
docker compose up -d
```

Проверка:

- Сайт: `http://<IP>` или ваш домен на порту **80**.
- API: тот же хост, префикс **`/api`** (как в `VITE_API_URL`).
- Mediasoup health: `http://<IP>:4001/health`
- Метрики (если задан `METRICS_TOKEN`): заголовок `Authorization: Bearer <token>` для `http://<IP>:4001/metrics`.

---

## Часть 3. HTTPS на порту 443

Раз **443 свободен**, типичный вариант:

1. Установить **Certbot** и **Nginx** на хосте (не в Docker).
2. Выпустить сертификат Let’s Encrypt для домена.
3. В конфиге Nginx:
   - `listen 443 ssl` → проксировать на `http://127.0.0.1:80` (контейнер `web`) для SPA и `/api`;
   - отдельный `location` или второй `server` для прокси **WebSocket / Socket.IO** на mediasoup, если хотите убрать `:4001` из URL (иначе оставьте порт **4001** наружу и обновите `VITE_MEDIASOUP_SIGNALING_URL`).

Упрощённый старт без своего Nginx на хосте: открыть пока **HTTP на 80** и **4001/tcp**, HTTPS добавить позже через reverse proxy.

---

## Часть 4. После обновления кода на сервере

```bash
cd .../diplomSam
git pull
docker compose build
docker compose up -d
```

При изменении только Laravel без фронта иногда достаточно пересобрать образ `laravel`; при изменении фронта — образ `web`.

---

## Часть 5. Что не хранить в Git

- Любые **`.env`** с паролями и секретами.
- Файлы `database.sqlite` с боевыми данными (если используете SQLite локально).

Примеры секретов уже перечислены в `env.docker.example` и комментариях в репозитории.
