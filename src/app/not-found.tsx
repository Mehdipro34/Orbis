import Link from "next/link";
export default function NotFound() {
  return <main className="app-frame"><section className="feed-state-card">
    <strong>Страница не найдена</strong><p>Проверь адрес или вернись к публичной ленте ORBIS.</p>
    <Link href="/" className="primary-button">На главную</Link>
  </section></main>;
}
