"use client";

import {useCallback,useEffect,useState,type FormEvent} from "react";
import {Activity,AlertTriangle,CheckCircle2,Clock,LoaderCircle,RefreshCw,Shield,ShieldCheck,Trash2} from "lucide-react";

type Count={table:string;count:number|null;error:boolean};
type Report={
  id:string;post_id:string;reason:string;status:string;created_at:string;
  reporter?:{username?:string}|null;
  post?:{title?:string;body?:string;status?:string;author_id?:string}|null;
};
type AdminOverview={role:string;counts:Count[];audit:Array<{action:string;target_type:string;target_id:string;created_at:string}>};

function isRecord(v:unknown):v is Record<string,unknown>{return typeof v==="object"&&v!==null&&!Array.isArray(v);}
async function api(path:string,method="GET",body?:unknown){
  const response=await fetch(path,{
    method,cache:"no-store",
    headers:body===undefined?{"Accept":"application/json"}:{"Accept":"application/json","Content-Type":"application/json"},
    body:body===undefined?undefined:JSON.stringify(body)
  });
  const value:unknown=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(isRecord(value)&&typeof value.error==="string"?value.error:"Не удалось выполнить операцию.");
  return value;
}
const names:Record<string,string>={
  profiles:"Аккаунты",posts:"Публикации",post_comments:"Комментарии",post_likes:"Лайки",
  post_reports:"Жалобы",clans:"Кланы",messages:"Сообщения"
};
const date=(value:string)=>new Intl.DateTimeFormat("ru-RU",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));

