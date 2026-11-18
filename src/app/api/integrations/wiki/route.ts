import {NextResponse} from "next/server";
import {requireOrbisSession} from "@/lib/orbis/require-session.server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request:Request){
  const session=await requireOrbisSession(request);
  if(!session.ok)return NextResponse.json(
    {error:session.status===401?"Войди в ORBIS, чтобы использовать поиск.":"Не удалось проверить сессию ORBIS."},
    {status:session.status,headers:{"Cache-Control":"no-store"}}
  );
  const params=new URL(request.url).searchParams;
  const query=(params.get("q")||"").trim().slice(0,120);
  const language=(params.get("lang")||"ru").toLowerCase();
  if(query.length<2)return NextResponse.json({error:"Введи не менее двух символов."},{status:400});
  if(!/^[a-z]{2,12}$/.test(language))return NextResponse.json({error:"Некорректный язык поиска."},{status:400});
  const endpoint=new URL("https://"+language+".wikipedia.org/w/api.php");
  endpoint.searchParams.set("action","query");
  endpoint.searchParams.set("list","search");
  endpoint.searchParams.set("srsearch",query);
  endpoint.searchParams.set("srlimit","10");
  endpoint.searchParams.set("format","json");
  endpoint.searchParams.set("formatversion","2");
  endpoint.searchParams.set("utf8","1");
  try{
    const response=await fetch(endpoint,{
      headers:{accept:"application/json","User-Agent":"ORBIS/1.0 (https://orbis-mehdipro34.vercel.app)"},
      cache:"force-cache",next:{revalidate:3600},signal:AbortSignal.timeout(7000)
    });
    if(!response.ok)return NextResponse.json({error:"Поиск Wikipedia временно недоступен."},{status:503});
    const raw:unknown=await response.json();
    const queryObject=typeof raw==="object"&&raw!==null&&"query" in raw
      ?(raw as {query?:{search?:unknown[]}}).query:null;
    const items=Array.isArray(queryObject?.search)?queryObject.search:[];
    const results=items.flatMap(item=>{
      if(typeof item!=="object"||item===null)return [];
      const row=item as {pageid?:unknown;title?:unknown;snippet?:unknown;timestamp?:unknown};
      if(typeof row.pageid!=="number"||typeof row.title!=="string")return [];
      return [{
        pageId:row.pageid,title:row.title,
        snippet:typeof row.snippet==="string"?row.snippet.replace(/<[^>]*>/g,""): "",
        url:"https://"+language+".wikipedia.org/?curid="+row.pageid,
        updatedAt:typeof row.timestamp==="string"?row.timestamp:null
      }];
    });
    return NextResponse.json({source:"Wikipedia",language,query,results},{
      headers:{"Cache-Control":"private, max-age=1800, s-maxage=3600","Vary":"Cookie"}
    });
  }catch{
    return NextResponse.json({error:"Не удалось выполнить поиск Wikipedia."},{status:503});
  }
}
