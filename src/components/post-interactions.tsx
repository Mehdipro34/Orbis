"use client";

import {useEffect,useState} from "react";
import {
  Bookmark,ChevronDown,ChevronUp,CornerDownRight,Heart,LoaderCircle,
  MessageCircle,Send
} from "lucide-react";

type CommentAuthor = {
  username:string;
  displayName:string;
  avatarUrl:string|null;
};

type PostComment = {
  id:string;
  postId:string;
  parentId:string|null;
  body:string;
  createdAt:string;
  author:CommentAuthor;
  own:boolean;
  repliesCount:number;
};

type Props = {
  postId:string;
  authenticated:boolean;
  initialLiked:boolean;
  initialSaved:boolean;
  initialLikes:number;
  onLikeChange:(postId:string,liked:boolean)=>void;
  onSavedChange:(postId:string,saved:boolean)=>void;
};

function isRecord(value:unknown):value is Record<string,unknown> {
  return typeof value==="object" && value!==null && !Array.isArray(value);
}

function parseComment(value:unknown):PostComment|null {
  if(!isRecord(value) || typeof value.id!=="string" || typeof value.postId!=="string" ||
    typeof value.body!=="string" || typeof value.createdAt!=="string") return null;
  const author=isRecord(value.author)?value.author:{};
  return {
    id:value.id,
    postId:value.postId,
    parentId:typeof value.parentId==="string"?value.parentId:null,
    body:value.body,
    createdAt:value.createdAt,
    author:{
      username:typeof author.username==="string"?author.username:"member",
      displayName:typeof author.displayName==="string"?author.displayName:"Участник ORBIS",
      avatarUrl:typeof author.avatarUrl==="string"?author.avatarUrl:null
    },
    own:value.own===true,
    repliesCount:typeof value.repliesCount==="number"?value.repliesCount:0
  };
}

async function requestJson(
  path:string,
  method:"GET"|"POST",
  body?:unknown
):Promise<Record<string,unknown>> {
  const response=await fetch(path,{
    method,
    cache:"no-store",
    headers:body===undefined?{"Accept":"application/json"}:{"Accept":"application/json","Content-Type":"application/json"},
    body:body===undefined?undefined:JSON.stringify(body)
  });
  const payload:unknown=await response.json().catch(()=>({}));
  if(!response.ok) {
    const message=isRecord(payload)&&typeof payload.error==="string"
      ?payload.error:"Не удалось выполнить действие.";
    throw new Error(message);
  }
  if(!isRecord(payload)) throw new Error("Сервер вернул некорректный ответ.");
  return payload;
}

function formatCommentDate(value:string) {
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return "Недавно";
  return new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(date);
}

