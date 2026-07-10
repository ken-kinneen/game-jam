import type { Entity } from '../entities/Entity';
import { Health } from '../entities/components/Health';
import type { EventBus } from '../core/EventBus';

/** Handles damage application and death detection via events. */
export class CombatSystem {
  constructor(private eventBus: EventBus) {}

  /** Apply damage to a target entity from a source. */
  applyDamage(target: Entity, amount: number, sourceId: string): void {
    const health = target.getComponent<Health>('health');
    if (!health || health.isDead) return;

    const actual = health.damage(amount);

    if (target.defId.includes('player') || target.hasComponent('playerControlled')) {
      this.eventBus.emit('player:damaged', { amount: actual, sourceId });
    }

    if (health.isDead) {
      this.eventBus.emit('entity:died', {
        entityId: target.id,
        defId: target.defId,
        killerId: sourceId,
      });
    }
  }
}
