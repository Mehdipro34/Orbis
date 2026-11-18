import {NextResponse} from "next/server";
import {requireOrbisSession} from "@/lib/orbis/require-session.server";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET(request:Request){
  const session=await requireOrbisSession(request);
  if(!session.ok)return NextResponse.json(
    {authenticated:false,isAdmin:false,error:session.status===401?"Сначала войди в ORBIS.":"Не удалось проверить сессию."},
    {status:session.status,headers:{"Cache-Control":"no-store"}}
  );
  const response=await fetch(new URL("/api/admin/status",request.url),{cache:"no-store"});
  const payload:unknown=await response.json().catch(()=>({}));
  return NextResponse.json(payload,{status:response.status,headers:{"Cache-Control":"no-store"}});
}
