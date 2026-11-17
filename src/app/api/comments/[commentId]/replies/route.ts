import {
  callGuestApi,isRecord,jsonNoStore,sessionTokenFromRequest,upstreamErrorMessage
} from "@/lib/orbis/guest-auth.server";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET(
  request:Request,
  context:{params:Promise<{commentId:string}>}
) {
  const token=sessionTokenFromRequest(request);
  if(!token) return jsonNoStore({error:"Войди, чтобы просматривать ответы."},401);
  const {commentId}=await context.params;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(commentId)) {
    return jsonNoStore({error:"Некорректный ID комментария."},400);
  }
  const upstream=await callGuestApi("/api/comments/"+commentId+"/replies","GET",undefined,token,request);
  if(upstream.status<200 || upstream.status>=300 || !isRecord(upstream.payload)) {
    return jsonNoStore({error:upstreamErrorMessage(upstream.payload,"Не удалось загрузить ответы.")},upstream.status>=400?upstream.status:502);
  }
  return jsonNoStore(upstream.payload,upstream.status);
}
