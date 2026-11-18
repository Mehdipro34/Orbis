import {NextResponse} from "next/server";
import {callGuestApi,isRecord,jsonNoStore} from "@/lib/orbis/guest-auth.server";
import {requireOrbisSession} from "@/lib/orbis/require-session.server";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET(request:Request){
  const session=await requireOrbisSession(request);
  if(!session.ok)return jsonNoStore({
    authenticated:false,isAdmin:false,
    error:session.status===401?"Сначала войди в ORBIS.":"Не удалось проверить сессию."
  },session.status);
  const result=await callGuestApi("/api/admin/status","GET",undefined,session.token,request);
  if(result.status<200||result.status>=300||!isRecord(result.payload)){
    return jsonNoStore({
      authenticated:true,isAdmin:false,
      error:typeof result.payload==="object"&&result.payload!==null&&"error" in result.payload
        ?String((result.payload as {error:unknown}).error)
        :"Не удалось проверить права администратора."
    },result.status>=400?result.status:502);
  }
  return jsonNoStore(result.payload,200);
}
