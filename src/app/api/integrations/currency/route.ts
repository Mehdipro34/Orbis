import {NextResponse} from "next/server";
import {requireOrbisSession} from "@/lib/orbis/require-session.server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request:Request){
  const session=await requireOrbisSession(request);
  if(!session.ok)return NextResponse.json(
    {error:session.status===401?"Войди в ORBIS, чтобы использовать виджеты.":"Не удалось проверить сессию ORBIS."},
    {status:session.status,headers:{"Cache-Control":"no-store"}}
  );
  const params=new URL(request.url).searchParams;
  const base=(params.get("base")||"USD").trim().toUpperCase();
  const quote=(params.get("quote")||"EUR").trim().toUpperCase();
  const amount=Number(params.get("amount")??"1");
  const date=params.get("date")||"";
  if(!/^[A-Z]{3}$/.test(base)||!/^[A-Z]{3}$/.test(quote))
    return NextResponse.json({error:"Используй трёхбуквенные коды валют."},{status:400});
  if(!Number.isFinite(amount)||amount<0||amount>1_000_000_000_000)
    return NextResponse.json({error:"Укажи корректную сумму."},{status:400});
  if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return NextResponse.json({error:"Дата должна быть в формате YYYY-MM-DD."},{status:400});
  if(base===quote)return NextResponse.json({
    base,quote,amount,rate:1,converted:amount,date:date||new Date().toISOString().slice(0,10),source:"Frankfurter"
  },{headers:{"Cache-Control":"private, max-age=1800"}});
  const endpoint=new URL("https://api.frankfurter.dev/v2/rate/"+base+"/"+quote);
  if(date)endpoint.searchParams.set("date",date);
  try{
    const response=await fetch(endpoint,{
      headers:{accept:"application/json","User-Agent":"ORBIS/1.0 (https://orbis-mehdipro34.vercel.app)"},
      cache:"force-cache",next:{revalidate:3600},signal:AbortSignal.timeout(7000)
    });
    if(response.status===404)return NextResponse.json({error:"Эта пара валют или дата отсутствуют в справочнике."},{status:404});
    if(!response.ok)return NextResponse.json({error:"Сервис курсов валют временно недоступен."},{status:503});
    const raw:unknown=await response.json();
    if(typeof raw!=="object"||raw===null||!("rate" in raw)||typeof (raw as {rate?:unknown}).rate!=="number")
      return NextResponse.json({error:"Провайдер вернул некорректный курс."},{status:502});
    const data=raw as {date?:string;base?:string;quote?:string;counter?:string;rate:number};
    return NextResponse.json({
      date:data.date||null,base:data.base||base,quote:data.counter||data.quote||quote,
      amount,rate:data.rate,converted:Number((amount*data.rate).toFixed(6)),
      source:"Frankfurter",
      note:"Справочный курс центральных банков, не биржевая котировка в реальном времени."
    },{headers:{"Cache-Control":"private, max-age=1800","Vary":"Cookie"}});
  }catch{
    return NextResponse.json({error:"Не удалось получить курс валют. Попробуй позже."},{status:503});
  }
}
