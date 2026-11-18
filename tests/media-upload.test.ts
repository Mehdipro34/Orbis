import {afterEach,describe,expect,it,vi} from "vitest";
import {POST as uploadMedia} from "../src/app/api/media/route";

const origin="https://preview.orbis.example";
const token="g".repeat(40)+"."+"h".repeat(43);
const userId="d304cf42-50a3-4a65-9ff1-a7860bc8dbb1";
const headers={cookie:"orbis_guest_session="+token,origin,"sec-fetch-site":"same-origin"};

function sessionResponse(){
  return new Response(JSON.stringify({
    authenticated:true,user:{id:userId,username:"orbis_user"}
  }),{status:200,headers:{"Content-Type":"application/json"}});
}
function jpegFile(){
  return new File([new Uint8Array([0xff,0xd8,0xff,0x00])],"photo.jpg",{type:"image/jpeg"});
}

afterEach(()=>{
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("authenticated media upload route",()=>{
  it("requires a signed-in session before reading files",async()=>{
    const mockedFetch=vi.fn();
    vi.stubGlobal("fetch",mockedFetch);
    const form=new FormData();
    form.append("files",jpegFile());
    const response=await uploadMedia(new Request(origin+"/api/media",{method:"POST",body:form}));
    expect(response.status).toBe(401);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("rejects cross-origin uploads",async()=>{
    const mockedFetch=vi.fn();
    vi.stubGlobal("fetch",mockedFetch);
    const form=new FormData();
    form.append("files",jpegFile());
    const response=await uploadMedia(new Request(origin+"/api/media",{
      method:"POST",headers:{...headers,origin:"https://attacker.example"},body:form
    }));
    expect(response.status).toBe(403);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("rejects unsupported image formats before forwarding them to ImgBB",async()=>{
    const mockedFetch=vi.fn().mockResolvedValue(sessionResponse());
    vi.stubGlobal("fetch",mockedFetch);
    vi.stubEnv("IMGBB_API_KEY","test-imgbb-key");
    const form=new FormData();
    form.append("files",new File(["<svg/>"],"photo.svg",{type:"image/svg+xml"}));
    const response=await uploadMedia(new Request(origin+"/api/media",{
      method:"POST",headers,body:form
    }));
    expect(response.status).toBe(415);
    expect(mockedFetch).toHaveBeenCalledOnce();
    expect(String(mockedFetch.mock.calls[0][0])).toContain("/api/guest/me");
  });

  it("authenticates the account and uploads a bounded JPEG to ImgBB",async()=>{
    const imgbbResponse=new Response(JSON.stringify({
      success:true,data:{id:"abc123",url:"https://i.ibb.co/abc123/photo.jpg"}
    }),{status:200,headers:{"Content-Type":"application/json"}});
    const mockedFetch=vi.fn()
      .mockResolvedValueOnce(sessionResponse())
      .mockResolvedValueOnce(imgbbResponse);
    vi.stubGlobal("fetch",mockedFetch);
    vi.stubEnv("IMGBB_API_KEY","test-imgbb-key");
    const form=new FormData();
    form.append("files",jpegFile());
    const response=await uploadMedia(new Request(origin+"/api/media",{
      method:"POST",headers,body:form
    }));
    expect(response.status).toBe(201);
    const payload=await response.json();
    expect(payload).toMatchObject({
      ok:true,provider:"ImgBB",
      media:[{
        key:userId+"/imgbb/abc123",
        url:"https://i.ibb.co/abc123/photo.jpg",
        type:"image/jpeg",size:4
      }]
    });
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    const [sessionUrl,sessionInit]=mockedFetch.mock.calls[0] as [URL,RequestInit];
    expect(String(sessionUrl)).toContain("/api/guest/me");
    expect((sessionInit.headers as Headers).get("Authorization")).toBe("Bearer "+token);
    const [uploadUrl,uploadInit]=mockedFetch.mock.calls[1] as [URL,RequestInit];
    expect(uploadUrl.hostname).toBe("api.imgbb.com");
    expect(uploadUrl.searchParams.get("key")).toBe("test-imgbb-key");
    expect(uploadInit.body).toBeInstanceOf(FormData);
  });
});
