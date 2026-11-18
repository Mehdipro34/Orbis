import {afterEach,describe,expect,it,vi} from "vitest";
import {GET as getProfile} from "../src/app/api/profile/[username]/route";
import {PUT as updateProfile} from "../src/app/api/profile/route";
import {POST as toggleFollow} from "../src/app/api/users/[username]/follow/route";

const origin="https://preview.orbis.example";
const token="a".repeat(40)+"."+"b".repeat(43);
const headers={
  cookie:"orbis_guest_session="+token,
  origin,
  "sec-fetch-site":"same-origin"
};

afterEach(()=>{vi.unstubAllGlobals();});

describe("authenticated profile routes",()=>{
  it("requires a guest session before reading a profile",async()=>{
    const mockedFetch=vi.fn();
    vi.stubGlobal("fetch",mockedFetch);
    const response=await getProfile(
      new Request(origin+"/api/profile/sample_user"),
      {params:Promise.resolve({username:"sample_user"})}
    );
    expect(response.status).toBe(401);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("reads the requested username through the existing Edge API",async()=>{
    const mockedFetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({
      user:{username:"sample_user",name:"Sample User",bio:""},
      followers:3,following:2,isFollowing:false,posts:[]
    }),{status:200,headers:{"Content-Type":"application/json"}}));
    vi.stubGlobal("fetch",mockedFetch);
    const response=await getProfile(
      new Request(origin+"/api/profile/sample_user",{headers}),
      {params:Promise.resolve({username:"sample_user"})}
    );
    expect(response.status).toBe(200);
    expect(mockedFetch).toHaveBeenCalledOnce();
    const [url,init]=mockedFetch.mock.calls[0] as [URL,RequestInit];
    expect(String(url)).toContain("/api/profile/sample_user");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer "+token);
  });

  it("rejects unsafe profile changes before forwarding",async()=>{
    const mockedFetch=vi.fn();
    vi.stubGlobal("fetch",mockedFetch);
    const response=await updateProfile(new Request(origin+"/api/profile",{
      method:"PUT",
      headers:{"Content-Type":"application/json",...headers},
      body:JSON.stringify({name:"x",bio:"",admin:true})
    }));
    expect(response.status).toBe(400);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("forwards validated profile updates to the Edge API",async()=>{
    const mockedFetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok:true,user:{username:"sample_user",name:"New Name",bio:"Updated"}
    }),{status:200,headers:{"Content-Type":"application/json"}}));
    vi.stubGlobal("fetch",mockedFetch);
    const response=await updateProfile(new Request(origin+"/api/profile",{
      method:"PUT",
      headers:{"Content-Type":"application/json",...headers},
      body:JSON.stringify({name:"New Name",bio:"Updated"})
    }));
    expect(response.status).toBe(200);
    expect(mockedFetch).toHaveBeenCalledOnce();
    const [url,init]=mockedFetch.mock.calls[0] as [URL,RequestInit];
    expect(String(url)).toContain("/api/profile");
    expect(JSON.parse(String(init.body))).toEqual({name:"New Name",bio:"Updated"});
  });

  it("toggles follow state through the existing user route",async()=>{
    const mockedFetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({ok:true,following:true}),{
      status:200,headers:{"Content-Type":"application/json"}
    }));
    vi.stubGlobal("fetch",mockedFetch);
    const response=await toggleFollow(new Request(origin+"/api/users/sample_user/follow",{
      method:"POST",headers
    }),{params:Promise.resolve({username:"sample_user"})});
    expect(response.status).toBe(200);
    const [url,init]=mockedFetch.mock.calls[0] as [URL,RequestInit];
    expect(String(url)).toContain("/api/users/sample_user/follow");
    expect(init.method).toBe("POST");
  });
});
