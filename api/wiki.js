"use strict";
const {WIKI_LANGUAGES}=require("../lib/news-catalog");
const SUPPORTED=new Set(WIKI_LANGUAGES.map(x=>x.id));
module.exports=async function handler(req,res){
 if(req.method!=="GET"){res.setHeader("Allow","GET");return res.status(405).json({error:"Method not allowed"})}
 const query=String(req.query.q||"").trim().slice(0,140);
 const lang=String(req.query.lang||"ru").toLowerCase();
 if(!SUPPORTED.has(lang))return res.status(400).json({error:"Этот язык пока не поддерживается."});
 if(query.length<2)return res.status(400).json({error:"Введи не менее двух символов."});
 try{
  const url=new URL("https://"+lang+".wikipedia.org/w/api.php");
  url.searchParams.set("action","query");url.searchParams.set("generator","search");url.searchParams.set("gsrsearch",query);url.searchParams.set("gsrlimit","12");
  url.searchParams.set("prop","extracts|pageimages|info");url.searchParams.set("exintro","1");url.searchParams.set("explaintext","1");url.searchParams.set("exchars","760");
  url.searchParams.set("piprop","thumbnail");url.searchParams.set("pithumbsize","720");url.searchParams.set("inprop","url");url.searchParams.set("format","json");
  const response=await fetch(url.href,{headers:{accept:"application/json","user-agent":"ORBIS Knowledge Reader/4.0 (https://orbis-mehdipro34.vercel.app)"},signal:AbortSignal.timeout(9000)});
  if(!response.ok)throw new Error("Wikipedia HTTP "+response.status);
  const data=await response.json();
  const results=Object.values(data.query?.pages||{}).sort((a,b)=>(a.index||0)-(b.index||0)).map(page=>({
   pageId:page.pageid,title:page.title,extract:String(page.extract||"").slice(0,900),image:page.thumbnail?.source||null,
   url:page.fullurl||("https://"+lang+".wikipedia.org/wiki/"+encodeURIComponent(page.title.replace(/ /g,"_"))),language:lang
  }));
  res.setHeader("Cache-Control","s-maxage=900, stale-while-revalidate=3600, stale-if-error=86400");
  return res.status(200).json({query,language:lang,results,source:"Wikipedia"});
 }catch(error){return res.status(502).json({error:"Википедия временно недоступна. Попробуй ещё раз."})}
};
