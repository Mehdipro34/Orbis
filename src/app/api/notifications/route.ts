import {
  callGuestApi,isRecord,jsonNoStore,sessionTokenFromRequest,upstreamErrorMessage
} from "@/lib/orbis/guest-auth.server";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET(request:Request) {
  const token=sessionTokenFromRequest(request);
  if(!token)return jsonNoStore({error:"Войди, чтобы открыть уведомления."},401);
  const upstream=await callGuestApi("/api/notifications","GET",undefined,token,request);
  if(upstream.status<200||upstream.status>=300||!isRecord(upstream.payload)) {
    return jsonNoStore({error:upstreamErrorMessage(upstream.payload,"Не удалось загрузить уведомления.")},upstream.status>=400?upstream.status:502);
  }
  return jsonNoStore(upstream.payload,upstream.status);
}
