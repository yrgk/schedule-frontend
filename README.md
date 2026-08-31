This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

Для локальной разработки укажите адрес бекенда в `.env`:

```bash
SCHEDULE_API_BASE_URL=https://dorogoy-dnevnik.duckdns.org
```

После изменения `.env` или `next.config.ts` перезапустите `npm run dev`. Локальный Next.js будет проксировать запросы `http://localhost:3000/api/*` в указанный бекенд, а браузер продолжит работать с теми же путями, что и в проде.

## Размещение на домене с API

Приложение доступно по корневому адресу `https://ваш-домен/`.
API должен оставаться на том же домене по пути `/api/*`.

В Caddy сначала направьте API-префикс в сервис расписания, а остальные запросы — в Next.js. Готовый пример есть в `Caddyfile.example`:

```caddyfile
# Replace example.com with your real domain.
# If Caddy runs on the host instead of Docker, replace schedule-app:3000
# with 127.0.0.1:3000 or the APP_PORT value from docker-compose.yml.

example.com {
  encode zstd gzip

  handle /api/* {
    reverse_proxy backend:8000
  }

  handle {
    reverse_proxy schedule-app:3000
  }
}
```

Приложение запрашивает список групп через `GET /api/schedule/groups`, а расписание — через `GET /api/schedule/{group_id}?day=ДД.ММ.ГГГГ`. Например, для группы с ID `1` и 28 июня 2026 года будет вызван `GET https://ваш-домен/api/schedule/1?day=28.06.2026`.

Список групп должен возвращаться в формате:

```json
[
  {
    "id": 1,
    "name": "09-661 (1)"
  }
]
```

Сервис расписания должен вернуть JSON в следующем формате:

```json
[
  {
    "title": "Ознакомительная практика",
    "start_time": "12:10",
    "end_time": "12:55",
    "teacher_name": "Сагдеева Р. Ф.",
    "location_short": "Кремл. 35, ауд. 1208",
    "location": "Кремлёвская, 35, ауд. 1208"
  }
]
```

В карточке показываются `title`, время из `start_time` и `end_time`, а также `location_short`.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
