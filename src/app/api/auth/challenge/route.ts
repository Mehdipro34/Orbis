import {
  callGuestApi,isSameOriginMutation,jsonNoStore,readJsonBody,
  ChallengeSchema,upstreamErrorMessage
} from "@/lib/orbis/guest-auth.server";

export const dynamic="force-dynamic";

export async function POST(request:Request) {
  if(!isSameOriginMutation(request)) return jsonNoStore({error:"Запрос с другого источника отклонён."},403);
  const body=await readJsonBody(request);
  if(!body.success) return jsonNoStore({error:body.message},body.status);
  const parsed=ChallengeSchema.safeParse(body.data);
  if(!parsed.success) return jsonNoStore({error:"Некорректный идентификатор аккаунта."},400);
  const upstream=await callGuestApi("/api/guest/challenge","POST",parsed.data,undefined,request);
  if(upstream.status<200 || upstream.status>=300) {
    return jsonNoStore({error:upstreamErrorMessage(upstream.payload,"Не удалось начать вход.")},upstream.status);
  }
  return jsonNoStore(upstream.payload,upstream.status);
}
