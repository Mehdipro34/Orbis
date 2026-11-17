"use client";

import Image from "next/image";
import {useCallback,useEffect,useState} from "react";
import {ChevronDown,Flame,RefreshCw} from "lucide-react";
import type {FeedMode,PublicFeedResponse,PublicPost} from "@/lib/orbis/public-feed";

type FeedState="loading"|"ready"|"error";

function formatDate(value:string) {
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return "Недавно";
  return new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(date);
}

function PostCard({post}:{post:PublicPost}) {
  const author=post.author?.trim() || post.username || "Участник ORBIS";
  const username=post.username?"@"+post.username:"@orbis";
  const media=post.media.filter(item=>item.type?.startsWith("image/") || !item.type);
  return <article className="post-card">
    <div className="post-author-row">
      <div className="avatar" aria-hidden="true">
        {post.avatar_url?<Image src={post.avatar_url} alt="" width={44} height={44} unoptimized/>:author.slice(0,1).toUpperCase()}
      </div>
      <div className="author-meta"><strong>{author}</strong><span>{username}</span></div>
      <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
    </div>
    {post.title && post.title!==post.body && <h3 className="post-title">{post.title}</h3>}
    <p className="post-body">{post.body}</p>
    {media.length>0 && <div className={media.length>1?"post-media-grid multiple":"post-media-grid"}>
      {media.slice(0,4).map((item,index)=><div className="post-media-item" key={item.key || item.url}>
        <Image src={item.url} alt={"Изображение в публикации "+(index+1)} fill
          sizes="(max-width: 720px) 100vw, 680px" unoptimized/>
      </div>)}
    </div>}
    <div className="post-footer">
      <span className="post-stat"><Flame size={16} aria-hidden="true"/> {post.likes}</span>
      <span className="post-topic">{post.topic || "ORBIS"}</span>
      {post.postNumber && <span className="post-number">№ {post.postNumber}</span>}
    </div>
  </article>;
}

function isFeedResponse(value:unknown):value is PublicFeedResponse {
  if(typeof value!=="object" || value===null) return false;
  const result=value as Record<string,unknown>;
  return Array.isArray(result.posts) && typeof result.hasMore==="boolean" &&
    (typeof result.nextCursor==="string" || result.nextCursor===null || result.nextCursor===undefined);
}

export function LiveFeed() {
  const [mode,setMode]=useState<FeedMode>("latest");
  const [posts,setPosts]=useState<PublicPost[]>([]);
  const [cursor,setCursor]=useState<string|null>(null);
  const [hasMore,setHasMore]=useState(false);
  const [state,setState]=useState<FeedState>("loading");
  const [errorMessage,setErrorMessage]=useState("");
  const [refreshVersion,setRefreshVersion]=useState(0);
  const [loadingMore,setLoadingMore]=useState(false);

  useEffect(()=>{
    const controller=new AbortController();
    let active=true;
    async function loadFirstPage() {
      setState("loading"); setErrorMessage(""); setPosts([]); setCursor(null); setHasMore(false);
      try {
        const response=await fetch("/api/posts?mode="+mode+"&limit=20",{cache:"no-store",signal:controller.signal});
        const payload:unknown=await response.json();
        if(!response.ok) {
          const data=payload as {error?:{message?:unknown}};
          const message=typeof data.error?.message==="string"?data.error.message:"Не удалось загрузить публикации.";
          throw new Error(message);
        }
        if(!isFeedResponse(payload)) throw new Error("Сервер вернул некорректную ленту.");
        if(active) {
          setPosts(payload.posts); setCursor(payload.nextCursor??null);
          setHasMore(payload.hasMore); setState("ready");
        }
      } catch(error) {
        if(!active || (error instanceof DOMException && error.name==="AbortError")) return;
        setErrorMessage(error instanceof Error?error.message:"Неизвестная ошибка загрузки.");
        setState("error");
      }
    }
    void loadFirstPage();
    return ()=>{active=false;controller.abort();};
  },[mode,refreshVersion]);

  const loadMore=useCallback(async()=>{
    if(!cursor || !hasMore || loadingMore) return;
    setLoadingMore(true); setErrorMessage("");
    try {
      const params=new URLSearchParams({mode,limit:"20",cursor});
      const response=await fetch("/api/posts?"+params.toString(),{cache:"no-store"});
      const payload:unknown=await response.json();
      if(!response.ok || !isFeedResponse(payload)) throw new Error("Не удалось загрузить следующую страницу ленты.");
      setPosts(current=>{
        const known=new Set(current.map(post=>post.id));
        return [...current,...payload.posts.filter(post=>!known.has(post.id))];
      });
      setCursor(payload.nextCursor??null); setHasMore(payload.hasMore);
    } catch(error) {
      setErrorMessage(error instanceof Error?error.message:"Не удалось загрузить следующую страницу.");
    } finally { setLoadingMore(false); }
  },[cursor,hasMore,loadingMore,mode]);

  useEffect(()=>{
    const onPostCreated=()=>setRefreshVersion(value=>value+1);
    window.addEventListener("orbis-post-created",onPostCreated);
    return ()=>window.removeEventListener("orbis-post-created",onPostCreated);
  },[]);

  return <section className="feed-section" aria-label="Публичная лента ORBIS">
    <div className="feed-toolbar">
      <div className="feed-tabs" role="tablist" aria-label="Режим ленты">
        <button className={mode==="latest"?"feed-tab active":"feed-tab"} type="button" role="tab"
          aria-selected={mode==="latest"} onClick={()=>setMode("latest")}>Свежие</button>
        <button className={mode==="popular"?"feed-tab active":"feed-tab"} type="button" role="tab"
          aria-selected={mode==="popular"} onClick={()=>setMode("popular")}>Популярные</button>
      </div>
      <button type="button" className="refresh-button" onClick={()=>setRefreshVersion(v=>v+1)} disabled={state==="loading"}>
        <RefreshCw size={16} aria-hidden="true" className={state==="loading"?"spin":""}/> Обновить
      </button>
    </div>
    {state==="loading" && <div className="feed-skeletons" aria-label="Загрузка ленты" aria-busy="true">
      <div className="post-skeleton"/><div className="post-skeleton"/><div className="post-skeleton"/>
    </div>}
    {state==="error" && <div className="feed-state-card" role="alert">
      <strong>Лента пока недоступна</strong><p>{errorMessage}</p>
      <button type="button" className="primary-button" onClick={()=>setRefreshVersion(v=>v+1)}>Повторить загрузку</button>
    </div>}
    {state==="ready" && posts.length===0 && <div className="feed-state-card">
      <strong>Пока нет публикаций</strong><p>Новые записи общей ленты появятся здесь после публикации.</p>
    </div>}
    {state==="ready" && posts.map(post=><PostCard key={post.id} post={post}/>)}
    {state==="ready" && hasMore && <button type="button" className="load-more-button"
      onClick={()=>void loadMore()} disabled={loadingMore}>
      <ChevronDown size={17} aria-hidden="true"/>{loadingMore?"Загрузка…":"Показать ещё"}
    </button>}
    {state==="ready" && errorMessage && <p className="inline-error" role="alert">{errorMessage}</p>}
  </section>;
}
