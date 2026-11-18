import {afterEach,describe,expect,it,vi} from "vitest";
import {GET as getBookmarks,POST as toggleBookmark} from "../src/app/api/bookmarks/route";
import {POST as createReport} from "../src/app/api/reports/route";

const origin="https://preview.orbis.example";
const token="e".repeat(40)+"."+"f".repeat(43);
const postId="d304cf42-50a3-4a65-9ff1-a7860bc8dbb1";
const headers={
  cookie:"orbis_guest_session="+token,
  origin,
  "sec-fetch-site":"same-origin"
};

afterEach(()=>{vi.unstubAllGlobals();});

describe("bookmarks and safety report routes",()=>{
  it("requires authentication for private bookmarks",async()=>{
    const mockedFetch=vi.fn();
    vi.stubGlobal("fetch",mockedFetch);
    const response=await getBookmarks(new Request(origin+"/api/bookmarks"));
    expect(response.status).toBe(401);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("reads bookmarks through the authenticated Edge API",async()=>{
    const mockedFetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({posts:[]}),{
      status:200,headers:{"Content-Type":"application/json"}
    }));
    vi.stubGlobal("fetch",mockedFetch);
    const response=await getBookmarks(new Request(origin+"/api/bookmarks",{headers}));
    expect(response.status).toBe(200);
    const [url,init]=mockedFetch.mock.calls[0] as [URL,RequestInit];
    expect(String(url)).toContain("/api/bookmarks");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer "+token);
  });

  it("rejects cross-origin bookmark mutations",async()=>{
    const mockedFetch=vi.fn();
    vi.stubGlobal("fetch",mockedFetch);
    const response=await toggleBookmark(new Request(origin+"/api/bookmarks",{
      method:"POST",
      headers:{"Content-Type":"application/json",...headers,origin:"https://attacker.example"},
      body:JSON.stringify({postId})
    }));
    expect(response.status).toBe(403);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("rejects invalid bookmark identifiers",async()=>{
    const mockedFetch=vi.fn();
    vi.stubGlobal("fetch",mockedFetch);
    const response=await toggleBookmark(new Request(origin+"/api/bookmarks",{
      method:"POST",headers:{"Content-Type":"application/json",...headers},
      body:JSON.stringify({postId:"not-a-uuid"})
    }));
    expect(response.status).toBe(400);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("toggles a bookmark using the signed-in session",async()=>{
    const mockedFetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({ok:true,saved:false}),{
      status:200,headers:{"Content-Type":"application/json"}
    }));
    vi.stubGlobal("fetch",mockedFetch);
    const response=await toggleBookmark(new Request(origin+"/api/bookmarks",{
      method:"POST",headers:{"Content-Type":"application/json",...headers},
      body:JSON.stringify({postId})
    }));
    expect(response.status).toBe(200);
    const [url,init]=mockedFetch.mock.calls[0] as [URL,RequestInit];
    expect(String(url)).toContain("/api/bookmarks");
    expect(JSON.parse(String(init.body))).toEqual({postId});
  });

  it("rejects invalid or cross-origin post reports before forwarding",async()=>{
    const mockedFetch=vi.fn();
    vi.stubGlobal("fetch",mockedFetch);
    const response=await createReport(new Request(origin+"/api/reports",{
      method:"POST",headers:{"Content-Type":"application/json",...headers},
      body:JSON.stringify({postId,reason:"",user_id:"other"})
    }));
    expect(response.status).toBe(400);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("submits a validated report to the active Edge API",async()=>{
    const mockedFetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({ok:true}),{
      status:201,headers:{"Content-Type":"application/json"}
    }));
    vi.stubGlobal("fetch",mockedFetch);
    const response=await createReport(new Request(origin+"/api/reports",{
      method:"POST",headers:{"Content-Type":"application/json",...headers},
      body:JSON.stringify({postId,reason:"Спам или мошенничество"})
    }));
    expect(response.status).toBe(201);
    const [url,init]=mockedFetch.mock.calls[0] as [URL,RequestInit];
    expect(String(url)).toContain("/api/reports");
    expect(JSON.parse(String(init.body))).toEqual({postId,reason:"Спам или мошенничество"});
  });
});
