import {
  callGuestApi,isRecord,isSameOriginMutation,jsonNoStore,
  readJsonBody,sessionTokenFromRequest,upstreamErrorMessage
} from "@/lib/orbis/guest-auth.server";
import {CreateClanSchema} from "@/lib/orbis/community";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET(request:Request) {
  const token=sessionTokenFromRequest(request);
  if(!token)return jsonNoStore({error:"Войди, чтобы просматривать кланы."},401);
  const upstream=await callGuestApi("/api/clans","GET",undefined,token,request);
  if(upstream.status<200||upstream.status>=300||!isRecord(upstream.payload)) {
    return jsonNoStore({error:upstreamErrorMessage(upstream.payload,"Не удалось загрузить кланы.")},upstream.status>=400?upstream.status:502);
  }
  return jsonNoStore(upstream.payload,upstream.status);
}

export async function POST(request:Request) {
  if(!isSameOriginMutation(request))return jsonNoStore({error:"Запрос с другого источника отклонён."},403);
  const token=sessionTokenFromRequest(request);
  if(!token)return jsonNoStore({error:"Войди, чтобы создать клан."},401);
  const raw=await readJsonBody(request);
  if(!raw.success)return jsonNoStore({error:raw.message},raw.status);
  const parsed=CreateClanSchema.safeParse(raw.data);
  if(!parsed.success)return jsonNoStore({error:parsed.error.issues[0]?.message||"Проверь название клана."},400);
  const upstream=await callGuestApi("/api/clans","POST",parsed.data,token,request);
  if(upstream.status<200||upstream.status>=300||!isRecord(upstream.payload)) {
    return jsonNoStore({error:upstreamErrorMessage(upstream.payload,"Не удалось создать клан.")},upstream.status>=400?upstream.status:502);
  }
  return jsonNoStore(upstream.payload,upstream.status);
}
