import {NextResponse} from "next/server";
import {orbisEdgeFunctionUrl,supabasePublishableKey} from "@/lib/orbis/config";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET() {
  try {
    const response=await fetch(orbisEdgeFunctionUrl+"/health",{
      method:"GET",headers:{apikey:supabasePublishableKey,accept:"application/json"},
      cache:"no-store",signal:AbortSignal.timeout(5000)
    });
    if(!response.ok) return NextResponse.json(
      {status:"degraded",service:"orbis-next",backend:"unavailable"},
      {status:503,headers:{"Cache-Control":"no-store"}}
    );
    const payload:unknown=await response.json();
    if(typeof payload!=="object" || payload===null || !("ok" in payload) || payload.ok!==true) {
      return NextResponse.json({status:"degraded",service:"orbis-next",backend:"invalid-response"},
        {status:503,headers:{"Cache-Control":"no-store"}});
    }
    return NextResponse.json({status:"ok",service:"orbis-next",backend:"supabase-edge"},
      {status:200,headers:{"Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({status:"degraded",service:"orbis-next",backend:"unavailable"},
      {status:503,headers:{"Cache-Control":"no-store"}});
  }
}
