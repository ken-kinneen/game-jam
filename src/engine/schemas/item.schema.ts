import { z } from 'zod';

/** Schema for item content definitions. */
export const ItemDefSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+:[a-z0-9_]+$/, 'ID must be namespaced: "mod:snake_case"'),
  type: z.literal('item'),
  name: z.string().min(1),
  sprite: z.string().min(1),
  stackSize: z.number().int().positive().default(99),
  tags: z.array(z.string()).default([]),
  value: z.number().nonnegative().default(0),
  displayScale: z.number().positive().default(1),
});

export type ItemDef = z.infer<typeof ItemDefSchema>;
