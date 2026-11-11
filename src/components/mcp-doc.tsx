import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import {UserMcpDoc} from "./user-mcp-doc";

const desktopConfig = `{
  "mcpServers": {
    "shisha-market": {
      "command": "node",
      "args": ["/полный/путь/к/listings.mjs"]
    }
  }
}`;

const agentLinks = (locale: Locale) => (
  <>
    <p>
      {locale === "en"
        ? "Machine-readable resources:"
        : "Машиночитаемые ресурсы:"}{" "}
      <Link className="text-link" href="/llms.txt">
        /llms.txt
      </Link>
      ,{" "}
      <Link className="text-link" href="/llms-full.txt">
        /llms-full.txt
      </Link>{" "}
      {locale === "en" ? "and the JSON status at" : "и JSON-статус"}{" "}
      <Link className="text-link" href="/ai/status">
        /ai/status
      </Link>
      {locale === "en"
        ? " with analytics and search visibility."
        : " с состоянием аналитики и поисковой видимости."}
    </p>
    <p className="muted small">
      {locale === "en"
        ? "This page is open to AI crawlers but excluded from search indexing."
        : "Страница открыта для ИИ-краулеров, но закрыта от индексации поисковиками."}
    </p>
  </>
);

function RussianDoc() {
  return (
    <section className="narrow wide page-section legal-copy mcp-page">
      <p className="eyebrow">СЛУЖЕБНОЕ</p>
      <h1 className="page-title">MCP для объявлений</h1>
      <p className="page-intro">
        Локальный MCP-сервер площадки: создаёт объявления и ведёт очередь
        модерации через служебный API. Работает только с токеном оператора и сам во ВКонтакте не
        публикует: при включённой автопубликации одобренное объявление уходит в
        сообщество проекта автоматически на стороне сервера.
      </p>

      <article className="panel">
        <h2>Что понадобится</h2>
        <ul>
          <li>Node.js 22 или новее.</li>
          <li>Один раз войдите на сайт настроенной почтой оператора и примите текущие документы. MCP использует отдельный служебный ключ, а не вход по коду для продавца.</li>
          <li>
            Токен оператора — 64 символа, его выдаёт владелец площадки. Токен
            даёт полный доступ к очереди и созданию объявлений; не публикуйте
            его.
          </li>
          <li>
            Файл клиента{" "}
            <a className="text-link" href="/mcp/listings.mjs" download>
              listings.mjs
            </a>{" "}
            — тот же файл лежит в репозитории проекта как{" "}
            <code>mcp/listings.mjs</code>.
          </li>
        </ul>
        <p>
          Токен читается из файла{" "}
          <code>~/.config/shisha-market/operator.token</code> (права{" "}
          <code>0600</code>). Путь можно переопределить переменной{" "}
          <code>SHISHA_OPERATOR_TOKEN_FILE</code>, а сам токен передать через{" "}
          <code>SHISHA_OPERATOR_TOKEN</code>. Адрес площадки по умолчанию —{" "}
          <code>https://shisha-market.com</code>; для локальной проверки задайте{" "}
          <code>SHISHA_APP_URL</code>.
        </p>
      </article>

      <article className="panel">
        <h2>Подключение</h2>
        <p>
          Клиент сам запускает процесс и общается с ним по stdio (JSON-RPC 2.0,
          стандартный newline-delimited транспорт, MCP 2025-11-25 с согласованием старых версий). Пример для Claude Desktop — добавьте сервер в
          конфигурацию MCP:
        </p>
        <pre className="code-block">{desktopConfig}</pre>
        <p className="muted small">
          macOS:{" "}
          <code>
            ~/Library/Application Support/Claude/claude_desktop_config.json
          </code>
          , Windows: <code>%APPDATA%\Claude\claude_desktop_config.json</code>.
          Другие клиенты (Cursor, собственные агенты) запускают ту же команду{" "}
          <code>node listings.mjs</code>.
        </p>
      </article>

      <article className="panel">
        <h2>Инструменты</h2>
        <h3>create_listing</h3>
        <p>
          Создаёт объявление от имени оператора. Обязательные поля: заголовок,
          описание, категория, город, цена в рублях, ссылка для связи и 1–6
          фотографий (локальные JPG/PNG/WebP, до 8 МБ суммарно). Категории: кальяны, чаши,
          аксессуары. Табак, никотин и вейпы не принимаются. По умолчанию
          объявление остаётся на модерации; <code>publish: true</code> просит
          опубликовать сразу — проверки правил площадки выполняются в обоих
          случаях. Ответ: <code>id</code> и <code>status</code>.
        </p>
        <h3>list_pending</h3>
        <p>
          Возвращает очередь на модерацию: до 50 записей, старые сверху. Каждая
          запись содержит <code>id</code>, заголовок, город, категорию, номер
          версии <code>revision</code> и даты. Номер версии — обязательный
          параметр решения.
        </p>
        <h3>get_listing и get_listing_photo</h3>
        <p>По <code>id</code> получите полный текст, цену, статус, комментарий, актуальный <code>revision</code> и список фото. Затем запросите каждое фото по <code>id</code> и <code>photoId</code>: оно придёт как изображение MCP, даже если карточка ещё закрыта. Email входа и ФИО согласия не выдаются.</p>
        <h3>update_listing и archive_listing</h3>
        <p>Работают только с собственными объявлениями оператора и требуют актуальный <code>revision</code>. Правка принимает изменяемые поля, новые фото и при необходимости <code>keepPhotoIds</code>; остальное сохраняется. Любая правка снова отправляет карточку на проверку. Снятие закрывает публикацию на сайте, но не стирает данные и существующий пост ВК. Архивную карточку так восстановить нельзя.</p>
        <p className="notice">Рекомендуемый путь: создать без публикации → открыть карточку и все фото → после человеческой проверки одобрить или вернуть на исправление. При сетевой ошибке сначала проверьте очередь — не создавайте дубликат вслепую.</p>
        <h3>moderate_listing</h3>
        <p>
          Публикует или отклоняет объявление. Нужны <code>id</code>,{" "}
          <code>decision</code> (<code>published</code> или{" "}
          <code>rejected</code>), <code>revision</code> из очереди и, для отказа,
          причина не короче трёх символов. Если автор успел изменить объявление,
          номер не совпадёт и решение будет отклонено: получите очередь заново и
          проверьте текст и фотографии. Ответ: <code>id</code> и{" "}
          <code>status</code>.
        </p>
      </article>

      <article className="panel">
        <h2>Для ИИ-агентов</h2>
        {agentLinks("ru")}
      </article>

      <article className="panel">
        <h2>Безопасность и ограничения</h2>
        <ul>
          <li>
            Без настроенного на сервере токена служебные адреса отвечают 404, при
            неверном токене — 401. Все запросы идут по HTTPS.
          </li>
          <li>
            При подозрении на утечку токен меняется на сервере, после чего старый
            перестаёт действовать.
          </li>
          <li>
            Площадка не принимает платежи и не сопровождает сделки.
            Автопубликация одобренных объявлений в сообществе ВК включается ключом
            сообщества на сервере и по умолчанию выключена.
          </li>
          <li>
            Отклонённое объявление владелец может исправить и подать заново;
            архивные объявления этой формой не восстанавливаются.
          </li>
        </ul>
        <p className="muted small">
          Страница служебная: поисковики её не индексируют.
        </p>
      </article>
    </section>
  );
}

