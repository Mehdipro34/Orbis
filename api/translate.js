"use strict";
const {LANGUAGES}=require("../lib/news-catalog");
const SUPPORTED=new Set(LANGUAGES.filter(x=>x.id!=="all").map(x=>x.id));
module.exports=async function handler(req,res){
 if(req.method!=="POST"){res.setHeader("Allow","POST");return res.status(405).json({error:"Method not allowed"})}
 const target=String(req.body?.target||"ru").toLowerCase();
 const texts=Array.isArray(req.body?.texts)?req.body.texts.map(x=>String(x||"").slice(0,1800)):[];
 if(!SUPPORTED.has(target))return res.status(400).json({error:"Язык пока не поддерживается."});
 if(!texts.length||texts.length>8||texts.some(x=>!x.trim()))return res.status(400).json({error:"Передай от 1 до 8 текстовых фрагментов."});
 if(texts.reduce((s,x)=>s+x.length,0)>5200)return res.status(413).json({error:"Текст слишком большой для одного перевода."});
 try{
  const translated=await Promise.all(texts.map(async text=>{
   const url=new URL("https://translate.googleapis.com/translate_a/single");
   url.searchParams.set("client","gtx");url.searchParams.set("sl","auto");url.searchParams.set("tl",target);url.searchParams.set("dt","t");url.searchParams.set("q",text);
   const response=await fetch(url.href,{headers:{accept:"application/json","user-agent":"Mozilla/5.0 ORBIS News Reader"},signal:AbortSignal.timeout(9000)});
   if(!response.ok)throw new Error("Translation provider unavailable");
   const payload=await response.json();
   const value=Array.isArray(payload?.[0])?payload[0].map(segment=>Array.isArray(segment)?segment[0]||"":"").join(""):"";
   if(!value.trim())throw new Error("Empty translation");
   return value;
  }));
  res.setHeader("Cache-Control","no-store");
  return res.status(200).json({target,translated,provider:"Google Translate"});
 }catch(error){return res.status(502).json({error:"Переводчик временно недоступен. Оригинал новости остаётся доступен."})}
};
