import {
  callGuestApi,isRecord,sessionTokenFromRequest
} from "@/lib/orbis/guest-auth.server";

export type OrbisSessionCheck=
  | {ok:true;token:string;username:string;userId:string}
  | {ok:false;status:401|503};

export async function requireOrbisSession(request:Request):Promise<OrbisSessionCheck>{
  const token=sessionTokenFromRequest(request);
  if(!token)return {ok:false,status:401};
  const upstream=await callGuestApi("/api/guest/me","GET",undefined,token,request);
  if(upstream.status===401||upstream.status===404)return {ok:false,status:401};
  if(upstream.status<200||upstream.status>=300||!isRecord(upstream.payload)||
    !isRecord(upstream.payload.user)||typeof upstream.payload.user.username!=="string"||
    typeof upstream.payload.user.id!=="string"){
    return {ok:false,status:503};
  }
  return {ok:true,token,username:upstream.payload.user.username,userId:upstream.payload.user.id};
}
