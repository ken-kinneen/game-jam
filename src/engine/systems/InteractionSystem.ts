import type { Entity } from '../entities/Entity';
import type { EventBus } from '../core/EventBus';

export interface Interactable {
  sprite: Phaser.Physics.Arcade.Sprite;
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
    const px = player.sprite.x;
    const py = player.sprite.y;
    let best: Interactable | null = null;
    let bestDist = Infinity;

    for (const obj of this.interactables) {
      if (!obj.sprite.active) continue;
      const dx = obj.sprite.x - px;
      const dy = obj.sprite.y - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= obj.radius && dist < bestDist) {
        best = obj;
        bestDist = dist;
      }
    }

    this.nearest = best;
    return best;
  }

  /** Trigger interaction with the nearest object. */
  interact(): boolean {
    if (this.nearest) {
      this.nearest.onInteract();
      return true;
    }
    return false;
  }

  /** Clear all interactables (scene teardown). */
  clear(): void {
    this.interactables = [];
    this.nearest = null;
  }
}
