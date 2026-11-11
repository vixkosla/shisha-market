import Link from "next/link";
export default function NotFound() {
  return (
    <section className="empty-state page-section">
      <p className="eyebrow">404</p>
      <h1 className="page-title">Здесь пока ничего нет</h1>
      <p>Страница отсутствует или недоступна вашему аккаунту.</p>
      <Link className="button button-primary" href="/">
        К объявлениям
      </Link>
    </section>
  );
}
