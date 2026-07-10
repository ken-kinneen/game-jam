import { z } from 'zod';

const TilemapGenerationSchema = z.object({
  method: z.literal('tilemap'),
  map: z.string(),
});

const RoomsGenerationSchema = z.object({
  method: z.literal('rooms'),
  roomCount: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  spawnTables: z
    .object({
      enemies: z.string().optional(),
      trash: z.string().optional(),
    })
    .optional(),
});

const GenerationSchema = z.discriminatedUnion('method', [
  TilemapGenerationSchema,
  RoomsGenerationSchema,
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
