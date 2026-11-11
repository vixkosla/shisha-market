"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="empty-state page-section">
      <h1 className="page-title">Не удалось загрузить страницу</h1>
      <p>Проверьте подключение. Если ошибка повторяется, попробуйте позже.</p>
      <button className="button button-primary" onClick={reset}>
        Повторить
      </button>
    </section>
  );
}
