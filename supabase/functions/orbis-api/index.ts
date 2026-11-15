import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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
  const [{data:likes},{data:mine},{data:comments},{data:bookmarks}]=await Promise.all([
    admin.from("post_like_counts").select("post_id,like_count").in("post_id",ids),
    admin.from("post_likes").select("post_id").eq("user_id",uid).in("post_id",ids),
    admin.from("post_comment_counts").select("post_id,comment_count").in("post_id",ids),
    admin.from("bookmarks").select("post_id").eq("user_id",uid).in("post_id",ids)
  ]);
  const likeMap=new Map((likes||[]).map((x:any)=>[x.post_id,Number(x.like_count)||0]));
  const commentMap=new Map((comments||[]).map((x:any)=>[x.post_id,Number(x.comment_count)||0]));
  const liked=new Set((mine||[]).map((x:any)=>x.post_id));
  const saved=new Set((bookmarks||[]).map((x:any)=>x.post_id));
  return rows.map((p:any)=>({...p,likes:likeMap.get(p.id)||0,comments:commentMap.get(p.id)||0,liked:liked.has(p.id),saved:saved.has(p.id)}));
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
  const token = (req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  let uid: string|null = null;
  let authUser:any = null;
  if (token) { const { data } = await admin.auth.getUser(token); authUser = data.user || null; uid = authUser?.id || null; }
  const u = new URL(req.url), path = u.pathname.replace(/^\/functions\/v1\/orbis-api/,"") || "/";
  let body:any = {}, form:FormData|null=null;
  if (req.method==="POST" && path==="/api/media") { try { form=await req.formData(); } catch { return out({error:"Invalid form data"},400); } }
  else if (["POST","PUT","PATCH"].includes(req.method)) { try { body = await req.json(); } catch { return out({error:"Invalid JSON"},400); } }

  if (req.method==="GET" && path==="/health") return out({ok:true,service:"ORBIS API",database:"Supabase PostgreSQL"});
  if (req.method==="GET" && path==="/api/username-available") {
    const username=String(u.searchParams.get("username")||"").trim().toLowerCase();
    if(!/^[a-zA-Z0-9_.]{3,24}$/.test(username))return out({available:false,error:"Username: 3–24 символа, латиница, цифры, точка или _."},400);
    const {data}=await admin.from("profiles").select("id").eq("username",username).maybeSingle();
    return out({available:!data});
  }
  if (req.method==="GET" && path==="/api/auth/me") {
    if (!uid || !authUser) return out({authenticated:false},401);
    let {data:p}=await admin.from("profiles").select("*").eq("id",uid).maybeSingle();
    if(!p){
      const metadata=authUser.user_metadata||{};
      const username=String(metadata.username||"").trim().toLowerCase();
      const displayName=String(metadata.display_name||username||"ORBIS member").trim().slice(0,32);
      if(!/^[a-zA-Z0-9_.]{3,24}$/.test(username))return out({error:"Не удалось создать профиль: проверь username и повтори вход."},422);
      const created=await admin.from("profiles").insert({id:uid,username,display_name:displayName}).select("*").single();
      if(created.error){
        const {data:existing}=await admin.from("profiles").select("*").eq("id",uid).maybeSingle();
        if(existing)p=existing;
        else return out({error:created.error.code==="23505"?"Этот username уже занят. Зарегистрируйся с другим username.":created.error.message},created.error.code==="23505"?409:400);
      }else p=created.data;
    }
    return p ? out({authenticated:true,user:{id:uid,...safeProfile(p)}}) : out({authenticated:false},401);
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
    const [{data:likes},{data:mine},{data:commentRows},{data:bookmarks}]=await Promise.all([
      ids.length?admin.from("post_like_counts").select("post_id,like_count").in("post_id",ids):Promise.resolve({data:[]}),
      ids.length?admin.from("post_likes").select("post_id").eq("user_id",uid).in("post_id",ids):Promise.resolve({data:[]}),
      ids.length?admin.from("post_comment_counts").select("post_id,comment_count").in("post_id",ids):Promise.resolve({data:[]}),
      ids.length?admin.from("bookmarks").select("post_id").eq("user_id",uid).in("post_id",ids):Promise.resolve({data:[]})
    ]);
    const counts=new Map((likes||[]).map((x:any)=>[x.post_id,Number(x.like_count)||0]));
    const commentCounts=new Map((commentRows||[]).map((x:any)=>[x.post_id,Number(x.comment_count)||0]));
    const liked=new Set((mine||[]).map((x:any)=>x.post_id));
    const saved=new Set((bookmarks||[]).map((x:any)=>x.post_id));
    const posts=(data||[]).map((p:any)=>({id:p.id,title:p.title,topic:p.topic,body:p.body,username:p.profiles?.username,author:p.profiles?.display_name,avatar_url:p.profiles?.avatar_url,createdAt:p.created_at,replyTo:p.reply_to,media:p.media||[],likes:counts.get(p.id)||0,comments:commentCounts.get(p.id)||0,liked:liked.has(p.id),saved:saved.has(p.id)}));
    return out({posts,hasMore:posts.length===limit,nextOffset:offset+posts.length});
  }
  const singlePost=path.match(/^\/api\/posts\/([0-9a-f-]+)$/i);
  if(req.method==="GET"&&singlePost){
    const {data:p,error}=await admin.from("posts")
      .select("*,profiles!posts_author_id_fkey(username,display_name,avatar_url)")
      .eq("id",singlePost[1]).eq("status","published").maybeSingle();
    if(error)return out({error:error.message},400);
    if(!p)return out({error:"Публикация не найдена."},404);
    const [{data:likes},{data:mine},{data:comments},{data:saved}]=await Promise.all([
      admin.from("post_like_counts").select("like_count").eq("post_id",p.id).maybeSingle(),
      admin.from("post_likes").select("post_id").eq("post_id",p.id).eq("user_id",uid).maybeSingle(),
      admin.from("post_comment_counts").select("comment_count").eq("post_id",p.id).maybeSingle(),
      admin.from("bookmarks").select("post_id").eq("post_id",p.id).eq("user_id",uid).maybeSingle()
    ]);
    return out({post:{
      id:p.id,title:p.title,topic:p.topic,body:p.body,
      username:p.profiles?.username,author:p.profiles?.display_name,avatar_url:p.profiles?.avatar_url,
      createdAt:p.created_at,replyTo:p.reply_to,media:p.media||[],
      likes:Number(likes?.like_count)||0,comments:Number(comments?.comment_count)||0,liked:!!mine,saved:!!saved
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
      likes:0,comments:0,liked:false,saved:false,
    }},201);
  }
  const like=path.match(/^\/api\/posts\/([0-9a-f-]+)\/like$/i);
  if(req.method==="POST"&&like){
    if(await isRateLimited(admin,uid,"like",90,60))return out({error:"Слишком много реакций. Подожди немного."},429);
    const postId=like[1]; const {data:exists}=await admin.from("post_likes").select("post_id").eq("post_id",postId).eq("user_id",uid).maybeSingle();
    const r=exists?await admin.from("post_likes").delete().eq("post_id",postId).eq("user_id",uid):await admin.from("post_likes").insert({post_id:postId,user_id:uid});
    if(r.error)return out({error:r.error.message},400);
    const {count}=await admin.from("post_likes").select("*",{count:"exact",head:true}).eq("post_id",postId);
    return out({ok:true,liked:!exists,likes:count||0});
  }
  const replies=path.match(/^\/api\/posts\/([0-9a-f-]+)\/replies$/i);
  if(req.method==="GET"&&replies){
    const {data,error}=await admin.from("posts").select("*,profiles!posts_author_id_fkey(username,display_name)").eq("reply_to",replies[1]).eq("status","published").order("created_at",{ascending:true}).limit(20);
    if(error)return out({error:error.message},400);
    const counted=await enrichPostCounts(admin,uid,data||[]);
    return out({replies:counted.map((p:any)=>({id:p.id,title:p.title,topic:p.topic,body:p.body,username:p.profiles?.username,author:p.profiles?.display_name,createdAt:p.created_at,replyTo:p.reply_to,likes:p.likes,comments:p.comments,liked:p.liked}))});
  }
  const commentsRoute=path.match(/^\/api\/posts\/([0-9a-f-]+)\/comments$/i);
  if(req.method==="GET"&&commentsRoute){
    const rawOffset=Number(u.searchParams.get("offset")||0),rawLimit=Number(u.searchParams.get("limit")||20);
    const offset=Number.isSafeInteger(rawOffset)?Math.max(0,Math.min(rawOffset,1000000)):0;
    const limit=Number.isSafeInteger(rawLimit)?Math.max(1,Math.min(rawLimit,30)):20;
    const {data,error}=await admin.from("post_comments")
      .select("id,post_id,body,created_at,author_id,profiles!post_comments_author_id_fkey(username,display_name,avatar_url)")
      .eq("post_id",commentsRoute[1]).eq("status","published")
      .order("created_at",{ascending:true}).order("id",{ascending:true})
      .range(offset,offset+limit);
    if(error)return out({error:error.message},400);
    const rows=data||[];
    const hasMore=rows.length>limit;
    return out({comments:rows.slice(0,limit).map((c:any)=>({
      id:c.id,postId:c.post_id,body:c.body,createdAt:c.created_at,
      username:c.profiles?.username,author:c.profiles?.display_name,
      avatar_url:c.profiles?.avatar_url,own:c.author_id===uid
    })),hasMore,nextOffset:offset+Math.min(rows.length,limit)});
  }
  if(req.method==="POST"&&commentsRoute){
    if(await isRateLimited(admin,uid,"comment",8,60))return out({error:"Слишком много комментариев. Подожди минуту."},429);
    const text=String(body.body||"").trim();
    if(!text||text.length>1000)return out({error:"Комментарий должен содержать от 1 до 1000 символов."},400);
    const moderation=basicTextGuard(text);if(moderation)return out({error:moderation},422);
    const {data:parent}=await admin.from("posts").select("id").eq("id",commentsRoute[1]).eq("status","published").maybeSingle();
    if(!parent)return out({error:"Публикация не найдена."},404);
    const {data:comment,error}=await admin.from("post_comments")
      .insert({post_id:commentsRoute[1],author_id:uid,body:text})
      .select("id,post_id,body,created_at,author_id,profiles!post_comments_author_id_fkey(username,display_name,avatar_url)")
      .single();
    if(error)return out({error:error.message},400);
    const {count}=await admin.from("post_comments").select("id",{count:"exact",head:true})
      .eq("post_id",commentsRoute[1]).eq("status","published");
    return out({ok:true,comment:{
      id:comment.id,postId:comment.post_id,body:comment.body,createdAt:comment.created_at,
      username:comment.profiles?.username,author:comment.profiles?.display_name,
      avatar_url:comment.profiles?.avatar_url,own:true
    },comments:count||0},201);
  }
  const deleteComment=path.match(/^\/api\/comments\/([0-9a-f-]+)$/i);
  if(req.method==="DELETE"&&deleteComment){
    const {data,error}=await admin.from("post_comments")
      .update({status:"removed"}).eq("id",deleteComment[1]).eq("author_id",uid)
      .eq("status","published").select("id,post_id").maybeSingle();
    if(error)return out({error:error.message},400);
    if(!data)return out({error:"Комментарий не найден или уже удалён."},404);
    const {count}=await admin.from("post_comments").select("id",{count:"exact",head:true})
      .eq("post_id",data.post_id).eq("status","published");
    return out({ok:true,comments:count||0});
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
    if(r.error)return out({error:r.error.message},400);return out({ok:true,following:!exists});
  }
  if(req.method==="POST"&&path==="/api/search"){
    if(await isRateLimited(admin,uid,"search",30,60))return out({error:"Слишком много поисковых запросов. Попробуй позже."},429);
    const q=String(body.q||"").trim().slice(0,80).replace(/[^\p{L}\p{N}_\-.@ ]/gu," ").replace(/\s+/g," ").trim();if(q.length<2)return out({users:[],posts:[]});
    const [{data:users},{data:posts}]=await Promise.all([
      admin.from("profiles").select("*").or("username.ilike.%"+q+"%,display_name.ilike.%"+q+"%,bio.ilike.%"+q+"%").limit(20),
      admin.from("posts").select("*,profiles!posts_author_id_fkey(username,display_name)").eq("status","published").or("title.ilike.%"+q+"%,body.ilike.%"+q+"%,topic.ilike.%"+q+"%").order("created_at",{ascending:false}).limit(30)
    ]);
    const userIds=(users||[]).map((p:any)=>p.id);
    const {data:followRows}=userIds.length?await admin.from("follows").select("following_id").eq("follower_id",uid).in("following_id",userIds):{data:[]};
    const following=new Set((followRows||[]).map((x:any)=>x.following_id));
    const countedPosts=await enrichPostCounts(admin,uid,posts||[]);
    return out({users:(users||[]).map((p:any)=>({...safeProfile(p),isFollowing:following.has(p.id)})),posts:countedPosts.map((p:any)=>({...p,username:p.profiles?.username,author:p.profiles?.display_name,createdAt:p.created_at}))});
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
  return out({error:"API route not found."},404);
});