function EnglishDoc() {
  return (
    <section className="narrow wide page-section legal-copy mcp-page">
      <p className="eyebrow">SERVICE</p>
      <h1 className="page-title">MCP for listings</h1>
      <p className="page-intro">
        The marketplace&apos;s local MCP server creates listings and runs the
        moderation queue through the operator API. It works only with an operator token and does not itself
        publish to VK: when autoposting is enabled, an approved listing is
        posted to the project community automatically on the server side.
      </p>

      <article className="panel">
        <h2>What you need</h2>
        <ul>
          <li>Node.js 22 or newer.</li>
          <li>First sign in on the website using the configured operator email and accept the current documents. MCP uses a separate operator credential, not a seller email/OTP login.</li>
          <li>
            An operator token — 64 characters, issued by the site owner. The
            token grants full access to the queue and listing creation; do not
            publish it.
          </li>
          <li>
            The client file{" "}
            <a className="text-link" href="/mcp/listings.mjs" download>
              listings.mjs
            </a>{" "}
            — the same file lives in the project repository as{" "}
            <code>mcp/listings.mjs</code>.
          </li>
        </ul>
        <p>
          The token is read from{" "}
          <code>~/.config/shisha-market/operator.token</code> (permissions{" "}
          <code>0600</code>). Override the path with{" "}
          <code>SHISHA_OPERATOR_TOKEN_FILE</code>, or pass the token itself via{" "}
          <code>SHISHA_OPERATOR_TOKEN</code>. The default site URL is{" "}
          <code>https://shisha-market.com</code>; set <code>SHISHA_APP_URL</code>{" "}
          for local checks.
        </p>
      </article>

      <article className="panel">
        <h2>Connection</h2>
        <p>
          The client starts the process and talks to it over stdio (JSON-RPC
          2.0, standard newline-delimited transport, MCP 2025-11-25 with older version negotiation). Claude Desktop example — add the server
          to the MCP configuration:
        </p>
        <pre className="code-block">{desktopConfig}</pre>
        <p className="muted small">
          macOS:{" "}
          <code>
            ~/Library/Application Support/Claude/claude_desktop_config.json
          </code>
          , Windows: <code>%APPDATA%\Claude\claude_desktop_config.json</code>.
          Other clients (Cursor, custom agents) start the same command{" "}
          <code>node listings.mjs</code>.
        </p>
      </article>

      <article className="panel">
        <h2>Tools</h2>
        <h3>create_listing</h3>
        <p>
          Creates a listing as the operator. Required fields: title,
          description, category, city, price in rubles, contact link and 1–6
          photos (local JPG/PNG/WebP paths, up to 8 MB combined). Categories: hookahs, bowls,
          accessories. Tobacco, nicotine and vapes are not accepted. By default
          the listing stays pending; <code>publish: true</code> asks to publish
          immediately — the platform rules are checked in both cases. Response:{" "}
          <code>id</code> and <code>status</code>.
        </p>
        <h3>list_pending</h3>
        <p>
          Returns the moderation queue: up to 50 records, oldest first. Each
          record contains <code>id</code>, title, city, category, revision and
          dates. The revision number is a required decision parameter.
        </p>
        <h3>get_listing and get_listing_photo</h3>
        <p>Use <code>id</code> to inspect the full text, price, status, moderation note, current <code>revision</code> and photo IDs. Fetch each photo with <code>id</code> and <code>photoId</code> as MCP image content, including private pending photos. Login email and consent full name are not exposed.</p>
        <h3>update_listing and archive_listing</h3>
        <p>Only operator-owned listings may be changed, using the current <code>revision</code>. Supply fields to change, optional new photos and <code>keepPhotoIds</code>; omitted fields/photos stay unchanged. Every edit returns to review. Archiving hides the listing on the site, not physical deletion or removal of existing VK posts. Archived listings cannot be restored this way.</p>
        <p className="notice">Recommended path: create without publishing → inspect the text and every photo → obtain human approval or request corrections. After a network timeout inspect the queue first; do not blindly create a duplicate.</p>
        <h3>moderate_listing</h3>
        <p>
          Publishes or rejects a listing. Requires <code>id</code>,{" "}
          <code>decision</code> (<code>published</code> or{" "}
          <code>rejected</code>), <code>revision</code> from the queue and, for
          rejection, a reason of at least three characters. If the author edits
          the listing first, the number will not match and the decision is
          refused: fetch the queue again and review the text and photos.
          Response: <code>id</code> and <code>status</code>.
        </p>
      </article>

      <article className="panel">
        <h2>For AI agents</h2>
        {agentLinks("en")}
      </article>

      <article className="panel">
        <h2>Security and limits</h2>
        <ul>
          <li>
            Without a token configured on the server, the operator endpoints
            answer 404; with a wrong token, 401. All requests go over HTTPS.
          </li>
          <li>
            If the token leaks, it is rotated on the server and the old one
            stops working.
          </li>
          <li>
            The platform does not take payments and does not support deals.
            Autoposting of approved listings to the VK community is enabled with a
            community key on the server and is off by default.
          </li>
          <li>
            The owner can fix a rejected listing and submit it again; archived
            listings are not restored by this form.
          </li>
        </ul>
        <p className="muted small">
          This page is a service page: search engines do not index it.
        </p>
      </article>
    </section>
  );
}

export function McpDoc({ locale }: { locale: Locale }) {
  return <UserMcpDoc locale={locale} />;
}
export function OperatorMcpDoc({ locale }: { locale: Locale }) {
  return locale === "en" ? <EnglishDoc /> : <RussianDoc />;
}
