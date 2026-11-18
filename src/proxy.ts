import {NextRequest,NextResponse} from "next/server";
import {orbisEdgeFunctionUrl,supabasePublishableKey} from "@/lib/orbis/config";

const COOKIE="orbis_guest_session";
const TOKEN=/^[A-Za-z0-9_-]{20,300}\.[A-Za-z0-9_-]{40,100}$/;

type SessionResult={username:string}|null|"unavailable";

async function verifySession(token:string):Promise<SessionResult>{
  try{
    const headers=new Headers({
      apikey:supabasePublishableKey,
      accept:"application/json",
      Authorization:"Bearer "+token
    });
    const response=await fetch(orbisEdgeFunctionUrl+"/api/guest/me",{
      method:"GET",
      headers,
      cache:"no-store",
      signal:AbortSignal.timeout(3500)
    });
    if(response.status===401||response.status===404)return null;
    if(!response.ok)return "unavailable";
    const payload:unknown=await response.json();
    if(typeof payload!=="object"||payload===null||!("user" in payload))return "unavailable";
    const user=(payload as {user?:unknown}).user;
    if(typeof user!=="object"||user===null||!("username" in user)||
      typeof (user as {username?:unknown}).username!=="string")return "unavailable";
    return {username:(user as {username:string}).username};
  }catch{
    return "unavailable";
  }
}

function clearCookie(response:NextResponse):NextResponse{
  response.cookies.set({
    name:COOKIE,value:"",httpOnly:true,
    secure:process.env.NODE_ENV==="production",
    sameSite:"lax",path:"/",maxAge:0
  });
  return response;
}

export async function proxy(request:NextRequest){
  const path=request.nextUrl.pathname;
  const authPage=path==="/register"||path==="/login";
  const token=request.cookies.get(COOKIE)?.value||"";

  if(!TOKEN.test(token)){
    return authPage?NextResponse.next():NextResponse.redirect(new URL("/register",request.url));
  }

  const session=await verifySession(token);
  if(session==="unavailable"){
    // Never open the social area when account status could not be verified.
    // Keep the cookie so a short provider outage does not erase a valid session.
    return authPage?NextResponse.next():
      NextResponse.redirect(new URL("/login?reason=session-check",request.url));
  }
  if(!session){
    const response=authPage?NextResponse.next():
      NextResponse.redirect(new URL("/register",request.url));
    return clearCookie(response);
  }
  if(authPage||path==="/"){
    return NextResponse.redirect(new URL("/u/"+encodeURIComponent(session.username),request.url));
  }
  return NextResponse.next();
}

export const config={
  matcher:[
    "/((?!api/|_next/static|_next/image|favicon.ico|orbis-icon.svg|manifest.webmanifest|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2)$).*)"
  ]
};
