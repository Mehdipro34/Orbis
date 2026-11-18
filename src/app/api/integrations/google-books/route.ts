import {NextResponse} from "next/server";
import {requireOrbisSession} from "@/lib/orbis/require-session.server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request:Request){
  const session=await requireOrbisSession(request);
  if(!session.ok)return NextResponse.json(
    {error:session.status===401?"Войди в ORBIS, чтобы искать книги.":"Не удалось проверить сессию."},
    {status:session.status,headers:{"Cache-Control":"no-store"}}
  );
  const params=new URL(request.url).searchParams;
  const query=(params.get("q")||"").trim().slice(0,120);
  if(query.length<2)return NextResponse.json({error:"Введи название книги или автора."},{status:400});
  const endpoint=new URL("https://www.googleapis.com/books/v1/volumes");
  endpoint.searchParams.set("q",query);
  endpoint.searchParams.set("maxResults","12");
  endpoint.searchParams.set("printType","books");
  endpoint.searchParams.set("orderBy","relevance");
  try{
    const response=await fetch(endpoint,{
      headers:{accept:"application/json","User-Agent":"ORBIS/1.0"},
      cache:"force-cache",next:{revalidate:3600},signal:AbortSignal.timeout(8000)
    });
    if(response.status===429)return NextResponse.json({error:"Google Books временно ограничил поиск."},{status:429});
    if(!response.ok)return NextResponse.json({error:"Google Books временно недоступен."},{status:503});
    const raw:unknown=await response.json();
    const rows=typeof raw==="object"&&raw!==null&&"items" in raw?(raw as {items?:unknown[]}).items:[];
    const results=(Array.isArray(rows)?rows:[]).flatMap(item=>{
      if(typeof item!=="object"||item===null)return [];
      const row=item as {id?:unknown;volumeInfo?:{
        title?:unknown;authors?:unknown[];description?:unknown;publishedDate?:unknown;
        imageLinks?:{thumbnail?:unknown};infoLink?:unknown;language?:unknown
      }};
      const info=row.volumeInfo;
      if(typeof row.id!=="string"||typeof info?.title!=="string")return [];
      return [{
        id:row.id,title:info.title,
        authors:Array.isArray(info.authors)?info.authors.filter((x):x is string=>typeof x==="string").slice(0,4):[],
        description:typeof info.description==="string"?info.description.replace(/<[^>]*>/g,"").slice(0,500):"",
        publishedDate:typeof info.publishedDate==="string"?info.publishedDate:null,
        coverUrl:typeof info.imageLinks?.thumbnail==="string"?info.imageLinks.thumbnail.replace("http://","https://"):null,
        language:typeof info.language==="string"?info.language:null,
        pageUrl:typeof info.infoLink==="string"?info.infoLink:"https://books.google.com/"
      }];
    });
    return NextResponse.json({source:"Google Books",query,results},{
      headers:{"Cache-Control":"private, max-age=1800, s-maxage=3600","Vary":"Cookie"}
    });
  }catch{
    return NextResponse.json({error:"Не удалось выполнить поиск Google Books."},{status:503});
  }
}
