import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};
const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const safeProfile = (p: any) => p ? ({ username:p.username, name:p.display_name, bio:p.bio||"", avatar_url:p.avatar_url||null, publicNumber:p.public_number==null?null:String(p.public_number), createdAt:p.created_at }) : null;

function basicTextGuard(value:string){
  const text=String(value||"").trim();
  const links=(text.match(/https?:\/\/|t\.me\//gi)||[]).length;
  if(links>3)return "Слишком много ссылок в одной публикации.";
  if(/(.)\1{24,}/u.test(text))return "Слишком много повторяющихся символов.";
  const words=text.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[];
  if(words.length>=18){
    const unique=new Set(words).size;
    if(unique/words.length<0.24)return "Текст похож на повторяющийся спам.";
  }
  const allAgesBlocked=/(?:\bporn(?:ography)?\b|\brape\b|\bsexual assault\b|\bsex trafficking\b|\bchild abuse\b|\bmurder(?:ed)?\b|\bmassacre\b|\bsuicide\b|\bself[- ]harm\b|\bdrug trafficking\b|\boverdose\b|\bshooting\b|\bbombing\b|\bbeheading\b|\btorture\b|\bterror attack\b|порно|изнасил|сексуальн.{0,12}насил|домогательств|убийств|убит[аоы]?|труп|самоубийств|суицид|самоповрежден|наркотик|наркобанд|расстрел|взрыв|бомб|обезглав|пытк|теракт|cinsi zorakılıq|zorlama|qətl|öldür|intihar|narkotik|partlayış|terror)/iu;
  if(allAgesBlocked.test(text))return "Этот материал не подходит для общей ленты ORBIS. Публикуй безопасный для всех возрастов контент.";
  return null;
}


async function enrichPostCounts(admin:any, uid:string, rows:any[]){
  if(!rows.length)return rows;
  const ids=rows.map((p:any)=>p.id).filter(Boolean);
  if(!ids.length)return rows;
  const [{data:likes},{data:mine},{data:bookmarks}]=await Promise.all([
    admin.from("post_like_counts").select("post_id,like_count").in("post_id",ids),
    admin.from("post_likes").select("post_id").eq("user_id",uid).in("post_id",ids),
    admin.from("bookmarks").select("post_id").eq("user_id",uid).in("post_id",ids)
  ]);
  const likeMap=new Map((likes||[]).map((x:any)=>[x.post_id,Number(x.like_count)||0]));
  const liked=new Set((mine||[]).map((x:any)=>x.post_id));
  const saved=new Set((bookmarks||[]).map((x:any)=>x.post_id));
  return rows.map((p:any)=>({...p,postNumber:p.post_number==null?null:String(p.post_number),authorNumber:p.profiles?.public_number==null?null:String(p.profiles.public_number),likes:likeMap.get(p.id)||0,liked:liked.has(p.id),saved:saved.has(p.id)}));
}


const encoder=new TextEncoder();
function bytesToBase64Url(bytes:Uint8Array){
  let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/=/g,"").replaceAll("+","-").replaceAll("/","_");
}
function base64UrlToBytes(value:string){
  const normalized=value.replace(/-/g,"+").replace(/_/g,"/");
  const binary=atob(normalized+"=".repeat((4-normalized.length%4)%4));
  return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
async function guestHmacKey(secret:string){
  return await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);
}
async function issueGuestToken(uid:string,secret:string){
  const payload=bytesToBase64Url(encoder.encode(JSON.stringify({sub:uid,exp:Date.now()+30*24*60*60*1000})));
  const signature=new Uint8Array(await crypto.subtle.sign("HMAC",await guestHmacKey(secret),encoder.encode(payload)));
  return payload+"."+bytesToBase64Url(signature);
}
async function verifyGuestToken(token:string,secret:string){
  try{
    const parts=token.split(".");if(parts.length!==2)return null;
    const signature=base64UrlToBytes(parts[1]);
    const valid=await crypto.subtle.verify("HMAC",await guestHmacKey(secret),signature,encoder.encode(parts[0]));
    if(!valid)return null;
    const payload=JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[0])));
    if(typeof payload.sub!=="string"||! /^[0-9a-f-]{36}$/i.test(payload.sub)||!Number.isFinite(payload.exp)||payload.exp<Date.now())return null;
    return payload.sub as string;
  }catch{return null}
}

async function enrichPolls(admin:any,uid:string,rows:any[]){
  const ids=rows.filter((p:any)=>Array.isArray(p.poll_options)&&p.poll_options.length>=2).map((p:any)=>p.id);
  if(!ids.length)return rows;
  const [{data:counts},{data:mine}]=await Promise.all([
    admin.from("post_poll_counts").select("post_id,option_index,vote_count").in("post_id",ids),
    admin.from("post_poll_votes").select("post_id,option_index").eq("user_id",uid).in("post_id",ids)
  ]);
  const map=new Map<string,number[]>();
  for(const row of counts||[]){const values=map.get(row.post_id)||[];values[Number(row.option_index)]=Number(row.vote_count)||0;map.set(row.post_id,values)}
  const mineMap=new Map((mine||[]).map((x:any)=>[x.post_id,Number(x.option_index)]));
  return rows.map((p:any)=>{
    if(!Array.isArray(p.poll_options)||p.poll_options.length<2)return p;
    const values=map.get(p.id)||[];
    const counts=p.poll_options.map((_:any,i:number)=>values[i]||0);
    return {...p,poll:{options:p.poll_options,counts,total:counts.reduce((x:number,y:number)=>x+y,0),myVote:mineMap.has(p.id)?mineMap.get(p.id):null,endsAt:p.poll_ends_at||null}};
  });
}

async function notifyUser(admin:any, recipientId:string, actorId:string, kind:string, entityId:string|null, body:string){
  if(!recipientId || recipientId===actorId)return;
  const {error}=await admin.from("notifications").insert({recipient_id:recipientId,actor_id:actorId,kind,entity_id:entityId,body});
  if(error)console.error("ORBIS notification:",error.message);
}

