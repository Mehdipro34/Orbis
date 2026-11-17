import {afterEach,describe,expect,it,vi} from "vitest";
import {POST as uploadMedia} from "../src/app/api/media/route";

const origin="https://preview.orbis.example";
const token="g".repeat(40)+"."+"h".repeat(43);
const headers={cookie:"orbis_guest_session="+token,origin,"sec-fetch-site":"same-origin"};

afterEach(()=>{vi.unstubAllGlobals();});

describe("authenticated media upload route",()=>{
  it("requires a signed-in session before reading files",async()=>{
    const mockedFetch=vi.fn();
    vi.stubGlobal("fetch",mockedFetch);
    const form=new FormData();
    form.append("files",new File(["image"],"photo.webp",{type:"image/webp"}));
    const response=await uploadMedia(new Request(origin+"/api/media",{method:"POST",body:form}));
    expect(response.status).toBe(401);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("rejects cross-origin uploads",async()=>{
    const mockedFetch=vi.fn();
    vi.stubGlobal("fetch",mockedFetch);
    const form=new FormData();
    form.append("files",new File(["image"],"photo.webp",{type:"image/webp"}));
    const response=await uploadMedia(new Request(origin+"/api/media",{
      method:"POST",headers:{...headers,origin:"https://attacker.example"},body:form
    }));
    expect(response.status).toBe(403);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("rejects unsupported image formats before forwarding",async()=>{
    const mockedFetch=vi.fn();
    vi.stubGlobal("fetch",mockedFetch);
    const form=new FormData();
    form.append("files",new File(["image"],"photo.svg",{type:"image/svg+xml"}));
    const response=await uploadMedia(new Request(origin+"/api/media",{
      method:"POST",headers,body:form
    }));
    expect(response.status).toBe(415);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("forwards bounded JPEG/PNG/WebP uploads with the HttpOnly session token",async()=>{
    const mockedFetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok:true,media:[{
        key:"user-id/photo.webp",
        url:"https://wdwvcvpgovvkoodozbxf.supabase.co/storage/v1/object/public/orbis-media/user-id/photo.webp",
        type:"image/webp",size:5
      }]
    }),{status:201,headers:{"Content-Type":"application/json"}}));
    vi.stubGlobal("fetch",mockedFetch);
    const form=new FormData();
    form.append("files",new File(["image"],"photo.webp",{type:"image/webp"}));
    const response=await uploadMedia(new Request(origin+"/api/media",{
      method:"POST",headers,body:form
    }));
    expect(response.status).toBe(201);
    expect(mockedFetch).toHaveBeenCalledOnce();
    const [url,init]=mockedFetch.mock.calls[0] as [URL,RequestInit];
    expect(String(url)).toContain("/api/media");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer "+token);
    expect(init.body).toBeInstanceOf(FormData);
  });
});
