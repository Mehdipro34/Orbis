import {
  callGuestApi,isSameOriginMutation,jsonNoStore,
  sessionTokenFromRequest,upstreamErrorMessage
} from "@/lib/orbis/guest-auth.server";

export const dynamic="force-dynamic";

export async function POST(
  request:Request,
  context:{params:Promise<{postId:string}>}
) {
  if(!isSameOriginMutation(request)) return jsonNoStore({error:"Запрос с другого источника отклонён."},403);
  const token=sessionTokenFromRequest(request);
  if(!token) return jsonNoStore({error:"Войди, чтобы поставить реакцию."},401);
  const {postId}=await context.params;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(postId)) {
    return jsonNoStore({error:"Некорректный ID публикации."},400);
  }
  const upstream=await callGuestApi("/api/posts/"+postId+"/like","POST",{},token,request);
  if(upstream.status<200 || upstream.status>=300) {
    return jsonNoStore({error:upstreamErrorMessage(upstream.payload,"Не удалось сохранить реакцию.")},upstream.status>=400?upstream.status:502);
  }
  return jsonNoStore(upstream.payload,upstream.status);
}
