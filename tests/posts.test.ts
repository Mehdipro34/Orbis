import {describe,expect,it} from "vitest";
import {CreatePostSchema} from "@/lib/orbis/posts";

describe("CreatePostSchema",()=>{
  it("accepts trimmed text and supplies the default topic",()=>{
    expect(CreatePostSchema.parse({body:"  Привет, ORBIS!  "})).toEqual({
      body:"Привет, ORBIS!",topic:"Global"
    });
  });

  it("rejects empty text",()=>{
    expect(CreatePostSchema.safeParse({body:"   "}).success).toBe(false);
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
