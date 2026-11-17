import {
  callGuestApi,isRecord,jsonNoStore,sessionTokenFromRequest,upstreamErrorMessage
} from "@/lib/orbis/guest-auth.server";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET(request:Request) {
  const token=sessionTokenFromRequest(request);
  if(!token) return jsonNoStore({error:"Войди, чтобы загрузить личное состояние публикаций."},401);
  const url=new URL(request.url);
  const ids=[...new Set((url.searchParams.get("ids")||"").split(",").filter(id=>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  ))].slice(0,30);
  const authors=[...new Set((url.searchParams.get("authors")||"").split(",").filter(name=>
    /^[a-z0-9_.]{3,24}$/i.test(name)
  ))].slice(0,30);
  if(!ids.length&&!authors.length) return jsonNoStore({likedIds:[],savedIds:[],followingUsernames:[]});
  const params=new URLSearchParams();
  if(ids.length) params.set("ids",ids.join(","));
  if(authors.length) params.set("authors",authors.join(","));
  const upstream=await callGuestApi("/api/posts/state?"+params.toString(),"GET",undefined,token,request);
  if(upstream.status<200 || upstream.status>=300 || !isRecord(upstream.payload)) {
    return jsonNoStore({error:upstreamErrorMessage(upstream.payload,"Не удалось загрузить личное состояние.")},upstream.status>=400?upstream.status:502);
  }
  return jsonNoStore(upstream.payload,upstream.status);
}
