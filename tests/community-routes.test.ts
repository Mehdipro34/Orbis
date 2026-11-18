import {afterEach,describe,expect,it,vi} from "vitest";
import {GET as getNotifications} from "../src/app/api/notifications/route";
import {POST as markNotificationsRead} from "../src/app/api/notifications/read/route";
import {GET as getClans,POST as createClan} from "../src/app/api/clans/route";
import {POST as clanAction} from "../src/app/api/clans/[slug]/[action]/route";

const origin="https://preview.orbis.example";
const token="c".repeat(40)+"."+"d".repeat(43);
const headers={
  cookie:"orbis_guest_session="+token,
  origin,
  "sec-fetch-site":"same-origin"
};

afterEach(()=>{vi.unstubAllGlobals();});

describe("authenticated community route handlers",()=>{
  it("loads notifications only with a guest session",async()=>{
    const mockedFetch=vi.fn();
    vi.stubGlobal("fetch",mockedFetch);
    const response=await getNotifications(new Request(origin+"/api/notifications"));
    expect(response.status).toBe(401);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("proxies the private notification inbox with the session token",async()=>{
    const mockedFetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({notifications:[],unread:0}),{
      status:200,headers:{"Content-Type":"application/json"}
    }));
    vi.stubGlobal("fetch",mockedFetch);
    const response=await getNotifications(new Request(origin+"/api/notifications",{headers}));
    expect(response.status).toBe(200);
    const [url,init]=mockedFetch.mock.calls[0] as [URL,RequestInit];
    expect(String(url)).toContain("/api/notifications");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer "+token);
  });

  it("rejects cross-origin notification mutations",async()=>{
    const mockedFetch=vi.fn();
    vi.stubGlobal("fetch",mockedFetch);
    const response=await markNotificationsRead(new Request(origin+"/api/notifications/read",{
      method:"POST",
      headers:{"Content-Type":"application/json",...headers,origin:"https://bad.example"},
      body:JSON.stringify({})
    }));
    expect(response.status).toBe(403);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("marks the notification inbox as read through the API",async()=>{
    const mockedFetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({ok:true}),{
      status:200,headers:{"Content-Type":"application/json"}
    }));
    vi.stubGlobal("fetch",mockedFetch);
    const response=await markNotificationsRead(new Request(origin+"/api/notifications/read",{
      method:"POST",headers:{"Content-Type":"application/json",...headers},body:JSON.stringify({})
    }));
    expect(response.status).toBe(200);
    const [url,init]=mockedFetch.mock.calls[0] as [URL,RequestInit];
    expect(String(url)).toContain("/api/notifications/read");
    expect(JSON.parse(String(init.body))).toEqual({});
  });

  it("loads clans from the authenticated backend",async()=>{
    const mockedFetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({clans:[],myClan:null}),{
      status:200,headers:{"Content-Type":"application/json"}
    }));
    vi.stubGlobal("fetch",mockedFetch);
    const response=await getClans(new Request(origin+"/api/clans",{headers}));
    expect(response.status).toBe(200);
    expect(String(mockedFetch.mock.calls[0]?.[0])).toContain("/api/clans");
  });

  it("rejects invalid clan names before calling the backend",async()=>{
    const mockedFetch=vi.fn();
    vi.stubGlobal("fetch",mockedFetch);
    const response=await createClan(new Request(origin+"/api/clans",{
      method:"POST",headers:{"Content-Type":"application/json",...headers},
      body:JSON.stringify({name:"x",description:"",owner_id:"someone"})
    }));
    expect(response.status).toBe(400);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("creates a validated clan through the existing backend route",async()=>{
    const mockedFetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok:true,clan:{id:"id",slug:"my-clan",name:"My Clan"}
    }),{status:201,headers:{"Content-Type":"application/json"}}));
    vi.stubGlobal("fetch",mockedFetch);
    const response=await createClan(new Request(origin+"/api/clans",{
      method:"POST",headers:{"Content-Type":"application/json",...headers},
      body:JSON.stringify({name:"My Clan",description:"Friends and learning"})
    }));
    expect(response.status).toBe(201);
    const [url,init]=mockedFetch.mock.calls[0] as [URL,RequestInit];
    expect(String(url)).toContain("/api/clans");
    expect(JSON.parse(String(init.body))).toEqual({name:"My Clan",description:"Friends and learning"});
  });

  it("joins a clan through the existing membership operation",async()=>{
    const mockedFetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({ok:true,joined:true}),{
      status:200,headers:{"Content-Type":"application/json"}
    }));
    vi.stubGlobal("fetch",mockedFetch);
    const response=await clanAction(new Request(origin+"/api/clans/my-clan/join",{
      method:"POST",headers
    }),{params:Promise.resolve({slug:"my-clan",action:"join"})});
    expect(response.status).toBe(200);
    const [url,init]=mockedFetch.mock.calls[0] as [URL,RequestInit];
    expect(String(url)).toContain("/api/clans/my-clan/join");
    expect(init.method).toBe("POST");
  });
});
