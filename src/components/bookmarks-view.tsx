"use client";

import Link from "next/link";
import {useCallback,useEffect,useState} from "react";
import {ArrowLeft,Bookmark,LoaderCircle,RefreshCw,Trash2,UserRound} from "lucide-react";

type SavedPost={
  id:string;
  title:string;
  body:string;
  topic:string;
  username:string|null;
  author:string;
  createdAt:string;
  likes:number;
};

function isRecord(v:unknown):v is Record<string,unknown>{return typeof v==="object"&&v!==null&&!Array.isArray(v);}
function parsePost(value:unknown):SavedPost|null{
  if(!isRecord(value)||typeof value.id!=="string"||typeof value.body!=="string")return null;
  return {
    id:value.id,
    title:typeof value.title==="string"?value.title:"",
    body:value.body,
    topic:typeof value.topic==="string"?value.topic:"ORBIS",
    username:typeof value.username==="string"?value.username:null,
    author:typeof value.author==="string"?value.author:"Участник ORBIS",
    createdAt:typeof value.createdAt==="string"?value.createdAt:
      typeof value.created_at==="string"?value.created_at:"",
    likes:typeof value.likes==="number"?value.likes:0
  };
}
function formatDate(value:string){
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"Недавно":new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(date);
}

export function BookmarksView(){
  const [posts,setPosts]=useState<SavedPost[]>([]);
  const [loading,setLoading]=useState(true);
  const [removing,setRemoving]=useState<string|null>(null);
  const [authenticated,setAuthenticated]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const response=await fetch("/api/bookmarks",{cache:"no-store"});
      const payload:unknown=await response.json().catch(()=>({}));
      if(response.status===401){setAuthenticated(false);setPosts([]);return;}
      if(!response.ok)throw new Error(isRecord(payload)&&typeof payload.error==="string"?payload.error:"Не удалось загрузить закладки.");
      if(!isRecord(payload)||!Array.isArray(payload.posts))throw new Error("Сервер вернул некорректный список закладок.");
      setAuthenticated(true);
      setPosts(payload.posts.map(parsePost).filter((item):item is SavedPost=>item!==null));
    }catch(value){setError(value instanceof Error?value.message:"Не удалось загрузить закладки.");}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{void load();},[load]);

  async function remove(post:SavedPost){
    if(removing)return;
    setRemoving(post.id);setError("");setNotice("");
    try{
      const response=await fetch("/api/bookmarks",{
        method:"POST",cache:"no-store",
        headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify({postId:post.id})
      });
      const payload:unknown=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(isRecord(payload)&&typeof payload.error==="string"?payload.error:"Не удалось удалить закладку.");
      if(!isRecord(payload)||payload.ok!==true||payload.saved!==false)throw new Error("Сервер не подтвердил удаление закладки.");
      setPosts(current=>current.filter(item=>item.id!==post.id));
      setNotice("Публикация удалена из закладок.");
    }catch(value){setError(value instanceof Error?value.message:"Не удалось удалить закладку.");}
    finally{setRemoving(null);}
  }

  return <div className="app-frame bookmarks-page">
    <header className="profile-topbar">
      <Link href="/" className="profile-back"><ArrowLeft size={15}/> На главную</Link>
      <span className="profile-brand">ORBIS</span>
      <Link href="/notifications" className="community-top-link">Уведомления</Link>
    </header>
    <section className="community-title-row">
      <div><div className="eyebrow">ТВОЯ КОЛЛЕКЦИЯ</div><h1>Закладки</h1><p>Публикации, которые ты сохранил, чтобы вернуться к ним позже.</p></div>
      <div className="community-title-icon"><Bookmark size={24}/></div>
    </section>
    {!authenticated&&!loading&&<div className="community-state">
      <Bookmark size={25}/><strong>Нужен вход в ORBIS</strong><p>Закладки доступны только владельцу аккаунта.</p>
      <Link href="/login" className="primary-button">Войти</Link>
    </div>}
    {authenticated&&<>
      <div className="community-toolbar"><span>{posts.length} сохранённых публикаций</span>
        <button type="button" className="secondary-button" onClick={()=>void load()} disabled={loading}><RefreshCw size={14}/> Обновить</button>
      </div>
      {error&&<p className="community-error" role="alert">{error}</p>}
      {notice&&<p className="community-success" role="status">{notice}</p>}
      {loading&&<div className="profile-loading"><LoaderCircle size={20} className="spin"/> Загружаем закладки…</div>}
      {!loading&&posts.length===0&&!error&&<div className="community-state">
        <Bookmark size={25}/><strong>Здесь пока пусто</strong><p>Нажимай «Сохранить» под публикациями в ленте, и они появятся здесь.</p>
        <Link href="/#feed" className="primary-button">Открыть ленту</Link>
      </div>}
      {!loading&&<div className="bookmark-list">
        {posts.map(post=><article className="bookmark-card" key={post.id}>
          <div className="bookmark-card-top"><span className="bookmark-topic">{post.topic}</span>
            <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time></div>
          {post.title&&<h2>{post.title}</h2>}
          <p className="bookmark-body">{post.body}</p>
          <div className="bookmark-card-footer">
            <span className="bookmark-author">{post.username?<Link href={"/u/"+encodeURIComponent(post.username)}><UserRound size={13}/> @{post.username}</Link>:post.author}</span>
            <span className="bookmark-likes">♡ {post.likes}</span>
            <button type="button" className="bookmark-remove" onClick={()=>void remove(post)} disabled={removing!==null}
              title="Удалить из закладок" aria-label="Удалить публикацию из закладок">
              {removing===post.id?<LoaderCircle size={15} className="spin"/>:<Trash2 size={15}/>} Убрать
            </button>
          </div>
        </article>)}
      </div>}
    </>}
  </div>;
}
