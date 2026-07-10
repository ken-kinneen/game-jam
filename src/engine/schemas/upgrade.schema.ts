import { z } from 'zod';

const StatEffectSchema = z.object({
  kind: z.literal('stat'),
  stat: z.string(),
  mod: z.enum(['flat', 'increased', 'more']),
  value: z.number(),
});

const BehaviorEffectSchema = z.object({
  kind: z.literal('behavior'),
  behavior: z.string(),
});

const EffectSchema = z.discriminatedUnion('kind', [StatEffectSchema, BehaviorEffectSchema]);

/** Schema for upgrade content definitions. */
export const UpgradeDefSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+:[a-z0-9_]+$/),
  type: z.literal('upgrade'),
  name: z.string().min(1),
  sprite: z.string().min(1),
  rarity: z.enum(['common', 'uncommon', 'rare', 'legendary']).default('common'),
  cost: z.record(z.string(), z.number().nonnegative()).default({}),
  effects: z.array(EffectSchema).default([]),
  requires: z.array(z.string()).default([]),
});

export type UpgradeDef = z.infer<typeof UpgradeDefSchema>;