async function isRateLimited(admin:any, uid:string, action:string, limit:number, windowSeconds:number){
  const {data,error}=await admin.rpc("consume_orbis_rate_limit",{
    p_key:uid+":"+action,p_limit:limit,p_window_seconds:windowSeconds
  });
  if(error)throw new Error("Не удалось проверить лимит запросов: "+error.message);
  return data!==true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = Deno.env.get("SUPABASE_URL"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return out({ error: "Supabase server secrets are not configured." }, 503);
  const admin = createClient(url, service, { auth: { persistSession:false, autoRefreshToken:false } });
  const authHeader=req.headers.get("Authorization")||"";
  const token=authHeader.toLowerCase().startsWith("bearer ")?authHeader.slice(7).trim():authHeader.trim();
  let uid: string|null = token ? await verifyGuestToken(token,service) : null;
  const u = new URL(req.url);
  const pathname = u.pathname;
  const apiMarker = pathname.lastIndexOf("/api/");
  const path = apiMarker >= 0 ? pathname.slice(apiMarker) : (pathname.endsWith("/health") ? "/health" : (pathname.replace(/^\/functions\/v1\/orbis-api/,"") || "/"));
  let body:any = {}, form:FormData|null=null;
  if (req.method==="GET" && path==="/api/guest/me") {
    if(!uid)return out({error:"Гостевой профиль не найден."},401);
    const {data:p,error}=await admin.from("profiles").select("*").eq("id",uid).maybeSingle();
    if(error)return out({error:"Не удалось загрузить гостевой профиль."},500);
    return p?out({authenticated:true,authMode:p.auth_public_key?"key":"legacy",user:{id:uid,...safeProfile(p)}}):out({error:"Гостевой профиль не найден."},404);
  }
  if (req.method==="POST" && path==="/api/media") { try { form=await req.formData(); } catch { return out({error:"Invalid form data"},400); } }
  else if (["POST","PUT","PATCH"].includes(req.method)) { try { body = await req.json(); } catch { return out({error:"Invalid JSON"},400); } }

  if (req.method==="GET" && path==="/health") return out({ok:true,service:"ORBIS API",database:"Supabase PostgreSQL"});
  if (req.method==="GET" && path==="/api/username-available") {
    const username=String(u.searchParams.get("username")||"").trim().toLowerCase();
    if(!/^[a-zA-Z0-9_.]{3,24}$/.test(username))return out({available:false,error:"Username: 3–24 символа, латиница, цифры, точка или _."},400);
    const {data,error}=await admin.from("profiles").select("id").eq("username",username).maybeSingle();
    if(error)return out({available:false,error:"Не удалось проверить username. Попробуй ещё раз."},503);
    return out({available:!data});
  }
  if(req.method==="POST" && path==="/api/guest/register"){
    const deviceId=String(body.deviceId||"").trim().toLowerCase();
    const username=String(body.username||"").trim().toLowerCase();
    const bio=String(body.bio||"").trim();
    const jwk=body.publicKey||{};
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(deviceId))return out({error:"Некорректный идентификатор устройства."},400);
    if(!/^[a-z0-9_.]{3,24}$/.test(username))return out({error:"Никнейм: 3–24 символа, латиница, цифры, точка или _."},400);
    if(bio.length>180)return out({error:"Описание профиля должно быть не длиннее 180 символов."},400);
    if(jwk.kty!=="EC"||jwk.crv!=="P-256"||typeof jwk.x!=="string"||typeof jwk.y!=="string"||!/^[A-Za-z0-9_-]{40,50}$/.test(jwk.x)||!/^[A-Za-z0-9_-]{40,50}$/.test(jwk.y))return out({error:"Некорректный публичный ключ устройства."},400);
    const ip=(req.headers.get("cf-connecting-ip")||req.headers.get("x-real-ip")||req.headers.get("x-forwarded-for")||"").split(",")[0].trim();
    if(ip&&await isRateLimited(admin,"register-ip:"+ip,"secure_register_ip",12,3600))return out({error:"Слишком много регистраций. Попробуй позже."},429);
    if(await isRateLimited(admin,deviceId,"secure_register_device",5,3600))return out({error:"Слишком много попыток регистрации на устройстве."},429);
    const {data:existing,error:existingError}=await admin.from("profiles").select("id").eq("id",deviceId).maybeSingle();
    if(existingError)return out({error:"Не удалось проверить устройство."},503);
    if(existing)return out({error:"Профиль на устройстве уже существует. Войди или восстанови доступ."},409);
    const publicKey={kty:"EC",crv:"P-256",x:jwk.x,y:jwk.y,ext:true,key_ops:["verify"]};
    const {data:user,error}=await admin.from("profiles").insert({id:deviceId,username,display_name:username,bio,auth_public_key:publicKey})
      .select("id,username,display_name,bio,avatar_url,public_number,created_at").single();
    if(error)return out({error:error.code==="23505"?"Этот никнейм уже занят.":"Не удалось создать профиль."},409);
    const challenge=bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    const expiresAt=new Date(Date.now()+5*60*1000).toISOString();
    const {data:row,error:challengeError}=await admin.from("orbis_auth_challenges").insert({user_id:deviceId,challenge,expires_at:expiresAt}).select("id").single();
    if(challengeError){await admin.from("profiles").delete().eq("id",deviceId);return out({error:"Не удалось подготовить безопасный вход."},500);}
    return out({ok:true,challengeId:row.id,challenge,user:{id:user.id,...safeProfile(user)}},201);
  }

  if(req.method==="POST" && path==="/api/guest/challenge"){
    const deviceId=String(body.deviceId||"").trim().toLowerCase();
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(deviceId))return out({error:"Некорректный идентификатор устройства."},400);
    const ip=(req.headers.get("cf-connecting-ip")||req.headers.get("x-real-ip")||req.headers.get("x-forwarded-for")||"").split(",")[0].trim();
    if(ip&&await isRateLimited(admin,"challenge-ip:"+ip,"secure_challenge_ip",40,3600))return out({error:"Слишком много запросов на вход."},429);
    if(await isRateLimited(admin,deviceId,"secure_challenge_device",12,3600))return out({error:"Слишком много попыток входа для профиля."},429);
    const {data:user,error}=await admin.from("profiles").select("auth_public_key").eq("id",deviceId).maybeSingle();
    if(error)return out({error:"Не удалось проверить профиль."},503);
    if(!user?.auth_public_key)return out({error:"Для профиля не настроен ключ восстановления."},404);
    const challenge=bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    const {data:row,error:insertError}=await admin.from("orbis_auth_challenges").insert({
      user_id:deviceId,challenge,expires_at:new Date(Date.now()+5*60*1000).toISOString()
    }).select("id").single();
    if(insertError)return out({error:"Не удалось создать запрос входа."},500);
    return out({ok:true,challengeId:row.id,challenge});
  }

  if(req.method==="POST" && path==="/api/guest/verify"){
    const deviceId=String(body.deviceId||"").trim().toLowerCase();
    const challengeId=String(body.challengeId||"").trim();
    const signatureText=String(body.signature||"").trim();
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(deviceId)||!/^[0-9a-f-]{36}$/i.test(challengeId)||!/^[A-Za-z0-9_-]{80,100}$/.test(signatureText))return out({error:"Некорректное подтверждение входа."},400);
    if(await isRateLimited(admin,deviceId,"secure_verify",12,300))return out({error:"Слишком много проверок подписи."},429);
    const [{data:challenge,error:challengeError},{data:profile,error:profileError}]=await Promise.all([
      admin.from("orbis_auth_challenges").select("id,challenge,expires_at,used_at").eq("id",challengeId).eq("user_id",deviceId).gt("expires_at",new Date().toISOString()).is("used_at",null).maybeSingle(),
      admin.from("profiles").select("id,auth_public_key").eq("id",deviceId).maybeSingle()
    ]);
    if(challengeError||profileError)return out({error:"Не удалось проверить запрос входа."},503);
    if(!challenge||!profile?.auth_public_key)return out({error:"Запрос входа истёк или уже использован. Начни заново."},401);
    try{
      const key=await crypto.subtle.importKey("jwk",profile.auth_public_key,{name:"ECDSA",namedCurve:"P-256"},false,["verify"]);
      const valid=await crypto.subtle.verify({name:"ECDSA",hash:"SHA-256"},key,base64UrlToBytes(signatureText),encoder.encode(challenge.challenge));
      if(!valid)return out({error:"Подпись ключа не подтверждена."},401);
    }catch{return out({error:"Не удалось проверить ключ восстановления."},400);}
    const {data:consumed,error:consumeError}=await admin.from("orbis_auth_challenges").update({used_at:new Date().toISOString()})
      .eq("id",challengeId).eq("user_id",deviceId).is("used_at",null).select("id").maybeSingle();
    if(consumeError)return out({error:"Не удалось завершить вход."},503);
    if(!consumed)return out({error:"Запрос уже использован. Начни вход заново."},409);
    const {data:user,error:userError}=await admin.from("profiles").select("*").eq("id",deviceId).maybeSingle();
    if(userError||!user)return out({error:"Профиль не найден."},404);
    const signed=await issueGuestToken(deviceId,service);
    return out({ok:true,token:signed,user:{id:deviceId,...safeProfile(user)}});
  }

  if (req.method==="POST" && path==="/api/guest/session") {
    const deviceId=String(body.deviceId||"").trim().toLowerCase();
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(deviceId))
      return out({error:"Некорректный идентификатор устройства."},400);
    if(uid&&uid!==deviceId)return out({error:"Идентификатор устройства не совпадает с текущей сессией."},403);
    const requestIp=(req.headers.get("cf-connecting-ip")||req.headers.get("x-real-ip")||req.headers.get("x-forwarded-for")||"").split(",")[0].trim();
    if(requestIp&&await isRateLimited(admin,"guest-ip:"+requestIp,"guest_session_ip",40,60))
      return out({error:"Слишком много новых гостевых сессий с этого подключения. Попробуй позже."},429);
    if(await isRateLimited(admin,deviceId,"guest_session_device",12,60))
      return out({error:"Слишком частые запросы гостевой сессии. Подожди минуту."},429);
    const {data:existing,error:loadError}=await admin.from("profiles").select("*").eq("id",deviceId).maybeSingle();
    if(loadError)return out({error:"Не удалось загрузить гостевой профиль."},500);
    let profile=existing;
    if(!profile)return out({error:"Новые профили создаются через защищённую регистрацию ORBIS."},410);
    const aliasPool=["Nova","Visionary","Founder","Pioneer","Thinker","Creator","Builder","Strategist","Explorer","Atlas","Orbit","Spark","Vector","Voyager"];
    const makeAlias=()=>{const word=aliasPool[Math.floor(Math.random()*aliasPool.length)];const code=100+Math.floor(Math.random()*900);return {username:word.toLowerCase()+"_"+code,display_name:word+" #"+code};};
    if(!profile){
      for(let attempt=0;attempt<8&&!profile;attempt++){
        const alias=makeAlias();
        const {data:created,error}=await admin.from("profiles").insert({id:deviceId,username:alias.username,display_name:alias.display_name}).select("*").single();
        if(!error)profile=created;
        else if(attempt===7)return out({error:"Не удалось создать уникальный ник: "+error.message},500);
      }
    }else if(profile.display_name==="Гость ORBIS" && String(profile.username||"").startsWith("guest_")){
      const alias=makeAlias();
      const {data:renamed,error}=await admin.from("profiles").update({username:alias.username,display_name:alias.display_name}).eq("id",deviceId).select("*").single();
      if(!error)profile=renamed;
    }
    const signed=await issueGuestToken(deviceId,service);
    return out({ok:true,token:signed,user:{id:deviceId,...safeProfile(profile)}});
  }
  if (req.method==="GET" && path==="/api/daily/feed") {
    if(!uid)return out({error:"Гостевая сессия не найдена."},401);
    if(await isRateLimited(admin,uid,"daily_feed",30,60))return out({error:"Слишком много обновлений ленты. Подожди немного."},429);

    const pageLimit=40;
    const cursor=String(u.searchParams.get("cursor")||"");
    let query=admin.from("orbis_daily_posts")
      .select("id,author_id,body,status,created_at,boosted_until")
      .eq("status","published")
      .order("created_at",{ascending:false})
      .order("id",{ascending:false})
      .limit(pageLimit+1);

    if(cursor){
      const parts=cursor.split("|");
      if(parts.length!==2||!/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z$/.test(parts[0])||!Number.isFinite(Date.parse(parts[0]))||!/^[0-9a-f-]{36}$/i.test(parts[1]))
        return out({error:"Некорректный курсор ленты."},400);
      const createdAt=parts[0],postId=parts[1];
      query=query.or("created_at.lt."+createdAt+",and(created_at.eq."+createdAt+",id.lt."+postId+")");
    }

    const {data:pageRows,error}=await query;
    if(error)return out({error:"Не удалось загрузить общую ленту."},500);
    const hasMore=(pageRows||[]).length>pageLimit;
    const posts=(pageRows||[]).slice(0,pageLimit);
    const lastPost=posts.length?posts[posts.length-1]:null;
    const nextCursor=hasMore&&lastPost?String(lastPost.created_at)+"|"+String(lastPost.id):null;
    const postIds=posts.map((p:any)=>p.id);
    const authorIds=[...new Set(posts.map((p:any)=>p.author_id))];

    const [{data:profiles,error:profileError},{data:totals,error:totalsError},{data:myReactions,error:mineError},{data:bookmarks,error:bookmarkError},{data:limitRow,error:limitError}]=await Promise.all([
      authorIds.length?admin.from("profiles").select("id,username,display_name,public_number").in("id",authorIds):Promise.resolve({data:[],error:null}),
      postIds.length?admin.from("orbis_reaction_totals").select("post_id,reaction,reaction_count").in("post_id",postIds):Promise.resolve({data:[],error:null}),
      postIds.length?admin.from("orbis_reactions").select("post_id,reaction").eq("user_id",uid).in("post_id",postIds):Promise.resolve({data:[],error:null}),
      postIds.length?admin.from("orbis_bookmarks").select("post_id").eq("user_id",uid).in("post_id",postIds):Promise.resolve({data:[],error:null}),
      admin.from("orbis_post_limits").select("last_post_at").eq("user_id",uid).maybeSingle()
    ]);
    if(profileError||totalsError||mineError||bookmarkError||limitError)return out({error:"Не удалось собрать ленту ORBIS."},500);

    const profileMap=new Map((profiles||[]).map((p:any)=>[p.id,p]));
    const bookmarkSet=new Set((bookmarks||[]).map((b:any)=>b.post_id));
    const countMap=new Map<string,any>();
    for(const row of totals||[]){
      const counts=countMap.get(row.post_id)||{"🔥":0,"💎":0,"🚀":0,"😂":0};
      counts[row.reaction]=Number(row.reaction_count)||0;
      countMap.set(row.post_id,counts);
    }
    const mineMap=new Map((myReactions||[]).map((r:any)=>[r.post_id,r.reaction]));
    const result=posts.map((p:any)=>{
      const counts=countMap.get(p.id)||{"🔥":0,"💎":0,"🚀":0,"😂":0};
      return {...p,author:profileMap.get(p.author_id)||{display_name:"ORBIS member",username:"member"},
        reaction_counts:{"🔥":counts["🔥"]||0,"💎":counts["💎"]||0,"🚀":counts["🚀"]||0,"😂":counts["😂"]||0},
        my_reaction:mineMap.get(p.id)||null,saved:bookmarkSet.has(p.id)};
    });
    const sort=String(u.searchParams.get("sort")||"fresh");
    if(sort==="top")result.sort((a:any,b:any)=>((b.reaction_counts["🔥"]+b.reaction_counts["💎"]+b.reaction_counts["🚀"]+b.reaction_counts["😂"])-(a.reaction_counts["🔥"]+a.reaction_counts["💎"]+a.reaction_counts["🚀"]+a.reaction_counts["😂"]))||String(b.created_at).localeCompare(String(a.created_at)));
    const nextAt=limitRow?.last_post_at?new Date(new Date(limitRow.last_post_at).getTime()+24*60*60*1000).toISOString():null;
    return out({posts:result,nextPostAt:nextAt,nextCursor,hasMore,serverTime:new Date().toISOString()});
  }
  if (req.method==="POST" && path==="/api/daily/post") {
    if(!uid)return out({error:"Сначала создай гостевой профиль ORBIS."},401);
    if(await isRateLimited(admin,uid,"daily_post_request",6,60))return out({error:"Слишком часто. Попробуй через минуту."},429);
    const text=String(body.body||"").trim();
    if(!text||text.length>140)return out({error:"Публикация должна содержать от 1 до 140 символов."},400);
    const guard=basicTextGuard(text);if(guard)return out({error:guard},422);
    const {data:post,error}=await admin.rpc("orbis_publish_daily_post",{p_user_id:uid,p_body:text});
    if(error){
      if(String(error.message||"").includes("DAILY_LIMIT")){
        const {data:nextAt}=await admin.rpc("orbis_get_next_post_at",{p_user_id:uid});
        return out({error:"Ты уже опубликовал сегодня. Следующая публикация будет доступна через 24 часа.",nextPostAt:nextAt},429);
      }
      console.error("ORBIS daily post:",error.message);
      return out({error:"Не удалось опубликовать. Попробуй ещё раз."},400);
    }
    const {data:profile}=await admin.from("profiles").select("id,username,display_name,public_number").eq("id",uid).maybeSingle();
    return out({ok:true,post:{...post,author:profile||{display_name:"ORBIS member",username:"member"},reaction_counts:{"🔥":0,"💎":0,"🚀":0,"😂":0},my_reaction:null,saved:false},nextPostAt:new Date(Date.now()+24*60*60*1000).toISOString()},201);
  }
  if (req.method==="POST" && path==="/api/daily/react") {
    if(!uid)return out({error:"Гостевая сессия не найдена."},401);
    if(await isRateLimited(admin,uid,"daily_reaction",90,60))return out({error:"Слишком много реакций. Подожди немного."},429);
    const postId=String(body.postId||""),reaction=String(body.reaction||"");
    if(!/^[0-9a-f-]{36}$/i.test(postId)||!["🔥","💎","🚀","😂"].includes(reaction))return out({error:"Некорректная реакция."},400);
    const {data:existing,error:readError}=await admin.from("orbis_reactions").select("reaction").eq("post_id",postId).eq("user_id",uid).maybeSingle();
    if(readError)return out({error:"Не удалось загрузить твою реакцию."},500);
    let myReaction=existing?.reaction||null;
    if(myReaction===reaction){
      const {error}=await admin.from("orbis_reactions").delete().eq("post_id",postId).eq("user_id",uid);
      if(error)return out({error:"Не удалось убрать реакцию."},500);
      myReaction=null;
    }else{
      const {error}=await admin.from("orbis_reactions").upsert({post_id:postId,user_id:uid,reaction},{onConflict:"post_id,user_id"});
      if(error)return out({error:"Не удалось сохранить реакцию."},500);
      myReaction=reaction;
    }
    const {data:rows,error}=await admin.from("orbis_reaction_totals").select("reaction,reaction_count").eq("post_id",postId);
    if(error)return out({error:"Реакция сохранена, но счётчики недоступны."},500);
    const counts={"🔥":0,"💎":0,"🚀":0,"😂":0};
    for(const row of rows||[])counts[row.reaction]=Number(row.reaction_count)||0;
    return out({ok:true,myReaction,counts});
  }
  if (req.method==="POST" && path==="/api/daily/bookmark") {
    if(!uid)return out({error:"Гостевая сессия не найдена."},401);
    if(await isRateLimited(admin,uid,"daily_bookmark",60,60))return out({error:"Слишком много сохранений. Подожди немного."},429);
    const postId=String(body.postId||"");
    if(!/^[0-9a-f-]{36}$/i.test(postId))return out({error:"Некорректная публикация."},400);
    const {data:existing}=await admin.from("orbis_bookmarks").select("post_id").eq("post_id",postId).eq("user_id",uid).maybeSingle();
    if(existing){
      const {error}=await admin.from("orbis_bookmarks").delete().eq("post_id",postId).eq("user_id",uid);
      if(error)return out({error:"Не удалось убрать из сохранённого."},500);
      return out({ok:true,saved:false});
    }
    const {error}=await admin.from("orbis_bookmarks").insert({post_id:postId,user_id:uid});
    if(error)return out({error:"Не удалось сохранить публикацию."},500);
    return out({ok:true,saved:true});
  }
  
  if (req.method==="POST" && path==="/api/media") {
    if(req.method==="GET"&&path==="/api/public/posts"){
    const ip=(req.headers.get("cf-connecting-ip")||req.headers.get("x-real-ip")||req.headers.get("x-forwarded-for")||"").split(",")[0].trim()||"unknown";
    if(await isRateLimited(admin,"public-feed:"+ip,"public_feed",120,60))return out({error:"Слишком много запросов к ленте."},429);
    const rawLimit=Number(u.searchParams.get("limit")||20),limit=Number.isSafeInteger(rawLimit)?Math.max(1,Math.min(rawLimit,30)):20;
    const mode=String(u.searchParams.get("mode")||"for-you"),ranked=mode==="popular";
    const cursorRaw=u.searchParams.get("cursor")||"";let cursor:any=null;
    if(cursorRaw){try{cursor=JSON.parse(new TextDecoder().decode(base64UrlToBytes(cursorRaw)))}catch{return out({error:"Некорректный курсор ленты."},400)}
      if(!cursor||typeof cursor.createdAt!=="string"||!Number.isFinite(Date.parse(cursor.createdAt))||typeof cursor.id!=="string"||! /^[0-9a-f-]{36}$/i.test(cursor.id)||(ranked&&!Number.isInteger(cursor.score)))return out({error:"Некорректный курсор ленты."},400)}
    let q=admin.from("posts").select("id,title,topic,body,media,created_at,post_number,author_id,engagement_score,profiles!posts_author_id_fkey(username,display_name,avatar_url,public_number)")
      .eq("status","published").is("reply_to",null);
    if(ranked)q=q.order("engagement_score",{ascending:false});
    q=q.order("created_at",{ascending:false}).order("id",{ascending:false});
    if(cursor){if(ranked)q=q.or("engagement_score.lt."+cursor.score+",and(engagement_score.eq."+cursor.score+",created_at.lt."+cursor.createdAt+"),and(engagement_score.eq."+cursor.score+",created_at.eq."+cursor.createdAt+",id.lt."+cursor.id+")");else q=q.or("created_at.lt."+cursor.createdAt+",and(created_at.eq."+cursor.createdAt+",id.lt."+cursor.id+")")}
    const {data,error}=await q.limit(limit+1);
    if(error)return out({error:"Не удалось загрузить ленту ORBIS."},503);
    let rows=data||[];const hasMore=rows.length>limit;if(hasMore)rows=rows.slice(0,limit);
    const ids=rows.map((p:any)=>p.id);
    const {data:likes,error:likeError}=ids.length?await admin.from("post_like_counts").select("post_id,like_count").in("post_id",ids):{data:[],error:null};
    if(likeError)return out({error:"Не удалось загрузить статистику публикаций."},503);
    const likeMap=new Map((likes||[]).map((x:any)=>[x.post_id,Number(x.like_count)||0]));
    const posts=rows.map((p:any)=>({id:p.id,postNumber:String(p.post_number),title:p.title,topic:p.topic,body:p.body,username:p.profiles?.username,author:p.profiles?.display_name,authorNumber:p.profiles?.public_number==null?null:String(p.profiles.public_number),avatar_url:p.profiles?.avatar_url,createdAt:p.created_at,media:p.media||[],likes:likeMap.get(p.id)||0,liked:false,saved:false}));
    const last=rows[rows.length-1],nextCursor=last?bytesToBase64Url(encoder.encode(JSON.stringify({createdAt:last.created_at,id:last.id,...(ranked?{score:Number(last.engagement_score)||0}:{})}))):null;
    return out({posts,hasMore,nextCursor,public:true});
  }
  if (!uid) return out({error:"Гостевая сессия не найдена. Обнови страницу."},401);
    if(await isRateLimited(admin,uid,"media",10,60))return out({error:"Слишком много загрузок. Подожди минуту."},429);
    const files=(form?.getAll("files")||[]).filter((f:any)=>f && typeof f.size==="number") as File[];
    if (!files.length || files.length>4) return out({error:"Выбери от 1 до 4 файлов."},400);
    const extensions:Record<string,string>={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif","video/mp4":"mp4","video/webm":"webm"};
    const prepared:any[]=[];
    // Validate the entire batch before uploading anything, including the actual file signature.
    for(const file of files){
      if(!extensions[file.type])return out({error:"Формат файла не поддерживается."},415);
      const isVideo=file.type.startsWith("video/");
      if(!file.size||file.size>(isVideo?50:12)*1024*1024)
        return out({error:isVideo?"Видео должно быть не больше 50 МБ.":"Фото должно быть не больше 12 МБ."},413);
      const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());
      const ascii=(offset:number,length:number)=>String.fromCharCode(...bytes.slice(offset,offset+length));
      let valid=false;
      if(file.type==="image/jpeg")valid=bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
      else if(file.type==="image/png")valid=bytes.length>=8&&bytes[0]===0x89&&ascii(1,3)==="PNG"&&bytes[4]===0x0d&&bytes[5]===0x0a&&bytes[6]===0x1a&&bytes[7]===0x0a;
      else if(file.type==="image/webp")valid=bytes.length>=12&&ascii(0,4)==="RIFF"&&ascii(8,4)==="WEBP";
      else if(file.type==="image/gif")valid=bytes.length>=6&&(ascii(0,6)==="GIF87a"||ascii(0,6)==="GIF89a");
      else if(file.type==="video/mp4")valid=bytes.length>=12&&ascii(4,4)==="ftyp";
      else if(file.type==="video/webm")valid=bytes.length>=4&&bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3;
      if(!valid)return out({error:"Содержимое файла не соответствует заявленному формату."},415);
      prepared.push({file,ext:extensions[file.type]});
    }
    const uploaded:any[]=[];
    for(const item of prepared){
      const {file,ext}=item;
      const key=uid+"/"+crypto.randomUUID()+"."+ext;
      const {error}=await admin.storage.from("orbis-media").upload(key,file,{contentType:file.type,upsert:false});
      if(error){
        if(uploaded.length)await admin.storage.from("orbis-media").remove(uploaded.map(x=>x.key));
        return out({error:"Не удалось сохранить пакет файлов: "+error.message},500);
      }
      const {data:publicData}=admin.storage.from("orbis-media").getPublicUrl(key);
      uploaded.push({key,url:publicData.publicUrl,type:file.type,size:file.size});
    }
    return out({ok:true,media:uploaded},201);
  }
  if (!uid) return out({error:"Гостевая сессия не найдена. Обнови страницу."},401);
  const {data:me}=await admin.from("profiles").select("*").eq("id",uid).maybeSingle();
  if (!me) return out({error:"Профиль ORBIS не найден. Обнови страницу, чтобы восстановить гостевую сессию."},401);
  if(req.method==="POST"&&path==="/api/sync/batch"){
    if(!Array.isArray(body.operations)||body.operations.length<1||body.operations.length>20)
      return out({error:"Пакет должен содержать от 1 до 20 операций."},400);
    if(await isRateLimited(admin,uid,"sync_batch",30,60))
      return out({error:"Слишком много пакетов синхронизации. Попробуй позже."},429);

    const results:any[]=[];
    for(const raw of body.operations){
      const operationId=String(raw?.id||"").trim().toLowerCase();
      const type=String(raw?.type||"");
      const payload=raw?.payload&&typeof raw.payload==="object"&&!Array.isArray(raw.payload)?raw.payload:{};
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(operationId)||
         !["post.create","like.set","comment.create","follow.set","profile.update"].includes(type)){
        results.push({id:operationId||null,status:"failed",error:"Операция имеет неверный ID или неизвестный тип."});
        continue;
      }

      try{
        const requestText=JSON.stringify({type,payload});
        const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(requestText)));
        const requestHash=bytesToBase64Url(digest);
        let {data:operation,error:loadError}=await admin.from("orbis_sync_operations")
          .select("operation_id,user_id,operation_type,request_hash,status,result")
          .eq("operation_id",operationId).maybeSingle();
        if(loadError)throw new Error("Не удалось проверить очередь синхронизации.");
        if(operation){
          if(operation.user_id!==uid||operation.operation_type!==type||operation.request_hash!==requestHash){
            results.push({id:operationId,status:"failed",error:"ID операции уже использован с другими данными."});
            continue;
          }
          if(operation.status==="done"){
            results.push({id:operationId,status:"synced",result:operation.result,duplicate:true});
            continue;
          }
        }else{
          const {data:created,error:createError}=await admin.from("orbis_sync_operations")
            .insert({operation_id:operationId,user_id:uid,operation_type:type,request_hash:requestHash,status:"processing",attempts:0})
            .select("operation_id,user_id,operation_type,request_hash,status,result").maybeSingle();
          if(createError&&createError.code!=="23505")throw new Error("Не удалось зарегистрировать операцию синхронизации.");
          if(created)operation=created;
          else{
            const {data:again,error:againError}=await admin.from("orbis_sync_operations")
              .select("operation_id,user_id,operation_type,request_hash,status,result")
              .eq("operation_id",operationId).maybeSingle();
            if(againError||!again)throw new Error("Не удалось повторно проверить операцию.");
            operation=again;
            if(operation.user_id!==uid||operation.operation_type!==type||operation.request_hash!==requestHash){
              results.push({id:operationId,status:"failed",error:"ID операции уже использован с другими данными."});
              continue;
            }
            if(operation.status==="done"){
              results.push({id:operationId,status:"synced",result:operation.result,duplicate:true});
              continue;
            }
          }
        }

        await admin.from("orbis_sync_operations").update({
          status:"processing",attempts:(Number(operation?.attempts)||0)+1,
          updated_at:new Date().toISOString(),last_error:null
        }).eq("operation_id",operationId).eq("user_id",uid);

        let result:any=null;

        if(type==="post.create"){
          if(await isRateLimited(admin,uid,"post_create",12,3600))throw new Error("Лимит публикаций — 12 постов в час.");
          const text=String(payload.body||"").trim().slice(0,4000);
          const media=Array.isArray(payload.media)?payload.media:[];
          if(media.length>4)throw new Error("Можно прикрепить не более четырёх фотографий.");
          if(!text&&!media.length)throw new Error("Публикация не может быть пустой.");
          const titleInput=String(payload.title||"").trim().slice(0,120);
          const title=titleInput||(text.split("\n")[0].slice(0,80)||"Фото");
          const topic=String(payload.topic||"Global").trim().slice(0,48)||"Global";
          const moderation=basicTextGuard(title+" "+text);if(moderation)throw new Error(moderation);
          const mediaBase="https://wdwvcvpgovvkoodozbxf.supabase.co/storage/v1/object/public/orbis-media/";
          if(media.some((item:any)=>!item||typeof item.key!=="string"||!item.key.startsWith(uid+"/")||
            typeof item.url!=="string"||item.url!==mediaBase+item.key||!["image/jpeg","image/png","image/webp"].includes(item.type)))
            throw new Error("Один из файлов публикации недействителен.");
          let {data:post,error:postError}=await admin.from("posts").select("*")
            .eq("author_id",uid).eq("client_operation_id",operationId).maybeSingle();
          if(postError)throw new Error("Не удалось проверить ранее созданную публикацию.");
          if(!post){
            const inserted=await admin.from("posts").insert({
              author_id:uid,title,topic,body:text||"Фото",media,
              client_operation_id:operationId
            }).select("*").single();
            post=inserted.data;postError=inserted.error;
            if(postError&&postError.code==="23505"){
              const retry=await admin.from("posts").select("*").eq("author_id",uid).eq("client_operation_id",operationId).maybeSingle();
              post=retry.data;postError=retry.error;
            }
          }
          if(postError||!post)throw new Error("Не удалось сохранить публикацию.");
          result={post:{
            id:post.id,postNumber:String(post.post_number),title:post.title,topic:post.topic,body:post.body,
            username:me.username,author:me.display_name,authorNumber:me.public_number==null?null:String(me.public_number),
            avatar_url:me.avatar_url||null,createdAt:post.created_at,media:post.media||[],
            likes:0,liked:false,saved:false
          }};
        }

        if(type==="like.set"){
          if(await isRateLimited(admin,uid,"like",90,60))throw new Error("Слишком много реакций. Попробуй позже.");
          const postId=String(payload.postId||"").trim(),liked=payload.liked;
          if(!/^[0-9a-f-]{36}$/i.test(postId)||typeof liked!=="boolean")throw new Error("Некорректная реакция.");
          const {data:target,error:targetError}=await admin.from("posts").select("id,author_id")
            .eq("id",postId).eq("status","published").maybeSingle();
          if(targetError||!target)throw new Error("Публикация не найдена.");
          const {data:existing,error:existingError}=await admin.from("post_likes").select("post_id")
            .eq("post_id",postId).eq("user_id",uid).maybeSingle();
          if(existingError)throw new Error("Не удалось проверить реакцию.");
          if(liked&&!existing){
            const {error}=await admin.from("post_likes").upsert({post_id:postId,user_id:uid},{onConflict:"post_id,user_id",ignoreDuplicates:true});
            if(error)throw new Error("Не удалось сохранить лайк.");
            await notifyUser(admin,target.author_id,uid,"like",postId,"Пользователю понравилась твоя публикация.");
          }else if(!liked&&existing){
            const {error}=await admin.from("post_likes").delete().eq("post_id",postId).eq("user_id",uid);
            if(error)throw new Error("Не удалось убрать лайк.");
          }
          const {data:count,error:countError}=await admin.from("post_like_counts").select("like_count").eq("post_id",postId).maybeSingle();
          if(countError)throw new Error("Лайк сохранён, но счётчик временно недоступен.");
          result={postId,liked,likes:Number(count?.like_count)||0};
        }

        if(type==="comment.create"){
          if(await isRateLimited(admin,uid,"comment_create",30,60))throw new Error("Слишком много комментариев. Попробуй позже.");
          const postId=String(payload.postId||"").trim(),text=String(payload.body||"").trim(),parentId=String(payload.parentId||"").trim()||null;
          if(!/^[0-9a-f-]{36}$/i.test(postId)||!text||text.length>1000)throw new Error("Проверь текст комментария.");
          const moderation=basicTextGuard(text);if(moderation)throw new Error(moderation);
          const {data:post,error:postError}=await admin.from("posts").select("id,author_id")
            .eq("id",postId).eq("status","published").maybeSingle();
          if(postError||!post)throw new Error("Публикация не найдена.");
          let parent:any=null;
          if(parentId){
            const {data:parentRow,error:parentError}=await admin.from("post_comments")
              .select("id,author_id,parent_id").eq("id",parentId).eq("post_id",postId).eq("status","published").maybeSingle();
            if(parentError||!parentRow||parentRow.parent_id)throw new Error("Ответить можно только на комментарий первого уровня.");
            parent=parentRow;
          }
          let createdNow=false;
          let {data:comment,error:commentError}=await admin.from("post_comments").select("id,post_id,author_id,body,created_at,parent_id")
            .eq("author_id",uid).eq("client_operation_id",operationId).maybeSingle();
          if(commentError)throw new Error("Не удалось проверить комментарий.");
          if(!comment){
            const inserted=await admin.from("post_comments").insert({
              post_id:postId,author_id:uid,body:text,parent_id:parentId,client_operation_id:operationId
            }).select("id,post_id,author_id,body,created_at,parent_id").single();
            comment=inserted.data;commentError=inserted.error;
            if(!commentError&&comment)createdNow=true;
            if(commentError&&commentError.code==="23505"){
              const retry=await admin.from("post_comments").select("id,post_id,author_id,body,created_at,parent_id")
                .eq("author_id",uid).eq("client_operation_id",operationId).maybeSingle();
              comment=retry.data;commentError=retry.error;
            }
          }
          if(commentError||!comment)throw new Error("Не удалось сохранить комментарий.");
          if(createdNow)await notifyUser(admin,parent?.author_id||post.author_id,uid,parentId?"comment_reply":"comment",postId,parentId?"Новый ответ на твой комментарий.":"Новый комментарий к твоей публикации.");
          result={comment:{
            id:comment.id,postId:comment.post_id,parentId:comment.parent_id,body:comment.body,
            createdAt:comment.created_at,own:true,
            author:{username:me.username,displayName:me.display_name,avatarUrl:me.avatar_url||null},
            repliesCount:0
          }};
        }

        if(type==="follow.set"){
          if(await isRateLimited(admin,uid,"follow",30,60))throw new Error("Слишком много подписок. Попробуй позже.");
          const username=String(payload.username||"").trim().toLowerCase(),following=payload.following;
          if(!/^[a-z0-9_.]{3,24}$/.test(username)||typeof following!=="boolean")throw new Error("Некорректная подписка.");
          const {data:target,error:targetError}=await admin.from("profiles").select("id")
            .eq("username",username).maybeSingle();
          if(targetError||!target)throw new Error("Пользователь не найден.");
          if(target.id===uid)throw new Error("Нельзя подписаться на себя.");
          const {data:existing,error:existingError}=await admin.from("follows").select("following_id")
            .eq("follower_id",uid).eq("following_id",target.id).maybeSingle();
          if(existingError)throw new Error("Не удалось проверить подписку.");
          if(following&&!existing){
            const {error}=await admin.from("follows").upsert({follower_id:uid,following_id:target.id},{onConflict:"follower_id,following_id",ignoreDuplicates:true});
            if(error)throw new Error("Не удалось подписаться.");
            await notifyUser(admin,target.id,uid,"follow",null,"Новый подписчик: @"+me.username);
          }else if(!following&&existing){
            const {error}=await admin.from("follows").delete().eq("follower_id",uid).eq("following_id",target.id);
            if(error)throw new Error("Не удалось отписаться.");
          }
          result={username,following};
        }

        if(type==="profile.update"){
          if(await isRateLimited(admin,uid,"profile_edit",20,60))throw new Error("Слишком много изменений профиля.");
          const name=String(payload.name||"").trim(),bio=String(payload.bio||"").trim();
          if(name.length<2||name.length>32||bio.length>180)throw new Error("Проверь имя и описание профиля.");
          const patch:any={display_name:name,bio,updated_at:new Date().toISOString()};
          if(payload.avatarUrl!==undefined){
            const avatar=String(payload.avatarUrl||"").trim();
            const base="https://wdwvcvpgovvkoodozbxf.supabase.co/storage/v1/object/public/orbis-media/";
            if(avatar&&!avatar.startsWith(base+uid+"/"))throw new Error("Аватар должен быть из твоего ORBIS-хранилища.");
            patch.avatar_url=avatar||null;
          }
          const {data:user,error}=await admin.from("profiles").update(patch).eq("id",uid).select("*").single();
          if(error)throw new Error("Не удалось сохранить профиль.");
          result={user:safeProfile(user)};
        }

        const {error:finishError}=await admin.from("orbis_sync_operations").update({
          status:"done",result,last_error:null,completed_at:new Date().toISOString(),updated_at:new Date().toISOString()
        }).eq("operation_id",operationId).eq("user_id",uid);
        if(finishError)throw new Error("Изменение сохранено, но не удалось подтвердить пакет. Его можно безопасно отправить повторно.");
        results.push({id:operationId,status:"synced",result});
      }catch(error){
        const message=error instanceof Error?error.message:"Неизвестная ошибка синхронизации.";
        await admin.from("orbis_sync_operations").update({
          status:"retry",last_error:message,updated_at:new Date().toISOString()
        }).eq("operation_id",operationId).eq("user_id",uid);
        results.push({id:operationId,status:"retry",error:message});
      }
    }
    return out({ok:true,results,serverTime:new Date().toISOString()});
  }

  if(req.method==="POST"&&path==="/api/guest/link-key"){
    if(await isRateLimited(admin,uid,"link_recovery_key",5,3600))return out({error:"Слишком много попыток настройки ключа."},429);
    const jwk=body.publicKey||{};
    if(jwk.kty!=="EC"||jwk.crv!=="P-256"||typeof jwk.x!=="string"||typeof jwk.y!=="string"||!/^[A-Za-z0-9_-]{40,50}$/.test(jwk.x)||!/^[A-Za-z0-9_-]{40,50}$/.test(jwk.y))return out({error:"Некорректный публичный ключ устройства."},400);
    if(me.auth_public_key)return out({error:"У профиля уже настроен защищённый ключ."},409);
    const {data,error}=await admin.from("profiles").update({auth_public_key:{kty:"EC",crv:"P-256",x:jwk.x,y:jwk.y,ext:true,key_ops:["verify"]},updated_at:new Date().toISOString()})
      .eq("id",uid).is("auth_public_key",null).select("id").maybeSingle();
    if(error)return out({error:"Не удалось связать ключ с профилем."},500);
    if(!data)return out({error:"Ключ уже был добавлен. Перезагрузи приложение."},409);
    return out({ok:true,authMode:"key"});
  }


  if (req.method === "GET" && path === "/api/news/reactions") {
    const keys = [...new Set((u.searchParams.get("keys") || "").split(",").filter((x:string) => /^[0-9a-f]{64}$/.test(x)))].slice(0, 40);
    if (!keys.length) return out({ reactions: [] });
    const [{ data: counts, error: countError }, { data: mine, error: mineError }] = await Promise.all([
      admin.from("news_reaction_counts").select("article_key,like_count").in("article_key", keys),
      admin.from("news_reactions").select("article_key").eq("user_id", uid).in("article_key", keys)
    ]);
    if (countError || mineError) return out({ error: "Не удалось загрузить реакции новостей." }, 500);
    const liked = new Set((mine || []).map((x:any) => x.article_key));
    const countMap = new Map((counts || []).map((x:any) => [x.article_key, Number(x.like_count) || 0]));
    return out({ reactions: keys.map((key:string) => ({ key, likes: countMap.get(key) || 0, liked: liked.has(key) })) });
  }
  if (req.method === "POST" && path === "/api/news/reactions") {
    if (await isRateLimited(admin, uid, "news_reaction", 120, 60)) return out({ error: "Слишком много реакций. Попробуй чуть позже." }, 429);
    const key = String(body.key || "");
    if (!/^[0-9a-f]{64}$/.test(key) || typeof body.liked !== "boolean") return out({ error: "Некорректная реакция на новость." }, 400);
    const { data: existing } = await admin.from("news_reactions").select("article_key").eq("article_key", key).eq("user_id", uid).maybeSingle();
    let writeError = null;
    if (body.liked && !existing) {
      const result = await admin.from("news_reactions").insert({ article_key: key, user_id: uid });
      writeError = result.error;
    } else if (!body.liked && existing) {
      const result = await admin.from("news_reactions").delete().eq("article_key", key).eq("user_id", uid);
      writeError = result.error;
    }
    if (writeError) return out({ error: "Не удалось сохранить реакцию." }, 500);
    const { count, error } = await admin.from("news_reactions").select("article_key", { count: "exact", head: true }).eq("article_key", key);
    if (error) return out({ error: "Реакция сохранена, но счётчик пока недоступен." }, 200);
    return out({ ok: true, key, liked: Boolean(body.liked), likes: count || 0 });
  }


  if (req.method==="GET" && path==="/api/posts") {
    if(await isRateLimited(admin,uid,"feed_read",120,60))return out({error:"Слишком много запросов к ленте. Подожди немного."},429);
    const rawLimit=Number(u.searchParams.get("limit")||20),limit=Number.isSafeInteger(rawLimit)?Math.max(1,Math.min(rawLimit,30)):20;
    const cursorRaw=u.searchParams.get("cursor")||"";
    let cursor:any=null;
    if(cursorRaw){
      try{cursor=JSON.parse(new TextDecoder().decode(base64UrlToBytes(cursorRaw)))}catch{return out({error:"Некорректный курсор ленты."},400)}
      if(!cursor||typeof cursor.createdAt!=="string"||!Number.isFinite(Date.parse(cursor.createdAt))||typeof cursor.id!=="string"||! /^[0-9a-f-]{36}$/i.test(cursor.id))return out({error:"Некорректный курсор ленты."},400);
    }
    const mode=String(u.searchParams.get("mode")||"for-you"),ranked=mode==="for-you"||mode==="popular";
    if(cursor&&ranked&&!Number.isInteger(cursor.score))return out({error:"Некорректный курсор рекомендаций."},400);
    let rows:any[]=[];
    let hasMore=false;
    if(mode==="following"){
      const {data,error}=await admin.rpc("orbis_following_feed",{
        p_user_id:uid,
        p_limit:limit+1,
        p_cursor_created_at:cursor?.createdAt||null,
        p_cursor_id:cursor?.id||null
      });
      if(error)return out({error:"Не удалось загрузить ленту подписок."},503);
      rows=data||[];
      hasMore=rows.length>limit;
      if(hasMore)rows=rows.slice(0,limit);
      const authorIds=[...new Set(rows.map((p:any)=>p.author_id))];
      const {data:profiles,error:profileError}=authorIds.length
        ?await admin.from("profiles").select("id,username,display_name,avatar_url,public_number").in("id",authorIds)
        :{data:[],error:null};
      if(profileError)return out({error:"Не удалось загрузить профили авторов."},503);
      const profileMap=new Map((profiles||[]).map((p:any)=>[p.id,p]));
      rows=rows.map((p:any)=>({...p,profiles:profileMap.get(p.author_id)||null}));
    }else{
      let q=admin.from("posts").select("*,profiles!posts_author_id_fkey(username,display_name,avatar_url,public_number)")
        .eq("status","published").is("reply_to",null);
      if(ranked)q=q.order("engagement_score",{ascending:false});
      q=q.order("created_at",{ascending:false}).order("id",{ascending:false});
      const topic=u.searchParams.get("topic");if(topic)q=q.ilike("topic",topic);
      if(cursor){
        if(ranked)q=q.or("engagement_score.lt."+cursor.score+",and(engagement_score.eq."+cursor.score+",created_at.lt."+cursor.createdAt+"),and(engagement_score.eq."+cursor.score+",created_at.eq."+cursor.createdAt+",id.lt."+cursor.id+")");
        else q=q.or("created_at.lt."+cursor.createdAt+",and(created_at.eq."+cursor.createdAt+",id.lt."+cursor.id+")");
      }
      const {data,error}=await q.limit(limit+1);
      if(error)return out({error:error.message},503);
      rows=data||[];
      hasMore=rows.length>limit;
      if(hasMore)rows=rows.slice(0,limit);
    }
    const enriched=await enrichPolls(admin,uid,rows),ids=enriched.map((p:any)=>p.id);
    const [{data:likes},{data:mine},{data:bookmarks}]=await Promise.all([
      ids.length?admin.from("post_like_counts").select("post_id,like_count").in("post_id",ids):Promise.resolve({data:[]}),
      ids.length?admin.from("post_likes").select("post_id").eq("user_id",uid).in("post_id",ids):Promise.resolve({data:[]}),
      ids.length?admin.from("bookmarks").select("post_id").eq("user_id",uid).in("post_id",ids):Promise.resolve({data:[]})
    ]);
    const counts=new Map((likes||[]).map((x:any)=>[x.post_id,Number(x.like_count)||0]));
    const liked=new Set((mine||[]).map((x:any)=>x.post_id)),saved=new Set((bookmarks||[]).map((x:any)=>x.post_id));
    const posts=enriched.map((p:any)=>({id:p.id,postNumber:String(p.post_number),title:p.title,topic:p.topic,body:p.body,username:p.profiles?.username,author:p.profiles?.display_name,authorNumber:p.profiles?.public_number==null?null:String(p.profiles.public_number),avatar_url:p.profiles?.avatar_url,createdAt:p.created_at,replyTo:p.reply_to,media:p.media||[],poll:p.poll||null,likes:counts.get(p.id)||0,liked:liked.has(p.id),saved:saved.has(p.id)}));
    const last=rows[rows.length-1],nextCursor=last?bytesToBase64Url(encoder.encode(JSON.stringify({createdAt:last.created_at,id:last.id,...(ranked?{score:Number(last.engagement_score)||0}:{})}))):null;
    return out({posts,hasMore,nextCursor});
  }
  if(req.method==="GET"&&path==="/api/posts/state"){
    if(await isRateLimited(admin,uid,"post_state",120,60))return out({error:"Слишком много запросов состояния ленты."},429);
    const ids=[...new Set(String(u.searchParams.get("ids")||"").split(",").filter(x=>/^[0-9a-f-]{36}$/i.test(x)))].slice(0,30);
    const usernames=[...new Set(String(u.searchParams.get("authors")||"").split(",").map((x:string)=>x.trim().toLowerCase()).filter((x:string)=>/^[a-z0-9_.]{3,24}$/.test(x)))].slice(0,30);
    const [likesResult,savedResult,profileResult]=await Promise.all([
      ids.length?admin.from("post_likes").select("post_id").eq("user_id",uid).in("post_id",ids):Promise.resolve({data:[],error:null}),
      ids.length?admin.from("bookmarks").select("post_id").eq("user_id",uid).in("post_id",ids):Promise.resolve({data:[],error:null}),
      usernames.length?admin.from("profiles").select("id,username").in("username",usernames):Promise.resolve({data:[],error:null})
    ]);
    if(likesResult.error||savedResult.error||profileResult.error)return out({error:"Не удалось загрузить личное состояние публикаций."},503);
    const authorIds=(profileResult.data||[]).map((x:any)=>x.id);
    const {data:follows,error:followError}=authorIds.length
      ?await admin.from("follows").select("following_id").eq("follower_id",uid).in("following_id",authorIds)
      :{data:[],error:null};
    if(followError)return out({error:"Не удалось загрузить состояние подписок."},503);
    const followIds=new Set((follows||[]).map((x:any)=>x.following_id));
    const followingUsernames=(profileResult.data||[]).filter((x:any)=>followIds.has(x.id)).map((x:any)=>x.username);
    return out({
      likedIds:(likesResult.data||[]).map((x:any)=>x.post_id),
      savedIds:(savedResult.data||[]).map((x:any)=>x.post_id),
      followingUsernames
    });
  }
  const singlePost=path.match(/^\/api\/posts\/([0-9a-f-]+)$/i);
  if(req.method==="GET"&&singlePost){
    const {data:p,error}=await admin.from("posts")
      .select("*,profiles!posts_author_id_fkey(username,display_name,avatar_url,public_number)")
      .eq("id",singlePost[1]).eq("status","published").maybeSingle();
    if(error)return out({error:error.message},400);
    if(!p)return out({error:"Публикация не найдена."},404);
    const [{data:likes},{data:mine},{data:saved}]=await Promise.all([
      admin.from("post_like_counts").select("like_count").eq("post_id",p.id).maybeSingle(),
      admin.from("post_likes").select("post_id").eq("post_id",p.id).eq("user_id",uid).maybeSingle(),
      admin.from("bookmarks").select("post_id").eq("post_id",p.id).eq("user_id",uid).maybeSingle()
    ]);
    return out({post:{
      id:p.id,title:p.title,topic:p.topic,body:p.body,
      username:p.profiles?.username,author:p.profiles?.display_name,avatar_url:p.profiles?.avatar_url,
      createdAt:p.created_at,postNumber:String(p.post_number),authorNumber:p.profiles?.public_number==null?null:String(p.profiles.public_number),replyTo:p.reply_to,media:p.media||[],
      likes:Number(likes?.like_count)||0,liked:!!mine,saved:!!saved,poll:(await enrichPolls(admin,uid,[p]))[0]?.poll||null
    }});
  }
  if (req.method==="POST" && path==="/api/posts") {
    if(await isRateLimited(admin,uid,"post_create",12,3600))return out({error:"Лимит публикаций — 12 постов в час. Попробуй позже."},429);
    const text=String(body.body||"").trim().slice(0,4000),media=Array.isArray(body.media)?body.media:[];
    if(body.media&&(!Array.isArray(body.media)||body.media.length>4))return out({error:"Можно прикрепить не более 4 файлов."},400);
    const options=Array.isArray(body.pollOptions)?body.pollOptions.map((x:any)=>String(x||"").trim().slice(0,90)).filter(Boolean):[];
    if(options.length!==0&&(options.length<2||options.length>6))return out({error:"В опросе должно быть от 2 до 6 вариантов."},400);
    if(!text&&!media.length&&!options.length)return out({error:"Добавь текст, фото/видео или опрос."},400);
    const titleInput=String(body.title||"").trim().slice(0,120),topic=String(body.topic||"").trim().slice(0,48)||"Без темы";
    const mediaLabel=media.length===1?(String(media[0]?.type||"").startsWith("video/")?"Видео":"Фото"):"Медиа-публикация";
    const title=titleInput||(text.split("\n")[0].slice(0,80)||(options.length?"Опрос":mediaLabel));
    const postText=text||(options.length?title:mediaLabel);
    const moderation=basicTextGuard(title+" "+postText);if(moderation)return out({error:moderation},422);
    const mediaBase="https://wdwvcvpgovvkoodozbxf.supabase.co/storage/v1/object/public/orbis-media/";
    if(media.some((item:any)=>!item||typeof item.key!=="string"||!item.key.startsWith(uid+"/")||typeof item.url!=="string"||item.url!==mediaBase+item.key))return out({error:"Один из файлов не принадлежит этому гостевому профилю."},400);
    const duration=Number(body.pollDurationHours||24),pollEndsAt=options.length?new Date(Date.now()+Math.max(1,Math.min(168,Number.isFinite(duration)?duration:24))*3600000).toISOString():null;
    const {data:post,error}=await admin.from("posts").insert({author_id:uid,title,topic,body:postText,reply_to:body.replyTo||null,media,poll_options:options,poll_ends_at:pollEndsAt}).select("*").single();
    if(error)return out({error:error.message},400);
    return out({ok:true,post:{...post,postNumber:String(post.post_number),username:me.username,author:me.display_name,authorNumber:me.public_number==null?null:String(me.public_number),createdAt:post.created_at,replyTo:post.reply_to,media:post.media||[],poll:options.length?{options,counts:options.map(()=>0),total:0,myVote:null,endsAt:pollEndsAt}:null,likes:0,liked:false,saved:false}},201);
  }
  const postComments=path.match(/^\/api\/posts\/([0-9a-f-]{36})\/comments$/i);
  if(postComments&&req.method==="GET"){
    if(await isRateLimited(admin,uid,"comments_read",120,60))return out({error:"Слишком много запросов к комментариям."},429);
    const postId=postComments[1],rawLimit=Number(u.searchParams.get("limit")||20);
    const limit=Number.isSafeInteger(rawLimit)?Math.max(1,Math.min(rawLimit,30)):20;
    const {data:post}=await admin.from("posts").select("id").eq("id",postId).eq("status","published").maybeSingle();
    if(!post)return out({error:"Публикация не найдена."},404);
    const {data:rows,error}=await admin.from("post_comments")
      .select("id,post_id,author_id,body,created_at,parent_id,profiles!post_comments_author_id_fkey(username,display_name,avatar_url)")
      .eq("post_id",postId).eq("status","published").is("parent_id",null)
      .order("created_at",{ascending:false}).order("id",{ascending:false}).limit(limit);
    if(error)return out({error:"Не удалось загрузить комментарии."},400);
    const ids=(rows||[]).map((x:any)=>x.id);
    const {data:replyRows}=ids.length?await admin.from("post_comments").select("parent_id").eq("status","published").in("parent_id",ids):{data:[]};
    const replyCounts=new Map<string,number>();
    for(const row of replyRows||[])replyCounts.set(row.parent_id,(replyCounts.get(row.parent_id)||0)+1);
    return out({comments:(rows||[]).map((x:any)=>({id:x.id,postId:x.post_id,parentId:null,body:x.body,createdAt:x.created_at,
      author:{username:x.profiles?.username||"member",displayName:x.profiles?.display_name||"ORBIS member",avatarUrl:x.profiles?.avatar_url||null},
      own:x.author_id===uid,repliesCount:replyCounts.get(x.id)||0}))});
  }
  if(postComments&&req.method==="POST"){
    if(await isRateLimited(admin,uid,"comment_create",30,60))return out({error:"Слишком много комментариев. Подожди немного."},429);
    const postId=postComments[1],text=String(body.body||"").trim(),parentId=String(body.parentId||"").trim()||null;
    if(!text||text.length>1000)return out({error:"Комментарий должен содержать от 1 до 1000 символов."},400);
    const moderation=basicTextGuard(text);if(moderation)return out({error:moderation},422);
    const {data:post}=await admin.from("posts").select("id,author_id").eq("id",postId).eq("status","published").maybeSingle();
    if(!post)return out({error:"Публикация не найдена."},404);
    let parent:any=null;
    if(parentId){
      const {data:parentRow}=await admin.from("post_comments").select("id,author_id,parent_id").eq("id",parentId).eq("post_id",postId).eq("status","published").maybeSingle();
      if(!parentRow||parentRow.parent_id)return out({error:"Ответить можно на комментарий первого уровня."},400);
      parent=parentRow;
    }
    const {data:row,error}=await admin.from("post_comments").insert({post_id:postId,author_id:uid,body:text,parent_id:parentId})
      .select("id,post_id,author_id,body,created_at,parent_id").single();
    if(error)return out({error:"Не удалось сохранить комментарий."},400);
    await notifyUser(admin,parent?.author_id||post.author_id,uid,parentId?"comment_reply":"comment",postId,parentId?"Новый ответ на твой комментарий.":"Новый комментарий к твоей публикации.");
    return out({ok:true,comment:{id:row.id,postId:row.post_id,parentId:row.parent_id,body:row.body,createdAt:row.created_at,own:true,
      author:{username:me.username,displayName:me.display_name,avatarUrl:me.avatar_url||null},repliesCount:0}},201);
  }
  const commentReplies=path.match(/^\/api\/comments\/([0-9a-f-]{36})\/replies$/i);
  if(commentReplies&&req.method==="GET"){
    if(await isRateLimited(admin,uid,"comment_replies_read",120,60))return out({error:"Слишком много запросов к ответам."},429);
    const parentId=commentReplies[1];
    const {data:parent}=await admin.from("post_comments").select("id,parent_id").eq("id",parentId).eq("status","published").maybeSingle();
    if(!parent||parent.parent_id)return out({error:"Комментарий не найден."},404);
    const {data:rows,error}=await admin.from("post_comments")
      .select("id,post_id,author_id,body,created_at,parent_id,profiles!post_comments_author_id_fkey(username,display_name,avatar_url)")
      .eq("parent_id",parentId).eq("status","published").order("created_at",{ascending:true}).order("id",{ascending:true}).limit(40);
    if(error)return out({error:"Не удалось загрузить ответы."},400);
    return out({replies:(rows||[]).map((x:any)=>({id:x.id,postId:x.post_id,parentId:x.parent_id,body:x.body,createdAt:x.created_at,
      author:{username:x.profiles?.username||"member",displayName:x.profiles?.display_name||"ORBIS member",avatarUrl:x.profiles?.avatar_url||null},
      own:x.author_id===uid,repliesCount:0}))});
  }
  const commentRoute=path.match(/^\/api\/comments\/([0-9a-f-]{36})$/i);
  if(commentRoute&&req.method==="PUT"){
    if(await isRateLimited(admin,uid,"comment_edit",20,60))return out({error:"Слишком много изменений комментариев."},429);
    const text=String(body.body||"").trim();
    if(!text||text.length>1000)return out({error:"Комментарий должен содержать от 1 до 1000 символов."},400);
    const moderation=basicTextGuard(text);if(moderation)return out({error:moderation},422);
    const {data:row,error}=await admin.from("post_comments").update({body:text}).eq("id",commentRoute[1])
      .eq("author_id",uid).eq("status","published").select("id,post_id,body,created_at,parent_id").maybeSingle();
    if(error)return out({error:"Не удалось изменить комментарий."},400);
    if(!row)return out({error:"Комментарий не найден или уже недоступен."},404);
    return out({ok:true,comment:{id:row.id,postId:row.post_id,parentId:row.parent_id,body:row.body,createdAt:row.created_at,own:true}});
  }
  if(commentRoute&&req.method==="DELETE"){
    const {data:row,error}=await admin.from("post_comments").update({status:"removed"}).eq("id",commentRoute[1])
      .eq("author_id",uid).eq("status","published").select("id").maybeSingle();
    if(error)return out({error:"Не удалось удалить комментарий."},400);
    return row?out({ok:true}):out({error:"Комментарий не найден или уже недоступен."},404);
  }

  const postItem=path.match(/^\/api\/posts\/([0-9a-f-]{36})$/i);
  if(postItem&&req.method==="PUT"){
    if(await isRateLimited(admin,uid,"post_edit",20,60))return out({error:"Слишком много изменений публикаций."},429);
    const text=String(body.body||"").trim().slice(0,4000);
    const title=String(body.title||"").trim().slice(0,120);
    const topic=String(body.topic||"").trim().slice(0,48);
    if(!text)return out({error:"Публикация не может быть пустой."},400);
    const moderation=basicTextGuard(title+" "+text);if(moderation)return out({error:moderation},422);
    const {data:updated,error}=await admin.from("posts").update({body:text,title:title||text.split("\n")[0].slice(0,80),topic:topic||"Без темы"})
      .eq("id",postItem[1]).eq("author_id",uid).eq("status","published").select("*").maybeSingle();
    if(error)return out({error:"Не удалось изменить публикацию."},400);
    if(!updated)return out({error:"Публикация не найдена или не принадлежит тебе."},404);
    return out({ok:true,post:{id:updated.id,title:updated.title,topic:updated.topic,body:updated.body,createdAt:updated.created_at,media:updated.media||[]}});
  }
  if(postItem&&req.method==="DELETE"){
    const {data:removed,error}=await admin.from("posts").update({status:"removed"}).eq("id",postItem[1])
      .eq("author_id",uid).eq("status","published").select("id").maybeSingle();
    if(error)return out({error:"Не удалось удалить публикацию."},400);
    return removed?out({ok:true}):out({error:"Публикация не найдена или не принадлежит тебе."},404);
  }

  const like=path.match(/^\/api\/posts\/([0-9a-f-]+)\/like$/i);
  if(req.method==="POST"&&like){
    if(await isRateLimited(admin,uid,"like",90,60))return out({error:"Слишком много реакций. Подожди немного."},429);
    const postId=like[1]; const {data:exists}=await admin.from("post_likes").select("post_id").eq("post_id",postId).eq("user_id",uid).maybeSingle();
    const r=exists?await admin.from("post_likes").delete().eq("post_id",postId).eq("user_id",uid):await admin.from("post_likes").insert({post_id:postId,user_id:uid});
    if(r.error)return out({error:r.error.message},400);
    if(!exists){const {data:postOwner}=await admin.from("posts").select("author_id").eq("id",postId).maybeSingle();if(postOwner)await notifyUser(admin,postOwner.author_id,uid,"like",postId,"Пользователю понравилась твоя публикация.");}
    const {data:likeCountRow,error:countError}=await admin.from("post_like_counts").select("like_count").eq("post_id",postId).maybeSingle();
    if(countError)return out({error:"Реакция сохранена, но счётчик пока недоступен."},200);
    return out({ok:true,liked:!exists,likes:Number(likeCountRow?.like_count)||0});
  }
  const pollVote=path.match(/^\/api\/posts\/([0-9a-f-]{36})\/vote$/i);
  if(req.method==="POST"&&pollVote){
    if(await isRateLimited(admin,uid,"poll_vote",60,60))return out({error:"Слишком много голосований. Подожди немного."},429);
    const {data:post,error:postError}=await admin.from("posts").select("id,poll_options,poll_ends_at,status").eq("id",pollVote[1]).maybeSingle();
    if(postError||!post||post.status!=="published")return out({error:"Опрос не найден."},404);
    const options=Array.isArray(post.poll_options)?post.poll_options:[],optionIndex=Number(body.optionIndex);
    if(options.length<2||!Number.isInteger(optionIndex)||optionIndex<0||optionIndex>=options.length)return out({error:"Выбери один из вариантов опроса."},400);
    if(post.poll_ends_at&&Date.parse(post.poll_ends_at)<=Date.now())return out({error:"Опрос уже завершён."},409);
    const {error}=await admin.from("post_poll_votes").upsert({post_id:post.id,user_id:uid,option_index:optionIndex},{onConflict:"post_id,user_id"});
    if(error)return out({error:"Не удалось сохранить голос."},400);
    const [{data:counts},{data:mine}]=await Promise.all([
      admin.from("post_poll_counts").select("option_index,vote_count").eq("post_id",post.id),
      admin.from("post_poll_votes").select("option_index").eq("post_id",post.id).eq("user_id",uid).maybeSingle()
    ]);
    const countMap=new Map((counts||[]).map((x:any)=>[Number(x.option_index),Number(x.vote_count)||0]));
    const values=options.map((_:any,i:number)=>countMap.get(i)||0);
    return out({ok:true,poll:{options,counts:values,total:values.reduce((x:number,y:number)=>x+y,0),myVote:mine?Number(mine.option_index):null,endsAt:post.poll_ends_at||null}});
  }
  const replies=path.match(/^\/api\/posts\/([0-9a-f-]+)\/replies$/i);
  if(req.method==="GET"&&replies){
    const {data,error}=await admin.from("posts").select("*,profiles!posts_author_id_fkey(username,display_name,public_number)").eq("reply_to",replies[1]).eq("status","published").order("created_at",{ascending:true}).limit(20);
    if(error)return out({error:error.message},400);
    const counted=await enrichPostCounts(admin,uid,data||[]);
    return out({replies:counted.map((p:any)=>({id:p.id,title:p.title,topic:p.topic,body:p.body,username:p.profiles?.username,author:p.profiles?.display_name,createdAt:p.created_at,replyTo:p.reply_to,likes:p.likes,liked:p.liked}))});
  }
  if(req.method==="PUT"&&path==="/api/profile"){
    const name=String(body.name||"").trim(),bio=String(body.bio||"").trim();
    if(name.length<2||name.length>32||bio.length>180)return out({error:"Проверь имя и описание профиля."},400);
    const patch:any={display_name:name,bio,updated_at:new Date().toISOString()};
    if(body.avatarUrl!==undefined){
      const avatar=String(body.avatarUrl||"").trim();
      if(avatar){
        const base="https://wdwvcvpgovvkoodozbxf.supabase.co/storage/v1/object/public/orbis-media/";
        if(!avatar.startsWith(base)||!avatar.slice(base.length).startsWith(uid+"/"))return out({error:"Аватар должен быть загружен в твой раздел ORBIS media."},400);
      }
      patch.avatar_url=avatar||null;
    }
    const {data,error}=await admin.from("profiles").update(patch).eq("id",uid).select("*").single();
    if(error)return out({error:error.message},400);return out({ok:true,user:{id:uid,...safeProfile(data)}});
  }
  if(req.method==="GET"&&path.startsWith("/api/profile/")){
    if(await isRateLimited(admin,uid,"profile_read",120,60))return out({error:"Слишком много просмотров профилей."},429);
    const username=decodeURIComponent(path.slice("/api/profile/".length)).toLowerCase();
    const {data:p}=await admin.from("profiles").select("*").eq("username",username).maybeSingle();if(!p)return out({error:"Профиль не найден."},404);
    const [{data:posts},{count:followers},{count:following},{data:follow}]=await Promise.all([
      admin.from("posts").select("*").eq("author_id",p.id).eq("status","published").order("created_at",{ascending:false}).limit(20),
      admin.from("follows").select("*",{count:"exact",head:true}).eq("following_id",p.id),
      admin.from("follows").select("*",{count:"exact",head:true}).eq("follower_id",p.id),
      admin.from("follows").select("*").eq("follower_id",uid).eq("following_id",p.id).maybeSingle()
    ]);
    const countedPosts=await enrichPostCounts(admin,uid,posts||[]);
    return out({user:safeProfile(p),followers:followers||0,following:following||0,isFollowing:!!follow,posts:countedPosts.map((x:any)=>({...x,username:p.username,author:p.display_name,createdAt:x.created_at}))});
  }
  const follow=path.match(/^\/api\/users\/([a-z0-9_.]{3,24})\/follow$/i);
  if(req.method==="POST"&&follow){
    if(await isRateLimited(admin,uid,"follow",30,60))return out({error:"Слишком много подписок за короткое время."},429);
    const {data:target}=await admin.from("profiles").select("id").eq("username",follow[1].toLowerCase()).maybeSingle();if(!target)return out({error:"Пользователь не найден."},404);
    if(target.id===uid)return out({error:"Нельзя подписаться на себя."},400);
    const {data:exists}=await admin.from("follows").select("*").eq("follower_id",uid).eq("following_id",target.id).maybeSingle();
    const r=exists?await admin.from("follows").delete().eq("follower_id",uid).eq("following_id",target.id):await admin.from("follows").insert({follower_id:uid,following_id:target.id});
    if(r.error)return out({error:r.error.message},400);if(!exists)await notifyUser(admin,target.id,uid,"follow",null,"Новый подписчик: @"+me.username);return out({ok:true,following:!exists});
  }
  if(req.method==="GET"&&path==="/api/navigator"){
    const {data,error}=await admin.from("post_topic_counts").select("topic,post_count").order("post_count",{ascending:false}).limit(30);
    if(error)return out({error:error.message},400);
    return out({topics:(data||[]).map((x:any)=>({name:x.topic,count:Number(x.post_count)||0}))});
  }
  if(req.method==="POST"&&path==="/api/reports"){
    if(await isRateLimited(admin,uid,"report",5,600))return out({error:"Слишком много жалоб. Попробуй позже."},429);
    const reason=String(body.reason||"").trim();if(!body.postId||!reason)return out({error:"Укажи публикацию и причину жалобы."},400);
    const {error}=await admin.from("post_reports").insert({post_id:body.postId,reporter_id:uid,reason:String(body.reason||"").trim().slice(0,300)});
    return error?out({error:error.message},400):out({ok:true},201);
  }
  if(req.method==="GET"&&path==="/api/bookmarks"){
    if(await isRateLimited(admin,uid,"bookmarks_read",60,60))return out({error:"Слишком много запросов к сохранённому."},429);
    const {data,error}=await admin.from("bookmarks").select("post_id,posts(*,profiles!posts_author_id_fkey(username,display_name,public_number))").eq("user_id",uid).order("created_at",{ascending:false}).limit(30);
    if(error)return out({error:error.message},400);
    const rawPosts=(data||[]).map((x:any)=>x.posts).filter(Boolean);
    const countedPosts=await enrichPostCounts(admin,uid,rawPosts);
    return out({posts:countedPosts.map((p:any)=>({...p,username:p.profiles?.username,author:p.profiles?.display_name,authorNumber:p.profiles?.public_number==null?null:String(p.profiles.public_number),createdAt:p.created_at}))});
  }
  if(req.method==="POST"&&path==="/api/bookmarks"){
    if(await isRateLimited(admin,uid,"bookmark",90,60))return out({error:"Слишком много действий с закладками."},429);
    const postId=String(body.postId||"");if(!postId)return out({error:"Не указана публикация."},400);const {data:exists}=await admin.from("bookmarks").select("*").eq("user_id",uid).eq("post_id",postId).maybeSingle();
    const r=exists?await admin.from("bookmarks").delete().eq("user_id",uid).eq("post_id",postId):await admin.from("bookmarks").insert({user_id:uid,post_id:postId});
    return r.error?out({error:r.error.message},400):out({ok:true,saved:!exists});
  }
  if(req.method==="GET"&&path==="/api/stories"){
    const {data,error}=await admin.from("stories").select("*,profiles!stories_author_id_fkey(username,display_name)").gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(40);
    return error?out({error:error.message},400):out({stories:(data||[]).map((s:any)=>({...s,username:s.profiles?.username,author:s.profiles?.display_name,createdAt:s.created_at}))});
  }
  if(req.method==="POST"&&path==="/api/stories"){
    const storyBody=String(body.body||"").trim().slice(0,500);
    const media=Array.isArray(body.media)?body.media: [];
    if(media.length>1)return out({error:"В историю можно добавить один файл."},400);
    if(!storyBody&&!media.length)return out({error:"Добавь текст или фото/видео."},400);
    const moderation=basicTextGuard(storyBody);if(moderation)return out({error:moderation},422);
    const allowedPrefix="https://wdwvcvpgovvkoodozbxf.supabase.co/storage/v1/object/public/orbis-media/";
    for(const item of media){
      if(!item||typeof item.key!=="string"||!item.key.startsWith(uid+"/")||typeof item.url!=="string"||item.url!==allowedPrefix+item.key||!["image/jpeg","image/png","image/webp","image/gif","video/mp4","video/webm"].includes(item.type))
        return out({error:"Файл истории недействителен или не принадлежит этому аккаунту."},400);
    }
    const {data,error}=await admin.from("stories").insert({author_id:uid,body:storyBody,media}).select("*").single();
    if(error)return out({error:error.code==="23505"?"Сегодня история уже опубликована.":error.message},400);
    return out({ok:true,story:data},201);
  }

  if(req.method==="GET"&&path==="/api/ads/feed"){
    const {data,error}=await admin.from("ad_campaigns").select("id,name,headline,body,destination_url,image_url").eq("status","approved").order("updated_at",{ascending:false}).limit(24);
    if(error)return out({ad:null});
    const rows=data||[];return out({ad:rows.length?rows[Math.floor(Math.random()*rows.length)]:null});
  }
  if(req.method==="POST"&&path==="/api/ads/events"){
    const campaignId=String(body.campaignId||""),eventType=String(body.eventType||"");
    if(!/^[0-9a-f-]{36}$/i.test(campaignId)||!["impression","click"].includes(eventType))return out({error:"Некорректное рекламное событие."},400);
    if(await isRateLimited(admin,uid,"ad_event",120,60))return out({error:"Слишком много рекламных событий."},429);
    const {data:campaign}=await admin.from("ad_campaigns").select("id").eq("id",campaignId).eq("status","approved").maybeSingle();
    if(!campaign)return out({error:"Рекламная кампания не активна."},404);
    const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(uid)));
    const visitorHash=bytesToBase64Url(digest);
    const {error}=await admin.from("ad_events").insert({campaign_id:campaignId,event_type:eventType,visitor_hash:visitorHash});
    return error?out({error:"Не удалось записать событие."},400):out({ok:true},201);
  }
  if(req.method==="GET"&&path==="/api/ads/campaigns"){
    const {data:campaigns,error}=await admin.from("ad_campaigns")
      .select("id,name,headline,body,destination_url,image_url,daily_budget,status,created_at,updated_at")
      .eq("owner_id",uid).order("created_at",{ascending:false}).limit(50);
    if(error)return out({error:"Не удалось загрузить рекламные кампании."},400);
    const rows=await Promise.all((campaigns||[]).map(async(c:any)=>{
      const [{count:impressions},{count:clicks}]=await Promise.all([
        admin.from("ad_events").select("id",{count:"exact",head:true}).eq("campaign_id",c.id).eq("event_type","impression"),
        admin.from("ad_events").select("id",{count:"exact",head:true}).eq("campaign_id",c.id).eq("event_type","click")
      ]);
      return {...c,impressions:impressions||0,clicks:clicks||0};
    }));
    return out({campaigns:rows});
  }
  if(req.method==="POST"&&path==="/api/ads/campaigns"){
    if(await isRateLimited(admin,uid,"ad_campaign_create",5,3600))return out({error:"Можно создать не более 5 кампаний в час."},429);
    const name=String(body.name||"").trim().slice(0,80);
    const headline=String(body.headline||"").trim().slice(0,90);
    const description=String(body.body||"").trim().slice(0,240);
    const destination=String(body.destinationUrl||"").trim();
    let parsed:URL|null=null;
    try{parsed=new URL(destination)}catch{}
    if(name.length<2||headline.length<2||description.length<2||!parsed||parsed.protocol!=="https:"||parsed.username||parsed.password)
      return out({error:"Заполни название, заголовок, описание и укажи корректную HTTPS-ссылку."},400);
    const budget=Number(body.dailyBudget||0);
    if(!Number.isFinite(budget)||budget<0||budget>100000)return out({error:"Проверь дневной лимит кампании."},400);
    const imageUrl=String(body.imageUrl||"").trim()||null;
    if(imageUrl){try{const image=new URL(imageUrl);if(image.protocol!=="https:")throw new Error()}catch{return out({error:"Ссылка на изображение должна начинаться с HTTPS."},400)}}
    const guard=basicTextGuard(name+" "+headline+" "+description);
    if(guard)return out({error:guard},422);
    const {data,error}=await admin.from("ad_campaigns").insert({
      owner_id:uid,name,headline,body:description,destination_url:parsed.href,
      image_url:imageUrl,daily_budget:budget,status:"pending_review"
    }).select("id,name,headline,body,destination_url,image_url,daily_budget,status,created_at,updated_at").single();
    if(error)return out({error:"Не удалось сохранить кампанию: "+error.message},400);
    return out({ok:true,campaign:{...data,impressions:0,clicks:0}},201);
  }
  const adCampaignId=path.startsWith("/api/ads/campaigns/")?path.slice("/api/ads/campaigns/".length):"";
  if(req.method==="PATCH"&&/^[0-9a-f-]{36}$/i.test(adCampaignId)){
    const {data:current,error:loadError}=await admin.from("ad_campaigns").select("*").eq("id",adCampaignId).eq("owner_id",uid).maybeSingle();
    if(loadError)return out({error:"Не удалось загрузить кампанию."},400);
    if(!current)return out({error:"Кампания не найдена."},404);
    const nextStatus=String(body.status||current.status);
    if(nextStatus!==current.status&&!((current.status==="approved"&&nextStatus==="paused")||(current.status==="paused"&&nextStatus==="pending_review")||(current.status==="draft"&&nextStatus==="pending_review")))
      return out({error:"Это изменение статуса недоступно. Одобренные кампании можно приостановить; повторный запуск проходит проверку."},403);
    const patch:any={status:nextStatus,updated_at:new Date().toISOString()};
    if(body.name!==undefined)patch.name=String(body.name).trim().slice(0,80);
    if(body.headline!==undefined)patch.headline=String(body.headline).trim().slice(0,90);
    if(body.body!==undefined)patch.body=String(body.body).trim().slice(0,240);
    if(body.destinationUrl!==undefined){
      try{const dest=new URL(String(body.destinationUrl));if(dest.protocol!=="https:"||dest.username||dest.password)throw new Error();patch.destination_url=dest.href}
      catch{return out({error:"Ссылка должна быть корректной HTTPS-ссылкой."},400)}
    }
    const {data,error}=await admin.from("ad_campaigns").update(patch).eq("id",adCampaignId).eq("owner_id",uid)
      .select("id,name,headline,body,destination_url,image_url,daily_budget,status,created_at,updated_at").single();
    if(error)return out({error:"Не удалось обновить кампанию: "+error.message},400);
    return out({ok:true,campaign:data});
  }

  if(req.method==="GET"&&path==="/api/conversations"){
    const {data:mine,error}=await admin.from("conversation_members").select("conversation_id,last_read_at").eq("user_id",uid);
    if(error)return out({error:"Не удалось загрузить диалоги."},400);
    const ids=(mine||[]).map((x:any)=>x.conversation_id);
    if(!ids.length)return out({conversations:[]});
    const [{data:members},{data:messages},{data:conversations}]=await Promise.all([
      admin.from("conversation_members").select("conversation_id,user_id").in("conversation_id",ids),
      admin.from("messages").select("id,conversation_id,sender_id,body,created_at").in("conversation_id",ids).order("created_at",{ascending:false}).limit(500),
      admin.from("conversations").select("id,updated_at").in("id",ids)
    ]);
    const otherIds=[...new Set((members||[]).filter((m:any)=>m.user_id!==uid).map((m:any)=>m.user_id))];
    const {data:profiles}=otherIds.length?await admin.from("profiles").select("id,username,display_name,avatar_url").in("id",otherIds):{data:[]};
    const profileMap=new Map((profiles||[]).map((p:any)=>[p.id,p]));
    const readMap=new Map((mine||[]).map((m:any)=>[m.conversation_id,m.last_read_at]));
    const convMap=new Map((conversations||[]).map((c:any)=>[c.id,c]));
    const result=ids.map((id:string)=>{
      const other=(members||[]).find((m:any)=>m.conversation_id===id&&m.user_id!==uid);
      const last=(messages||[]).find((m:any)=>m.conversation_id===id);
      const readAt=readMap.get(id)||"1970-01-01T00:00:00Z";
      const unread=(messages||[]).filter((m:any)=>m.conversation_id===id&&m.sender_id!==uid&&m.created_at>readAt).length;
      return {id,updatedAt:convMap.get(id)?.updated_at||last?.created_at,other:profileMap.get(other?.user_id)||null,lastMessage:last?.body||"Начни разговор",lastMessageAt:last?.created_at||null,unread};
    }).sort((a:any,b:any)=>String(b.updatedAt||"").localeCompare(String(a.updatedAt||"")));
    return out({conversations:result});
  }
  if(req.method==="POST"&&path==="/api/conversations"){
    const username=String(body.username||"").trim().replace(/^@/,"").toLowerCase();
    if(!/^[a-z0-9_.]{3,24}$/.test(username))return out({error:"Введи корректный username."},400);
    const {data:target}=await admin.from("profiles").select("id,username,display_name").eq("username",username).maybeSingle();
    if(!target)return out({error:"Пользователь не найден."},404);
    if(target.id===uid)return out({error:"Нельзя начать диалог с самим собой."},400);
    const directKey=[uid,target.id].sort().join(":");
    let {data:conversation}=await admin.from("conversations").select("id").eq("direct_key",directKey).maybeSingle();
    if(!conversation){
      const created=await admin.from("conversations").insert({direct_key:directKey,created_by:uid}).select("id").single();
      if(created.error){
        const retry=await admin.from("conversations").select("id").eq("direct_key",directKey).maybeSingle();
        if(!retry.data)return out({error:"Не удалось создать диалог."},400);
        conversation=retry.data;
      }else conversation=created.data;
      const joined=await admin.from("conversation_members").upsert([{conversation_id:conversation.id,user_id:uid},{conversation_id:conversation.id,user_id:target.id}],{onConflict:"conversation_id,user_id"});
      if(joined.error)return out({error:"Диалог создан, но не удалось добавить участников."},500);
    }
    return out({ok:true,conversationId:conversation.id,other:target},201);
  }
  const conversationMessages=path.match(/^\/api\/conversations\/([0-9a-f-]{36})\/messages$/i);
  if(conversationMessages&&req.method==="GET"){
    const conversationId=conversationMessages[1];
    const {data:member}=await admin.from("conversation_members").select("conversation_id").eq("conversation_id",conversationId).eq("user_id",uid).maybeSingle();
    if(!member)return out({error:"У тебя нет доступа к этому диалогу."},403);
    const {data:rows,error}=await admin.from("messages").select("id,conversation_id,sender_id,body,created_at").eq("conversation_id",conversationId).order("created_at",{ascending:false}).limit(100);
    if(error)return out({error:"Не удалось загрузить сообщения."},400);
    const messages=(rows||[]).reverse();
    const authorIds=[...new Set(messages.map((m:any)=>m.sender_id))];
    const {data:authors}=authorIds.length?await admin.from("profiles").select("id,username,display_name").in("id",authorIds):{data:[]};
    const authorMap=new Map((authors||[]).map((p:any)=>[p.id,p]));
    await admin.from("conversation_members").update({last_read_at:new Date().toISOString()}).eq("conversation_id",conversationId).eq("user_id",uid);
    return out({messages:messages.map((m:any)=>({id:m.id,body:m.body,createdAt:m.created_at,own:m.sender_id===uid,author:authorMap.get(m.sender_id)?.display_name||"Участник",username:authorMap.get(m.sender_id)?.username||"user"}))});
  }
  if(conversationMessages&&req.method==="POST"){
    if(await isRateLimited(admin,uid,"message",30,60))return out({error:"Слишком много сообщений. Подожди немного."},429);
    const conversationId=conversationMessages[1],text=String(body.body||"").trim();
    if(!text||text.length>2000)return out({error:"Сообщение должно содержать от 1 до 2000 символов."},400);
    const guard=basicTextGuard(text);if(guard)return out({error:guard},422);
    const {data:members}=await admin.from("conversation_members").select("user_id").eq("conversation_id",conversationId);
    if(!members||members.length!==2||!members.some((m:any)=>m.user_id===uid))return out({error:"Диалог не найден или доступ запрещён."},403);
    const recipient=members.find((m:any)=>m.user_id!==uid)?.user_id;
    const {data:message,error}=await admin.from("messages").insert({conversation_id:conversationId,sender_id:uid,body:text}).select("id,body,created_at").single();
    if(error)return out({error:"Не удалось отправить сообщение."},400);
    await admin.from("conversations").update({updated_at:new Date().toISOString()}).eq("id",conversationId);
    if(recipient)await notifyUser(admin,recipient,uid,"message",conversationId,"Новое личное сообщение.");
    return out({ok:true,message:{id:message.id,body:message.body,createdAt:message.created_at,own:true}},201);
  }
  if(req.method==="GET"&&path==="/api/notifications"){
    if(await isRateLimited(admin,uid,"notifications_read",60,60))return out({error:"Слишком много запросов к уведомлениям."},429);
    const {data:rows,error}=await admin.from("notifications").select("id,actor_id,kind,entity_id,body,created_at,read_at").eq("recipient_id",uid).order("created_at",{ascending:false}).limit(60);
    if(error)return out({error:"Не удалось загрузить уведомления."},400);
    const actorIds=[...new Set((rows||[]).map((n:any)=>n.actor_id).filter(Boolean))];
    const {data:actors}=actorIds.length?await admin.from("profiles").select("id,username,display_name,avatar_url").in("id",actorIds):{data:[]};
    const actorMap=new Map((actors||[]).map((p:any)=>[p.id,p]));
    return out({notifications:(rows||[]).map((n:any)=>({...n,actor:actorMap.get(n.actor_id)||null})),unread:(rows||[]).filter((n:any)=>!n.read_at).length});
  }
  if(req.method==="POST"&&path==="/api/notifications/read"){
    const id=String(body.id||"");
    let q=admin.from("notifications").update({read_at:new Date().toISOString()}).eq("recipient_id",uid).is("read_at",null);
    if(id)q=q.eq("id",id);
    const {error}=await q;
    return error?out({error:"Не удалось отметить уведомления прочитанными."},400):out({ok:true});
  }
  if(req.method==="GET"&&path==="/api/clans"){
    const [{data:clans,error},{data:members},{data:mine}]=await Promise.all([
      admin.from("clans").select("id,slug,name,description,owner_id,created_at").order("created_at",{ascending:false}).limit(60),
      admin.from("clan_members").select("clan_id,user_id,role"),
      admin.from("clan_members").select("clan_id,role").eq("user_id",uid).maybeSingle()
    ]);
    if(error)return out({error:"Не удалось загрузить кланы."},400);
    const rows=(clans||[]).map((c:any)=>({ ...c,memberCount:(members||[]).filter((m:any)=>m.clan_id===c.id).length,isMember:(members||[]).some((m:any)=>m.clan_id===c.id&&m.user_id===uid),role:mine?.clan_id===c.id?mine.role:null }));
    rows.sort((a:any,b:any)=>b.memberCount-a.memberCount||a.name.localeCompare(b.name));
    return out({clans:rows,myClan:mine?.clan_id||null});
  }
  if(req.method==="POST"&&path==="/api/clans"){
    const name=String(body.name||"").trim(),description=String(body.description||"").trim().slice(0,240);
    if(name.length<3||name.length>40)return out({error:"Название клана должно содержать от 3 до 40 символов."},400);
    const {data:membership}=await admin.from("clan_members").select("clan_id").eq("user_id",uid).maybeSingle();
    if(membership)return out({error:"Ты уже состоишь в одном клане. Сначала выйди из него."},409);
    const slugBase=name.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,24)||"clan";
    const slug=slugBase+"-"+crypto.randomUUID().slice(0,6);
    const {data:clan,error}=await admin.from("clans").insert({slug,name,description,owner_id:uid}).select("*").single();
    if(error)return out({error:"Не удалось создать клан: "+error.message},400);
    const {error:joinError}=await admin.from("clan_members").insert({clan_id:clan.id,user_id:uid,role:"owner"});
    if(joinError){await admin.from("clans").delete().eq("id",clan.id);return out({error:"Не удалось создать состав клана."},400);}
    return out({ok:true,clan:{...clan,memberCount:1,isMember:true,role:"owner"}},201);
  }
  const clanRoute=path.match(/^\/api\/clans\/([a-z0-9-]+)$/i);
  if(clanRoute&&req.method==="GET"){
    const {data:clan}=await admin.from("clans").select("*").eq("slug",clanRoute[1]).maybeSingle();
    if(!clan)return out({error:"Клан не найден."},404);
    const {data:members}=await admin.from("clan_members").select("user_id,role,joined_at").eq("clan_id",clan.id).order("joined_at",{ascending:true}).limit(200);
    const memberIds=(members||[]).map((m:any)=>m.user_id);
    const {data:profiles}=memberIds.length?await admin.from("profiles").select("id,username,display_name,avatar_url").in("id",memberIds):{data:[]};
    const profileMap=new Map((profiles||[]).map((p:any)=>[p.id,p]));
    return out({clan,members:(members||[]).map((m:any)=>({...m,profile:profileMap.get(m.user_id)||null})),isMember:(members||[]).some((m:any)=>m.user_id===uid)});
  }
  const clanJoin=path.match(/^\/api\/clans\/([a-z0-9-]+)\/(join|leave)$/i);
  if(clanJoin&&req.method==="POST"){
    const {data:clan}=await admin.from("clans").select("id,slug,owner_id").eq("slug",clanJoin[1]).maybeSingle();
    if(!clan)return out({error:"Клан не найден."},404);
    const {data:existing}=await admin.from("clan_members").select("clan_id,role").eq("user_id",uid).maybeSingle();
    if(clanJoin[2]==="join"){
      if(existing?.clan_id===clan.id)return out({ok:true,joined:true});
      if(existing)return out({error:"Можно состоять только в одном клане. Сначала выйди из текущего."},409);
      const {error}=await admin.from("clan_members").insert({clan_id:clan.id,user_id:uid,role:"member"});
      return error?out({error:"Не удалось вступить. Возможно, ты уже состоишь в другом клане."},409):out({ok:true,joined:true});
    }
    if(existing?.clan_id!==clan.id)return out({error:"Ты не состоишь в этом клане."},400);
    if(existing.role==="owner")return out({error:"Создатель не может покинуть клан. Сначала передай управление другому участнику."},403);
    const {error}=await admin.from("clan_members").delete().eq("clan_id",clan.id).eq("user_id",uid);
    return error?out({error:"Не удалось покинуть клан."},400):out({ok:true,joined:false});
  }

  return out({error:"API route not found."},404);
});