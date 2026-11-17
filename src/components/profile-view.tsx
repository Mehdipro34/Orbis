"use client";

import Link from "next/link";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import {
  ArrowLeft,Check,LoaderCircle,RefreshCw,Save,UserRound,UserRoundPlus,Users
} from "lucide-react";

type ProfileUser={
  username:string;
  name:string;
  bio:string;
  avatarUrl:string|null;
  publicNumber:string|null;
  createdAt:string|null;
};
type ProfilePost={
  id:string;
  title:string;
  topic:string;
  body:string;
  createdAt:string;
  likes:number;
  postNumber:string|null;
};
type ProfileData={
  user:ProfileUser;
  followers:number;
  following:number;
  isFollowing:boolean;
  posts:ProfilePost[];
};

function isRecord(value:unknown):value is Record<string,unknown> {
  return typeof value==="object"&&value!==null&&!Array.isArray(value);
}
function parseProfile(value:unknown):ProfileData|null {
  if(!isRecord(value)||!isRecord(value.user)||!Array.isArray(value.posts))return null;
  const raw=value.user;
  if(typeof raw.username!=="string"||typeof raw.name!=="string")return null;
  const posts=value.posts.flatMap((rawPost):ProfilePost[]=>{
    if(!isRecord(rawPost)||typeof rawPost.id!=="string"||typeof rawPost.body!=="string")return [];
    return [{
      id:rawPost.id,
      title:typeof rawPost.title==="string"?rawPost.title:"",
      topic:typeof rawPost.topic==="string"?rawPost.topic:"ORBIS",
      body:rawPost.body,
      createdAt:typeof rawPost.createdAt==="string"?rawPost.createdAt:"",
      likes:typeof rawPost.likes==="number"?rawPost.likes:0,
      postNumber:rawPost.postNumber==null?null:String(rawPost.postNumber)
    }];
  });
  return {
    user:{
      username:raw.username,
      name:raw.name,
      bio:typeof raw.bio==="string"?raw.bio:"",
      avatarUrl:typeof raw.avatar_url==="string"?raw.avatar_url:null,
      publicNumber:raw.publicNumber==null?null:String(raw.publicNumber),
      createdAt:typeof raw.createdAt==="string"?raw.createdAt:null
    },
    followers:typeof value.followers==="number"?value.followers:0,
    following:typeof value.following==="number"?value.following:0,
    isFollowing:value.isFollowing===true,
    posts
  };
}
function showDate(value:string|null) {
  if(!value)return "Участник ORBIS";
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return "Участник ORBIS";
  return "В ORBIS с "+new Intl.DateTimeFormat("ru-RU",{month:"long",year:"numeric"}).format(date);
}
function postDate(value:string) {
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return "Недавно";
  return new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(date);
}

