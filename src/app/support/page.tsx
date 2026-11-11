import Link from "next/link";
import { currentUser } from "@/server/session";
import { getDatabase } from "@/server/db";
import { requestsFor } from "@/server/support";
import { requestKinds } from "@/lib/legal";
import { legalConfiguration } from "@/server/legal-policy";
import { SupportForm } from "@/components/support-form";
import { SuggestionForm } from "@/components/suggestion-form";
import {EXTERNAL_LISTINGS} from "@/lib/external-listings";

export const metadata = { title: "Обращения и жалобы" };
export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ listing?: string; external?: string }>;
}) {
  const actor = await currentUser();
  const { listing, external } = await searchParams;
  const externalListing = EXTERNAL_LISTINGS.find(item => item.id === external);
  const requests = actor ? await requestsFor(await getDatabase(), actor) : [];
  const { email } = legalConfiguration();
  return (
    <section className="narrow wide page-section legal-copy">
      <h1 className="page-title">Обращения и жалобы</h1>
      <p>
        Сообщите о нарушении, обжалуйте модерацию или направьте запрос о своих
        данных. <Link href="/legal/privacy">Как обрабатываются обращения</Link>.
      </p>
      {externalListing && <aside className="notice" id="external-report">
        <h2>Внешнее объявление: {externalListing.title}</h2>
        <p>Если предложение устарело, содержит ошибку или его нужно удалить из подборки, напишите оператору. Аккаунт на Shisha Market не нужен.</p>
        <p><a className="text-link" href={externalListing.sourceUrl} target="_blank" rel="noopener noreferrer">Оригинал объявления ↗</a></p>
        {email && <a className="text-link" href={`mailto:${email}?subject=${encodeURIComponent(`Внешнее объявление: ${externalListing.title}`)}&body=${encodeURIComponent(`Карточка: ${externalListing.id}\nИсточник: ${externalListing.sourceUrl}\n\nЧто нужно исправить или удалить:\n`)}`}>Сообщить об объявлении по почте</a>}
      </aside>}
      <h2>Предложение площадке</h2>
      <p>
        Идея, замечание по интерфейсу или что не хватает. Вход не нужен.
        Объявление через эту форму не публикуется.
      </p>
      <SuggestionForm />
      <h2>Обращения по аккаунту</h2>
      {actor ? (
        <SupportForm
          listingId={typeof listing === "string" ? listing.slice(0, 36) : ""}
        />
      ) : (
        <p className="notice">
          <Link href="/login">Войдите</Link>, чтобы создать обращение и видеть
          ответ. Для обращения без аккаунта используйте email оператора.
        </p>
      )}
      {email ? (
        <p>
          <a className="text-link" href={`mailto:${email}`}>
            Написать оператору: {email}
          </a>
        </p>
      ) : (
        <p className="notice">
          Рабочий email оператора ещё не указан. Внешние обращения пока не
          принимаются; публичная регистрация закрыта.
        </p>
      )}
      {actor && (
        <>
          <h2>Мои обращения</h2>
          <p className="muted small">
            Последние 100 обращений, сначала новые. Более ранний ответ можно
            запросить по email оператора, указав номер обращения.
          </p>
          {!requests.length && (
            <p className="muted">Вы ещё не отправляли обращений.</p>
          )}
          {requests.map((item) => (
            <article className="panel" key={item.id}>
              <h3>
                {requestKinds[item.kind as keyof typeof requestKinds]} ·{" "}
                {item.status === "open" ? "На рассмотрении" : "Рассмотрено"}
              </h3>
              <p className="muted small">Номер: {item.id}</p>
              <p className="description">{item.message}</p>
              {item.resolution && (
                <p className="notice">Ответ: {item.resolution}</p>
              )}
            </article>
          ))}
        </>
      )}
    </section>
  );
}
