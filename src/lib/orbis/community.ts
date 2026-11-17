import {z} from "zod";

export const CreateClanSchema=z.object({
  name:z.string().trim().min(3,"Название должно содержать минимум 3 символа.").max(40,"Название слишком длинное."),
  description:z.string().trim().max(240,"Описание не должно превышать 240 символов.").default("")
}).strict();

export const ReadNotificationSchema=z.object({
  id:z.string().uuid().optional()
}).strict();

export type CreateClanInput=z.infer<typeof CreateClanSchema>;

export const CreateReportSchema=z.object({
  postId:z.string().uuid(),
  reason:z.string().trim().min(1,"Укажи причину жалобы.").max(300,"Причина слишком длинная.")
}).strict();