export function ProfileView({username}:{username:string}) {
  const [data,setData]=useState<ProfileData|null>(null);
  const [currentUsername,setCurrentUsername]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [editing,setEditing]=useState(false);
  const [name,setName]=useState("");
  const [bio,setBio]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try {
      const meResponse=await fetch("/api/auth/me",{cache:"no-store"});
      if(!meResponse.ok) {
        setData(null);setCurrentUsername(null);
        throw new Error("Войди в ORBIS, чтобы просматривать профили и подписываться.");
      }
      const mePayload:unknown=await meResponse.json();
      const meUser=isRecord(mePayload)&&isRecord(mePayload.user)?mePayload.user:null;
      setCurrentUsername(meUser&&typeof meUser.username==="string"?meUser.username:null);
      const response=await fetch("/api/profile/"+encodeURIComponent(username),{cache:"no-store"});
      const payload:unknown=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(isRecord(payload)&&typeof payload.error==="string"?payload.error:"Не удалось загрузить профиль.");
      const parsed=parseProfile(payload);
      if(!parsed)throw new Error("Сервер вернул профиль в неизвестном формате.");
      setData(parsed);setName(parsed.user.name);setBio(parsed.user.bio);
    } catch(value) {
      setError(value instanceof Error?value.message:"Не удалось загрузить профиль.");
    } finally {setLoading(false);}
  },[username]);

  useEffect(()=>{void load();},[load]);

  const isOwn=data!==null&&currentUsername===data.user.username;

  async function toggleFollow() {
    if(!data||busy||isOwn)return;
    setBusy(true);setError("");setNotice("");
    try {
      const response=await fetch("/api/users/"+encodeURIComponent(data.user.username)+"/follow",{
        method:"POST",cache:"no-store",headers:{"Accept":"application/json"}
      });
      const payload:unknown=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(isRecord(payload)&&typeof payload.error==="string"?payload.error:"Не удалось изменить подписку.");
      if(!isRecord(payload)||typeof payload.following!=="boolean")throw new Error("Сервер не подтвердил изменение подписки.");
      setData(current=>current?{
        ...current,isFollowing:payload.following as boolean,
        followers:Math.max(0,current.followers+(payload.following?1:-1))
      }:current);
    } catch(value) {
      setError(value instanceof Error?value.message:"Не удалось изменить подписку.");
    } finally {setBusy(false);}
  }

  async function saveProfile(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busy)return;
    setBusy(true);setError("");setNotice("");
    try {
      const response=await fetch("/api/profile",{
        method:"PUT",cache:"no-store",
        headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify({name,bio})
      });
      const payload:unknown=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(isRecord(payload)&&typeof payload.error==="string"?payload.error:"Не удалось сохранить профиль.");
      if(!isRecord(payload)||payload.ok!==true||!isRecord(payload.user))throw new Error("Сервер не подтвердил сохранение профиля.");
      setData(current=>current?{...current,user:{
        ...current.user,
        name:typeof payload.user.name==="string"?payload.user.name:name,
        bio:typeof payload.user.bio==="string"?payload.user.bio:bio
      }}:current);
      setEditing(false);setNotice("Профиль обновлён.");
    } catch(value) {
      setError(value instanceof Error?value.message:"Не удалось сохранить профиль.");
    } finally {setBusy(false);}
  }

  return <div className="app-frame profile-page">
    <header className="profile-topbar">
      <Link href="/" className="profile-back"><ArrowLeft size={16}/> На главную</Link>
      <span className="profile-brand">ORBIS</span>
      <button type="button" className="refresh-button" onClick={()=>void load()} disabled={loading}>
        <RefreshCw size={15} className={loading?"spin":""}/> Обновить
      </button>
    </header>
    {loading&&<div className="profile-loading"><LoaderCircle size={22} className="spin"/> Загружаем профиль…</div>}
    {!loading&&error&&!data&&<section className="profile-state-card" role="alert">
      <UserRound size={25}/><h1>Профиль недоступен</h1><p>{error}</p>
      <Link href="/login" className="primary-button">Войти в ORBIS</Link>
    </section>}
    {!loading&&data&&<>
      <section className="profile-card">
        <div className="profile-cover"/>
        <div className="profile-main">
          <div className="profile-avatar"><UserRound size={34}/></div>
          <div className="profile-heading">
            <div className="eyebrow">ПРОФИЛЬ ORBIS</div>
            <h1>{data.user.name}</h1>
            <p className="profile-username">@{data.user.username}{data.user.publicNumber?" · № "+data.user.publicNumber:""}</p>
          </div>
          <div className="profile-header-actions">
            {isOwn?
              <button className="secondary-button" type="button" onClick={()=>{setEditing(v=>!v);setName(data.user.name);setBio(data.user.bio);}}>
                {editing?"Закрыть":"Изменить профиль"}
              </button>:
              <button type="button" className={data.isFollowing?"secondary-button":"primary-button"}
                onClick={()=>void toggleFollow()} disabled={busy}>
                {busy?<LoaderCircle size={15} className="spin"/>:data.isFollowing?<Check size={15}/>:<UserRoundPlus size={15}/>}
                {data.isFollowing?"Вы подписаны":"Подписаться"}
              </button>}
          </div>
          <p className="profile-bio">{data.user.bio||"Пользователь пока не добавил описание."}</p>
          <div className="profile-meta">{showDate(data.user.createdAt)}</div>
          <div className="profile-stats">
            <div><strong>{data.posts.length}</strong><span>Публикации</span></div>
            <div><strong>{data.followers}</strong><span>Подписчики</span></div>
            <div><strong>{data.following}</strong><span>Подписки</span></div>
          </div>
        </div>
      </section>
      {editing&&isOwn&&<form className="profile-edit-card" onSubmit={event=>void saveProfile(event)}>
        <div className="profile-edit-heading"><strong>Настройки профиля</strong><span>Имя и описание видны другим участникам</span></div>
        <label>Отображаемое имя
          <input value={name} onChange={event=>setName(event.target.value)} minLength={2} maxLength={32} required/>
        </label>
        <label>О себе
          <textarea value={bio} onChange={event=>setBio(event.target.value)} maxLength={180} rows={3}/>
          <small>{bio.length}/180</small>
        </label>
        <button className="primary-button" type="submit" disabled={busy}>
          {busy?<LoaderCircle size={15} className="spin"/>:<Save size={15}/>} Сохранить профиль
        </button>
      </form>}
      {error&&<p className="profile-inline-error" role="alert">{error}</p>}
      {notice&&<p className="profile-inline-success" role="status">{notice}</p>}
      <section className="profile-posts-section">
        <div className="profile-posts-heading"><div><div className="eyebrow">АКТИВНОСТЬ</div><h2>Публикации</h2></div><Users size={19}/></div>
        {data.posts.length===0&&<div className="profile-empty">У этого пользователя пока нет публикаций.</div>}
        {data.posts.map(post=><article className="profile-post" key={post.id}>
          <div className="profile-post-meta"><span>{post.topic}</span><time>{postDate(post.createdAt)}</time></div>
          {post.title&&<h3>{post.title}</h3>}
          <p>{post.body}</p>
          <div className="profile-post-footer"><span>♡ {post.likes}</span>{post.postNumber&&<span>№ {post.postNumber}</span>}</div>
        </article>)}
      </section>
    </>}
  </div>;
}
