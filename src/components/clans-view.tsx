"use client";

import Link from "next/link";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import {ArrowLeft,Flag,LoaderCircle,Plus,RefreshCw,Users} from "lucide-react";

type Clan={id:string;slug:string;name:string;description:string;memberCount:number;isMember:boolean;role:string|null;created_at:string};
function isRecord(v:unknown):v is Record<string,unknown>{return typeof v==="object"&&v!==null&&!Array.isArray(v);}

export function ClansView(){
  const [clans,setClans]=useState<Clan[]>([]);
  const [myClan,setMyClan]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [signedIn,setSignedIn]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [name,setName]=useState("");
  const [description,setDescription]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const response=await fetch("/api/clans",{cache:"no-store"});
      const payload:unknown=await response.json().catch(()=>({}));
      if(response.status===401){setSignedIn(false);setClans([]);return;}
      if(!response.ok)throw new Error(isRecord(payload)&&typeof payload.error==="string"?payload.error:"Не удалось загрузить кланы.");
      if(!isRecord(payload)||!Array.isArray(payload.clans))throw new Error("Сервер вернул некорректный список кланов.");
      const parsed=payload.clans.flatMap((value):Clan[]=>{
        if(!isRecord(value)||typeof value.id!=="string"||typeof value.slug!=="string"||typeof value.name!=="string")return [];
        return [{id:value.id,slug:value.slug,name:value.name,
          description:typeof value.description==="string"?value.description:"",
          memberCount:typeof value.memberCount==="number"?value.memberCount:0,
          isMember:value.isMember===true,role:typeof value.role==="string"?value.role:null,
          created_at:typeof value.created_at==="string"?value.created_at:""}];
      });
      setSignedIn(true);setClans(parsed);setMyClan(typeof payload.myClan==="string"?payload.myClan:null);
    }catch(value){setError(value instanceof Error?value.message:"Не удалось загрузить кланы.");}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{void load();},[load]);

  async function act(slug:string,action:"join"|"leave"){
    if(busy)return;
    setBusy(slug);setError("");setNotice("");
    try{
      const response=await fetch("/api/clans/"+encodeURIComponent(slug)+"/"+action,{
        method:"POST",cache:"no-store",headers:{"Accept":"application/json"}
      });
      const payload:unknown=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(isRecord(payload)&&typeof payload.error==="string"?payload.error:"Не удалось изменить состав клана.");
      if(!isRecord(payload)||payload.ok!==true)throw new Error("Сервер не подтвердил изменение.");
      setNotice(action==="join"?"Ты вступил в клан.":"Ты покинул клан.");
      await load();
    }catch(value){setError(value instanceof Error?value.message:"Не удалось изменить участие.");}
    finally{setBusy(null);}
  }

  async function create(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(busy)return;
    setBusy("create");setError("");setNotice("");
    try{
      const response=await fetch("/api/clans",{
        method:"POST",cache:"no-store",headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify({name,description})
      });
      const payload:unknown=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(isRecord(payload)&&typeof payload.error==="string"?payload.error:"Не удалось создать клан.");
      if(!isRecord(payload)||payload.ok!==true)throw new Error("Сервер не подтвердил создание клана.");
      setName("");setDescription("");setNotice("Клан создан, ты автоматически стал его владельцем.");
      await load();
    }catch(value){setError(value instanceof Error?value.message:"Не удалось создать клан.");}
    finally{setBusy(null);}
  }

  const myMembership=clans.find(clan=>clan.id===myClan);

  return <div className="app-frame community-page">
    <header className="profile-topbar">
      <Link href="/" className="profile-back"><ArrowLeft size={15}/> На главную</Link>
      <span className="profile-brand">ORBIS</span>
      <Link href="/notifications" className="community-top-link">Уведомления</Link>
    </header>
    <section className="community-title-row">
      <div><div className="eyebrow">СООБЩЕСТВА ORBIS</div><h1>Кланы</h1><p>Объединяйся вокруг интересов и развивай сообщество.</p></div>
      <div className="community-title-icon"><Flag size={25}/></div>
    </section>
    {!signedIn&&!loading&&<div className="community-state"><strong>Нужен вход в ORBIS</strong><p>Список кланов и вступление доступны после входа.</p><Link href="/login" className="primary-button">Войти</Link></div>}
    {signedIn&&<>
      {myMembership&&<div className="my-clan-banner"><strong>Твой клан: {myMembership.name}</strong><span>Ты можешь состоять только в одном клане одновременно.</span></div>}
      {!myClan&&<form className="clan-create-card" onSubmit={event=>void create(event)}>
        <div className="clan-create-heading"><Plus size={17}/><strong>Создать клан</strong></div>
        <input value={name} onChange={event=>setName(event.target.value)} minLength={3} maxLength={40} placeholder="Название клана" required/>
        <textarea value={description} onChange={event=>setDescription(event.target.value)} maxLength={240} rows={2} placeholder="Коротко расскажи о клане"/>
        <div className="clan-create-footer"><span>{description.length}/240</span><button className="primary-button" type="submit" disabled={busy!==null||name.trim().length<3}>{busy==="create"?<LoaderCircle size={14} className="spin"/>:"Создать клан"}</button></div>
      </form>}
      <div className="community-toolbar"><span>{clans.length} кланов</span><button type="button" className="secondary-button" onClick={()=>void load()} disabled={loading}><RefreshCw size={14}/> Обновить</button></div>
      {error&&<p className="community-error" role="alert">{error}</p>}
      {notice&&<p className="community-success" role="status">{notice}</p>}
      {loading&&<div className="profile-loading"><LoaderCircle className="spin" size={20}/> Загружаем кланы…</div>}
      {!loading&&clans.length===0&&!error&&<div className="community-state"><Users size={25}/><strong>Кланов ещё нет</strong><p>Создай первое сообщество ORBIS.</p></div>}
      {!loading&&<div className="clan-list">
        {clans.map(clan=><article className="clan-card" key={clan.id}>
          <div className="clan-card-mark"><Flag size={19}/></div>
          <div className="clan-card-main">
            <h2>{clan.name}</h2><p>{clan.description||"Описание пока не добавлено."}</p>
            <div className="clan-card-meta"><span><Users size={13}/>{clan.memberCount} участников</span><span>/{clan.slug}</span></div>
          </div>
          <div className="clan-card-action">
            {clan.isMember?
              clan.role==="owner"?<span className="clan-owner-label">Владелец</span>:
                <button type="button" className="secondary-button" onClick={()=>void act(clan.slug,"leave")} disabled={busy!==null}>{busy===clan.slug?<LoaderCircle size={14} className="spin"/>:"Покинуть"}</button>:
              <button type="button" className="primary-button" onClick={()=>void act(clan.slug,"join")} disabled={busy!==null||Boolean(myClan)}>{busy===clan.slug?<LoaderCircle size={14} className="spin"/>:"Вступить"}</button>}
          </div>
        </article>)}
      </div>}
    </>}
  </div>;
}
