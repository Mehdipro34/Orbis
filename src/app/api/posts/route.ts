import {NextResponse} from "next/server";
import {callGuestApi,isSameOriginMutation,jsonNoStore,readJsonBody,sessionTokenFromRequest,upstreamErrorMessage} from "@/lib/orbis/guest-auth.server";
import {CreatePostSchema} from "@/lib/orbis/posts";
import {PublicFeedResponseSchema,parsePublicFeedQuery} from "@/lib/orbis/public-feed";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET(request:Request) {
  const token=sessionTokenFromRequest(request);
  if(!token)return jsonNoStore({
    error:{code:"AUTH_REQUIRED",message:"Зарегистрируйся или войди, чтобы открыть ленту ORBIS."}
  },401);

  const url=new URL(request.url);
  const parsed=parsePublicFeedQuery(url.searchParams);
  if(!parsed.success)return jsonNoStore({
    error:{code:"INVALID_QUERY",message:"Проверь режим, размер страницы и курсор ленты."}
  },400);

  const params=new URLSearchParams({
    mode:parsed.data.mode==="popular"?"popular":"latest",
    limit:String(parsed.data.limit)
  });
  if(parsed.data.cursor)params.set("cursor",parsed.data.cursor);

  const upstream=await callGuestApi(
    "/api/posts?"+params.toString(),"GET",undefined,token,request
  );
  if(upstream.status===401||upstream.status===404)return jsonNoStore({
    error:{code:"SESSION_EXPIRED",message:"Сессия закончилась. Войди повторно."}
  },401);
  if(upstream.status<200||upstream.status>=300||!isRecord(upstream.payload)){
    return jsonNoStore({
      error:{
        code:"FEED_UNAVAILABLE",
        message:upstreamErrorMessage(upstream.payload,"Не удалось загрузить ленту ORBIS.")
      }
    },upstream.status>=400?upstream.status:502);
  }

  const validated=PublicFeedResponseSchema.safeParse(upstream.payload);
  if(!validated.success)return jsonNoStore({
    error:{code:"INVALID_UPSTREAM_RESPONSE",message:"Сервер вернул некорректную ленту."}
  },502);

  return jsonNoStore(validated.data,200);
}

export async function POST(request:Request) {
  if(!isSameOriginMutation(request)) {
    return jsonNoStore({error:"Запрос с другого источника отклонён."},403);
  }
  const token=sessionTokenFromRequest(request);
  if(!token) return jsonNoStore({error:"Сначала войди в аккаунт ORBIS."},401);

  const body=await readJsonBody(request);
  if(!body.success) return jsonNoStore({error:body.message},body.status);
  const parsed=CreatePostSchema.safeParse(body.data);
  if(!parsed.success) {
    const issue=parsed.error.issues[0];
    return jsonNoStore({error:issue?.message||"Проверь текст публикации."},400);
  }

  const upstream=await callGuestApi("/api/posts","POST",parsed.data,token,request);
  if(upstream.status<200 || upstream.status>=300) {
    return jsonNoStore({
      error:upstreamErrorMessage(upstream.payload,"Не удалось сохранить публикацию.")
    },upstream.status>=400?upstream.status:502);
  }
  return jsonNoStore(upstream.payload,201);
}
