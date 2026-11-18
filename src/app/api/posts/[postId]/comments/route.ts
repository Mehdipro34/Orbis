import {
  callGuestApi,isSameOriginMutation,isRecord,jsonNoStore,
  readJsonBody,sessionTokenFromRequest,upstreamErrorMessage
} from "@/lib/orbis/guest-auth.server";
import {CreateCommentSchema} from "@/lib/orbis/posts";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET(
  request:Request,
  context:{params:Promise<{postId:string}>}
) {
  const token=sessionTokenFromRequest(request);
  if(!token) return jsonNoStore({error:"Войди, чтобы просматривать обсуждение."},401);
  const {postId}=await context.params;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(postId)) {
    return jsonNoStore({error:"Некорректный ID публикации."},400);
  }
  const upstream=await callGuestApi("/api/posts/"+postId+"/comments?limit=20","GET",undefined,token,request);
  if(upstream.status<200 || upstream.status>=300 || !isRecord(upstream.payload)) {
    return jsonNoStore({error:upstreamErrorMessage(upstream.payload,"Не удалось загрузить комментарии.")},upstream.status>=400?upstream.status:502);
  }
  return jsonNoStore(upstream.payload,upstream.status);
}

export async function POST(
  request:Request,
  context:{params:Promise<{postId:string}>}
) {
  if(!isSameOriginMutation(request)) return jsonNoStore({error:"Запрос с другого источника отклонён."},403);
  const token=sessionTokenFromRequest(request);
  if(!token) return jsonNoStore({error:"Войди, чтобы комментировать."},401);
  const {postId}=await context.params;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(postId)) {
    return jsonNoStore({error:"Некорректный ID публикации."},400);
  }
  const raw=await readJsonBody(request);
  if(!raw.success) return jsonNoStore({error:raw.message},raw.status);
  const parsed=CreateCommentSchema.safeParse(raw.data);
  if(!parsed.success) return jsonNoStore({error:parsed.error.issues[0]?.message||"Проверь текст комментария."},400);
  const upstream=await callGuestApi("/api/posts/"+postId+"/comments","POST",parsed.data,token,request);
  if(upstream.status<200 || upstream.status>=300) {
    return jsonNoStore({error:upstreamErrorMessage(upstream.payload,"Не удалось сохранить комментарий.")},upstream.status>=400?upstream.status:502);
  }
  return jsonNoStore(upstream.payload,upstream.status);
}
