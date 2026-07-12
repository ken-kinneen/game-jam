import type { AbstractMesh, Scene, TransformNode } from '@babylonjs/core';
import { MeshBuilder, StandardMaterial, Color3, type PBRMaterial } from '@babylonjs/core';
import { MeshFactory } from '../rendering/MeshFactory';
import { assetStore } from '../rendering/AssetStore';
import { instantiateScaledModel } from '../entities/ModelAnimator';
import type { Entity } from '../entities/Entity';
import type { SceneDef } from '../schemas/scene.schema';
import type { Aabb } from '../rendering/CollisionWorld';
import { WORLD_SCALE } from '../entities/EntityFactory';

export type PropShadow = { shadow: AbstractMesh; source: AbstractMesh };

/** Default model height in pixels when a prop omits `height`. */
const DEFAULT_MODEL_HEIGHT_PX = 48;

/** Spawns scene props as GLB models or billboards; returns shadows + collision AABBs. */
export function spawnSceneProps(
  scene: Scene,
  sceneDef: SceneDef | undefined,
  _player: Entity | undefined,
  onPropAction: (
    prop: {
      position: { x: number; y: number };
      action?: string;
      actionTarget?: string;
      actionLabel?: string;
    },
    visual?: AbstractMesh | TransformNode,
  ) => void,
): { shadows: PropShadow[]; walls: Aabb[]; disposables: { dispose: () => void }[] } {
  const propShadows: PropShadow[] = [];
  const walls: Aabb[] = [];
  const disposables: { dispose: () => void }[] = [];
  const props = sceneDef?.props ?? [];

  for (const prop of props) {
    const pos = prop.position;
    let visual: AbstractMesh | TransformNode | null = null;

    if (prop.model) {
      const container = assetStore.getModelContainer(prop.model);
      if (!container) {
        console.warn(`Prop model "${prop.model}" not loaded, skipping`);
        continue;
      }
      const heightPx = prop.height ?? DEFAULT_MODEL_HEIGHT_PX;
      const worldH = heightPx * WORLD_SCALE;
      const { root } = instantiateScaledModel(
        container,
        `prop_${prop.model.replace(/\//g, '_')}_${pos.x}_${pos.y}`,
        worldH,
      );
      root.position.x = pos.x * WORLD_SCALE;
      root.position.z = pos.y * WORLD_SCALE;
      if (prop.angle) {
        root.rotationQuaternion = null;
        root.rotation.y = (prop.angle * Math.PI) / 180;
      }
      visual = root;

      if (prop.tint) {
        const tintColor = Color3.FromHexString(prop.tint);
        for (const child of root.getChildMeshes(false)) {
          const mat = child.material;
          if (mat && 'albedoColor' in mat) {
            (mat as PBRMaterial).albedoColor = tintColor;
          } else if (mat && 'diffuseColor' in mat) {
            (mat as StandardMaterial).diffuseColor = tintColor;
          }
        }
      }

      console.log(
        `[Prop] spawned ${prop.model} at (${root.position.x.toFixed(1)}, ${root.position.z.toFixed(1)}) h=${worldH.toFixed(2)} meshes=${root.getChildMeshes().length}`,
      );

      if (prop.collides) {
        root.computeWorldMatrix(true);
        const bi = root.getHierarchyBoundingVectors(true);
        walls.push({
          minX: bi.min.x,
          maxX: bi.max.x,
          minZ: bi.min.z,
          maxZ: bi.max.z,
        });
      }
    } else if (prop.image) {
      if (!assetStore.hasTexture(prop.image)) {
        console.warn(`Prop image "${prop.image}" not found, skipping`);
        continue;
      }

      const tex = assetStore.getTexture(prop.image);
      const srcHeight = tex.getSize().height || 64;
      const scale = prop.height ? prop.height / srcHeight : prop.scale;
      const worldH = srcHeight * scale * WORLD_SCALE;

      visual = MeshFactory.createGroundDecal(
        scene,
        `prop_${prop.image}_${pos.x}`,
        prop.image,
        worldH,
      );
      visual.position.x = pos.x * WORLD_SCALE;
      visual.position.z = pos.y * WORLD_SCALE;
      if (prop.angle) {
        visual.rotation.y = (prop.angle * Math.PI) / 180;
      }

      if (prop.collides) {
        const halfW = ((visual.metadata?.displayWidth as number) ?? worldH) * 0.35;
        const halfD = halfW;
        walls.push({
          minX: visual.position.x - halfW,
          maxX: visual.position.x + halfW,
          minZ: visual.position.z - halfD,
          maxZ: visual.position.z + halfD,
        });
      }
    }

    if (!visual) continue;
    disposables.push(visual);

    if (prop.model && prop.collides) {
      // Soft disc under 3D props
      const disc = MeshBuilder.CreateDisc(
        `propShadow3d_${pos.x}_${pos.y}`,
        { radius: 0.55, tessellation: 16 },
        scene,
      );
      disc.rotation.x = Math.PI / 2;
      disc.position.x = visual.position.x;
      disc.position.z = visual.position.z;
      disc.position.y = 0.015;
      const mat = new StandardMaterial(`propShadow3dMat_${pos.x}`, scene);
      mat.diffuseColor = Color3.Black();
      mat.emissiveColor = Color3.Black();
      mat.alpha = 0.3;
      mat.specularColor = Color3.Black();
      disc.material = mat;
      const children = visual.getChildMeshes(false);
      const track = children.find((m) => m.getTotalVertices() > 0) ?? disc;
      propShadows.push({ shadow: disc, source: track });
      disposables.push(disc);
    }

    if (prop.action) {
      onPropAction(prop, visual);
    }
  }

  return { shadows: propShadows, walls, disposables };
}
