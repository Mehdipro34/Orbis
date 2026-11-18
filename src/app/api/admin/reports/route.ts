import {isRecord,jsonNoStore,callGuestApi,sessionTokenFromRequest} from "@/lib/orbis/guest-auth.server";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET(request:Request){
  const token=sessionTokenFromRequest(request);
  if(!token)return jsonNoStore({error:"Войди в ORBIS."},401);
  const status=new URL(request.url).searchParams.get("status")||"new";
  if(!["new","reviewing","resolved","dismissed","all"].includes(status))
    return jsonNoStore({error:"Неизвестный статус жалоб."},400);
  const upstream=await callGuestApi("/api/admin/reports?status="+encodeURIComponent(status),"GET",undefined,token,request);
  if(upstream.status<200||upstream.status>=300||!isRecord(upstream.payload))
    return jsonNoStore({error:typeof upstream.payload==="object"&&upstream.payload!==null&&"error" in upstream.payload
      ?String((upstream.payload as {error:unknown}).error):"Не удалось загрузить жалобы."},
      upstream.status>=400?upstream.status:502);
  return jsonNoStore(upstream.payload,200);
}
