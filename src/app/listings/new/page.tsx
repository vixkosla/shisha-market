import { requireUser } from "@/server/session";
import { ListingComposer } from "@/components/listing-composer";
import { smartAtlas } from "@/server/listing-atlas";
import Link from "next/link";
import { allowedMarkets } from "@/server/legal-policy";
import { hasCurrentAccountAcceptance } from "@/server/legal-acceptance";
import { getDatabase } from "@/server/db";
import { redirect } from "next/navigation";
import { loginHref } from "@/lib/login-return";
export const metadata = { title: "Подать объявление" };
export default async function NewPage() {
  const actor = await requireUser("/listings/new");
  if (!(await hasCurrentAccountAcceptance(await getDatabase(), actor.id)))
    redirect(loginHref("/listings/new", true));
  const markets = allowedMarkets();
  return (
    <section className="page-section">
      <p className="eyebrow">НОВАЯ ИСТОРИЯ</p>
      <h1 className="page-title">Ваше объявление</h1>
      <p className="page-intro">
        Расскажите о вещи так, как хотели бы узнать о ней сами. Справа видно, как объявление будет выглядеть.
      </p>
      {markets.length ? (
        <ListingComposer markets={markets} draftKey={`shisha:listing-draft:${actor.id}`} atlas={smartAtlas()} />
      ) : (
        <p className="notice">
          Публикация пока закрыта. <Link href="/legal">Условия запуска</Link>.
        </p>
      )}
    </section>
  );
}
