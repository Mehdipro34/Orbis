import {afterEach,describe,expect,it,vi} from "vitest";
import {POST as register} from "../src/app/api/auth/register/route";
import {POST as verify} from "../src/app/api/auth/verify/route";
import {GET as me} from "../src/app/api/auth/me/route";
import {POST as logout} from "../src/app/api/auth/logout/route";

const deviceId="d304cf42-50a3-4a65-9ff1-a7860bc8dbb1";
const publicKey={
  kty:"EC",crv:"P-256",
  x:"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  y:"BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
};
const origin="https://preview.orbis.example";

function postRequest(path:string,body:unknown,requestOrigin=origin) {
  return new Request(origin+path,{
    method:"POST",
    headers:{"content-type":"application/json",origin:requestOrigin,"sec-fetch-site":"same-origin"},
    body:JSON.stringify(body)
  });
}

afterEach(()=>{vi.unstubAllGlobals();});

describe("ORBIS key-auth route handlers",()=>{
  it("rejects a filled honeypot before calling the backend",async()=>{
    const mockedFetch=vi.fn();
    vi.stubGlobal("fetch",mockedFetch);
    const response=await register(postRequest("/api/auth/register",{
      deviceId,username:"orbis_user",bio:"",publicKey,website:"https://spam.example"
    }));
    expect(response.status).toBe(400);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("rejects cross-origin state changes",async()=>{
    const mockedFetch=vi.fn();
    vi.stubGlobal("fetch",mockedFetch);
    const response=await register(postRequest("/api/auth/register",{
      deviceId,username:"orbis_user",bio:"",publicKey
    },"https://attacker.example"));
    expect(response.status).toBe(403);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("forwards validated registration to the existing Supabase guest API",async()=>{
    const mockedFetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok:true,challengeId:deviceId,challenge:"a-safe-challenge",
      user:{id:deviceId,username:"orbis_user"}
    }),{status:201,headers:{"Content-Type":"application/json"}}));
    vi.stubGlobal("fetch",mockedFetch);
    const response=await register(postRequest("/api/auth/register",{
      deviceId,username:"ORBIS_USER",bio:"hello",publicKey,website:""
    }));
    expect(response.status).toBe(201);
    expect(mockedFetch).toHaveBeenCalledOnce();
    const [url,init]=mockedFetch.mock.calls[0] as [URL,RequestInit];
    expect(String(url)).toContain("/api/guest/register");
    expect((init.headers as Headers).get("apikey")).toBeTruthy();
    expect(JSON.parse(String(init.body))).toMatchObject({deviceId,username:"orbis_user"});
  });

  it("stores verified guest tokens only in an HttpOnly cookie",async()=>{
    const token="eyJzdWIiOiJkMzA0Y2Y0Mi01MGEzLTRhNjUtOWZmMS1hNzg2MGJjOGRiYjEiLCJleHAiOjQ3MDAwMDAwMDAwMDB9."+"A".repeat(43);
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok:true,token,user:{id:deviceId,username:"orbis_user"}
    }),{status:200,headers:{"Content-Type":"application/json"}})));
    const response=await verify(postRequest("/api/auth/verify",{
      deviceId,challengeId:deviceId,signature:"S".repeat(86)
    }));
    expect(response.status).toBe(200);
    const payload=await response.json();
    expect(payload).toMatchObject({ok:true,user:{username:"orbis_user"}});
    expect(payload).not.toHaveProperty("token");
    const cookie=response.headers.get("set-cookie")||"";
    expect(cookie).toContain("orbis_guest_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
  });

  it("does not query the guest API when the HttpOnly cookie is missing",async()=>{
    const mockedFetch=vi.fn();
    vi.stubGlobal("fetch",mockedFetch);
    const response=await me(new Request(origin+"/api/auth/me"));
    expect(response.status).toBe(401);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("clears the browser session cookie on logout",async()=>{
    const response=await logout(postRequest("/api/auth/logout",{}));
    expect(response.status).toBe(200);
    const cookie=response.headers.get("set-cookie")||"";
    expect(cookie).toContain("orbis_guest_session=");
    expect(cookie.toLowerCase()).toContain("max-age=0");
    expect(cookie).toContain("HttpOnly");
  });
});
