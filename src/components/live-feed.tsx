"use client";

import Image from "next/image";
import {useCallback,useEffect,useState} from "react";
import {ChevronDown,RefreshCw} from "lucide-react";
import {PostInteractions} from "@/components/post-interactions";
import {PublicPostSchema,type FeedMode,type PublicFeedResponse,type PublicPost} from "@/lib/orbis/public-feed";

type FeedState="loading"|"ready"|"error";
type AuthStatus="checking"|"signed-in"|"guest";

function formatDate(value:string) {
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return "Недавно";
  return new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(date);
}

function PostCard({
  post,authenticated,liked,saved,onLikeChange,onSavedChange
}:{
  post:PublicPost;
  authenticated:boolean;
  liked:boolean;
  saved:boolean;
  onLikeChange:(postId:string,liked:boolean)=>void;
  onSavedChange:(postId:string,saved:boolean)=>void;
}) {
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
      <span className="post-topic">{post.topic || "ORBIS"}</span>
      {post.postNumber && <span className="post-number">№ {post.postNumber}</span>}
    </div>
    <PostInteractions
      postId={post.id}
      authenticated={authenticated}
      initialLiked={liked}
      initialSaved={saved}
      initialLikes={post.likes}
      onLikeChange={onLikeChange}
      onSavedChange={onSavedChange}
    />
  </article>;
}

function isFeedResponse(value:unknown):value is PublicFeedResponse {
  if(typeof value!=="object" || value===null) return false;
  const result=value as Record<string,unknown>;
  return Array.isArray(result.posts) && typeof result.hasMore==="boolean" &&
    (typeof result.nextCursor==="string" || result.nextCursor===null || result.nextCursor===undefined);
}

