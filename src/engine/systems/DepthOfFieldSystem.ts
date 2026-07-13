type BlurFX = { strength: number; destroy: () => void };

interface TrackedSprite {
  go: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  blur: BlurFX | null;
}

export class DepthOfFieldSystem {
  private tracked: TrackedSprite[] = [];
  private focusTarget: Phaser.GameObjects.Sprite | null = null;

  private focusRadius = 60;
  private maxBlurRadius = 280;
  private maxStrength = 0.8;

  setFocusTarget(sprite: Phaser.GameObjects.Sprite): void {
    this.focusTarget = sprite;
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

  update(): void {
    if (!this.focusTarget) return;
    const fx = this.focusTarget.x;
    const fy = this.focusTarget.y;

    for (const entry of this.tracked) {
      const go = entry.go;
      if (!go.active) continue;

      const dx = go.x - fx;
      const dy = go.y - fy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= this.focusRadius) {
        if (entry.blur) {
          entry.blur.strength = 0;
        }
        continue;
      }

      const t = Math.min((dist - this.focusRadius) / (this.maxBlurRadius - this.focusRadius), 1);
      const strength = t * t * this.maxStrength;

      if (!entry.blur && go.preFX) {
        try {
          entry.blur = go.preFX.addBlur(0, 1, 1, strength, 0xffffff, 6) as unknown as BlurFX;
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
    this.focusTarget = null;
  }
}
