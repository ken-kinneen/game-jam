import { z } from 'zod';

const TilemapGenerationSchema = z.object({
  method: z.literal('tilemap'),
  map: z.string(),
});

// "rooms" is implemented as a procedural cave (cellular-automata carving with a
// guaranteed-connectivity flood-fill prune — see generation/caveGenerator.ts).
// roomCount loosely scales the generated grid size (GameScene derives width/height
// from it) so existing content authored against this schema needs no changes; the
// fields below are optional tuning knobs with defaults already proven in the
// asset-pipeline admin tool's cave preview (fillRatio 0.4, smoothIterations 6,
// widenPasses 2 — tuned there for "wide corridor, not cramped" per design notes).
const RoomsGenerationSchema = z.object({
  method: z.literal('rooms'),
  roomCount: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  seed: z.number().int().optional(),
  fillRatio: z.number().min(0.2).max(0.6).default(0.4),
  smoothIterations: z.number().int().min(0).max(10).default(6),
  widenPasses: z.number().int().min(0).max(5).default(2),
  exitCount: z.number().int().positive().default(2),
  openItemCount: z.number().int().nonnegative().default(8),
  behindWallItemCount: z.number().int().nonnegative().default(3),
  spawnTables: z
    .object({
      enemies: z.string().optional(),
      trash: z.string().optional(),
    })
    .optional(),
});

const BackgroundGenerationSchema = z.object({
  method: z.literal('background'),
  image: z.string(),
  wallInset: z.number().nonnegative().default(32),
  scale: z.number().positive().default(1),
});

const GenerationSchema = z.discriminatedUnion('method', [
  TilemapGenerationSchema,
  RoomsGenerationSchema,
  BackgroundGenerationSchema,
]);

const ExitSchema = z.object({
  to: z.string(),
  condition: z.string().default('always'),
  label: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
});

const ShopSchema = z.object({
  label: z.string().default('Shop'),
  position: z.object({ x: z.number(), y: z.number() }),
});

/** Schema for scene content definitions. */
export const SceneDefSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+:[a-z0-9_]+$/),
  type: z.literal('scene'),
  kind: z.string().min(1),
  tileset: z.string().optional(),
  music: z.string().optional(),
  generation: GenerationSchema,
  exits: z.array(ExitSchema).default([]),
  shops: z.array(ShopSchema).default([]),
  playerSpawn: z.object({ x: z.number(), y: z.number() }).optional(),
});

export type SceneDef = z.infer<typeof SceneDefSchema>;
