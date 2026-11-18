import {callGuestApi,jsonNoStore,sessionTokenFromRequest,isRecord} from "@/lib/orbis/guest-auth.server";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET(request:Request){
  const token=sessionTokenFromRequest(request);
  if(!token)return jsonNoStore({authenticated:false,isAdmin:false,error:"Сначала войди в ORBIS."},401);
  const upstream=await callGuestApi("/api/admin/status","GET",undefined,token,request);
  if(upstream.status<200||upstream.status>=300||!isRecord(upstream.payload))
    return jsonNoStore({authenticated:false,isAdmin:false,error:typeof upstream.payload==="object"&&upstream.payload!==null&&"error" in upstream.payload
      ?String((upstream.payload as {error:unknown}).error):"Не удалось проверить административную роль."},
      upstream.status>=400?upstream.status:502);
  return jsonNoStore(upstream.payload,200);
}
