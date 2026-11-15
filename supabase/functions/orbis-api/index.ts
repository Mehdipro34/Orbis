import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};
const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const safeProfile = (p: any) => p ? ({ username:p.username, name:p.display_name, bio:p.bio||"", avatar_url:p.avatar_url||null, createdAt:p.created_at }) : null;

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
  return rows.map((p:any)=>({...p,likes:likeMap.get(p.id)||0,liked:liked.has(p.id),saved:saved.has(p.id)}));
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
  const payload=bytesToBase64Url(encoder.encode(JSON.stringify({sub:uid,exp:Date.now()+365*24*60*60*1000})));
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
  if (req.method==="POST" && path==="/api/guest/session") {
    const deviceId=String(body.deviceId||"").trim().toLowerCase();
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(deviceId))
      return out({error:"Некорректный идентификатор устройства."},400);
    if(uid&&uid!==deviceId)return out({error:"Идентификатор устройства не совпадает с текущей сессией."},403);
    const {data:existing,error:loadError}=await admin.from("profiles").select("*").eq("id",deviceId).maybeSingle();
    if(loadError)return out({error:"Не удалось загрузить гостевой профиль."},500);
    let profile=existing;
    if(!profile){
      const username="guest_"+deviceId.replace(/-/g,"").slice(0,16);
      const {data:created,error}=await admin.from("profiles").insert({id:deviceId,username,display_name:"Гость ORBIS"}).select("*").single();
      if(error){
        const {data:retry}=await admin.from("profiles").select("*").eq("id",deviceId).maybeSingle();
        if(!retry)return out({error:"Не удалось создать гостевой профиль: "+error.message},500);
        profile=retry;
      }else profile=created;
    }
    const signed=await issueGuestToken(deviceId,service);
    return out({ok:true,token:signed,user:{id:deviceId,...safeProfile(profile)}});
  }
  if (req.method==="POST" && path==="/api/media") {
    if (!uid) return out({error:"Войди в ORBIS, чтобы загружать медиа."},401);
    if(await isRateLimited(admin,uid,"media",10,60))return out({error:"Слишком много загрузок. Подожди минуту."},429);
    const files=(form?.getAll("files")||[]).filter((f:any)=>f && typeof f.size==="number") as File[];
    if (!files.length || files.length>4) return out({error:"Выбери от 1 до 4 файлов."},400);
    const allowed=new Set(["image/jpeg","image/png","image/webp","image/gif","video/mp4","video/webm"]);
    const uploaded=[];
    for (const file of files) {
      const isVideo=file.type.startsWith("video/");
      if (!allowed.has(file.type)) return out({error:"Формат файла не поддерживается."},415);
      if (!file.size || file.size>(isVideo?50:12)*1024*1024) return out({error:isVideo?"Видео должно быть не больше 50 МБ.":"Фото должно быть не больше 12 МБ."},413);
      const ext=({ "image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif","video/mp4":"mp4","video/webm":"webm"} as Record<string,string>)[file.type];
      const key=uid+"/"+crypto.randomUUID()+"."+ext;
      const {error}=await admin.storage.from("orbis-media").upload(key,file,{contentType:file.type,upsert:false});
      if(error)return out({error:"Не удалось сохранить файл: "+error.message},500);
      const {data:publicData}=admin.storage.from("orbis-media").getPublicUrl(key);
      uploaded.push({key,url:publicData.publicUrl,type:file.type,size:file.size});
    }
    return out({ok:true,media:uploaded},201);
  }
  if (!uid) return out({error:"Войди в ORBIS, чтобы продолжить."},401);
  const {data:me}=await admin.from("profiles").select("*").eq("id",uid).maybeSingle();
  if (!me) return out({error:"Профиль ORBIS не найден. Повтори вход в аккаунт."},401);

  if (req.method==="GET" && path==="/api/posts") {
    const rawOffset=Number(u.searchParams.get("offset")||0),rawLimit=Number(u.searchParams.get("limit")||20);
    const offset=Number.isSafeInteger(rawOffset)?Math.max(0,Math.min(rawOffset,1000000)):0;
    const limit=Number.isSafeInteger(rawLimit)?Math.max(1,Math.min(rawLimit,30)):20;
    let q=admin.from("posts").select("*,profiles!posts_author_id_fkey(username,display_name,avatar_url)").eq("status","published").is("reply_to",null).order("created_at",{ascending:false}).range(offset,offset+limit-1);
    const topic=u.searchParams.get("topic"); if(topic) q=q.ilike("topic",topic);
    const {data,error}=await q; if(error)return out({error:error.message},400);
    const ids=(data||[]).map((p:any)=>p.id);
    const [{data:likes},{data:mine},{data:bookmarks}]=await Promise.all([
      ids.length?admin.from("post_like_counts").select("post_id,like_count").in("post_id",ids):Promise.resolve({data:[]}),
      ids.length?admin.from("post_likes").select("post_id").eq("user_id",uid).in("post_id",ids):Promise.resolve({data:[]}),
      ids.length?admin.from("bookmarks").select("post_id").eq("user_id",uid).in("post_id",ids):Promise.resolve({data:[]})
    ]);
    const counts=new Map((likes||[]).map((x:any)=>[x.post_id,Number(x.like_count)||0]));
    const liked=new Set((mine||[]).map((x:any)=>x.post_id));
    const saved=new Set((bookmarks||[]).map((x:any)=>x.post_id));
    const posts=(data||[]).map((p:any)=>({id:p.id,title:p.title,topic:p.topic,body:p.body,username:p.profiles?.username,author:p.profiles?.display_name,avatar_url:p.profiles?.avatar_url,createdAt:p.created_at,replyTo:p.reply_to,media:p.media||[],likes:counts.get(p.id)||0,liked:liked.has(p.id),saved:saved.has(p.id)}));
    return out({posts,hasMore:posts.length===limit,nextOffset:offset+posts.length});
  }
  const singlePost=path.match(/^\/api\/posts\/([0-9a-f-]+)$/i);
  if(req.method==="GET"&&singlePost){
    const {data:p,error}=await admin.from("posts")
      .select("*,profiles!posts_author_id_fkey(username,display_name,avatar_url)")
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
      createdAt:p.created_at,replyTo:p.reply_to,media:p.media||[],
      likes:Number(likes?.like_count)||0,liked:!!mine,saved:!!saved
    }});
  }
  if (req.method==="POST" && path==="/api/posts") {
    const text=String(body.body||"").trim().slice(0,4000);
    const media=Array.isArray(body.media)?body.media:[];
    if (body.media && (!Array.isArray(body.media)||body.media.length>4)) return out({error:"Можно прикрепить не более 4 файлов."},400);
    if(!text&&!media.length)return out({error:"Добавь текст или фото/видео."},400);
    const titleInput=String(body.title||"").trim().slice(0,120);
    const topicInput=String(body.topic||"").trim().slice(0,48);
    const mediaLabel=media.length===1?(String(media[0]?.type||"").startsWith("video/")?"Видео":"Фото"):"Медиа-публикация";
    const title=titleInput||(text.split("\n")[0].slice(0,80)||mediaLabel);
    const topic=topicInput||"Без темы";
    const postText=text||mediaLabel;
    const moderation=basicTextGuard(title+" "+postText);if(moderation)return out({error:moderation},422);
    const mediaBase="https://wdwvcvpgovvkoodozbxf.supabase.co/storage/v1/object/public/orbis-media/";
    if (media.some((item:any)=>!item||typeof item.key!=="string"||!item.key.startsWith(uid+"/")||typeof item.url!=="string"||item.url!==mediaBase+item.key)) return out({error:"Один из файлов не принадлежит этому аккаунту."},400);
    const {data:post,error}=await admin.from("posts").insert({author_id:uid,title,topic,body:postText,reply_to:body.replyTo||null,media}).select("*").single();
    if(error)return out({error:error.code==="23505"?"Сегодня ты уже опубликовал пост. По правилам ORBIS — одна публикация в день.":error.message},error.code==="23505"?409:400);
    return out({ok:true,post:{
      ...post,username:me.username,author:me.display_name,
      createdAt:post.created_at,replyTo:post.reply_to,
      likes:0,liked:false,saved:false,
    }},201);
  }
  const like=path.match(/^\/api\/posts\/([0-9a-f-]+)\/like$/i);
  if(req.method==="POST"&&like){
    if(await isRateLimited(admin,uid,"like",90,60))return out({error:"Слишком много реакций. Подожди немного."},429);
    const postId=like[1]; const {data:exists}=await admin.from("post_likes").select("post_id").eq("post_id",postId).eq("user_id",uid).maybeSingle();
    const r=exists?await admin.from("post_likes").delete().eq("post_id",postId).eq("user_id",uid):await admin.from("post_likes").insert({post_id:postId,user_id:uid});
    if(r.error)return out({error:r.error.message},400);
    if(!exists){const {data:postOwner}=await admin.from("posts").select("author_id").eq("id",postId).maybeSingle();if(postOwner)await notifyUser(admin,postOwner.author_id,uid,"like",postId,"Пользователю понравилась твоя публикация.");}
    const {count}=await admin.from("post_likes").select("*",{count:"exact",head:true}).eq("post_id",postId);
    return out({ok:true,liked:!exists,likes:count||0});
  }
  const replies=path.match(/^\/api\/posts\/([0-9a-f-]+)\/replies$/i);
  if(req.method==="GET"&&replies){
    const {data,error}=await admin.from("posts").select("*,profiles!posts_author_id_fkey(username,display_name)").eq("reply_to",replies[1]).eq("status","published").order("created_at",{ascending:true}).limit(20);
    if(error)return out({error:error.message},400);
    const counted=await enrichPostCounts(admin,uid,data||[]);
    return out({replies:counted.map((p:any)=>({id:p.id,title:p.title,topic:p.topic,body:p.body,username:p.profiles?.username,author:p.profiles?.display_name,createdAt:p.created_at,replyTo:p.reply_to,likes:p.likes,liked:p.liked}))});
  }
  if(req.method==="PUT"&&path==="/api/profile"){
    const name=String(body.name||"").trim(),bio=String(body.bio||"").trim();
    if(name.length<2||name.length>32||bio.length>180)return out({error:"Проверь имя и описание профиля."},400);
    const {data,error}=await admin.from("profiles").update({display_name:name,bio,updated_at:new Date().toISOString()}).eq("id",uid).select("*").single();
    if(error)return out({error:error.message},400);return out({ok:true,user:{id:uid,...safeProfile(data)}});
  }
  if(req.method==="GET"&&path.startsWith("/api/profile/")){
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
    const {data,error}=await admin.from("bookmarks").select("post_id,posts(*,profiles!posts_author_id_fkey(username,display_name))").eq("user_id",uid).order("created_at",{ascending:false}).limit(30);
    if(error)return out({error:error.message},400);
    const rawPosts=(data||[]).map((x:any)=>x.posts).filter(Boolean);
    const countedPosts=await enrichPostCounts(admin,uid,rawPosts);
    return out({posts:countedPosts.map((p:any)=>({...p,username:p.profiles?.username,author:p.profiles?.display_name,createdAt:p.created_at}))});
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