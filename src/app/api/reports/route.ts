import {
  callGuestApi,isRecord,isSameOriginMutation,jsonNoStore,
  readJsonBody,sessionTokenFromRequest,upstreamErrorMessage
} from "@/lib/orbis/guest-auth.server";
import {CreateReportSchema} from "@/lib/orbis/community";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function POST(request:Request) {
  if(!isSameOriginMutation(request))return jsonNoStore({error:"Запрос с другого источника отклонён."},403);
  const token=sessionTokenFromRequest(request);
  if(!token)return jsonNoStore({error:"Войди, чтобы отправить жалобу."},401);
  const raw=await readJsonBody(request);
  if(!raw.success)return jsonNoStore({error:raw.message},raw.status);
  const parsed=CreateReportSchema.safeParse(raw.data);
  if(!parsed.success)return jsonNoStore({error:parsed.error.issues[0]?.message||"Проверь жалобу."},400);
  const upstream=await callGuestApi("/api/reports","POST",parsed.data,token,request);
  if(upstream.status<200||upstream.status>=300||!isRecord(upstream.payload)) {
    return jsonNoStore({error:upstreamErrorMessage(upstream.payload,"Не удалось отправить жалобу.")},upstream.status>=400?upstream.status:502);
  }
  return jsonNoStore(upstream.payload,upstream.status);
}
