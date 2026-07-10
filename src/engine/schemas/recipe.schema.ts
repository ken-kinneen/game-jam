import { z } from 'zod';

const RecipeInputSchema = z.union([
  z.object({ item: z.string(), qty: z.number().int().positive() }),
  z.object({ tag: z.string(), qty: z.number().int().positive() }),
]);

/** Schema for crafting recipe definitions. */
export const RecipeDefSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+:[a-z0-9_]+$/),
  type: z.literal('recipe'),
  station: z.string().min(1),
  inputs: z.array(RecipeInputSchema).min(1),
  output: z.object({
    item: z.string(),
    qty: z.number().int().positive(),
  }),
});

export type RecipeDef = z.infer<typeof RecipeDefSchema>;
