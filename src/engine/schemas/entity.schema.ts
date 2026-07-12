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

/**
 * Directional walk-cycle animation from a spritesheet grid: one row per direction,
 * `framesPerRow` columns per row (frame 0 = idle, the rest = the walk cycle).
 * `sprite` must be a manifest key of type "spritesheet" (see ModLoader.ts). Movement
 * direction/facing is derived at runtime from the entity's velocity — this schema
 * only describes the sheet's layout, not the runtime state (see Animator.ts).
 */
const AnimationsComponentSchema = z.object({
  directions: z.array(z.enum(['down', 'up', 'side'])).min(1),
  framesPerRow: z.number().int().positive(),
  idleFrame: z.number().int().nonnegative().default(0),
  walkFrames: z.array(z.number().int().nonnegative()).min(1),
  frameRate: z.number().positive().default(8),
});

/** Schema for entity content definitions (player, enemies, NPCs, destructibles). */
export const EntityDefSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+:[a-z0-9_]+$/),
  type: z.literal('entity'),
  name: z.string().min(1),
  /** Billboard spritesheet/image key (required for 2D art path). */
  sprite: z.string().min(1),
  /** Optional GLB/GLTF model asset key for future 3D mesh entities. */
  model: z.string().min(1).optional(),
  /** Multiplier on the default display height (default 1). */
  displayScale: z.number().positive().default(1),
  components: z
    .object({
      health: HealthComponentSchema.optional(),
      movement: MovementComponentSchema.optional(),
      ai: AIComponentSchema.optional(),
      loot: LootComponentSchema.optional(),
      contactDamage: ContactDamageComponentSchema.optional(),
      inventory: InventoryComponentSchema.optional(),
      stats: StatSheetComponentSchema.optional(),
      animations: AnimationsComponentSchema.optional(),
    })
    .passthrough(),
});

export type EntityDef = z.infer<typeof EntityDefSchema>;
