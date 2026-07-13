type BlurFX = { strength: number; destroy: () => void };

interface TrackedSprite {
  go: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  blur: BlurFX | null;
}

export class DepthOfFieldSystem {
  private tracked: TrackedSprite[] = [];
  private enabled = false;

  private lampX = 0;
  private lampY = 0;
  private lampRadius = 0;

  private maxStrength = 1.2;

  enable(): void {
    this.enabled = true;
  }

  register(sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite): void {
    if (this.tracked.some((t) => t.go === sprite)) return;
    this.tracked.push({ go: sprite, blur: null });
  }

  unregister(sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite): void {
    const idx = this.tracked.findIndex((t) => t.go === sprite);
    if (idx < 0) return;
    this.tracked[idx].blur?.destroy();
    this.tracked.splice(idx, 1);
  }

  setLamp(x: number, y: number, radius: number): void {
    this.lampX = x;
    this.lampY = y;
    this.lampRadius = radius;
  }

  update(): void {
    if (!this.enabled || this.lampRadius <= 0) return;

    const innerEdge = this.lampRadius * 0.5;
    const outerEdge = this.lampRadius * 1.1;

    for (const entry of this.tracked) {
      const go = entry.go;
      if (!go.active) continue;

      const dx = go.x - this.lampX;
      const dy = go.y - this.lampY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= innerEdge) {
        if (entry.blur) {
          entry.blur.strength = 0;
        }
        continue;
      }

      const t = Math.min((dist - innerEdge) / (outerEdge - innerEdge), 1);
      const strength = t * t * this.maxStrength;

      if (!entry.blur && go.preFX) {
        try {
          entry.blur = go.preFX.addBlur(0, 1, 1, strength, 0xffffff, 4) as unknown as BlurFX;
        } catch {
          continue;
        }
      }

      if (entry.blur) {
        entry.blur.strength = strength;
      }
    }
  }

  destroy(): void {
    for (const entry of this.tracked) {
      entry.blur?.destroy();
    }
    this.tracked.length = 0;
    this.enabled = false;
  }
}
