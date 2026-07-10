import { z } from 'zod';

/** Schema for mod.json metadata files. */
export const ModMetaSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/, 'Mod ID must be lowercase alphanumeric + underscores'),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  dependencies: z.array(z.string()).default([]),
});

export type ModMeta = z.infer<typeof ModMetaSchema>;
