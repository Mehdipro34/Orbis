import {NextResponse} from "next/server";
import {requireOrbisSession} from "@/lib/orbis/require-session.server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const BASE="https://www.thesportsdb.com/api/v1/json/123/";
const SPORTS=new Set(["Soccer","Basketball","American Football","Baseball","Ice Hockey","Rugby","Cricket","Motorsport","Tennis"]);

export async function GET(request:Request){
  const session=await requireOrbisSession(request);
  if(!session.ok)return NextResponse.json(
    {error:session.status===401?"Войди в ORBIS, чтобы использовать виджеты.":"Не удалось проверить сессию ORBIS."},
    {status:session.status,headers:{"Cache-Control":"no-store"}}
  );
  const params=new URL(request.url).searchParams;
  const view=params.get("view")||"day";
  const url=new URL(BASE);
  let revalidate=300;
  if(view==="day"){
    const date=params.get("date")||new Date().toISOString().slice(0,10);
    const sport=params.get("sport")||"Soccer";
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!SPORTS.has(sport))
      return NextResponse.json({error:"Проверь дату и вид спорта."},{status:400});
    url.pathname+="eventsday.php";url.searchParams.set("d",date);url.searchParams.set("s",sport);
  }else if(view==="league"){
    const country=(params.get("country")||"England").trim().slice(0,50);
    const sport=params.get("sport")||"Soccer";
    if(!country||!SPORTS.has(sport))return NextResponse.json({error:"Укажи страну и вид спорта."},{status:400});
    url.pathname+="search_all_leagues.php";url.searchParams.set("c",country);url.searchParams.set("s",sport);
    revalidate=3600;
  }else if(view==="table"){
    const league=params.get("league")||"";
    const season=params.get("season")||"";
    if(!/^\d{1,10}$/.test(league)||!/^\d{4}-\d{4}$/.test(season))
      return NextResponse.json({error:"Для таблицы укажи ID лиги и сезон, например 2025-2026."},{status:400});
    url.pathname+="lookuptable.php";url.searchParams.set("l",league);url.searchParams.set("s",season);
    revalidate=900;
  }else if(view==="team"){
    const query=(params.get("name")||"").trim();
    if(query.length<2||query.length>80)return NextResponse.json({error:"Название команды должно содержать от 2 до 80 символов."},{status:400});
    url.pathname+="searchteams.php";url.searchParams.set("t",query);
    revalidate=3600;
  }else{
    return NextResponse.json({error:"Неизвестный раздел спортивного каталога."},{status:400});
  }
  try{
    const response=await fetch(url,{
      headers:{accept:"application/json","User-Agent":"ORBIS/1.0 (https://orbis-mehdipro34.vercel.app)"},
      cache:"force-cache",next:{revalidate},signal:AbortSignal.timeout(7000)
    });
    if(response.status===429)return NextResponse.json({error:"TheSportsDB ограничил частоту запросов. Попробуй позже."},{status:429});
    if(!response.ok)return NextResponse.json({error:"Спортивный каталог временно недоступен."},{status:503});
    const data:unknown=await response.json();
    if(typeof data!=="object"||data===null)return NextResponse.json({error:"Некорректный ответ спортивного каталога."},{status:502});
    return NextResponse.json({
      source:"TheSportsDB",view,data
    },{headers:{"Cache-Control":`private, max-age=120, s-maxage=${revalidate}, stale-while-revalidate=${revalidate*3}`,"Vary":"Cookie"}});
  }catch{
    return NextResponse.json({error:"Не удалось загрузить спортивные данные."},{status:503});
  }
}
