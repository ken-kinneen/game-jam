import { CharacterRenderer3D } from './CharacterRenderer3D';
import type { Entity } from '../entities/Entity';
import { Movement } from '../entities/components/Movement';

/**
 * Bridges the 3D character renderer with the existing Entity/sprite system.
 * Each frame it reads the entity's velocity, updates the 3D model's animation
 * and facing, renders to canvas, and swaps the Phaser sprite texture.
 *
 * The Phaser sprite remains the source of truth for position, physics,
 * depth sorting, and all other systems. Only the visual texture changes.
 */
export class CharacterController3D {
  private renderer: CharacterRenderer3D;
  private entity: Entity | null = null;
  private loaded = false;

  constructor(
    private phaserScene: Phaser.Scene,
    private renderSize = 128,
  ) {
    this.renderer = new CharacterRenderer3D(phaserScene, renderSize, renderSize);
  }

  /** Load model file(s). Accepts a single URL or multi-file array. */
  async load(source: string | { url: string; name: string }[]): Promise<boolean> {
    try {
      await this.renderer.load(source);
      this.loaded = true;
      console.log('3D character loaded. Animations:', this.renderer.getAvailableClips());
      return true;
    } catch (err) {
      console.warn('Failed to load 3D character, falling back to sprites:', err);
      this.loaded = false;
      return false;
    }
  }

  /** Attach to an entity using the same dimensions as the player config. */
  attach(entity: Entity, displayHeight = this.renderSize, bodyRadiusPct = 0.35): void {
    if (!this.loaded) return;
    this.entity = entity;

    // Swap sprite texture to the 3D rendered canvas
    const key = this.renderer.getTextureKey();
    entity.sprite.setTexture(key);
    const aspect = entity.sprite.width / entity.sprite.height;
    entity.sprite.setDisplaySize(displayHeight * aspect, displayHeight);
    entity.sprite.setVisible(true);

    // Ensure the physics body is still correct after texture swap
    const body = entity.sprite.body as Phaser.Physics.Arcade.Body;
    if (body) {
      const w = entity.sprite.displayWidth;
      const h = entity.sprite.displayHeight;
      body.setCircle(
        Math.min(w, h) * bodyRadiusPct,
        w * ((1 - bodyRadiusPct * 2) / 2),
        h * ((1 - bodyRadiusPct * 2) / 2),
      );
    }
  }

  /**
   * Call each frame. Reads velocity from the entity's Movement component,
   * updates the 3D animation/rotation, and re-renders the texture.
   */
  update(dt: number): void {
    if (!this.loaded || !this.entity) return;

    const movement = this.entity.getComponent<Movement>('movement');
    const vx = movement?.velocityX ?? 0;
    const vy = movement?.velocityY ?? 0;

    this.renderer.update(dt, vx, vy);

    // Refresh the Phaser texture so the sprite shows the latest render
    this.entity.sprite.setTexture(this.renderer.getTextureKey());
  }

  /** Trigger a one-shot interaction animation. */
  triggerInteract(): void {
    if (!this.loaded) return;
    this.renderer.triggerInteract();
  }

  /** Whether a 3D model was successfully loaded. */
  get isActive(): boolean {
    return this.loaded;
  }

  /** Clean up. */
  destroy(): void {
    this.renderer.destroy();
    this.entity = null;
    this.loaded = false;
  }
}
