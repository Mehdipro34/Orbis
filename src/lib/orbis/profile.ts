import {z} from "zod";

export const UpdateProfileSchema=z.object({
  name:z.string().trim().min(2,"Имя должно содержать минимум 2 символа.").max(32,"Имя слишком длинное."),
  bio:z.string().trim().max(180,"Описание не должно превышать 180 символов.")
}).strict();

export type UpdateProfileInput=z.infer<typeof UpdateProfileSchema>;