function getIdArray(value:unknown):string[] {
  if(!Array.isArray(value)) return [];
  return value.filter((item):item is string=>typeof item==="string"&&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item));
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
  const [authStatus,setAuthStatus]=useState<AuthStatus>("checking");
  const [likedIds,setLikedIds]=useState<Set<string>>(()=>new Set());
  const [savedIds,setSavedIds]=useState<Set<string>>(()=>new Set());

  useEffect(()=>{
    let active=true;
    const onAuthChanged=(event:Event)=>{
      const detail=(event as CustomEvent<{signedIn?:boolean}>).detail;
      const signedIn=detail?.signedIn===true;
      setAuthStatus(signedIn?"signed-in":"guest");
      if(!signedIn){setLikedIds(new Set());setSavedIds(new Set());}
    };
    void fetch("/api/auth/me",{cache:"no-store"})
      .then(response=>response.ok?"signed-in":"guest")
      .catch(()=>"guest")
      .then(status=>{if(active)setAuthStatus(status as AuthStatus);});
    window.addEventListener("orbis-auth-changed",onAuthChanged);
    return ()=>{active=false;window.removeEventListener("orbis-auth-changed",onAuthChanged);};
  },[]);

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

  useEffect(()=>{
    if(authStatus!=="signed-in"||posts.length===0) return;
    const controller=new AbortController();
    let active=true;
    async function loadPersonalState() {
      try {
        const batches:string[][]=[];
        for(let index=0;index<posts.length;index+=30) {
          batches.push(posts.slice(index,index+30).map(post=>post.id));
        }
        const responses=await Promise.all(batches.map(async ids=>{
          const response=await fetch("/api/posts/state?ids="+encodeURIComponent(ids.join(",")),{
            cache:"no-store",signal:controller.signal
          });
          const payload:unknown=await response.json();
          if(!response.ok||typeof payload!=="object"||payload===null) return null;
          return payload as Record<string,unknown>;
        }));
        if(!active)return;
        const liked=new Set<string>(),saved=new Set<string>();
        for(const response of responses) {
          if(!response)continue;
          getIdArray(response.likedIds).forEach(id=>liked.add(id));
          getIdArray(response.savedIds).forEach(id=>saved.add(id));
        }
        setLikedIds(liked);setSavedIds(saved);
      } catch(error) {
        if(active&&!(error instanceof DOMException&&error.name==="AbortError")) {
          setErrorMessage("Не удалось загрузить личные реакции. Обнови ленту.");
        }
      }
    }
    void loadPersonalState();
    return ()=>{active=false;controller.abort();};
  },[authStatus,posts]);

  const loadMore=useCallback(async()=>{
    if(!cursor||!hasMore||loadingMore)return;
    setLoadingMore(true);setErrorMessage("");
    try {
      const params=new URLSearchParams({mode,limit:"20",cursor});
      const response=await fetch("/api/posts?"+params.toString(),{cache:"no-store"});
      const payload:unknown=await response.json();
      if(!response.ok||!isFeedResponse(payload))throw new Error("Не удалось загрузить следующую страницу ленты.");
      setPosts(current=>{
        const known=new Set(current.map(post=>post.id));
        return [...current,...payload.posts.filter(post=>!known.has(post.id))];
      });
      setCursor(payload.nextCursor??null);setHasMore(payload.hasMore);
    } catch(error) {
      setErrorMessage(error instanceof Error?error.message:"Не удалось загрузить следующую страницу.");
    } finally {setLoadingMore(false);}
  },[cursor,hasMore,loadingMore,mode]);

  useEffect(()=>{
    const onPostCreated=(event:Event)=>{
      const parsed=PublicPostSchema.safeParse((event as CustomEvent<unknown>).detail);
      if(!parsed.success) {
        setRefreshVersion(value=>value+1);
        return;
      }
      if(mode==="latest") {
        setPosts(current=>[parsed.data,...current.filter(post=>post.id!==parsed.data.id)].slice(0,30));
        setState("ready");
      } else {
        setRefreshVersion(value=>value+1);
      }
    };
    window.addEventListener("orbis-post-created",onPostCreated);
    return ()=>window.removeEventListener("orbis-post-created",onPostCreated);
  },[mode]);

  const handleLikeChange=useCallback((postId:string,liked:boolean)=>{
    setLikedIds(current=>{
      const next=new Set(current);
      if(liked)next.add(postId);else next.delete(postId);
      return next;
    });
  },[]);
  const handleSavedChange=useCallback((postId:string,saved:boolean)=>{
    setSavedIds(current=>{
      const next=new Set(current);
      if(saved)next.add(postId);else next.delete(postId);
      return next;
    });
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
    {state==="loading"&&<div className="feed-skeletons" aria-label="Загрузка ленты" aria-busy="true">
      <div className="post-skeleton"/><div className="post-skeleton"/><div className="post-skeleton"/>
    </div>}
    {state==="error"&&<div className="feed-state-card" role="alert">
      <strong>Лента пока недоступна</strong><p>{errorMessage}</p>
      <button type="button" className="primary-button" onClick={()=>setRefreshVersion(v=>v+1)}>Повторить загрузку</button>
    </div>}
    {state==="ready"&&posts.length===0&&<div className="feed-state-card">
      <strong>Пока нет публикаций</strong><p>Новые записи общей ленты появятся здесь после публикации.</p>
    </div>}
    {state==="ready"&&posts.map(post=><PostCard key={post.id} post={post}
      authenticated={authStatus==="signed-in"}
      liked={likedIds.has(post.id)||post.liked===true}
      saved={savedIds.has(post.id)||post.saved===true}
      onLikeChange={handleLikeChange}
      onSavedChange={handleSavedChange}
    />)}
    {state==="ready"&&hasMore&&<button type="button" className="load-more-button"
      onClick={()=>void loadMore()} disabled={loadingMore}>
      <ChevronDown size={17} aria-hidden="true"/>{loadingMore?"Загрузка…":"Показать ещё"}
    </button>}
    {state==="ready"&&errorMessage&&<p className="inline-error" role="alert">{errorMessage}</p>}
  </section>;
}
