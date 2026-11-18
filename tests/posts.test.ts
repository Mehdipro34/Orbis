import {describe,expect,it} from "vitest";
import {CreatePostSchema} from "@/lib/orbis/posts";

describe("CreatePostSchema",()=>{
  it("accepts trimmed text and supplies the default topic",()=>{
    expect(CreatePostSchema.parse({body:"  Привет, ORBIS!  "})).toEqual({
      body:"Привет, ORBIS!",topic:"Global",media:[]
    });
  });

  it("rejects empty text when there is no media",()=>{
    expect(CreatePostSchema.safeParse({body:"   "}).success).toBe(false);
  });

  it("accepts an image-only post with validated uploaded media",()=>{
    const result=CreatePostSchema.safeParse({
      body:"",
      media:[{key:"user-id/photo.webp",url:"https://wdwvcvpgovvkoodozbxf.supabase.co/storage/v1/object/public/orbis-media/user-id/photo.webp",type:"image/webp",size:1200}]
    });
    expect(result.success).toBe(true);
  });

  it("rejects unsupported media and too many files",()=>{
    const invalid={key:"user/photo.svg",url:"https://example.com/photo.svg",type:"image/svg+xml",size:100};
    expect(CreatePostSchema.safeParse({body:"",media:[invalid]}).success).toBe(false);
    const image={key:"user/photo.webp",url:"https://example.com/photo.webp",type:"image/webp",size:100};
    expect(CreatePostSchema.safeParse({body:"",media:[image,image,image,image,image]}).success).toBe(false);
  });

  it("accepts exactly 500 characters",()=>{
    expect(CreatePostSchema.safeParse({body:"a".repeat(500)}).success).toBe(true);
  });

  it("rejects text longer than 500 characters",()=>{
    expect(CreatePostSchema.safeParse({body:"a".repeat(501)}).success).toBe(false);
  });

  it("rejects unknown fields rather than mass-assigning them",()=>{
    expect(CreatePostSchema.safeParse({body:"Hello",author_id:"another-user"}).success).toBe(false);
  });

  it("rejects empty or overlong titles",()=>{
    expect(CreatePostSchema.safeParse({body:"Hello",title:" "}).success).toBe(false);
    expect(CreatePostSchema.safeParse({body:"Hello",title:"x".repeat(121)}).success).toBe(false);
  });
});
