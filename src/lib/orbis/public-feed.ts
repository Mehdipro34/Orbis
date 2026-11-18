import {z} from "zod";
import {orbisEdgeFunctionUrl,supabasePublishableKey} from "./config";

export const FeedModeSchema = z.enum(["latest","popular"]);
export type FeedMode = z.infer<typeof FeedModeSchema>;

const PublicFeedQuerySchema = z.object({
  mode:FeedModeSchema.default("latest"),
  limit:z.coerce.number().int().min(1).max(30).default(20),
  cursor:z.preprocess(value => value === "" ? undefined : value,z.string().max(700).optional())
});

const PublicMediaSchema = z.object({
  key:z.string().optional(),
  url:z.string().url(),
  type:z.string().optional(),
  size:z.number().nonnegative().optional()
}).passthrough();

export const PublicPostSchema = z.object({
  id:z.string().uuid(),
  postNumber:z.union([z.string(),z.number().transform(String)]).optional(),
  title:z.string().nullable().optional(),
  topic:z.string().nullable().optional(),
  body:z.string().default(""),
  username:z.string().nullable().optional(),
  author:z.string().nullable().optional(),
  authorNumber:z.union([z.string(),z.number().transform(String)]).nullable().optional(),
  avatar_url:z.string().url().nullable().optional(),
  createdAt:z.string().min(1),
  media:z.array(PublicMediaSchema).default([]),
  likes:z.number().int().nonnegative().default(0),
  liked:z.boolean().optional(),
  saved:z.boolean().optional()
});

export const PublicFeedResponseSchema = z.object({
  posts:z.array(PublicPostSchema),
  hasMore:z.boolean(),
  nextCursor:z.string().nullable().optional().default(null),
  public:z.boolean().optional()
});

export type PublicPost = z.infer<typeof PublicPostSchema>;
export type PublicFeedResponse = z.infer<typeof PublicFeedResponseSchema>;
export type PublicFeedQuery = z.infer<typeof PublicFeedQuerySchema>;

export class PublicFeedError extends Error {
  readonly status:number;
  readonly code:string;
  constructor(message:string,status:number,code:string) {
    super(message); this.name="PublicFeedError"; this.status=status; this.code=code;
  }
}

export function parsePublicFeedQuery(searchParams:URLSearchParams) {
  return PublicFeedQuerySchema.safeParse({
    mode:searchParams.get("mode") ?? undefined,
    limit:searchParams.get("limit") ?? undefined,
    cursor:searchParams.get("cursor") ?? undefined
  });
}

export async function fetchPublicFeed(query:PublicFeedQuery,forwardedFor?:string):Promise<PublicFeedResponse> {
  const endpoint=new URL(orbisEdgeFunctionUrl+"/api/public/posts");
  endpoint.searchParams.set("mode",query.mode);
  endpoint.searchParams.set("limit",String(query.limit));
  if(query.cursor) endpoint.searchParams.set("cursor",query.cursor);

  const headers=new Headers({apikey:supabasePublishableKey,accept:"application/json"});
  if(forwardedFor) headers.set("x-forwarded-for",forwardedFor.slice(0,160));

  let response:Response;
  try {
    response=await fetch(endpoint,{method:"GET",headers,cache:"no-store",signal:AbortSignal.timeout(7000)});
  } catch {
    throw new PublicFeedError("Публичная лента временно недоступна. Попробуй ещё раз.",503,"UPSTREAM_UNAVAILABLE");
  }

  if(!response.ok) {
    if(response.status===429) throw new PublicFeedError("Слишком много запросов к ленте. Подожди немного.",429,"RATE_LIMITED");
    if(response.status===400) throw new PublicFeedError("Не удалось обработать параметры ленты.",400,"INVALID_UPSTREAM_QUERY");
    throw new PublicFeedError("Публичная лента временно недоступна.",response.status>=500?503:502,"UPSTREAM_REJECTED");
  }

  let payload:unknown;
  try { payload=await response.json(); }
  catch { throw new PublicFeedError("Сервер ленты вернул некорректный ответ.",502,"INVALID_UPSTREAM_RESPONSE"); }

  const parsed=PublicFeedResponseSchema.safeParse(payload);
  if(!parsed.success) throw new PublicFeedError("Сервер ленты вернул данные в неизвестном формате.",502,"INVALID_UPSTREAM_RESPONSE");
  return parsed.data;
}
