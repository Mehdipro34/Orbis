import {NextResponse} from "next/server";
import {
  callGuestApi,GUEST_SESSION_COOKIE,isRecord,
  jsonNoStore,sessionTokenFromRequest
} from "@/lib/orbis/guest-auth.server";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET(request:Request) {
  const token=sessionTokenFromRequest(request);
  if(!token) return jsonNoStore({authenticated:false,error:"Сессия не найдена."},401);

  const upstream=await callGuestApi("/api/guest/me","GET",undefined,token,request);
  if(upstream.status===401 || upstream.status===404) {
    const response=NextResponse.json(
      {authenticated:false,error:"Сессия истекла. Войди с помощью ключа восстановления."},
      {status:401,headers:{"Cache-Control":"no-store"}}
    );
    response.cookies.set({
      name:GUEST_SESSION_COOKIE,value:"",httpOnly:true,
      secure:process.env.NODE_ENV==="production",sameSite:"lax",
      path:"/",maxAge:0
    });
    return response;
  }
  if(upstream.status<200 || upstream.status>=300 || !isRecord(upstream.payload)) {
    return jsonNoStore({authenticated:false,error:"Не удалось проверить сессию ORBIS."},
      upstream.status>=400?upstream.status:503);
  }
  return jsonNoStore(upstream.payload,200);
}
