"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useEffect,useState} from "react";
import {
  Activity, Bell, Bookmark, Compass, Home, Orbit, Search, Shield,
  Users, Sparkles
} from "lucide-react";
import {AuthNavigation} from "@/components/auth-navigation";
import {ThemeToggle} from "@/components/theme-toggle";

const links=[
  {href:"/",label:"Главная",icon:Home},
  {href:"/explore",label:"Обзор",icon:Search},
  {href:"/clans",label:"Сообщества",icon:Users},
  {href:"/notifications",label:"Уведомления",icon:Bell},
  {href:"/bookmarks",label:"Закладки",icon:Bookmark}
];

const titles:Record<string,string>={
  "/explore":"Обзор",
  "/clans":"Сообщества",
  "/notifications":"Уведомления",
  "/bookmarks":"Закладки",
  "/admin":"Администрирование"
};

export function SocialShell({children}:{children:React.ReactNode}){
  const pathname=usePathname();
  const [admin,setAdmin]=useState(false);
  const [adminChecked,setAdminChecked]=useState(false);

  useEffect(()=>{
    let active=true;
    void fetch("/api/admin/status",{cache:"no-store"})
      .then(async response=>response.ok?await response.json():null)
      .then(payload=>{
        if(active){setAdmin(Boolean(payload?.isAdmin));setAdminChecked(true);}
      }).catch(()=>{if(active)setAdminChecked(true);});
    return ()=>{active=false;};
  },[pathname]);

  if(pathname==="/"||pathname==="/login"||pathname==="/register"){
    return <>{children}</>;
  }

  const heading=titles[pathname]||
    (pathname.startsWith("/u/")?"Профиль":"ORBIS");
  return <div className="social-shell">
    <aside className="social-sidebar">
      <Link href="/" className="social-wordmark" aria-label="ORBIS — главная">
        <span className="social-mark"><Orbit size={23}/></span><span>ORBIS</span>
      </Link>
      <nav className="social-nav" aria-label="Основная навигация">
        {links.map(item=>{
          const Icon=item.icon;
          const active=pathname===item.href||
            (item.href!=="/"&&pathname.startsWith(item.href+"/"));
          return <Link key={item.href} href={item.href}
            className={active?"social-nav-item active":"social-nav-item"}>
            <Icon size={22} strokeWidth={active?2.3:1.8}/><span>{item.label}</span>
          </Link>;
        })}
        {admin&&<Link href="/admin" className={pathname.startsWith("/admin")?"social-nav-item active":"social-nav-item"}>
          <Shield size={22}/><span>Администрирование</span>
        </Link>}
      </nav>
      <Link href="/explore" className="social-compose-button"><Sparkles size={17}/> Исследовать ORBIS</Link>
      <div className="social-sidebar-bottom">
        <div className="social-live"><span/> ORBIS · ЖИВОЕ СООБЩЕСТВО</div>
        <span>Твои идеи. Твой круг.</span>
      </div>
    </aside>

    <main className="social-main">
      <header className="social-main-header">
        <div className="social-main-title">
          <h1>{heading}</h1>
          <span>ORBIS</span>
        </div>
        <div className="social-main-actions">
          <AuthNavigation/>
          <ThemeToggle/>
        </div>
      </header>
      <div className="social-main-content">{children}</div>
    </main>

    <aside className="social-aside">
      <div className="social-search-card">
        <Search size={17}/><Link href="/explore">Поиск и открытие</Link>
      </div>
      <section className="social-aside-card">
        <div className="social-aside-kicker"><Activity size={15}/> ORBIS NOW</div>
        <h2>Всё интересное — рядом</h2>
        <p>Находи новые темы, читай, следи за спортом, открывай книги и идеи сообщества.</p>
        <Link href="/explore">Перейти в обзор →</Link>
      </section>
      <section className="social-aside-card social-aside-simple">
        <strong>Твоя орбита</strong>
        <p>Публикуй мысли, сохраняй важное и общайся уважительно.</p>
      </section>
      <div className="social-aside-footer">ORBIS · YOUR WORLD. YOUR VOICE.</div>
    </aside>

    <nav className="social-mobile-nav" aria-label="Навигация">
      {links.slice(0,5).map(item=>{
        const Icon=item.icon;
        return <Link key={item.href} href={item.href}
          className={pathname===item.href?"active":""} aria-label={item.label}>
          <Icon size={21}/>
        </Link>;
      })}
    </nav>
  </div>;
}
