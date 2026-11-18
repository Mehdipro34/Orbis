import {NextResponse} from "next/server";
import {requireOrbisSession} from "@/lib/orbis/require-session.server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request:Request){
  const session=await requireOrbisSession(request);
  if(!session.ok)return NextResponse.json(
    {error:session.status===401?"Войди в ORBIS, чтобы использовать каталог книг.":"Не удалось проверить сессию ORBIS."},
    {status:session.status,headers:{"Cache-Control":"no-store"}}
  );
  const params=new URL(request.url).searchParams;
  const query=(params.get("q")||"").trim().slice(0,120);
  const language=(params.get("lang")||"").trim().toLowerCase();
  if(query.length<2)return NextResponse.json({error:"Введи название книги или автора."},{status:400});
  if(language&&!/^[a-z]{2}$/.test(language))return NextResponse.json({error:"Некорректный код языка."},{status:400});
  const endpoint=new URL("https://openlibrary.org/search.json");
  endpoint.searchParams.set("q",query);
  endpoint.searchParams.set("limit","12");
  endpoint.searchParams.set("fields","key,title,author_name,first_publish_year,cover_i,edition_count,language,isbn");
  if(language)endpoint.searchParams.set("language",language);
  try{
    const response=await fetch(endpoint,{
      headers:{accept:"application/json","User-Agent":"ORBIS/1.0 (https://orbis-mehdipro34.vercel.app)"},
      cache:"force-cache",next:{revalidate:3600},signal:AbortSignal.timeout(7000)
    });
    if(!response.ok)return NextResponse.json({error:"Каталог Open Library временно недоступен."},{status:503});
    const raw:unknown=await response.json();
    const docs=typeof raw==="object"&&raw!==null&&"docs" in raw
      ?(raw as {docs?:unknown[]}).docs:[];
    const results=(Array.isArray(docs)?docs:[]).flatMap(item=>{
      if(typeof item!=="object"||item===null)return [];
      const row=item as {
        key?:unknown;title?:unknown;author_name?:unknown;first_publish_year?:unknown;
        cover_i?:unknown;edition_count?:unknown;language?:unknown;isbn?:unknown
      };
      if(typeof row.key!=="string"||typeof row.title!=="string")return [];
      return [{
        key:row.key,title:row.title,
        authors:Array.isArray(row.author_name)?row.author_name.filter((x):x is string=>typeof x==="string").slice(0,4):[],
        firstPublishYear:typeof row.first_publish_year==="number"?row.first_publish_year:null,
        coverUrl:typeof row.cover_i==="number"?"https://covers.openlibrary.org/b/id/"+row.cover_i+"-M.jpg":null,
        editionCount:typeof row.edition_count==="number"?row.edition_count:null,
        languages:Array.isArray(row.language)?row.language.filter((x):x is string=>typeof x==="string").slice(0,4):[],
        url:"https://openlibrary.org"+row.key
      }];
    });
    return NextResponse.json({source:"Open Library",query,results},{
      headers:{"Cache-Control":"private, max-age=1800, s-maxage=3600","Vary":"Cookie"}
    });
  }catch{
    return NextResponse.json({error:"Не удалось выполнить поиск книг."},{status:503});
  }
}
