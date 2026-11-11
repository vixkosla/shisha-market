import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-client";
import { currentUser } from "@/server/session";
import { vkEnabled } from "@/server/auth";
import { authenticationEnabled } from "@/server/auth-policy";
import Link from "next/link";
import { safeLoginReturn } from "@/lib/login-return";
export const metadata = { title: "Вход" };
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ renew?: string; next?: string }>;
}) {
  const params = await searchParams;
  const renewing = params.renew === "1";
  const returnTo = safeLoginReturn(params.next);
  if ((await currentUser()) && !renewing) redirect(returnTo);
  return (
    <section className="narrow page-section">
      <p className="eyebrow">ВХОД И РЕГИСТРАЦИЯ</p>
      <h1 className="page-title">Войти в маркет</h1>
      <p className="page-intro">
        Без пароля: отправим код на почту. Если вы впервые здесь, аккаунт
        создастся после подтверждения email.
      </p>
      {returnTo === "/listings/new" && <p className="notice">После входа сразу откроется форма объявления: фотографии, описание и контакт для связи.</p>}
      <div className="panel">
        {renewing && (
          <p className="notice">
            Для новой публикации нужно подтвердить вход и принять актуальную
            редакцию документов. Обращения и отзыв согласия остаются доступны в
            существующей сессии.
          </p>
        )}
        {authenticationEnabled() ? (
          <LoginForm
            returnTo={returnTo}
            vk={vkEnabled()}
            local={
              process.env.NODE_ENV !== "production" &&
              (process.env.MAIL_MODE ?? "console") === "console"
            }
          />
        ) : (
          <p>
            Готовим площадку к запуску. Вход и подача объявлений откроются после
            настройки почты, реквизитов оператора и проверки схемы обработки
            данных.{" "}
            <Link className="text-link" href="/legal">
              Правила и условия запуска →
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}
