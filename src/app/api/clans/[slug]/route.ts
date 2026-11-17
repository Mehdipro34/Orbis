import {
  callGuestApi,isRecord,jsonNoStore,sessionTokenFromRequest,upstreamErrorMessage
} from "@/lib/orbis/guest-auth.server";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET(
  request:Request,
  context:{params:Promise<{slug:string}>}
) {
  const token=sessionTokenFromRequest(request);
  if(!token)return jsonNoStore({error:"Войди, чтобы просматривать клан."},401);
  const {slug}=await context.params;
  if(!/^[a-z0-9-]{3,40}$/i.test(slug))return jsonNoStore({error:"Некорректный адрес клана."},400);
  const upstream=await callGuestApi("/api/clans/"+encodeURIComponent(slug),"GET",undefined,token,request);
  if(upstream.status<200||upstream.status>=300||!isRecord(upstream.payload)) {
    return jsonNoStore({error:upstreamErrorMessage(upstream.payload,"Не удалось загрузить клан.")},upstream.status>=400?upstream.status:502);
  }
  return jsonNoStore(upstream.payload,upstream.status);
}
