"use strict";
const {SOURCES,CATEGORIES}=require("../lib/news-catalog");

function decode(value){
 return String(value||"")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1")
  .replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(_,code)=>{
   const n=code[0].toLowerCase()==="x"?parseInt(code.slice(1),16):parseInt(code,10);
   try{return Number.isFinite(n)?String.fromCodePoint(n):""}catch{return ""}
  })
  .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
  .replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'")
  .replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
}
function tag(block,names){
 for(const name of names){
  const m=block.match(new RegExp("<"+name+"(?:\\s[^>]*)?>([\\s\\S]*?)</"+name+"\\s*>","i"));
  if(m)return decode(m[1]);
 }
 return "";
}
function safeExternal(value){
 try{
  let raw=String(value||"").trim();
  if(raw.startsWith("//"))raw="https:"+raw;
  const u=new URL(decode(raw));
  if(u.protocol==="http:")u.protocol="https:";
  if(u.protocol!=="https:"||!u.hostname||u.hostname==="localhost"||u.hostname.endsWith(".localhost")||u.hostname==="127.0.0.1"||u.hostname==="0.0.0.0"||u.hostname==="::1")return null;
  return u.href;
 }catch{return null}
}
function extractImage(block){
 const candidates=[
  block.match(/<media:thumbnail\b[^>]*url=["']([^"']+)["']/i)?.[1],
  block.match(/<media:content\b(?=[^>]*medium=["']image["'])[^>]*url=["']([^"']+)["']/i)?.[1],
  block.match(/<enclosure\b(?=[^>]*type=["']image\/)[^>]*url=["']([^"']+)["']/i)?.[1],
  block.match(/<itunes:image\b[^>]*href=["']([^"']+)["']/i)?.[1],
  block.match(/<img\b[^>]*src=["']([^"']+)["']/i)?.[1],
  block.match(/<image>\s*<url>([\s\S]*?)<\/url>/i)?.[1]
 ].filter(Boolean);
 for(const candidate of candidates){const url=safeExternal(candidate);if(url)return url}
 return null;
}
function extractVideo(block){
 const m=block.match(/<(?:media:content|enclosure)\b(?=[^>]*(?:medium=["']video["']|type=["']video\/(?:mp4|webm)["']))[^>]*url=["']([^"']+)["']/i);
 const videoUrl=m?safeExternal(m[1]):null;
 const id=tag(block,["yt:videoId"]);
 const videoId=/^[A-Za-z0-9_-]{11}$/.test(id)?id:null;
 return {videoUrl,videoId};
}
function extractLink(block){
 const plain=tag(block,["link"]);
 if(plain&&/^https:\/\//i.test(plain))return safeExternal(plain);
 const links=[...block.matchAll(/<link\b([^>]*)\/?>/gi)].map(m=>m[1]);
 const preferred=links.find(a=>/rel=["']alternate["']/i.test(a))||links[0]||"";
 const href=preferred.match(/href=["']([^"']+)["']/i)?.[1]||"";
 return safeExternal(href);
}
function familySafe(item){
 const text=(item.title+" "+item.summary).toLocaleLowerCase();
 const blocked=/(?:\bporn(?:ography)?\b|\bexplicit sex\b|\brape\b|\bsexual assault\b|\bsex trafficking\b|\bchild abuse\b|\bgraphic violence\b|\bmassacre\b|\bsuicide\b|\bself[- ]harm\b|\bdrug trafficking\b|\boverdose\b|\bbeheading\b|\btorture\b|\bterror attack\b|\bshooting spree\b|порно|изнасил|сексуальн.{0,16}насил|домогательств|насилие над детьми|убийств|убит[аоы]?|самоубийств|суицид|самоповрежден|наркотрафик|передозиров|обезглав|пытк|теракт|массовая стрельба|cinsi zorakılıq|zorlama|uşaq istismarı|qətl|öldür|intihar|narkotik|partlayış|terror)/iu;
 return !blocked.test(text);
}
function parse(xml,source){
 const blocks=[...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1\s*>/gi)].map(x=>x[2]);
 const items=[];
 for(const block of blocks.slice(0,35)){
  const title=tag(block,["title"]);
  const url=extractLink(block);
  if(!title||!url)continue;
  const summary=tag(block,["description","summary","content:encoded","content"]);
  const date=tag(block,["pubDate","published","updated","dc:date"]);
  const media=extractVideo(block);
  const item={
   id:url,title:title.slice(0,240),summary:summary.slice(0,520),url,
   image:extractImage(block),videoUrl:media.videoUrl,videoId:media.videoId,
   publishedAt:date&&!Number.isNaN(Date.parse(date))?new Date(date).toISOString():null,
   source:source.name,credit:source.credit,language:source.language,languageName:source.languageName,
   country:source.country,countryName:source.countryName,category:source.category,
   tags:[source.category,source.countryName,source.publisher].filter(Boolean)
  };
  if(familySafe(item))items.push(item);
 }
 return items;
}
async function loadSource(source){
 const response=await fetch(source.url,{
  headers:{accept:"application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5","user-agent":"ORBIS News Reader/4.0"},
  signal:AbortSignal.timeout(6500)
 });
 if(!response.ok)throw new Error("HTTP "+response.status);
 const xml=await response.text();
 if(!xml||!/<(?:rss|feed|rdf:RDF)\b/i.test(xml))throw new Error("Unsupported RSS format");
 return parse(xml,source);
}
function pickRotating(list,limit,rotation){
 if(list.length<=limit)return list;
 const start=rotation%list.length;
 return Array.from({length:limit},(_,i)=>list[(start+i)%list.length]);
}
module.exports=async function handler(req,res){
 if(req.method!=="GET"){res.setHeader("Allow","GET");return res.status(405).json({error:"Method not allowed"})}
 const sourceId=String(req.query.source||"");
 const categoryId=String(req.query.category||"all");
 const country=String(req.query.country||"all").toUpperCase();
 const language=String(req.query.language||"all").toLowerCase();
 const allowedCats=new Set(CATEGORIES.map(x=>x.id));
 if(categoryId!=="all"&&!allowedCats.has(categoryId))return res.status(400).json({error:"Неизвестная категория"});
 let selected=[];
 if(sourceId){
  const source=SOURCES.find(x=>x.id===sourceId);
  if(!source)return res.status(404).json({error:"Источник не найден"});
  selected=[source];
 }else{
  const pool=SOURCES.filter(s=>(categoryId==="all"||s.category===categoryId)&&(country==="ALL"||s.country===country)&&(language==="all"||s.language===language));
  const rotation=Math.floor(Date.now()/600000);
  if(categoryId==="all"){
   for(let i=0;i<CATEGORIES.length;i++){
    const cat=CATEGORIES[(i+rotation)%CATEGORIES.length];
    const match=pool.filter(s=>s.category===cat.id);
    selected.push(...pickRotating(match,2,Math.floor(rotation/ CATEGORIES.length)+i*3));
   }
  }else{
   selected=pickRotating(pool,12,rotation*2);
  }
 }
 if(!selected.length)return res.status(404).json({error:"Для этого фильтра пока нет подключённых источников. Выбери другой язык или страну."});
 const settled=await Promise.allSettled(selected.map(loadSource));
 const merged=[],failed=[];
 for(let i=0;i<settled.length;i++){
  const result=settled[i];
  if(result.status==="fulfilled")merged.push(...result.value);
  else failed.push({name:selected[i].name,reason:String(result.reason?.message||"Unavailable").slice(0,80)});
 }
 const unique=new Map();
 for(const item of merged)if(!unique.has(item.url))unique.set(item.url,item);
 const items=[...unique.values()].sort((a,b)=>(Date.parse(b.publishedAt||0)||0)-(Date.parse(a.publishedAt||0)||0)).slice(0,categoryId==="all"?90:45);
 res.setHeader("Cache-Control","s-maxage=600, stale-while-revalidate=1800, stale-if-error=86400");
 if(!items.length)return res.status(502).json({error:"Выбранные RSS-источники временно не ответили. Попробуй обновить ленту.",failedSources:failed});
 return res.status(200).json({
  category:categoryId,categoryName:categoryId==="all"?"Все темы":CATEGORIES.find(x=>x.id===categoryId)?.name,
  country,language,items,sourceCount:selected.length,workingSources:settled.filter(x=>x.status==="fulfilled").length,
  failedSources:failed,fetchedAt:Date.now()
 });
};
