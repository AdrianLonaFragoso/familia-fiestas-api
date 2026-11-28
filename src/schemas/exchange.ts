import { z } from "zod";
export const revisionSchema = z
  .object({ revision: z.number().int().nonnegative() })
  .strict();
export const mailActionSchema = z
  .object({ action: z.enum(["retry", "mark-sent"]) })
  .strict();
