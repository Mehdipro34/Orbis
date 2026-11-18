import {NextResponse} from "next/server";
import {requireOrbisSession} from "@/lib/orbis/require-session.server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const numeric=(value:unknown):number|null=>
  typeof value==="number"&&Number.isFinite(value)?value:null;

export async function GET(request:Request){
  const session=await requireOrbisSession(request);
  if(!session.ok)return NextResponse.json(
    {error:session.status===401?"Войди в ORBIS, чтобы использовать виджеты.":"Не удалось проверить сессию ORBIS."},
    {status:session.status,headers:{"Cache-Control":"no-store"}}
  );
  const params=new URL(request.url).searchParams;
  const lat=Number(params.get("lat")),lon=Number(params.get("lon"));
  if(!Number.isFinite(lat)||lat< -90||lat>90||!Number.isFinite(lon)||lon< -180||lon>180)
    return NextResponse.json({error:"Передай корректные координаты."},{status:400});
  const endpoint=new URL("https://api.met.no/weatherapi/locationforecast/2.0/compact");
  endpoint.searchParams.set("lat",lat.toFixed(4));
  endpoint.searchParams.set("lon",lon.toFixed(4));
  try{
    const response=await fetch(endpoint,{
      headers:{
        accept:"application/json",
        "User-Agent":"ORBIS/1.0 (https://orbis-mehdipro34.vercel.app)"
      },
      cache:"force-cache",next:{revalidate:900},signal:AbortSignal.timeout(7000)
    });
    if(!response.ok)return NextResponse.json({error:"Сервис погоды временно недоступен."},{status:response.status===429?429:503});
    const raw:unknown=await response.json();
    if(typeof raw!=="object"||raw===null||!("properties" in raw))
      return NextResponse.json({error:"Провайдер вернул некорректный прогноз."},{status:502});
    const properties=(raw as {properties?:{meta?:{updated_at?:string};timeseries?:unknown[]}}).properties;
    const rows=Array.isArray(properties?.timeseries)?properties.timeseries:[];
    const forecast=rows.slice(0,8).flatMap(row=>{
      if(typeof row!=="object"||row===null)return [];
      const entry=row as {
        time?:unknown;
        data?:{
          instant?:{details?:Record<string,unknown>};
          next_1_hours?:{summary?:{symbol_code?:unknown}};
          next_6_hours?:{summary?:{symbol_code?:unknown}}
        }
      };
      const details=entry.data?.instant?.details||{};
      return [{
        time:typeof entry.time==="string"?entry.time:null,
        temperatureC:numeric(details.air_temperature),
        windMps:numeric(details.wind_speed),
        humidityPercent:numeric(details.relative_humidity),
        pressureHpa:numeric(details.air_pressure_at_sea_level),
        symbolCode:typeof entry.data?.next_1_hours?.summary?.symbol_code==="string"
          ?entry.data.next_1_hours.summary.symbol_code
          :typeof entry.data?.next_6_hours?.summary?.symbol_code==="string"
            ?entry.data.next_6_hours.summary.symbol_code:null
      }];
    });
    if(!forecast.length)return NextResponse.json({error:"Прогноз для этой точки не найден."},{status:404});
    return NextResponse.json({
      source:"MET Norway",
      sourceUrl:"https://api.met.no/weatherapi/locationforecast/2.0/documentation",
      updatedAt:properties?.meta?.updated_at||null,
      coordinates:{lat,lon},current:forecast[0],forecast
    },{headers:{"Cache-Control":"private, max-age=300","Vary":"Cookie"}});
  }catch{
    return NextResponse.json({error:"Не удалось загрузить погоду. Попробуй позже."},{status:503});
  }
}
