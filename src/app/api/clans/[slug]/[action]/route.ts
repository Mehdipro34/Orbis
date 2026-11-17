import {
  callGuestApi,isRecord,isSameOriginMutation,jsonNoStore,
  sessionTokenFromRequest,upstreamErrorMessage
} from "@/lib/orbis/guest-auth.server";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function POST(
  request:Request,
  context:{params:Promise<{slug:string;action:string}>}
) {
  if(!isSameOriginMutation(request))return jsonNoStore({error:"Запрос с другого источника отклонён."},403);
  const token=sessionTokenFromRequest(request);
  if(!token)return jsonNoStore({error:"Войди, чтобы изменить состав клана."},401);
  const {slug,action}=await context.params;
  if(!/^[a-z0-9-]{3,40}$/i.test(slug)||!(action==="join"||action==="leave")) {
    return jsonNoStore({error:"Некорректное действие клана."},400);
  }
  const upstream=await callGuestApi("/api/clans/"+encodeURIComponent(slug)+"/"+action,"POST",{},token,request);
  if(upstream.status<200||upstream.status>=300||!isRecord(upstream.payload)) {
    return jsonNoStore({error:upstreamErrorMessage(upstream.payload,"Не удалось изменить участие в клане.")},upstream.status>=400?upstream.status:502);
  }
  return jsonNoStore(upstream.payload,upstream.status);
}
