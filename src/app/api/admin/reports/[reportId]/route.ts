import {jsonNoStore,callGuestApi,isSameOriginMutation,readJsonBody,sessionTokenFromRequest,isRecord} from "@/lib/orbis/guest-auth.server";

export const dynamic="force-dynamic";

export async function PATCH(request:Request,{params}:{params:Promise<{reportId:string}>}){
  if(!isSameOriginMutation(request))return jsonNoStore({error:"Запрос с другого источника отклонён."},403);
  const token=sessionTokenFromRequest(request);
  if(!token)return jsonNoStore({error:"Войди в ORBIS."},401);
  const {reportId}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(reportId))return jsonNoStore({error:"Некорректная жалоба."},400);
  const body=await readJsonBody(request);
  if(!body.success)return jsonNoStore({error:body.message},body.status);
  const upstream=await callGuestApi("/api/admin/reports/"+reportId,"PATCH",body.data,token,request);
  if(upstream.status<200||upstream.status>=300||!isRecord(upstream.payload))
    return jsonNoStore({error:typeof upstream.payload==="object"&&upstream.payload!==null&&"error" in upstream.payload
      ?String((upstream.payload as {error:unknown}).error):"Не удалось обновить жалобу."},
      upstream.status>=400?upstream.status:502);
  return jsonNoStore(upstream.payload,200);
}
