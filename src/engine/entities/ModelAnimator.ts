import { registerBuiltInLoaders } from '@babylonjs/loaders/dynamic';
import {
  Color3,
  LoadAssetContainerAsync,
  PBRMaterial,
  StandardMaterial,
  TransformNode,
  type AbstractMesh,
  type AnimationGroup,
  type AssetContainer,
  type InstantiatedEntries,
  type Scene,
} from '@babylonjs/core';

let loadersRegistered = false;

/** Register Babylon file loaders once (docs: @babylonjs/loaders/dynamic). */
export function ensureBabylonLoaders(): void {
  if (loadersRegistered) return;
  registerBuiltInLoaders();
  loadersRegistered = true;
}

/** Runtime GLB character: Babylon AnimationGroups + yaw from velocity. */
export class ModelAnimator {
  playing = false;

  constructor(
    readonly root: AbstractMesh | TransformNode,
    readonly groups: AnimationGroup[],
    private readonly entries: InstantiatedEntries,
  ) {
    // GLTF roots use rotationQuaternion — euler yaw is ignored until cleared
    this.root.rotationQuaternion = null;
  }

  /** Play first animation group looping (Babylon character pattern). */
  playWalk(speedRatio = 1): void {
    const g = this.groups[0];
    if (!g) return;
    g.speedRatio = speedRatio;
    if (!this.playing) {
      g.start(true, 1.0, g.from, g.to, false);
      this.playing = true;
    }
  }

  /** Stop and reset to rest pose. */
  stopWalk(): void {
    const g = this.groups[0];
    if (!g) return;
    if (this.playing) {
      g.stop();
      g.reset();
      this.playing = false;
    }
  }

  /**
   * Face movement on XZ — same as Babylon animated-character docs:
   * `hero.rotation.y = Math.atan2(direction.x, direction.z)`
   */
  faceVelocity(vx: number, vz: number): void {
    if (Math.abs(vx) + Math.abs(vz) < 1e-4) return;
    this.root.rotationQuaternion = null;
    this.root.rotation.y = Math.atan2(vx, vz) + Math.PI;
  }

  /** Dispose cloned instance (keeps the shared AssetContainer). */
  dispose(): void {
    this.entries.dispose();
  }
}

/** Preload a GLB into an AssetContainer (not added to the scene). */
export async function preloadModelContainer(scene: Scene, url: string): Promise<AssetContainer> {
  ensureBabylonLoaders();
  console.log('[Model] LoadAssetContainerAsync', url);
  // blob: URLs have no .glb extension — tell the loader which plugin to use
  const options = url.startsWith('blob:') ? { pluginExtension: '.glb' } : undefined;
  const container = await LoadAssetContainerAsync(url, scene, options);
  for (const g of container.animationGroups) {
    g.stop();
    g.reset();
  }
  console.log(
    '[Model] container ready meshes=',
    container.meshes.length,
    'anims=',
    container.animationGroups.length,
  );
  return container;
}

/**
 * Instantiate a preloaded container under one parent, fit height, center on XZ.
 * Kenney/obj2gltf packs often have multiple scene roots (frame + pillow + …);
 * parenting them keeps the whole prop together.
 */
export function instantiateScaledModel(
  container: AssetContainer,
  name: string,
  targetHeight: number,
): { root: TransformNode; animator: ModelAnimator } {
  const entries = container.instantiateModelsToScene(
    (sourceName) => `${name}_${sourceName}`,
    false,
    { doNotInstantiate: true },
  );

  if (entries.rootNodes.length === 0) {
    throw new Error(`Instantiate produced no root for ${name}`);
  }

  const scene = entries.rootNodes[0].getScene();
  // Outer root: callers set world XZ here without fighting fit/center offsets
  const root = new TransformNode(name, scene);
  root.rotationQuaternion = null;
  const pivot = new TransformNode(`${name}_pivot`, scene);
  pivot.parent = root;
  pivot.rotationQuaternion = null;

  for (const node of entries.rootNodes) {
    node.parent = pivot;
    if ('rotationQuaternion' in node) {
      (node as TransformNode).rotationQuaternion = null;
    }
  }

  // Fit height + plant on ground + center XZ on the pivot (not the world root)
  pivot.computeWorldMatrix(true);
  const bi = pivot.getHierarchyBoundingVectors(true);
  const sizeY = Math.max(0.001, bi.max.y - bi.min.y);
  pivot.scaling.setAll(targetHeight / sizeY);
  pivot.computeWorldMatrix(true);
  const bi2 = pivot.getHierarchyBoundingVectors(true);
  pivot.position.x = -((bi2.min.x + bi2.max.x) / 2);
  pivot.position.y = -bi2.min.y;
  pivot.position.z = -((bi2.min.z + bi2.max.z) / 2);

  for (const g of entries.animationGroups) {
    g.stop();
    g.reset();
  }

  boostPropVisibility(root);

  const animator = new ModelAnimator(root, entries.animationGroups, entries);
  return { root, animator };
}

/** Soft emissive so untextured PBR placeholder props read clearly. */
function boostPropVisibility(root: TransformNode): void {
  for (const mesh of root.getChildMeshes(false)) {
    const mats = mesh.material
      ? Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]
      : [];
    for (const mat of mats) {
      if (!mat) continue;
      if (mat instanceof PBRMaterial) {
        const c = mat.albedoColor;
        mat.emissiveColor = new Color3(c.r * 0.3, c.g * 0.3, c.b * 0.3);
      } else if (mat instanceof StandardMaterial) {
        const c = mat.diffuseColor;
        mat.emissiveColor = new Color3(c.r * 0.3, c.g * 0.3, c.b * 0.3);
      }
    }
  }
}
