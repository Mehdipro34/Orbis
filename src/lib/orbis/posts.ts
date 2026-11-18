import {z} from "zod";

export const UploadedMediaSchema=z.object({
  key:z.string().trim().min(1).max(300),
  url:z.string().url().max(600),
  type:z.enum(["image/jpeg","image/png","image/webp"]),
  size:z.number().int().positive().max(3*1024*1024)
}).strict();

export const CreatePostSchema=z.object({
  body:z.string().trim().max(500,"Публикация не может быть длиннее 500 символов.").optional().default(""),
  title:z.string().trim().min(1).max(120).optional(),
  topic:z.string().trim().min(1).max(48).optional().default("Global"),
  media:z.array(UploadedMediaSchema).max(4,"Можно прикрепить не более 4 фотографий.").optional().default([])
}).strict().refine(value=>value.body.length>0||value.media.length>0,{
  message:"Добавь текст или фотографию."
});

export type CreatePostInput=z.infer<typeof CreatePostSchema>;

export const CreateCommentSchema=z.object({
  body:z.string().trim().min(1,"Комментарий не может быть пустым.").max(1000,"Максимум 1000 символов."),
  parentId:z.string().uuid().optional().nullable()
}).strict();

export const BookmarkSchema=z.object({
  postId:z.string().uuid()
}).strict();

export type CreateCommentInput=z.infer<typeof CreateCommentSchema>;