export function AdminView(){
  const [status,setStatus]=useState<"loading"|"guest"|"not-admin"|"admin">("loading");
  const [code,setCode]=useState("");
  const [overview,setOverview]=useState<AdminOverview|null>(null);
  const [reports,setReports]=useState<Report[]>([]);
  const [filter,setFilter]=useState("new");
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  const loadDashboard=useCallback(async()=>{
    setBusy("load");setError("");
    try{
      const [overviewRaw,reportsRaw]=await Promise.all([
        api("/api/admin/overview"),
        api("/api/admin/reports?status="+filter)
      ]);
      if(!isRecord(overviewRaw)||!Array.isArray(overviewRaw.counts))throw new Error("Ответ панели некорректен.");
      setOverview(overviewRaw as unknown as AdminOverview);
      setReports(isRecord(reportsRaw)&&Array.isArray(reportsRaw.reports)?reportsRaw.reports as Report[]:[]);
      setStatus("admin");
    }catch(e){setError(e instanceof Error?e.message:"Не удалось загрузить панель.");}
    finally{setBusy("");}
  },[filter]);

  useEffect(()=>{
    let active=true;
    void fetch("/api/admin/status",{cache:"no-store"})
      .then(async response=>{
        if(response.status===401)return {status:"guest" as const};
        const value:unknown=await response.json();
        if(!response.ok||!isRecord(value))throw new Error("Не удалось проверить права.");
        return {status:value.isAdmin===true?"admin" as const:"not-admin" as const};
      })
      .then(result=>{if(active)setStatus(result.status);})
      .catch(error=>{
        if(active){
          setError(error instanceof Error?error.message:"Ошибка проверки.");
          setStatus("guest");
        }
      });
    return ()=>{active=false;};
  },[]);

  useEffect(()=>{
    if(status!=="admin")return;
    let active=true;
    void Promise.all([
      api("/api/admin/overview"),
      api("/api/admin/reports?status="+filter)
    ])
      .then(([overviewRaw,reportsRaw])=>{
        if(!active)return;
        if(!isRecord(overviewRaw)||!Array.isArray(overviewRaw.counts))
          throw new Error("Ответ панели некорректен.");
        setOverview(overviewRaw as unknown as AdminOverview);
        setReports(isRecord(reportsRaw)&&Array.isArray(reportsRaw.reports)?reportsRaw.reports as Report[]:[]);
      })
      .catch(error=>{
        if(active)setError(error instanceof Error?error.message:"Не удалось загрузить панель.");
      });
    return ()=>{active=false;};
  },[status,filter]);

  async function claim(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy("claim");setError("");setNotice("");
    try{
      await api("/api/admin/claim","POST",{bootstrapCode:code.trim()});
      setCode("");setStatus("admin");setNotice("Владелец ORBIS успешно назначен.");
    }catch(e){setError(e instanceof Error?e.message:"Не удалось назначить администратора.");}
    finally{setBusy("");}
  }
  async function updateReport(report:Report,statusValue:string){
    setBusy(report.id);setError("");setNotice("");
    try{
      await api("/api/admin/reports/"+report.id,"PATCH",{status:statusValue});
      setNotice("Статус жалобы обновлён.");
      await loadDashboard();
    }catch(e){setError(e instanceof Error?e.message:"Не удалось обновить жалобу.");}
    finally{setBusy("");}
  }
  async function moderatePost(report:Report,statusValue:string){
    if(!report.post_id)return;
    setBusy(report.post_id);setError("");setNotice("");
    try{
      await api("/api/admin/posts/"+report.post_id,"PATCH",{status:statusValue});
      setNotice(statusValue==="hidden"?"Публикация скрыта.":"Статус публикации изменён.");
      await loadDashboard();
    }catch(e){setError(e instanceof Error?e.message:"Не удалось изменить публикацию.");}
    finally{setBusy("");}
  }

  return <div className="admin-page">
    <section className="admin-hero">
      <div className="admin-hero-icon"><ShieldCheck size={25}/></div>
      <div><div className="admin-kicker">ORBIS CONTROL CENTER</div><h2>Панель управления</h2>
        <p>Статистика платформы, безопасность и модерация сообщества.</p></div>
      {status==="admin"&&<span className="admin-role-pill"><Shield size={13}/>{overview?.role||"admin"}</span>}
    </section>

    {error&&<div className="admin-alert error" role="alert"><AlertTriangle size={16}/>{error}</div>}
    {notice&&<div className="admin-alert success" role="status"><CheckCircle2 size={16}/>{notice}</div>}

    {status==="loading"&&<div className="admin-state"><LoaderCircle className="spin"/> Проверяем административный доступ…</div>}
    {status==="guest"&&<div className="admin-state"><Shield size={24}/><h3>Нужен вход в ORBIS</h3>
      <p>Войди в зарегистрированный аккаунт, чтобы проверить права владельца.</p>
      <a className="admin-link-button" href="/login">Войти</a></div>}
    {status==="not-admin"&&<section className="admin-claim-card">
      <div className="admin-kicker">ПЕРВИЧНАЯ НАСТРОЙКА</div><h3>Назначить владельца ORBIS</h3>
      <p>Эта операция доступна только один раз. Введи одноразовый код владельца. После успешной проверки повторно использовать его будет нельзя.</p>
      <form onSubmit={claim}>
        <label>Одноразовый код<input value={code} onChange={e=>setCode(e.target.value)} minLength={64} maxLength={64} autoComplete="off" required placeholder="64 символа"/></label>
        <button type="submit" disabled={busy==="claim"||code.trim().length!==64}>
          {busy==="claim"?<LoaderCircle size={16} className="spin"/>:<ShieldCheck size={16}/>} Назначить меня владельцем
        </button>
      </form>
    </section>}

    {status==="admin"&&<div className="admin-dashboard">
      <div className="admin-section-heading"><div><span>ОБЗОР</span><h3>Состояние ORBIS</h3></div>
        <button className="admin-refresh" type="button" onClick={()=>void loadDashboard()} disabled={busy==="load"}>
          {busy==="load"?<LoaderCircle size={15} className="spin"/>:<RefreshCw size={15}/>} Обновить
        </button></div>
      <div className="admin-stat-grid">
        {(overview?.counts||[]).map(item=><article className="admin-stat" key={item.table}>
          <span>{names[item.table]||item.table}</span>
          <strong>{item.error?"—":(item.count??0).toLocaleString("ru-RU")}</strong>
        </article>)}
      </div>
      <section className="admin-section">
        <div className="admin-section-heading"><div><span>MODERATION</span><h3>Жалобы пользователей</h3></div>
          <select value={filter} onChange={e=>setFilter(e.target.value)}>
            <option value="new">Новые</option><option value="reviewing">На рассмотрении</option>
            <option value="resolved">Решённые</option><option value="dismissed">Отклонённые</option><option value="all">Все</option>
          </select>
        </div>
        {reports.length===0&&<div className="admin-empty"><CheckCircle2 size={20}/><strong>Жалоб нет</strong><p>Для выбранного фильтра нет обращений.</p></div>}
        {reports.map(report=><article className="admin-report" key={report.id}>
          <div className="admin-report-top"><span>#{report.id.slice(0,8)}</span><time>{date(report.created_at)}</time><em>{report.status}</em></div>
          <p>{report.reason}</p>
          <div className="admin-report-post">
            <strong>{report.post?.title||"Публикация"}</strong>
            <p>{report.post?.body||"Публикация недоступна."}</p>
            <small>Автор жалобы: @{report.reporter?.username||"неизвестен"}</small>
          </div>
          <div className="admin-report-actions">
            {report.status!=="reviewing"&&<button type="button" onClick={()=>void updateReport(report,"reviewing")} disabled={busy===report.id}>На рассмотрении</button>}
            {report.status!=="resolved"&&<button type="button" onClick={()=>void updateReport(report,"resolved")} disabled={busy===report.id}>Решена</button>}
            {report.status!=="dismissed"&&<button type="button" onClick={()=>void updateReport(report,"dismissed")} disabled={busy===report.id}>Отклонить</button>}
            {report.post?.status==="published"&&<button className="danger" type="button" onClick={()=>void moderatePost(report,"hidden")} disabled={busy===report.post_id}><Trash2 size={14}/> Скрыть пост</button>}
            {report.post?.status==="hidden"&&<button type="button" onClick={()=>void moderatePost(report,"published")} disabled={busy===report.post_id}>Восстановить пост</button>}
          </div>
        </article>)}
      </section>

      <section className="admin-section">
        <div className="admin-section-heading"><div><span>AUDIT LOG</span><h3>Журнал действий</h3></div></div>
        {(overview?.audit||[]).length===0&&<div className="admin-empty"><Clock size={18}/> Пока нет действий.</div>}
        {(overview?.audit||[]).map((item,index)=><div className="admin-audit-row" key={item.action+item.created_at+index}>
          <Activity size={15}/><strong>{item.action}</strong><span>{item.target_type||"—"}</span><time>{date(item.created_at)}</time>
        </div>)}
      </section>
    </div>}
  </div>;
}
