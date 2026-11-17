import {z} from "zod";

export const CreatePostSchema=z.object({
  body:z.string().trim().min(1,"Добавь текст публикации.").max(500,"Публикация не может быть длиннее 500 символов."),
  title:z.string().trim().min(1).max(120).optional(),
  topic:z.string().trim().min(1).max(48).optional().default("Global")
}).strict();

export type CreatePostInput=z.infer<typeof CreatePostSchema>;
