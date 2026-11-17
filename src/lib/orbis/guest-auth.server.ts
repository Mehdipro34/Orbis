import {z} from "zod";
import {orbisEdgeFunctionUrl,supabasePublishableKey} from "./config";

export const GUEST_SESSION_COOKIE="orbis_guest_session";
export const GUEST_SESSION_MAX_AGE=30*24*60*60;

const DeviceIdSchema=z.string().uuid();
const CoordinateSchema=z.string().regex(/^[A-Za-z0-9_-]{40,50}$/);
const PublicKeySchema=z.object({
  kty:z.literal("EC"),crv:z.literal("P-256"),
  x:CoordinateSchema,y:CoordinateSchema
}).passthrough();

export const RegisterSchema=z.object({
  deviceId:DeviceIdSchema,
  username:z.string().trim().toLowerCase().regex(/^[a-z0-9_.]{3,24}$/),
  bio:z.string().trim().max(180).default(""),
  publicKey:PublicKeySchema,
  website:z.string().max(300).optional().default("")
}).strict();
export const ChallengeSchema=z.object({deviceId:DeviceIdSchema}).strict();
export const VerifySchema=z.object({
  deviceId:DeviceIdSchema,
  challengeId:z.string().uuid(),
  signature:z.string().regex(/^[A-Za-z0-9_-]{80,100}$/)
}).strict();

export function isRecord(value:unknown):value is Record<string,unknown> {
  return typeof value==="object" && value!==null && !Array.isArray(value);
}

export function jsonNoStore(payload:unknown,status=200) {
  return Response.json(payload,{status,headers:{"Cache-Control":"no-store"}});
}

export function isSameOriginMutation(request:Request):boolean {
  if(request.headers.get("sec-fetch-site")==="cross-site") return false;
  const origin=request.headers.get("origin");
  if(!origin) return process.env.NODE_ENV!=="production";
  try {
    return new URL(origin).origin===new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function readJsonBody(request:Request):Promise<
  {success:true;data:unknown}|{success:false;status:number;message:string}
> {
  if(!(request.headers.get("content-type")||"").toLowerCase().includes("application/json")) {
    return {success:false,status:415,message:"Ожидается JSON-запрос."};
  }
  const contentLength=Number(request.headers.get("content-length")||0);
  if(Number.isFinite(contentLength) && contentLength>12_000) {
    return {success:false,status:413,message:"Запрос слишком большой."};
  }
  try {
    const raw=await request.text();
    if(raw.length>12_000) return {success:false,status:413,message:"Запрос слишком большой."};
    return {success:true,data:JSON.parse(raw) as unknown};
  } catch {
    return {success:false,status:400,message:"Некорректный JSON."};
  }
}

export function sessionTokenFromRequest(request:Request):string|null {
  const cookieHeader=request.headers.get("cookie")||"";
  for(const part of cookieHeader.split(";")) {
    const index=part.indexOf("=");
    if(index<0 || part.slice(0,index).trim()!==GUEST_SESSION_COOKIE) continue;
    const value=part.slice(index+1).trim();
    return /^[A-Za-z0-9_-]{20,300}\.[A-Za-z0-9_-]{40,100}$/.test(value)?value:null;
  }
  return null;
}

function getClientIp(request?:Request):string|undefined {
  if(!request) return undefined;
  const value=request.headers.get("x-real-ip")||request.headers.get("cf-connecting-ip");
  if(!value) return undefined;
  const ip=value.trim();
  return ip.length<=64?ip:undefined;
}

export async function callGuestApi(
  path:string,method:"GET"|"POST"|"PUT",body?:unknown,bearerToken?:string,request?:Request
):Promise<{status:number;payload:unknown}> {
  const headers=new Headers({apikey:supabasePublishableKey,accept:"application/json"});
  if(body!==undefined) headers.set("Content-Type","application/json");
  if(bearerToken) headers.set("Authorization","Bearer "+bearerToken);
  const ip=getClientIp(request);
  if(ip) headers.set("x-real-ip",ip);

  let response:Response;
  try {
    response=await fetch(orbisEdgeFunctionUrl+path,{
      method,headers,body:body===undefined?undefined:JSON.stringify(body),
      cache:"no-store",signal:AbortSignal.timeout(8000)
    });
  } catch {
    return {status:503,payload:{error:"Сервис ORBIS временно недоступен. Попробуй ещё раз."}};
  }
  let payload:unknown;
  try { payload=await response.json(); }
  catch { payload={error:"Сервис ORBIS вернул некорректный ответ."}; }
  return {status:response.status,payload};
}

export function upstreamErrorMessage(payload:unknown,fallback:string):string {
  return isRecord(payload) && typeof payload.error==="string"?payload.error:fallback;
}

export function isValidGuestToken(value:unknown):value is string {
  return typeof value==="string" &&
    /^[A-Za-z0-9_-]{20,300}\.[A-Za-z0-9_-]{40,100}$/.test(value);
}
