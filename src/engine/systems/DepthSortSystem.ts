/**
 * Y-sort depth ordering: sprites lower on screen render in front.
 * Call update() each frame to keep depths current.
 */
export class DepthSortSystem {
  private sprites: Phaser.GameObjects.Components.Depth[] = [];
  private baseDepth = 10;

  register(sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite): void {
    this.sprites.push(sprite as unknown as Phaser.GameObjects.Components.Depth);
  }

  unregister(sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite): void {
    const idx = this.sprites.indexOf(sprite as unknown as Phaser.GameObjects.Components.Depth);
    if (idx >= 0) this.sprites.splice(idx, 1);
  }

  update(): void {
    for (const sprite of this.sprites) {
      const go = sprite as unknown as Phaser.GameObjects.Sprite;
      go.setDepth(this.baseDepth + go.y * 0.01);
    }
  }
}
