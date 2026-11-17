"use client";

import {FormEvent,useEffect,useState,type ChangeEvent} from "react";
import {ArrowUpRight,ImagePlus,LoaderCircle,Paperclip,PenLine,Trash2} from "lucide-react";

type AuthUser={username:string;name?:string};
type UploadedMedia={key:string;url:string;type:string;size:number};

function isRecord(value:unknown):value is Record<string,unknown> {
  return typeof value==="object"&&value!==null&&!Array.isArray(value);
}
function isAuthUser(value:unknown):value is AuthUser {
  return isRecord(value)&&typeof value.username==="string";
}
function isUploadedMedia(value:unknown):value is UploadedMedia {
  return isRecord(value)&&typeof value.key==="string"&&typeof value.url==="string"&&
    typeof value.type==="string"&&typeof value.size==="number";
}
const MAX_FILES=4;
const MAX_FILE_BYTES=3*1024*1024;
const MAX_TOTAL_BYTES=4*1024*1024;
const ALLOWED_TYPES=new Set(["image/jpeg","image/png","image/webp"]);

export function PostComposer() {
  const [user,setUser]=useState<AuthUser|null>(null);
  const [ready,setReady]=useState(false);
  const [body,setBody]=useState("");
  const [files,setFiles]=useState<File[]>([]);
  const [filePickerKey,setFilePickerKey]=useState(0);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");

  useEffect(()=>{
    let active=true;
    void fetch("/api/auth/me",{cache:"no-store"})
      .then(async response=>{
        if(!response.ok)return null;
        const payload:unknown=await response.json();
        return isRecord(payload)&&isAuthUser(payload.user)?payload.user:null;
      })
      .catch(()=>null)
      .then(value=>{if(active){setUser(value);setReady(true);}});
    return ()=>{active=false;};
  },[]);

  function chooseFiles(event:ChangeEvent<HTMLInputElement>) {
    const chosen=Array.from(event.currentTarget.files||[]);
    setError("");setSuccess("");
    if(chosen.length>MAX_FILES){setError("Можно выбрать не более четырёх фотографий.");return;}
    if(chosen.some(file=>!ALLOWED_TYPES.has(file.type.toLowerCase()))) {
      setError("Поддерживаются только JPEG, PNG и WebP.");
      return;
    }
    if(chosen.some(file=>file.size<1||file.size>MAX_FILE_BYTES)||
      chosen.reduce((sum,file)=>sum+file.size,0)>MAX_TOTAL_BYTES) {
      setError("Каждый файл должен быть до 3 МБ, общий размер — до 4 МБ.");
      return;
    }
    setFiles(chosen);
  }

  function formatSize(bytes:number) {
    return (bytes/1024/1024).toFixed(2)+" МБ";
  }

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busy)return;
    const text=body.trim();
    if(text.length>500){setError("Максимум 500 символов.");return;}
    if(!text&&!files.length){setError("Добавь текст или фотографию.");return;}

    setBusy(true);setError("");setSuccess("");
    try {
      let uploaded:UploadedMedia[]=[];
      if(files.length) {
        const formData=new FormData();
        files.forEach(file=>formData.append("files",file,file.name));
        const uploadResponse=await fetch("/api/media",{method:"POST",cache:"no-store",body:formData});
        const uploadPayload:unknown=await uploadResponse.json().catch(()=>({}));
        if(!uploadResponse.ok) {
          throw new Error(isRecord(uploadPayload)&&typeof uploadPayload.error==="string"
            ?uploadPayload.error:"Не удалось загрузить фотографии.");
        }
        if(!isRecord(uploadPayload)||uploadPayload.ok!==true||!Array.isArray(uploadPayload.media)) {
          throw new Error("Хранилище не подтвердило загрузку фотографий.");
        }
        uploaded=uploadPayload.media.filter(isUploadedMedia);
        if(uploaded.length!==files.length)throw new Error("Хранилище вернуло неполный список фотографий.");
      }

      const response=await fetch("/api/posts",{
        method:"POST",cache:"no-store",
        headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify({body:text,topic:"Global",media:uploaded})
      });
      const payload:unknown=await response.json().catch(()=>({}));
      if(!response.ok) {
        throw new Error(isRecord(payload)&&typeof payload.error==="string"
          ?payload.error:"Не удалось сохранить публикацию.");
      }
      if(!isRecord(payload)||payload.ok!==true||!isRecord(payload.post)||typeof payload.post.id!=="string") {
        throw new Error("Сервер не подтвердил сохранение публикации.");
      }
      setBody("");setFiles([]);setFilePickerKey(value=>value+1);
      setSuccess("Публикация сохранена и отправлена в общую ленту.");
      window.dispatchEvent(new CustomEvent("orbis-post-created",{detail:payload.post}));
    } catch(value) {
      setError(value instanceof Error?value.message:"Не удалось опубликовать запись.");
    } finally {setBusy(false);}
  }

  if(!ready||!user)return null;

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
        placeholder="О чём ты думаешь?" maxLength={500} rows={3} disabled={busy}/>
      {files.length>0&&<div className="composer-file-list" aria-live="polite">
        {files.map((file,index)=><div className="composer-file" key={file.name+"-"+file.lastModified+"-"+index}>
          <span><Paperclip size={13}/>{file.name}<small>{formatSize(file.size)}</small></span>
          <button type="button" onClick={()=>setFiles(current=>current.filter((_,i)=>i!==index))}
            disabled={busy} aria-label={"Убрать файл "+file.name}><Trash2 size={14}/></button>
        </div>)}
      </div>}
      <div className="composer-footer">
        <div className="composer-attachments">
          <label className="composer-attach-button" htmlFor="orbis-post-images">
            <ImagePlus size={15}/> Фото
          </label>
          <input key={filePickerKey} id="orbis-post-images" className="sr-only" type="file"
            accept="image/jpeg,image/png,image/webp" multiple onChange={chooseFiles} disabled={busy}/>
          <span className="composer-counter">{body.length}/500 · {files.length}/4 фото</span>
        </div>
        <button className="primary-button composer-submit" type="submit" disabled={busy||(!body.trim()&&!files.length)}>
          {busy?<><LoaderCircle size={16} className="spin"/> Публикуем…</>:<>Опубликовать <ArrowUpRight size={16}/></>}
        </button>
      </div>
      <p className="composer-upload-hint">JPEG, PNG или WebP · до 4 фото · общий размер до 4 МБ</p>
    </form>
    {error&&<p className="composer-message error" role="alert">{error}</p>}
    {success&&<p className="composer-message success" role="status">{success}</p>}
  </section>;
}
