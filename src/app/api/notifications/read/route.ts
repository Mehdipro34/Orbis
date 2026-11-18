import {
  callGuestApi,isRecord,isSameOriginMutation,jsonNoStore,
  readJsonBody,sessionTokenFromRequest,upstreamErrorMessage
} from "@/lib/orbis/guest-auth.server";
import {ReadNotificationSchema} from "@/lib/orbis/community";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function POST(request:Request) {
  if(!isSameOriginMutation(request))return jsonNoStore({error:"Запрос с другого источника отклонён."},403);
  const token=sessionTokenFromRequest(request);
  if(!token)return jsonNoStore({error:"Войди, чтобы изменять уведомления."},401);
  const raw=await readJsonBody(request);
  if(!raw.success)return jsonNoStore({error:raw.message},raw.status);
  const parsed=ReadNotificationSchema.safeParse(raw.data);
  if(!parsed.success)return jsonNoStore({error:"Некорректный ID уведомления."},400);
  const upstream=await callGuestApi("/api/notifications/read","POST",parsed.data,token,request);
  if(upstream.status<200||upstream.status>=300||!isRecord(upstream.payload)) {
    return jsonNoStore({error:upstreamErrorMessage(upstream.payload,"Не удалось обновить уведомления.")},upstream.status>=400?upstream.status:502);
  }
  return jsonNoStore(upstream.payload,upstream.status);
}
