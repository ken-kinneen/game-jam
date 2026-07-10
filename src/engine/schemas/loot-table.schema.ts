import { z } from 'zod';

const LootEntrySchema = z.union([
  z.object({
    item: z.string(),
    weight: z.number().positive(),
    qty: z.tuple([z.number().int().nonnegative(), z.number().int().positive()]),
  }),
  z.object({
    tag: z.string(),
    weight: z.number().positive(),
    qty: z.tuple([z.number().int().nonnegative(), z.number().int().positive()]),
  }),
]);

/** Schema for loot table definitions. */
export const LootTableDefSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+:[a-z0-9_]+$/),
  type: z.literal('loot-table'),
  entries: z.array(LootEntrySchema).min(1),
});

export type LootTableDef = z.infer<typeof LootTableDefSchema>;
