import {NextResponse} from "next/server";
import {requireOrbisSession} from "@/lib/orbis/require-session.server";
import {isSameOriginMutation} from "@/lib/orbis/guest-auth.server";

export const dynamic="force-dynamic";
export const revalidate=0;
export const runtime="nodejs";

const MAX_FILES=4;
const MAX_FILE_BYTES=3*1024*1024;
const MAX_TOTAL_BYTES=4*1024*1024;
const ALLOWED_TYPES=new Set(["image/jpeg","image/png","image/webp"]);

function json(payload:unknown,status=200){
  return NextResponse.json(payload,{status,headers:{"Cache-Control":"no-store"}});
}
async function validImageSignature(file:File):Promise<boolean>{
  const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());
  const ascii=(offset:number,length:number)=>String.fromCharCode(...bytes.slice(offset,offset+length));
  if(file.type==="image/jpeg")return bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  if(file.type==="image/png")return bytes.length>=8&&bytes[0]===0x89&&ascii(1,3)==="PNG"&&
    bytes[4]===0x0d&&bytes[5]===0x0a&&bytes[6]===0x1a&&bytes[7]===0x0a;
  if(file.type==="image/webp")return bytes.length>=12&&ascii(0,4)==="RIFF"&&ascii(8,4)==="WEBP";
  return false;
}

export async function POST(request:Request){
  if(!isSameOriginMutation(request))return json({error:"Запрос с другого источника отклонён."},403);
  const session=await requireOrbisSession(request);
  if(!session.ok)return json({error:session.status===401?"Сначала войди в ORBIS.":"Не удалось проверить аккаунт."},session.status);

  const length=Number(request.headers.get("content-length")||0);
  if(Number.isFinite(length)&&length>4_300_000)return json({error:"Общий размер фотографий превышает 4 МБ."},413);
  let form:FormData;
  try{form=await request.formData();}catch{return json({error:"Не удалось прочитать фотографии."},400);}
  const raw=form.getAll("files");
  if(raw.length<1||raw.length>MAX_FILES||raw.some(value=>!(value instanceof File)))return json({error:"Выбери от 1 до 4 фотографий."},400);
  const files=raw as File[];
  if(files.some(file=>file.size<1||file.size>MAX_FILE_BYTES)||files.reduce((sum,file)=>sum+file.size,0)>MAX_TOTAL_BYTES)
    return json({error:"Каждая фотография — до 3 МБ, все вместе — до 4 МБ."},413);
  if(files.some(file=>!ALLOWED_TYPES.has(file.type.toLowerCase())))return json({error:"Поддерживаются JPEG, PNG и WebP."},415);
  for(const file of files)if(!await validImageSignature(file))return json({error:"Файл не похож на настоящую фотографию заявленного формата."},415);

  const apiKey=process.env.IMGBB_API_KEY;
  if(!apiKey)return json({error:"Хранилище изображений пока не настроено. Добавь IMGBB_API_KEY в настройках preview."},503);

  const uploaded:Array<{key:string;url:string;type:string;size:number}>=[];
  for(const file of files){
    const upload=new FormData();
    upload.set("image",file,file.name.slice(0,120)||"orbis-image");
    const endpoint=new URL("https://api.imgbb.com/1/upload");
    endpoint.searchParams.set("key",apiKey);
    let response:Response;
    try{
      response=await fetch(endpoint,{
        method:"POST",body:upload,cache:"no-store",
        signal:AbortSignal.timeout(20_000)
      });
    }catch{
      return json({error:"ImgBB не ответил. Попробуй ещё раз. Уже загруженные изображения можно будет загрузить повторно."},503);
    }
    const result:unknown=await response.json().catch(()=>null);
    if(!response.ok||typeof result!=="object"||result===null||
      !("success" in result)||(result as {success?:unknown}).success!==true||
      !("data" in result)||typeof (result as {data?:unknown}).data!=="object"||
      (result as {data:{id?:unknown;url?:unknown}}).data===null){
      const message=typeof result==="object"&&result!==null&&"error" in result&&
        typeof (result as {error?:{message?:unknown}}).error?.message==="string"
        ?String((result as {error:{message:string}}).error.message):"Не удалось сохранить изображение в ImgBB.";
      return json({error:message},response.status===429?429:503);
    }
    const data=(result as {data:{id?:unknown;url?:unknown}}).data;
    if(typeof data.id!=="string"||!/^[A-Za-z0-9]+$/.test(data.id)||typeof data.url!=="string"){
      return json({error:"ImgBB вернул некорректную ссылку на фотографию."},502);
    }
    let imageUrl:URL;
    try{imageUrl=new URL(data.url);}catch{return json({error:"ImgBB вернул неправильный адрес изображения."},502);}
    if(imageUrl.protocol!=="https:"||imageUrl.hostname!=="i.ibb.co"||imageUrl.username||imageUrl.password){
      return json({error:"ImgBB вернул неподдерживаемый домен изображения."},502);
    }
    uploaded.push({
      key:session.userId+"/imgbb/"+data.id,
      url:imageUrl.toString(),
      type:file.type,
      size:file.size
    });
  }
  return json({ok:true,provider:"ImgBB",media:uploaded},201);
}
