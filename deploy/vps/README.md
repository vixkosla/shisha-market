# Развёртывание на VPS

Шаблоны для одного сервера: приложение Next.js (standalone) под systemd, PostgreSQL, закрытое S3-хранилище фотографий и Caddy с HTTPS. Адреса, ключи и пароли в репозитории не хранятся: `SERVER_IP` и `GATEWAY_IP` в файлах — заглушки, секреты создаёт `create-secrets.mjs` прямо на сервере в `/etc/shisha-market/app.env`.

## Выпуск релиза

1. `npm run check` и `npm run test:e2e` — без зелёных проверок релиз не собирается.
2. Архив: `.next/standalone`, `.next/static`, `public`, `content`, `drizzle`, `migrate.mjs`; `.next/node_modules` разыменовать (`cp -rL`). Файлы `.env*`, `.data`, отчёты тестов в архив не попадают.
3. На сервере архив распаковывается в `releases/<имя>`, рядом прежние релизы для отката.
4. Перед миграцией — онлайн-копия базы `pg_dump --format=custom`, проверка `pg_restore --list`.
5. Миграции: `node migrate.mjs` от пользователя приложения с `EnvironmentFile=/etc/shisha-market/app.env`. Новые колонки добавляются nullable, чтобы прежний релиз оставался совместим.
6. Пробный запуск (`systemd-run`) на отдельном порту: страницы, поиск, ответ модели.
7. Атомарное переключение ссылки `current` и перезапуск только приложения. Откат — вернуть `current` на прежний релиз.

## Живой поиск

Модель подключается переменными `LIVE_LLM_URL`, `LIVE_LLM_MODEL`, `LIVE_LLM_KEY`, `LIVE_LLM_MAX_ACTIVE`, `LIVE_LLM_DAILY_LIMIT`. Получателей данных перечисляет `LEGAL_PROCESSORS`, он выводится в политике конфиденциальности; при смене поставщика модели его нужно обновить.
