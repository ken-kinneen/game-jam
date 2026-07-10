import { z } from 'zod';

const HealthComponentSchema = z.object({ max: z.number().positive() });
const MovementComponentSchema = z.object({ maxSpeed: z.number().nonnegative() });
const AIComponentSchema = z.object({
  behavior: z.string(),
  aggroRange: z.number().nonnegative().optional(),
});
const LootComponentSchema = z.object({ table: z.string() });
const ContactDamageComponentSchema = z.object({ amount: z.number().positive() });
const InventoryComponentSchema = z.object({ capacity: z.number().int().positive().optional() });
const StatSheetComponentSchema = z.object({
  maxHealth: z.number().positive().optional(),
  moveSpeed: z.number().nonnegative().optional(),
  damage: z.number().nonnegative().optional(),
  attackSpeed: z.number().nonnegative().optional(),
  pickupRadius: z.number().nonnegative().optional(),
  carryCapacity: z.number().int().positive().optional(),
  luck: z.number().optional(),
});

/** Schema for entity content definitions (player, enemies, NPCs, destructibles). */
export const EntityDefSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+:[a-z0-9_]+$/),
  type: z.literal('entity'),
  name: z.string().min(1),
  sprite: z.string().min(1),
  components: z
    .object({
      health: HealthComponentSchema.optional(),
      movement: MovementComponentSchema.optional(),
      ai: AIComponentSchema.optional(),
      loot: LootComponentSchema.optional(),
      contactDamage: ContactDamageComponentSchema.optional(),
      inventory: InventoryComponentSchema.optional(),
      stats: StatSheetComponentSchema.optional(),
    })
    .passthrough(),
});

export type EntityDef = z.infer<typeof EntityDefSchema>;
