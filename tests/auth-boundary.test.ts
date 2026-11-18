import {afterEach,describe,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
import {proxy} from "../src/proxy";
import {GET as feed} from "../src/app/api/posts/route";

const origin="https://orbis.example";
const token="A".repeat(40)+"."+"B".repeat(64);
const user={id:"d304cf42-50a3-4a65-9ff1-a7860bc8dbb1",username:"orbis_user"};

afterEach(()=>vi.unstubAllGlobals());

describe("ORBIS mandatory account access",()=>{
  it("redirects visitors with no session to registration",async()=>{
    const fetchMock=vi.fn();
    vi.stubGlobal("fetch",fetchMock);
    const response=await proxy(new NextRequest(origin+"/"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(origin+"/register");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not allow an unregistered visitor to read the feed API",async()=>{
    const fetchMock=vi.fn();
    vi.stubGlobal("fetch",fetchMock);
    const response=await feed(new Request(origin+"/api/posts"));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({error:{code:"AUTH_REQUIRED"}});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("opens the user's own profile when a registered member visits the home page",async()=>{
    const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({
      authenticated:true,user
    }),{status:200,headers:{"Content-Type":"application/json"}}));
    vi.stubGlobal("fetch",fetchMock);
    const request=new NextRequest(origin+"/",{
      headers:{cookie:"orbis_guest_session="+token}
    });
    const response=await proxy(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(origin+"/u/orbis_user");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url,init]=fetchMock.mock.calls[0] as [string,RequestInit];
    expect(url).toContain("/api/guest/me");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer "+token);
  });

  it("sends an already registered member away from the registration page to their profile",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(JSON.stringify({
      authenticated:true,user
    }),{status:200,headers:{"Content-Type":"application/json"}})));
    const request=new NextRequest(origin+"/register",{
      headers:{cookie:"orbis_guest_session="+token}
    });
    const response=await proxy(request);
    expect(response.headers.get("location")).toBe(origin+"/u/orbis_user");
  });

  it("clears an invalid account session and blocks the social page",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(
      JSON.stringify({error:"invalid session"}),{status:401}
    )));
    const request=new NextRequest(origin+"/clans",{
      headers:{cookie:"orbis_guest_session="+token}
    });
    const response=await proxy(request);
    expect(response.headers.get("location")).toBe(origin+"/register");
    expect(response.headers.get("set-cookie")).toMatch(/max-age=0/i);
  });

  it("allows the registration page when the visitor has no existing account",async()=>{
    const response=await proxy(new NextRequest(origin+"/register"));
    expect(response.status).toBe(200);
  });

  it("requires a valid session for the feed API even with a syntactically valid cookie",async()=>{
    const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({
      posts:[],hasMore:false,nextCursor:null
    }),{status:200,headers:{"Content-Type":"application/json"}}));
    vi.stubGlobal("fetch",fetchMock);
    const response=await feed(new Request(origin+"/api/posts?mode=latest",{
      headers:{cookie:"orbis_guest_session="+token}
    }));
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url,init]=fetchMock.mock.calls[0] as [string,RequestInit];
    expect(url).toContain("/api/posts?mode=latest");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer "+token);
  });
});
