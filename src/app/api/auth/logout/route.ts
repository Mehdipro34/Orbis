import {NextResponse} from "next/server";
import {GUEST_SESSION_COOKIE,isSameOriginMutation,jsonNoStore} from "@/lib/orbis/guest-auth.server";

export const dynamic="force-dynamic";

export async function POST(request:Request) {
  if(!isSameOriginMutation(request)) return jsonNoStore({error:"Запрос с другого источника отклонён."},403);
  const response=NextResponse.json({ok:true},{status:200,headers:{"Cache-Control":"no-store"}});
  response.cookies.set({
    name:GUEST_SESSION_COOKIE,value:"",httpOnly:true,
    secure:process.env.NODE_ENV==="production",sameSite:"lax",
    path:"/",maxAge:0
  });
  return response;
}
