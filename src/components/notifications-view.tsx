"use client";

import Link from "next/link";
import {useCallback,useEffect,useState} from "react";
import {Bell,Check,LoaderCircle,RefreshCw,UserRound} from "lucide-react";

type Actor={username:string;display_name:string;avatar_url?:string|null};
type Notification={id:string;kind:string;body:string;created_at:string;read_at:string|null;actor:Actor|null};

function isRecord(v:unknown):v is Record<string,unknown>{return typeof v==="object"&&v!==null&&!Array.isArray(v);}
function formatDate(value:string){
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"Недавно":new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(date);
}

export function NotificationsView(){
  const [rows,setRows]=useState<Notification[]>([]);
  const [unread,setUnread]=useState(0);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState("");
  const [signedIn,setSignedIn]=useState(true);

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const response=await fetch("/api/notifications",{cache:"no-store"});
      const payload:unknown=await response.json().catch(()=>({}));
      if(response.status===401){setSignedIn(false);setRows([]);return;}
      if(!response.ok)throw new Error(isRecord(payload)&&typeof payload.error==="string"?payload.error:"Не удалось загрузить уведомления.");
      if(!isRecord(payload)||!Array.isArray(payload.notifications))throw new Error("Сервер вернул некорректные уведомления.");
      const parsed=payload.notifications.flatMap((value):Notification[]=>{
        if(!isRecord(value)||typeof value.id!=="string"||typeof value.kind!=="string"||typeof value.body!=="string"||typeof value.created_at!=="string")return [];
        const actor=isRecord(value.actor)&&typeof value.actor.username==="string"
          ?{username:value.actor.username,display_name:typeof value.actor.display_name==="string"?value.actor.display_name:"Участник",avatar_url:typeof value.actor.avatar_url==="string"?value.actor.avatar_url:null}
          :null;
        return [{id:value.id,kind:value.kind,body:value.body,created_at:value.created_at,read_at:typeof value.read_at==="string"?value.read_at:null,actor}];
      });
      setSignedIn(true);setRows(parsed);setUnread(typeof payload.unread==="number"?payload.unread:parsed.filter(x=>!x.read_at).length);
    }catch(value){setError(value instanceof Error?value.message:"Не удалось загрузить уведомления.");}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{void load();},[load]);

  async function markRead(id?:string){
    const key=id||"all";
    if(busy)return;
    setBusy(key);setError("");
    try{
      const response=await fetch("/api/notifications/read",{
        method:"POST",cache:"no-store",headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify(id?{id}:{})
      });
      const payload:unknown=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(isRecord(payload)&&typeof payload.error==="string"?payload.error:"Не удалось отметить уведомление прочитанным.");
      if(!isRecord(payload)||payload.ok!==true)throw new Error("Сервер не подтвердил изменение уведомления.");
      setRows(current=>current.map(item=>!id||item.id===id?{...item,read_at:new Date().toISOString()}:item));
      setUnread(current=>id?Math.max(0,current-1):0);
    }catch(value){setError(value instanceof Error?value.message:"Не удалось обновить уведомления.");}
    finally{setBusy(null);}
  }

  return <div className="app-frame community-page">
    <header className="profile-topbar">
      <Link href="/" className="profile-back">← На главную</Link>
      <span className="profile-brand">ORBIS</span>
      <Link href="/clans" className="community-top-link">Кланы</Link>
    </header>
    <section className="community-title-row">
      <div><div className="eyebrow">ВАША АКТИВНОСТЬ</div><h1>Уведомления</h1><p>Ответы, реакции и другие события аккаунта.</p></div>
      <div className="community-title-icon"><Bell size={24}/></div>
    </section>
    {!signedIn&&!loading&&<div className="community-state"><strong>Нужен вход в ORBIS</strong><p>Уведомления доступны только владельцу аккаунта.</p><Link href="/login" className="primary-button">Войти</Link></div>}
    {signedIn&&<>
      <div className="community-toolbar">
        <span>{unread} непрочитанных</span>
        <div><button type="button" className="secondary-button" onClick={()=>void load()} disabled={loading}><RefreshCw size={14}/> Обновить</button>
        <button type="button" className="secondary-button" onClick={()=>void markRead()} disabled={busy!==null||unread===0}>{busy==="all"?<LoaderCircle size={14} className="spin"/>:<Check size={14}/>} Прочитать все</button></div>
      </div>
      {error&&<p className="community-error" role="alert">{error}</p>}
      {loading&&<div className="profile-loading"><LoaderCircle className="spin" size={20}/> Загружаем уведомления…</div>}
      {!loading&&rows.length===0&&!error&&<div className="community-state"><Bell size={25}/><strong>Пока тихо</strong><p>Новые события аккаунта появятся здесь.</p></div>}
      {!loading&&rows.map(item=><article className={item.read_at?"notification-item":"notification-item unread"} key={item.id}>
        <div className="notification-avatar"><UserRound size={17}/></div>
        <div className="notification-content">
          <p>{item.body}</p>
          <div className="notification-meta">
            {item.actor&&<Link href={"/u/"+encodeURIComponent(item.actor.username)}>@{item.actor.username}</Link>}
            <time dateTime={item.created_at}>{formatDate(item.created_at)}</time>
            <span>{item.kind}</span>
          </div>
        </div>
        {!item.read_at&&<button type="button" className="notification-read" onClick={()=>void markRead(item.id)} disabled={busy!==null} aria-label="Отметить прочитанным" title="Отметить прочитанным"><Check size={15}/></button>}
      </article>)}
    </>}
  </div>;
}
