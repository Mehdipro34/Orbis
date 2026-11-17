import {NextResponse} from "next/server";
import {fetchPublicFeed,parsePublicFeedQuery,PublicFeedError} from "@/lib/orbis/public-feed";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET(request:Request) {
  const url=new URL(request.url);
  const parsed=parsePublicFeedQuery(url.searchParams);
  if(!parsed.success) {
    return NextResponse.json({error:{code:"INVALID_QUERY",message:"Проверь режим, размер страницы и курсор ленты."}},
      {status:400,headers:{"Cache-Control":"no-store"}});
  }
  try {
    const forwardedFor=request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined;
    const data=await fetchPublicFeed(parsed.data,forwardedFor);
    return NextResponse.json(data,{status:200,headers:{
      "Cache-Control":"public, s-maxage=60, stale-while-revalidate=300",
      "Vercel-CDN-Cache-Control":"public, s-maxage=60, stale-while-revalidate=300",
      "CDN-Cache-Control":"public, max-age=60",
      "Vary":"Accept-Encoding",
      "X-ORBIS-Feed-Cache":"public-60s"
    }});
  } catch(error) {
    if(error instanceof PublicFeedError) {
      return NextResponse.json({error:{code:error.code,message:error.message}},
        {status:error.status,headers:{"Cache-Control":"no-store"}});
    }
    return NextResponse.json({error:{code:"INTERNAL_ERROR",message:"Не удалось загрузить публичную ленту."}},
      {status:500,headers:{"Cache-Control":"no-store"}});
  }
}
