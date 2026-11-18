import {NextResponse} from "next/server";
import {requireOrbisSession} from "@/lib/orbis/require-session.server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

type GiphyImage={url?:unknown;width?:unknown;height?:unknown};
type GiphyRow={
  id?:unknown;title?:unknown;url?:unknown;
  images?:{fixed_width?:GiphyImage;fixed_width_small?:GiphyImage;original?:GiphyImage}
};

export async function GET(request:Request){
  const session=await requireOrbisSession(request);
  if(!session.ok)return NextResponse.json(
    {error:session.status===401?"Войди в ORBIS, чтобы искать GIF.":"Не удалось проверить сессию ORBIS."},
    {status:session.status,headers:{"Cache-Control":"no-store"}}
  );
  const query=(new URL(request.url).searchParams.get("q")||"").trim().slice(0,100);
  if(query.length<2)return NextResponse.json({error:"Введи не менее двух символов."},{status:400});
  const key=process.env.GIPHY_API_KEY;
  if(!key)return NextResponse.json({error:"GIPHY ещё не настроен для этой версии приложения."},{status:503});
  const endpoint=new URL("https://api.giphy.com/v1/gifs/search");
  endpoint.searchParams.set("api_key",key);
  endpoint.searchParams.set("q",query);
  endpoint.searchParams.set("limit","12");
  endpoint.searchParams.set("rating","g");
  endpoint.searchParams.set("lang","ru");
  try{
    const response=await fetch(endpoint,{
      headers:{accept:"application/json","User-Agent":"ORBIS/1.0"},
      cache:"force-cache",next:{revalidate:600},signal:AbortSignal.timeout(8000)
    });
    if(response.status===429)return NextResponse.json({error:"GIPHY временно ограничил количество запросов."},{status:429});
    if(!response.ok)return NextResponse.json({error:"GIPHY временно недоступен."},{status:503});
    const raw:unknown=await response.json();
    const data=typeof raw==="object"&&raw!==null&&"data" in raw?(raw as {data?:unknown}).data:[];
    const results=(Array.isArray(data)?data:[]).flatMap((item)=>{
      if(typeof item!=="object"||item===null)return [];
      const row=item as GiphyRow;
      if(typeof row.id!=="string")return [];
      const image=row.images?.fixed_width||row.images?.fixed_width_small||row.images?.original;
      if(typeof image?.url!=="string")return [];
      let imageUrl:URL;
      try{imageUrl=new URL(image.url);}catch{return [];}
      if(imageUrl.protocol!=="https:"||!imageUrl.hostname.endsWith(".giphy.com"))return [];
      const pageUrl=typeof row.url==="string"&&row.url.startsWith("https://")?row.url:"https://giphy.com/";
      return [{
        id:row.id,title:typeof row.title==="string"?row.title:"",
        url:pageUrl,
        images:{fixed_width:{
          url:imageUrl.toString(),
          width:typeof image.width==="string"||typeof image.width==="number"?String(image.width):"180",
          height:typeof image.height==="string"||typeof image.height==="number"?String(image.height):"140"
        }}
      }];
    });
    return NextResponse.json({source:"GIPHY",query,results},{
      headers:{"Cache-Control":"private, max-age=300, s-maxage=600","Vary":"Cookie"}
    });
  }catch{
    return NextResponse.json({error:"Не удалось выполнить поиск GIF."},{status:503});
  }
}