export function PostInteractions({
  postId,authenticated,initialLiked,initialSaved,initialLikes,onLikeChange,onSavedChange
}:Props) {
  const [liked,setLiked]=useState(initialLiked);
  const [saved,setSaved]=useState(initialSaved);
  const [likes,setLikes]=useState(initialLikes);
  const [likeBusy,setLikeBusy]=useState(false);
  const [saveBusy,setSaveBusy]=useState(false);
  const [commentsOpen,setCommentsOpen]=useState(false);
  const [commentsLoaded,setCommentsLoaded]=useState(false);
  const [commentsLoading,setCommentsLoading]=useState(false);
  const [comments,setComments]=useState<PostComment[]>([]);
  const [newComment,setNewComment]=useState("");
  const [sending,setSending]=useState(false);
  const [replyingTo,setReplyingTo]=useState<string|null>(null);
  const [replyText,setReplyText]=useState("");
  const [repliesByParent,setRepliesByParent]=useState<Record<string,PostComment[]>>({});
  const [expandedReplies,setExpandedReplies]=useState<Set<string>>(()=>new Set());
  const [loadingReplies,setLoadingReplies]=useState<string|null>(null);
  const [error,setError]=useState("");

  useEffect(()=>{setLiked(initialLiked);},[initialLiked]);
  useEffect(()=>{setSaved(initialSaved);},[initialSaved]);

  async function toggleLike() {
    if(!authenticated||likeBusy) return;
    setLikeBusy(true);setError("");
    try {
      const payload=await requestJson("/api/posts/"+postId+"/like","POST",{});
      if(typeof payload.liked!=="boolean"||typeof payload.likes!=="number") {
        throw new Error("Сервер не подтвердил сохранение реакции.");
      }
      setLiked(payload.liked);setLikes(payload.likes);onLikeChange(postId,payload.liked);
    } catch(value) {
      setError(value instanceof Error?value.message:"Не удалось сохранить реакцию.");
    } finally {setLikeBusy(false);}
  }

  async function toggleSaved() {
    if(!authenticated||saveBusy) return;
    setSaveBusy(true);setError("");
    try {
      const payload=await requestJson("/api/bookmarks","POST",{postId});
      if(typeof payload.saved!=="boolean") throw new Error("Сервер не подтвердил изменение закладки.");
      setSaved(payload.saved);onSavedChange(postId,payload.saved);
    } catch(value) {
      setError(value instanceof Error?value.message:"Не удалось изменить закладку.");
    } finally {setSaveBusy(false);}
  }

  async function loadComments() {
    setCommentsLoading(true);setError("");
    try {
      const payload=await requestJson("/api/posts/"+postId+"/comments?limit=20","GET");
      if(!Array.isArray(payload.comments)) throw new Error("Не удалось прочитать обсуждение.");
      setComments(payload.comments.map(parseComment).filter((item):item is PostComment=>item!==null));
      setCommentsLoaded(true);
    } catch(value) {
      setError(value instanceof Error?value.message:"Не удалось загрузить комментарии.");
    } finally {setCommentsLoading(false);}
  }

  async function toggleComments() {
    const next=!commentsOpen;
    setCommentsOpen(next);
    if(next&&!commentsLoaded) await loadComments();
  }

  async function toggleReplies(commentId:string) {
    const next=new Set(expandedReplies);
    if(next.has(commentId)) {
      next.delete(commentId);setExpandedReplies(next);return;
    }
    next.add(commentId);setExpandedReplies(next);
    if(repliesByParent[commentId]) return;
    setLoadingReplies(commentId);setError("");
    try {
      const payload=await requestJson("/api/comments/"+commentId+"/replies","GET");
      const replyRows=payload.replies;
      if(!Array.isArray(replyRows)) throw new Error("Не удалось загрузить ответы.");
      const parsedReplies=replyRows
        .map((row:unknown)=>parseComment(row))
        .filter((item):item is PostComment=>item!==null);
      setRepliesByParent(current=>({...current,[commentId]:parsedReplies}));
    } catch(value) {
      setExpandedReplies(current=>{const copy=new Set(current);copy.delete(commentId);return copy;});
      setError(value instanceof Error?value.message:"Не удалось загрузить ответы.");
    } finally {setLoadingReplies(null);}
  }

  async function sendComment(parentId:string|null) {
    const value=(parentId?replyText:newComment).trim();
    if(!authenticated||!value||sending) return;
    setSending(true);setError("");
    try {
      const payload=await requestJson("/api/posts/"+postId+"/comments","POST",{
        body:value,...(parentId?{parentId}:{})
      });
      const created=parseComment(payload.comment);
      if(payload.ok!==true||!created) throw new Error("Сервер не подтвердил сохранение комментария.");
      if(parentId) {
        setRepliesByParent(current=>({...current,[parentId]:[...(current[parentId]||[]),created]}));
        setExpandedReplies(current=>new Set(current).add(parentId));
        setComments(current=>current.map(item=>item.id===parentId
          ?{...item,repliesCount:item.repliesCount+1}:item));
        setReplyText("");
        setReplyingTo(null);
      } else {
        setComments(current=>[created,...current]);
        setNewComment("");
      }
      setCommentsLoaded(true);
    } catch(value) {
      setError(value instanceof Error?value.message:"Не удалось отправить комментарий.");
    } finally {setSending(false);}
  }

  function renderComment(comment:PostComment,isReply=false) {
    const replies=repliesByParent[comment.id]||[];
    const expanded=expandedReplies.has(comment.id);
    return <article className={isReply?"post-comment post-comment-reply":"post-comment"} key={comment.id}>
      <div className="post-comment-avatar" aria-hidden="true">
        {comment.author.displayName.slice(0,1).toUpperCase()}
      </div>
      <div className="post-comment-content">
        <div className="post-comment-heading">
          <strong>{comment.author.displayName}</strong>
          <span>@{comment.author.username}</span>
          <time dateTime={comment.createdAt}>{formatCommentDate(comment.createdAt)}</time>
        </div>
        <p>{comment.body}</p>
        {!isReply&&<div className="post-comment-actions">
          <button type="button" onClick={()=>{setReplyingTo(replyingTo===comment.id?null:comment.id);setReplyText("");}}>
            <CornerDownRight size={13}/> Ответить
          </button>
          {comment.repliesCount>0&&<button type="button" onClick={()=>void toggleReplies(comment.id)}>
            {expanded?<ChevronUp size={13}/>:<ChevronDown size={13}/>}
            {loadingReplies===comment.id?"Загрузка…":expanded?"Скрыть ответы":"Ответы ("+comment.repliesCount+")"}
          </button>}
        </div>}
        {replyingTo===comment.id&&!isReply&&<form className="post-reply-form" onSubmit={event=>{event.preventDefault();void sendComment(comment.id);}}>
          <input value={replyText} onChange={event=>setReplyText(event.target.value)}
            maxLength={1000} placeholder={"Ответ для @"+comment.author.username} aria-label="Текст ответа"/>
          <button className="post-send-button" type="submit" disabled={sending||!replyText.trim()}>
            {sending?<LoaderCircle size={15} className="spin"/>:<Send size={15}/>}
          </button>
        </form>}
        {!isReply&&expanded&&<div className="post-replies">
          {replies.map(reply=>renderComment(reply,true))}
          {loadingReplies===comment.id&&<span className="post-comments-hint">Загружаем ответы…</span>}
          {!loadingReplies&&replies.length===0&&<span className="post-comments-hint">Ответов пока нет.</span>}
        </div>}
      </div>
    </article>;
  }

  return <div className="post-interactions">
    <div className="post-action-row">
      <button type="button" className={liked?"post-action-button active":"post-action-button"}
        onClick={()=>void toggleLike()} disabled={!authenticated||likeBusy} aria-pressed={liked}
        title={authenticated?"Поставить или убрать лайк":"Войди, чтобы реагировать"}>
        {likeBusy?<LoaderCircle size={16} className="spin"/>:<Heart size={16} fill={liked?"currentColor":"none"}/>}
        <span>{likes}</span>
      </button>
      <button type="button" className={commentsOpen?"post-action-button active":"post-action-button"}
        onClick={()=>void toggleComments()} disabled={!authenticated}
        title={authenticated?"Открыть обсуждение":"Войди, чтобы комментировать"}>
        <MessageCircle size={16}/><span>Обсудить</span>
      </button>
      <button type="button" className={saved?"post-action-button active":"post-action-button"}
        onClick={()=>void toggleSaved()} disabled={!authenticated||saveBusy} aria-pressed={saved}
        title={authenticated?"Сохранить или убрать из закладок":"Войди, чтобы сохранять"}>
        {saveBusy?<LoaderCircle size={16} className="spin"/>:<Bookmark size={16} fill={saved?"currentColor":"none"}/>}
        <span>{saved?"Сохранено":"Сохранить"}</span>
      </button>
    </div>
    {!authenticated&&<p className="post-login-hint"><a href="/login">Войди в ORBIS</a>, чтобы ставить реакции, сохранять посты и участвовать в обсуждениях.</p>}
    {error&&<p className="post-interaction-error" role="alert">{error}</p>}
    {commentsOpen&&<section className="post-comments-panel" aria-label="Обсуждение публикации">
      <form className="post-comment-form" onSubmit={event=>{event.preventDefault();void sendComment(null);}}>
        <input value={newComment} onChange={event=>setNewComment(event.target.value)}
          maxLength={1000} placeholder="Напиши комментарий…" aria-label="Новый комментарий"/>
        <button className="post-send-button" type="submit" disabled={sending||!newComment.trim()}>
          {sending?<LoaderCircle size={15} className="spin"/>:<Send size={15}/>}
          <span>Отправить</span>
        </button>
      </form>
      {commentsLoading&&<p className="post-comments-hint">Загружаем обсуждение…</p>}
      {!commentsLoading&&commentsLoaded&&comments.length===0&&<p className="post-comments-hint">Пока нет комментариев. Начни обсуждение первым.</p>}
      {comments.map(comment=>renderComment(comment))}
    </section>}
  </div>;
}
