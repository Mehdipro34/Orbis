import {NextResponse} from "next/server";
import {requireOrbisSession} from "@/lib/orbis/require-session.server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request:Request){
  const session=await requireOrbisSession(request);
  if(!session.ok)return NextResponse.json(
    {error:session.status===401?"Войди в ORBIS, чтобы искать изображения.":"Не удалось проверить сессию."},
    {status:session.status,headers:{"Cache-Control":"no-store"}}
  );
  const params=new URL(request.url).searchParams;
  const query=(params.get("q")||"").trim().slice(0,120);
  if(query.length<2)return NextResponse.json({error:"Введи не менее двух символов."},{status:400});
  const endpoint=new URL("https://commons.wikimedia.org/w/api.php");
  endpoint.searchParams.set("action","query");
  endpoint.searchParams.set("generator","search");
  endpoint.searchParams.set("gsrsearch","filetype:bitmap "+query);
  endpoint.searchParams.set("gsrnamespace","6");
  endpoint.searchParams.set("gsrlimit","12");
  endpoint.searchParams.set("prop","imageinfo");
  endpoint.searchParams.set("iiprop","url|extmetadata");
  endpoint.searchParams.set("iiurlwidth","480");
  endpoint.searchParams.set("format","json");
  endpoint.searchParams.set("origin","*");
  try{
    const response=await fetch(endpoint,{
      headers:{accept:"application/json","User-Agent":"ORBIS/1.0 (https://orbis-mehdipro34.vercel.app)"},
      cache:"force-cache",next:{revalidate:1800},signal:AbortSignal.timeout(8000)
    });
    if(!response.ok)return NextResponse.json({error:"Wikimedia Commons временно недоступен."},{status:503});
    const raw:unknown=await response.json();
    const pages=typeof raw==="object"&&raw!==null&&"query" in raw&&
      typeof (raw as {query?:unknown}).query==="object"&&(raw as {query:{pages?:unknown}}).query!==null
      ?(raw as {query:{pages?:Record<string,unknown>}}).query.pages:null;
    const results=Object.values(pages||{}).flatMap(item=>{
      if(typeof item!=="object"||item===null)return [];
      const row=item as {pageid?:unknown;title?:unknown;imageinfo?:Array<{thumburl?:unknown;descriptionurl?:unknown;extmetadata?:Record<string,{value?:unknown}>}>};
      const info=row.imageinfo?.[0];
      if(typeof row.pageid!=="number"||typeof row.title!=="string"||typeof info?.thumburl!=="string")return [];
      const meta=info.extmetadata||{};
      const value=(key:string)=>typeof meta[key]?.value==="string"
        ?String(meta[key].value).replace(/<[^>]*>/g,"").slice(0,300):"";
      return [{
        id:String(row.pageid),title:row.title.replace(/^File:/,""),
        imageUrl:info.thumburl,
        pageUrl:typeof info.descriptionurl==="string"?info.descriptionurl:"https://commons.wikimedia.org/wiki/"+encodeURIComponent(row.title),
        artist:value("Artist"),
        license:value("LicenseShortName"),
        credit:value("Credit")
      }];
    });
    return NextResponse.json({
      source:"Wikimedia Commons",query,results,
      attributionNotice:"Проверяй лицензию, автора и условия повторного использования на странице каждого файла."
    },{headers:{"Cache-Control":"private, max-age=900, s-maxage=1800","Vary":"Cookie"}});
  }catch{
    return NextResponse.json({error:"Не удалось выполнить поиск изображений."},{status:503});
  }
}
