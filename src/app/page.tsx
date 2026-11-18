import Link from "next/link";
import {
  ArrowUpRight, Bell, Bookmark, Compass, Home, Orbit, ShieldCheck,
  Sparkles, Users, Search
} from "lucide-react";
import {AuthNavigation} from "@/components/auth-navigation";
import {LiveFeed} from "@/components/live-feed";
import {PostComposer} from "@/components/post-composer";
import {ThemeToggle} from "@/components/theme-toggle";

const navigation=[
  {href:"/",label:"Главная",icon:Home},
  {href:"/explore",label:"Обзор",icon:Search},
  {href:"/clans",label:"Сообщества",icon:Users},
  {href:"/notifications",label:"Уведомления",icon:Bell},
  {href:"/bookmarks",label:"Закладки",icon:Bookmark},
];

export default function HomePage() {
  return <main className="orb-shell">
    <div className="orb-layout">
      <aside className="orb-sidebar" aria-label="Основная навигация">
        <Link href="/" className="orb-brand" aria-label="ORBIS — главная">
          <span className="orb-brand-mark"><Orbit size={23} strokeWidth={2}/></span>
          <span>ORBIS</span>
        </Link>
        <nav className="orb-nav">
          {navigation.map(({href,label,icon:Icon},index)=><Link
            key={href} href={href} className={index===0?"orb-nav-link is-active":"orb-nav-link"}>
            <Icon size={21} strokeWidth={1.8}/><span>{label}</span>
          </Link>)}
        </nav>
        <div className="orb-sidebar-note">
          <span className="orb-note-icon"><ShieldCheck size={17}/></span>
          <div><strong>Твоё пространство</strong><p>Публикуй идеи, находи людей и сохраняй важное.</p></div>
        </div>
        <div className="orb-sidebar-bottom">
          <div className="orb-online-line"><span className="orb-live-dot"/><span>Только для зарегистрированных участников</span></div>
          <span className="orb-copyright">ORBIS · YOUR WORLD. YOUR VOICE.</span>
        </div>
      </aside>

      <section className="orb-center">
        <header className="orb-center-header">
          <Link href="/" className="orb-mobile-brand"><span className="orb-brand-mark"><Orbit size={21}/></span><span>ORBIS</span></Link>
          <div className="orb-center-heading"><div className="orb-eyebrow">ТВОЯ ОРБИТА</div><h1>Главная</h1></div>
          <div className="orb-header-actions"><AuthNavigation/><ThemeToggle/></div>
        </header>
        <div className="orb-feed-intro">
          <div><span className="orb-live-dot"/><span>СЕЙЧАС В ORBIS</span></div>
          <p>Мысли, открытия и публикации сообщества.</p>
        </div>
        <PostComposer/>
        <div className="orb-stream-heading" id="feed">
          <div><h2>Лента</h2><p>Публикации людей, на которых ты подписан, и открытые темы</p></div>
          <span className="orb-stream-badge"><Compass size={14}/> Открытая</span>
        </div>
        <LiveFeed/>
      </section>

      <aside className="orb-right">
        <section className="orb-right-card orb-welcome-card">
          <div className="orb-card-kicker"><Sparkles size={15}/> ORBIS COMMUNITY</div>
          <h2>Идеи становятся интереснее, когда ими делятся.</h2>
          <p>Публикуй то, что важно, и открывай новые взгляды через людей и их истории.</p>
          <a href="#feed" className="orb-text-link">Исследовать ленту <ArrowUpRight size={15}/></a>
        </section>
        <section className="orb-right-card">
          <div className="orb-right-title"><Users size={17}/><h3>Сообщества</h3></div>
          <p className="orb-muted-copy">Найди людей с общими интересами, вступай в кланы и создавай своё сообщество.</p>
          <Link href="/explore" className="orb-secondary-link">Открыть обзор <ArrowUpRight size={14}/></Link>
        </section>
        <section className="orb-right-card orb-safety-card">
          <div className="orb-right-title"><ShieldCheck size={17}/><h3>Твой аккаунт под защитой</h3></div>
          <p className="orb-muted-copy">Вход в ORBIS сохраняется на устройстве. Для восстановления используй резервный файл и секретный код.</p>
          <Link href="/login" className="orb-secondary-link">Вход и восстановление <ArrowUpRight size={14}/></Link>
        </section>
        <div className="orb-right-footer"><span>ORBIS</span><span>Делись идеями. Слушай других.</span></div>
      </aside>
    </div>

    <nav className="orb-mobile-nav" aria-label="Мобильная навигация">
      <Link href="/" className="is-active"><Home size={20}/><span>Лента</span></Link>
      <Link href="/clans"><Users size={20}/><span>Кланы</span></Link>
      <Link href="/notifications"><Bell size={20}/><span>События</span></Link>
      <Link href="/bookmarks"><Bookmark size={20}/><span>Сохранено</span></Link>
    </nav>
  </main>;
}
