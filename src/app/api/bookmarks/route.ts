import {
  callGuestApi,isSameOriginMutation,isRecord,jsonNoStore,
  readJsonBody,sessionTokenFromRequest,upstreamErrorMessage
} from "@/lib/orbis/guest-auth.server";
import {BookmarkSchema} from "@/lib/orbis/posts";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET(request:Request) {
  const token=sessionTokenFromRequest(request);
  if(!token) return jsonNoStore({error:"Войди, чтобы открыть закладки."},401);
  const upstream=await callGuestApi("/api/bookmarks","GET",undefined,token,request);
  if(upstream.status<200 || upstream.status>=300 || !isRecord(upstream.payload)) {
    return jsonNoStore({error:upstreamErrorMessage(upstream.payload,"Не удалось загрузить закладки.")},upstream.status>=400?upstream.status:502);
  }
  return jsonNoStore(upstream.payload,upstream.status);
}

export async function POST(request:Request) {
  if(!isSameOriginMutation(request)) return jsonNoStore({error:"Запрос с другого источника отклонён."},403);
  const token=sessionTokenFromRequest(request);
  if(!token) return jsonNoStore({error:"Войди, чтобы сохранять публикации."},401);
  const raw=await readJsonBody(request);
  if(!raw.success) return jsonNoStore({error:raw.message},raw.status);
  const parsed=BookmarkSchema.safeParse(raw.data);
  if(!parsed.success) return jsonNoStore({error:"Некорректная публикация."},400);
  const upstream=await callGuestApi("/api/bookmarks","POST",parsed.data,token,request);
  if(upstream.status<200 || upstream.status>=300) {
    return jsonNoStore({error:upstreamErrorMessage(upstream.payload,"Не удалось сохранить закладку.")},upstream.status>=400?upstream.status:502);
  }
  return jsonNoStore(upstream.payload,upstream.status);
}
