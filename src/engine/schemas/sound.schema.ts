import { z } from 'zod';

const SoundTriggerSchema = z.object({
  event: z.string().min(1),
  filter: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

/** Schema for sound effect definitions — maps game events to audio assets. */
export const SoundDefSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+:[a-z0-9_]+$/, 'ID must be namespaced: "mod:snake_case"'),
  type: z.literal('sound'),
  name: z.string().min(1),
  asset: z.string().min(1),
  volume: z.number().min(0).max(1).default(1),
  pitchRange: z.tuple([z.number(), z.number()]).default([1, 1]),
  cooldown: z.number().nonnegative().default(0),
  triggers: z.array(SoundTriggerSchema).min(1),
});

export type SoundDef = z.infer<typeof SoundDefSchema>;
