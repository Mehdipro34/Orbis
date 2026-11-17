import Link from "next/link";
import {ArrowUpRight,Globe2,Orbit,ShieldCheck,Sparkles} from "lucide-react";
import {LiveFeed} from "@/components/live-feed";
import {PostComposer} from "@/components/post-composer";
import {ThemeToggle} from "@/components/theme-toggle";
import {AuthNavigation} from "@/components/auth-navigation";
import {currentProductionUrl} from "@/lib/orbis/config";

export default function HomePage() {
  return <div className="app-frame">
    <header className="topbar">
      <Link href="/" className="brand" aria-label="ORBIS — главная">
        <span className="brand-mark"><Orbit size={22} strokeWidth={2.1} aria-hidden="true"/></span><span>ORBIS</span>
      </Link>
      <nav className="top-navigation" aria-label="Основная навигация">
        <a href="#feed" className="top-navigation-link active">Лента</a>
        <Link href="/clans" className="top-navigation-link">Кланы</Link>
        <Link href="/notifications" className="top-navigation-link">Уведомления</Link>
        <Link href="/bookmarks" className="top-navigation-link">Закладки</Link>
        <a href="#about" className="top-navigation-link">О проекте</a>
      </nav>
      <div className="topbar-actions">
        <AuthNavigation/>
        <ThemeToggle/>
        <a className="primary-button topbar-legacy-link" href={currentProductionUrl} target="_blank" rel="noreferrer">
          Действующая версия <ArrowUpRight size={16} aria-hidden="true"/>
        </a>
      </div>
    </header>

    <main className="main-layout">
      <section className="main-column">
        <div className="hero-panel">
          <div className="hero-orbit" aria-hidden="true"><Orbit size={150} strokeWidth={0.8}/></div>
          <div className="eyebrow"><span className="status-dot"/> ORBIS · НОВАЯ ВЕРСИЯ</div>
          <h1>Твои идеи заслуживают <span>своей орбиты.</span></h1>
          <p className="hero-copy">Публичная лента ORBIS подключена к действующей базе данных. Новые модули создаются постепенно, не затрагивая существующие аккаунты.</p>
          <div className="hero-actions">
            <a href="#feed" className="primary-button">Смотреть публикации <ArrowUpRight size={16} aria-hidden="true"/></a>
            <span className="hero-note"><ShieldCheck size={15} aria-hidden="true"/> Публичные данные · Без авторизации</span>
          </div>
        </div>
        <PostComposer/>
        <div id="feed" className="section-heading">
          <div><div className="eyebrow">СООБЩЕСТВО ORBIS</div><h2>Что происходит</h2></div>
          <span className="live-label"><span className="status-dot"/> Live feed</span>
        </div>
        <LiveFeed/>
      </section>

      <aside className="right-column" id="about">
        <section className="side-panel about-panel">
          <div className="side-panel-icon"><Sparkles size={19} aria-hidden="true"/></div>
          <div className="eyebrow">ФИЛОСОФИЯ</div>
          <h2>Одна сеть. Множество интересов.</h2>
          <p>ORBIS создаётся как пространство для мыслей, полезных открытий и общения между людьми.</p>
        </section>
        <section className="side-panel">
          <div className="side-panel-heading"><Globe2 size={17} aria-hidden="true"/><h3>Принципы платформы</h3></div>
          <div className="principle-row"><span>01</span><div><strong>Надёжность</strong><small>Данные остаются в основной базе ORBIS.</small></div></div>
          <div className="principle-row"><span>02</span><div><strong>Безопасность</strong><small>Публичная лента не раскрывает личное состояние аккаунта.</small></div></div>
          <div className="principle-row"><span>03</span><div><strong>Развитие</strong><small>Новые модули проходят проверки отдельно от production.</small></div></div>
        </section>
        <section className="side-panel current-version-panel">
          <div className="eyebrow">УЖЕ ДОСТУПНО</div>
          <h3>Основное приложение ORBIS</h3>
          <p>Регистрация, профили, публикации, фотографии и социальные действия продолжают работать в текущей версии.</p>
          <a href={currentProductionUrl} target="_blank" rel="noreferrer" className="text-link">Перейти в ORBIS <ArrowUpRight size={15} aria-hidden="true"/></a>
        </section>
      </aside>
    </main>

    <footer className="footer">
      <span className="footer-brand">ORBIS</span>
      <span>Твои идеи заслуживают аудитории.</span>
      <span>Новая версия развивается отдельно от действующего приложения.</span>
    </footer>
  </div>;
}
