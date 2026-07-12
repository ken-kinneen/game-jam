import type { AbstractMesh } from '@babylonjs/core';
import type { Entity } from '../entities/Entity';
import type { EventBus } from '../core/EventBus';
import { WORLD_SCALE } from '../entities/EntityFactory';

export interface Interactable {
  mesh: AbstractMesh;
  id: string;
  radius: number;
  onInteract: () => void;
}

/** Manages "press E on thing" interactions at stations and objects. */
export class InteractionSystem {
  private interactables: Interactable[] = [];
  private nearest: Interactable | null = null;

  constructor(private eventBus: EventBus) {}

  /** Register an interactable object in the scene. */
  add(interactable: Interactable): void {
    this.interactables.push(interactable);
  }

  /** Find nearest interactable within range. Call each frame. */
  update(player: Entity): Interactable | null {
    const px = player.x / WORLD_SCALE;
    const py = player.y / WORLD_SCALE;
    let best: Interactable | null = null;
    let bestDist = Infinity;

    for (const obj of this.interactables) {
      if (obj.mesh.isDisposed()) continue;
      const dx = obj.mesh.position.x / WORLD_SCALE - px;
      const dy = obj.mesh.position.z / WORLD_SCALE - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= obj.radius && dist < bestDist) {
        best = obj;
        bestDist = dist;
      }
    }

    this.nearest = best;
    void this.eventBus;
    return best;
  }

  /** Trigger the nearest interactable's callback. */
  interact(): boolean {
    if (!this.nearest) return false;
    this.nearest.onInteract();
    return true;
  }

  /** Clear all interactables. */
  clear(): void {
    this.interactables = [];
    this.nearest = null;
  }
}
