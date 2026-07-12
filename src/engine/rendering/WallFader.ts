import { Ray, Vector3, type AbstractMesh, type Mesh, type Scene } from '@babylonjs/core';

const FADE_ALPHA = 0.15;
const RESTORE_SPEED = 8;
const FADE_SPEED = 12;

/**
 * Fades wall meshes that block the line of sight from camera to player.
 * Each frame: raycast camera→player, fade occluders, restore the rest.
 */
export class WallFader {
  private faded = new Set<AbstractMesh>();
  private alphas = new Map<AbstractMesh, number>();

  constructor(
    private scene: Scene,
    private wallMeshes: AbstractMesh[],
  ) {
    for (const m of wallMeshes) {
      if (m.material) {
        m.material.transparencyMode = 2;
        this.alphas.set(m, 1);
      }
    }
  }

  /** Call each frame with the player's world position. */
  update(playerX: number, playerY: number, playerZ: number, dt: number): void {
    const cam = this.scene.activeCamera;
    if (!cam) return;

    const camPos = cam.position;
    const playerPos = new Vector3(playerX, playerY, playerZ);
    const dir = playerPos.subtract(camPos);
    const dist = dir.length();
    dir.normalize();

    const ray = new Ray(camPos, dir, dist);
    const hits = ray.intersectsMeshes(this.wallMeshes as Mesh[]);

    const occluding = new Set<AbstractMesh>();
    for (const hit of hits) {
      if (hit.hit && hit.pickedMesh) {
        occluding.add(hit.pickedMesh);
      }
    }

    for (const m of this.wallMeshes) {
      if (!m.material) continue;
      const current = this.alphas.get(m) ?? 1;
      if (occluding.has(m)) {
        const next = Math.max(FADE_ALPHA, current - FADE_SPEED * dt);
        m.material.alpha = next;
        this.alphas.set(m, next);
        this.faded.add(m);
      } else if (this.faded.has(m)) {
        const next = Math.min(1, current + RESTORE_SPEED * dt);
        m.material.alpha = next;
        this.alphas.set(m, next);
        if (next >= 1) this.faded.delete(m);
      }
    }
  }

  dispose(): void {
    for (const m of this.faded) {
      if (m.material) m.material.alpha = 1;
    }
    this.faded.clear();
    this.alphas.clear();
  }
}
