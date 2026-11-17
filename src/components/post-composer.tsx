"use client";

import {FormEvent,useEffect,useState} from "react";
import {ArrowUpRight,LoaderCircle,PenLine} from "lucide-react";

type AuthUser={username:string;name?:string};

function isAuthUser(value:unknown):value is AuthUser {
  return typeof value==="object" && value!==null &&
    "username" in value && typeof value.username==="string";
}

export function PostComposer() {
  const [user,setUser]=useState<AuthUser|null>(null);
  const [ready,setReady]=useState(false);
  const [body,setBody]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");

  useEffect(()=>{
    let active=true;
    void fetch("/api/auth/me",{cache:"no-store"})
      .then(async response=>{
        if(!response.ok) return null;
        const payload:unknown=await response.json();
        if(typeof payload!=="object" || payload===null || !("user" in payload)) return null;
        return isAuthUser(payload.user)?payload.user:null;
      })
      .catch(()=>null)
      .then(value=>{
        if(active) {setUser(value);setReady(true);}
      });
    return ()=>{active=false;};
  },[]);

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busy) return;
    const text=body.trim();
    if(!text) {setError("Напиши текст перед публикацией.");return;}
    if(text.length>500) {setError("Максимум 500 символов.");return;}

    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response=await fetch("/api/posts",{
        method:"POST",
        cache:"no-store",
        headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify({body:text,topic:"Global"})
      });
      const payload:unknown=await response.json().catch(()=>({}));
      const row=typeof payload==="object" && payload!==null
        ?payload as Record<string,unknown>:{};
      if(!response.ok) {
        throw new Error(typeof row.error==="string"?row.error:"Не удалось сохранить публикацию.");
      }
      const post=row.post;
      if(row.ok!==true || typeof post!=="object" || post===null ||
        !("id" in post) || typeof post.id!=="string") {
        throw new Error("Сервер не подтвердил сохранение публикации.");
      }
      setBody("");
      setSuccess("Публикация сохранена и отправлена в общую ленту.");
      window.dispatchEvent(new CustomEvent("orbis-post-created",{detail:post}));
    } catch(value) {
      setError(value instanceof Error?value.message:"Не удалось опубликовать запись.");
    } finally {
      setBusy(false);
    }
  }

  if(!ready || !user) return null;

  return <section className="composer-panel" aria-labelledby="composer-title">
    <div className="composer-heading">
      <span className="composer-icon"><PenLine size={17} aria-hidden="true"/></span>
      <div><h2 id="composer-title">Новая публикация</h2><p>Поделись мыслью с сообществом ORBIS</p></div>
      <span className="composer-account">@{user.username}</span>
    </div>
    <form onSubmit={event=>void submit(event)}>
      <label className="sr-only" htmlFor="orbis-post-body">Текст публикации</label>
      <textarea id="orbis-post-body" value={body}
        onChange={event=>{setBody(event.target.value);setError("");setSuccess("");}}
        placeholder="О чём ты думаешь?" maxLength={500} rows={3}
        disabled={busy} required/>
      <div className="composer-footer">
        <span className="composer-counter" aria-live="polite">{body.length}/500</span>
        <button className="primary-button composer-submit" type="submit" disabled={busy || !body.trim()}>
          {busy?<><LoaderCircle size={16} className="spin"/> Публикуем…</>:<>Опубликовать <ArrowUpRight size={16}/></>}
        </button>
      </div>
    </form>
    {error&&<p className="composer-message error" role="alert">{error}</p>}
    {success&&<p className="composer-message success" role="status">{success}</p>}
  </section>;
}
