import {
  callGuestApi,isSameOriginMutation,jsonNoStore,readJsonBody,
  RegisterSchema,upstreamErrorMessage
} from "@/lib/orbis/guest-auth.server";

export const dynamic="force-dynamic";

export async function POST(request:Request) {
  if(!isSameOriginMutation(request)) return jsonNoStore({error:"Запрос с другого источника отклонён."},403);
  const body=await readJsonBody(request);
  if(!body.success) return jsonNoStore({error:body.message},body.status);
  const parsed=RegisterSchema.safeParse(body.data);
  if(!parsed.success) return jsonNoStore({error:"Проверь никнейм, описание и ключ устройства."},400);
  if(parsed.data.website.trim()) return jsonNoStore({error:"Не удалось создать профиль."},400);

  const {deviceId,username,bio,publicKey}=parsed.data;
  const upstream=await callGuestApi(
    "/api/guest/register","POST",{deviceId,username,bio,publicKey},undefined,request
  );
  if(upstream.status<200 || upstream.status>=300) {
    return jsonNoStore({error:upstreamErrorMessage(upstream.payload,"Не удалось создать профиль.")},upstream.status);
  }
  return jsonNoStore(upstream.payload,upstream.status);
}
