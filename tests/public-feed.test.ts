import {afterEach,describe,expect,it,vi} from "vitest";
import {fetchPublicFeed,PublicFeedError} from "../src/lib/orbis/public-feed";

const fixture = {
  posts:[{
    id:"d304cf42-50a3-4a65-9ff1-a7860bc8dbb1",
    postNumber:"12",title:"Проверка публичной ленты",topic:"ORBIS",
    body:"Запись загружена через реальный backend-контракт.",
    username:"sample_user",author:"ORBIS member",authorNumber:"12",
    avatar_url:null,createdAt:"2026-11-17T10:00:00.000Z",media:[],
    likes:3,liked:false,saved:false
  }],
  hasMore:false,nextCursor:null,public:true
};

afterEach(()=>{vi.unstubAllGlobals();});

describe("fetchPublicFeed",()=>{
  it("calls the Supabase public feed and validates its response",async()=>{
    const mockedFetch=vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture),{
      status:200,headers:{"Content-Type":"application/json"}
    }));
    vi.stubGlobal("fetch",mockedFetch);
    const data=await fetchPublicFeed({mode:"latest",limit:20});
    expect(mockedFetch).toHaveBeenCalledOnce();
    expect(String(mockedFetch.mock.calls[0]?.[0])).toContain("/api/public/posts");
    expect(String(mockedFetch.mock.calls[0]?.[0])).toContain("mode=latest");
    expect(data.posts[0]?.username).toBe("sample_user");
  });

  it("maps upstream rate limiting to an explicit error",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response("{}",{status:429})));
    await expect(fetchPublicFeed({mode:"popular",limit:10})).rejects.toMatchObject({
      status:429,code:"RATE_LIMITED"
    });
  });

  it("rejects malformed backend payloads instead of fabricating data",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(JSON.stringify({posts:"bad"}),{status:200})));
    await expect(fetchPublicFeed({mode:"latest",limit:20})).rejects.toBeInstanceOf(PublicFeedError);
  });

  it("returns a controlled unavailable error if the backend cannot be reached",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new Error("network unavailable")));
    await expect(fetchPublicFeed({mode:"latest",limit:20})).rejects.toMatchObject({
      status:503,code:"UPSTREAM_UNAVAILABLE"
    });
  });
});
