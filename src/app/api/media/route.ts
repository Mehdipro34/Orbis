import {
  callGuestApiForm,isRecord,isSameOriginMutation,jsonNoStore,
  sessionTokenFromRequest,upstreamErrorMessage
} from "@/lib/orbis/guest-auth.server";

export const dynamic="force-dynamic";
export const revalidate=0;
export const runtime="nodejs";

const MAX_FILES=4;
const MAX_FILE_BYTES=3*1024*1024;
const MAX_TOTAL_BYTES=4*1024*1024;
const ALLOWED_TYPES=new Set(["image/jpeg","image/png","image/webp"]);

export async function POST(request:Request) {
  if(!isSameOriginMutation(request))return jsonNoStore({error:"Запрос с другого источника отклонён."},403);
  const token=sessionTokenFromRequest(request);
  if(!token)return jsonNoStore({error:"Сначала войди в ORBIS."},401);

  const contentLength=Number(request.headers.get("content-length")||0);
  if(Number.isFinite(contentLength)&&contentLength>4_300_000) {
    return jsonNoStore({error:"Пакет слишком большой для безопасной загрузки. Уменьши размер фотографий."},413);
  }
  let incoming:FormData;
  try{incoming=await request.formData();}
  catch{return jsonNoStore({error:"Не удалось прочитать загруженные файлы."},400);}

  const files=incoming.getAll("files");
  if(files.length<1||files.length>MAX_FILES||files.some(value=>!(value instanceof File))) {
    return jsonNoStore({error:"Выбери от 1 до 4 фотографий."},400);
  }
  const typed=files as File[];
  const total=typed.reduce((sum,file)=>sum+file.size,0);
  if(total>MAX_TOTAL_BYTES||typed.some(file=>file.size<1||file.size>MAX_FILE_BYTES)) {
    return jsonNoStore({error:"Каждая фотография должна быть не больше 3 МБ, общий размер — не больше 4 МБ."},413);
  }
  if(typed.some(file=>!ALLOWED_TYPES.has(file.type.toLowerCase()))) {
    return jsonNoStore({error:"Поддерживаются только фотографии JPEG, PNG и WebP."},415);
  }

  const outgoing=new FormData();
  typed.forEach((file,index)=>outgoing.append("files",file,"orbis-image-"+(index+1)));
  const upstream=await callGuestApiForm("/api/media",outgoing,token,request);
  if(upstream.status<200||upstream.status>=300||!isRecord(upstream.payload)) {
    return jsonNoStore({error:upstreamErrorMessage(upstream.payload,"Не удалось сохранить фотографии.")},upstream.status>=400?upstream.status:502);
  }
  if(!Array.isArray(upstream.payload.media))return jsonNoStore({error:"Хранилище вернуло некорректный ответ."},502);
  return jsonNoStore(upstream.payload,upstream.status);
}
