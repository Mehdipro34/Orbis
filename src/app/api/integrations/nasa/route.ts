import {NextResponse} from "next/server";
import {requireOrbisSession} from "@/lib/orbis/require-session.server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request:Request){
  const session=await requireOrbisSession(request);
  if(!session.ok)return NextResponse.json(
    {error:session.status===401?"Войди в ORBIS, чтобы открывать космические материалы.":"Не удалось проверить сессию."},
    {status:session.status,headers:{"Cache-Control":"no-store"}}
  );
  const date=new URL(request.url).searchParams.get("date")||"";
  if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return NextResponse.json({error:"Дата должна быть в формате YYYY-MM-DD."},{status:400});
  const endpoint=new URL("https://api.nasa.gov/planetary/apod");
  endpoint.searchParams.set("api_key","DEMO_KEY");
  endpoint.searchParams.set("thumbs","true");
  if(date)endpoint.searchParams.set("date",date);
  try{
    const response=await fetch(endpoint,{
      headers:{accept:"application/json","User-Agent":"ORBIS/1.0"},
      cache:"force-cache",next:{revalidate:86400},signal:AbortSignal.timeout(8000)
    });
    if(response.status===429)return NextResponse.json({error:"NASA DEMO_KEY временно исчерпал общий лимит запросов."},{status:429});
    if(!response.ok)return NextResponse.json({error:"NASA APOD временно недоступен."},{status:503});
    const raw:unknown=await response.json();
    if(typeof raw!=="object"||raw===null||!("title" in raw)||!("url" in raw))
      return NextResponse.json({error:"NASA вернул некорректный материал."},{status:502});
    const data=raw as {date?:string;title?:string;explanation?:string;url?:string;hdurl?:string;media_type?:string;thumbnail_url?:string;copyright?:string};
    const mediaUrl=data.media_type==="video"?data.thumbnail_url||data.url:data.url;
    if(typeof mediaUrl!=="string")return NextResponse.json({error:"В NASA APOD нет изображения для этого дня."},{status:404});
    let safeUrl:URL;
    try{safeUrl=new URL(mediaUrl);}catch{return NextResponse.json({error:"Некорректная ссылка NASA."},{status:502});}
    if(safeUrl.protocol!=="https:"||!["apod.nasa.gov","images-assets.nasa.gov","www.youtube.com","youtube.com"].includes(safeUrl.hostname))
      return NextResponse.json({error:"NASA вернул неподдерживаемый адрес медиа."},{status:502});
    return NextResponse.json({
      source:"NASA APOD",date:data.date||null,title:data.title||"",
      explanation:data.explanation||"",mediaType:data.media_type||"image",
      imageUrl:mediaUrl,hdUrl:data.hdurl||null,copyright:data.copyright||null,
      pageUrl:"https://apod.nasa.gov/apod/astropix.html"
    },{headers:{"Cache-Control":"private, max-age=3600, s-maxage=86400","Vary":"Cookie"}});
  }catch{
    return NextResponse.json({error:"Не удалось загрузить материал NASA."},{status:503});
  }
}
