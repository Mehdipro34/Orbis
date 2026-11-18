import {describe,expect,it} from "vitest";
import {parsePublicFeedQuery} from "../src/lib/orbis/public-feed";

describe("parsePublicFeedQuery",()=>{
  it("defaults to latest with twenty posts",()=>{
    const result=parsePublicFeedQuery(new URLSearchParams());
    expect(result.success).toBe(true);
    if(result.success){expect(result.data.mode).toBe("latest");expect(result.data.limit).toBe(20);}
  });
  it("accepts the supported popular mode and bounded page size",()=>{
    const result=parsePublicFeedQuery(new URLSearchParams("mode=popular&limit=30"));
    expect(result.success).toBe(true);
    if(result.success){expect(result.data.mode).toBe("popular");expect(result.data.limit).toBe(30);}
  });
  it("rejects unsupported modes and excessive page sizes",()=>{
    expect(parsePublicFeedQuery(new URLSearchParams("mode=private")).success).toBe(false);
    expect(parsePublicFeedQuery(new URLSearchParams("limit=31")).success).toBe(false);
  });
  it("accepts a bounded keyset cursor",()=>{
    expect(parsePublicFeedQuery(new URLSearchParams("cursor=eyJvayI6MX0")).success).toBe(true);
  });
});
