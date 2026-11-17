import {NextResponse} from "next/server";
import {
  callGuestApi,GUEST_SESSION_COOKIE,GUEST_SESSION_MAX_AGE,
  isRecord,isSameOriginMutation,isValidGuestToken,jsonNoStore,
  readJsonBody,upstreamErrorMessage,VerifySchema
} from "@/lib/orbis/guest-auth.server";

export const dynamic="force-dynamic";

export async function POST(request:Request) {
  if(!isSameOriginMutation(request)) return jsonNoStore({error:"Запрос с другого источника отклонён."},403);
  const body=await readJsonBody(request);
  if(!body.success) return jsonNoStore({error:body.message},body.status);
  const parsed=VerifySchema.safeParse(body.data);
  if(!parsed.success) return jsonNoStore({error:"Некорректное подтверждение входа."},400);

  const upstream=await callGuestApi("/api/guest/verify","POST",parsed.data,undefined,request);
  if(upstream.status<200 || upstream.status>=300 || !isRecord(upstream.payload)) {
    return jsonNoStore({
      error:upstreamErrorMessage(upstream.payload,"Не удалось завершить вход.")
    },upstream.status>=400?upstream.status:502);
  }
  const token=upstream.payload.token;
  const user=upstream.payload.user;
  if(!isValidGuestToken(token) || !isRecord(user)) {
    return jsonNoStore({error:"Сервис входа вернул неполную сессию."},502);
  }

  const response=Response.json({ok:true,user},{
    status:200,headers:{"Cache-Control":"no-store"}
  });
  const nextResponse=new NextResponse(response.body,response);
  nextResponse.cookies.set({
    name:GUEST_SESSION_COOKIE,value:token,httpOnly:true,
    secure:process.env.NODE_ENV==="production",sameSite:"lax",
    path:"/",maxAge:GUEST_SESSION_MAX_AGE
  });
  return nextResponse;
}
