import {callGuestApi,isRecord,isSameOriginMutation,jsonNoStore,readJsonBody,sessionTokenFromRequest} from "@/lib/orbis/guest-auth.server";

export const dynamic="force-dynamic";

export async function POST(request:Request){
  if(!isSameOriginMutation(request))return jsonNoStore({error:"Запрос с другого источника отклонён."},403);
  const token=sessionTokenFromRequest(request);
  if(!token)return jsonNoStore({error:"Войди в ORBIS."},401);
  const body=await readJsonBody(request);
  if(!body.success)return jsonNoStore({error:body.message},body.status);
  if(!isRecord(body.data))return jsonNoStore({error:"Некорректный запрос настройки администратора."},400);
  const code=typeof body.data.bootstrapCode==="string"?body.data.bootstrapCode.trim():"";
  if(!/^[a-f0-9]{64}$/i.test(code))return jsonNoStore({error:"Введи корректный одноразовый код настройки."},400);
  const upstream=await callGuestApi("/api/admin/claim","POST",{bootstrapCode:code},token,request);
  if(upstream.status<200||upstream.status>=300)return jsonNoStore(
    {error:typeof upstream.payload==="object"&&upstream.payload!==null&&"error" in upstream.payload
      ?String((upstream.payload as {error:unknown}).error):"Не удалось назначить администратора."},
    upstream.status>=400?upstream.status:502
  );
  return jsonNoStore(upstream.payload,upstream.status);
}
