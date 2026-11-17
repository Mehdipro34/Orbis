import {
  callGuestApi,isRecord,jsonNoStore,sessionTokenFromRequest,upstreamErrorMessage
} from "@/lib/orbis/guest-auth.server";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET(
  request:Request,
  context:{params:Promise<{username:string}>}
) {
  const token=sessionTokenFromRequest(request);
  if(!token) return jsonNoStore({error:"Войди, чтобы просматривать профили."},401);
  const {username}=await context.params;
  if(!/^[a-z0-9_.]{3,24}$/i.test(username)) {
    return jsonNoStore({error:"Некорректный username."},400);
  }
  const upstream=await callGuestApi("/api/profile/"+encodeURIComponent(username.toLowerCase()),"GET",undefined,token,request);
  if(upstream.status<200 || upstream.status>=300 || !isRecord(upstream.payload)) {
    return jsonNoStore({error:upstreamErrorMessage(upstream.payload,"Не удалось загрузить профиль.")},upstream.status>=400?upstream.status:502);
  }
  return jsonNoStore(upstream.payload,upstream.status);
}
