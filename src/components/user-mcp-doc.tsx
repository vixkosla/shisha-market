import Link from "next/link";
import type {Locale} from "@/lib/i18n";

export function UserMcpDoc({locale}: {locale: Locale}) {
  const en = locale === "en";
  const config = JSON.stringify({mcpServers: {"shisha-market": {command: "node", args: [en ? "/full/path/to/user.mjs" : "/полный/путь/к/user.mjs"]}}}, null, 2);
  return <section className="narrow wide page-section legal-copy mcp-page">
    <p className="eyebrow">{en ? "YOUR ACCOUNT · YOUR AI ASSISTANT" : "ВАШ АККАУНТ · ВАШ ИИ-ПОМОЩНИК"}</p>
    <h1 className="page-title">{en ? "MCP for your listings" : "Объявления через ИИ"}</h1>
    <p className="page-intro">{en ? "Connect your assistant to your Shisha Market account. Ask it to prepare a listing, attach your photos, check its status or make corrections. You sign in yourself; the assistant only gets access to your listings." : "Подключите своего помощника к аккаунту Shisha Market. Попросите подготовить объявление, приложить ваши фотографии, узнать статус или внести правки. Вы входите сами; помощник получает доступ только к вашим объявлениям."}</p>
    <article className="panel"><h2>{en ? "1. Add Shisha Market to your assistant" : "1. Добавьте Shisha Market в помощника"}</h2>
      <p>{en ? "Use a client that supports local MCP servers and Node.js 22 or newer." : "Нужны помощник с поддержкой локальных MCP-серверов и Node.js 22 или новее."}</p>
      <p><a className="button button-primary" href="/mcp/user.mjs" download="user.mjs">{en ? "Download user.mjs" : "Скачать user.mjs"}</a></p>
      <p><a className="text-link" href="https://github.com/vixkosla/shisha-market-mcp">{en ? "Source code, releases and installation on GitHub →" : "Исходный код, версии и установка на GitHub →"}</a></p>
      <p>{en ? "Save the file, then add this configuration in your client's MCP settings. Replace the path with the location of your downloaded file." : "Сохраните файл и добавьте эту настройку в раздел MCP вашего помощника. Укажите полный путь к скачанному файлу."}</p>
      <pre className="code-block">{config}</pre>
      <p className="muted small">{en ? "This is a local stdio connection. Entering the documentation URL as a remote MCP server will not connect it." : "Это локальное подключение через stdio. Адрес этой страницы не является URL удалённого MCP-сервера."}</p>
    </article>
    <article className="panel"><h2>{en ? "2. Sign in to your account" : "2. Войдите в свой аккаунт"}</h2>
      <p>{en ? "Tell your assistant: “Connect my Shisha Market account.” It will give you a link and an eight-character code. Open the link, sign in by email, enter the code and approve access. Return to the assistant and ask it to finish connecting." : "Напишите помощнику: «Подключи мой аккаунт Shisha Market». Он даст ссылку и код из восьми символов. Откройте ссылку, войдите по почте, введите код и подтвердите доступ. Вернитесь к помощнику и попросите завершить подключение."}</p>
      <p>{en ? "Your personal access is saved on your computer for up to 90 days. You do not need an administrator or operator key. Each connection can be revoked in your account." : "Личный доступ сохраняется на вашем компьютере на срок до 90 дней. Получать ключ у администратора не нужно. Каждое подключение можно отозвать в кабинете."}</p>
      <Link className="text-link" href="/account/mcp">{en ? "Manage my AI assistants →" : "Мои ИИ-агенты и отзыв доступа →"}</Link>
    </article>
    <article className="panel"><h2>{en ? "3. Prepare your listing" : "3. Подготовьте объявление"}</h2>
      <p>{en ? "Give the assistant your description and selected photo files. Review the final text, price, location and contact link. Confirm the separate publication consents for that listing. The assistant submits it for moderation; the status and moderator's comment remain available in your account and through MCP." : "Передайте помощнику описание вещи и выбранные файлы фотографий. Проверьте итоговый текст, цену, город и ссылку для связи. Подтвердите отдельные согласия для этого объявления. Помощник отправит его на модерацию; статус и комментарий модератора будут доступны в кабинете и через MCP."}</p>
      <p>{en ? "The same publication rules apply as on the website. The assistant cannot approve listings, read other users' private data or restore withdrawn publications." : "Действуют те же правила, что при подаче через сайт. Помощник не может одобрять объявления, читать чужие закрытые данные или восстанавливать снятые публикации."}</p>
      <Link className="text-link" href={en ? "/en/legal/rules" : "/legal/rules"}>{en ? "Publication rules →" : "Правила публикации →"}</Link>
    </article>
    <article className="panel"><h2>{en ? "For AI agents" : "Для ИИ-агентов"}</h2>
      <p><code>connect_account → finish_connection → get_account</code></p>
      <p><code>get_publication_rules</code>, <code>list_my_listings</code>, <code>create_listing</code>, <code>get_listing</code>, <code>get_listing_photo</code>, <code>update_listing</code>, <code>archive_listing</code>, <code>disconnect_account</code>.</p>
      <p>{en ? "Account access is not publication consent. Use the user's explicit choices for each listing. After a timeout, inspect their listings before attempting creation again." : "Подключение аккаунта не заменяет согласия на публикацию. Для каждого объявления нужны явные решения пользователя. После сетевой ошибки сначала проверьте его объявления, чтобы не создать дубликат."}</p>
      <p><Link className="text-link" href="/llms.txt">/llms.txt</Link> · <Link className="text-link" href="/llms-full.txt">/llms-full.txt</Link> · <Link className="text-link" href="/ai/status">/ai/status</Link></p>
    </article>
    <p className="muted small"><Link className="text-link" href={en ? "/en/mcp/operator" : "/mcp/operator"}>{en ? "Separate operator documentation" : "Отдельная инструкция для оператора площадки"}</Link></p>
  </section>;
}
