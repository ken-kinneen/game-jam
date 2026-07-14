export interface QuestPoweredLightConfig {
  position: { x: number; y: number };
  poweredByQuest: string;
  radius: number;
  color: number;
  intensity: number;
}

/**
 * Casts overhead environmental light after the required quest is complete.
 *
 * Future home-base lighting hook:
 * - Transformer progress becomes complete only after every transformer is activated AND the
 *   player successfully exits the cave. ZoneManager persists that cave scene ID as a completed
 *   quest before returning the player home.
 * - When a scene is created, GameScene passes its `poweredLights` entries here. A light appears
 *   only when ProgressionManager already contains the entry's `poweredByQuest` ID.
 * - To restore powered home lighting later, add `poweredLights` to `mods/core/scenes/home.json`
 *   with `poweredByQuest: "core:tunnel_1"`. No home lights are configured at present.
 */
export class QuestLightSystem {
  private static readonly GLOW_TEXTURE = '__quest_overhead_glow';

  private readonly lights: Phaser.GameObjects.Light[] = [];
  private readonly glows: Phaser.GameObjects.Image[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly configs: readonly QuestPoweredLightConfig[],
    private readonly isQuestComplete: (questId: string) => boolean,
  ) {}

  create(): void {
    for (const config of this.configs) {
      if (!this.isQuestComplete(config.poweredByQuest)) continue;

      this.scene.lights.enable();
      this.lights.push(
        this.scene.lights.addLight(
          config.position.x,
          config.position.y,
          config.radius,
          config.color,
          config.intensity,
        ),
      );
      this.glows.push(this.createOverheadGlow(config));
    }
  }

  destroy(): void {
    for (const glow of this.glows) glow.destroy();
    for (const light of this.lights) this.scene.lights.removeLight(light);
    this.glows.length = 0;
    this.lights.length = 0;
  }

  /** Adds a soft pool above the darkness overlay without drawing a physical fixture. */
  private createOverheadGlow(config: QuestPoweredLightConfig): Phaser.GameObjects.Image {
    this.ensureGlowTexture();

    const glow = this.scene.add.image(
      config.position.x,
      config.position.y,
      QuestLightSystem.GLOW_TEXTURE,
    );
    glow.setDisplaySize(config.radius * 2, config.radius * 2);
    glow.setTint(config.color);
    glow.setAlpha(Phaser.Math.Clamp(config.intensity / 1.5, 0.3, 0.75));
    glow.setBlendMode(Phaser.BlendModes.ADD);
    glow.setDepth(801);
    return glow;
  }

  private ensureGlowTexture(): void {
    if (this.scene.textures.exists(QuestLightSystem.GLOW_TEXTURE)) return;

    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) return;

    const half = size / 2;
    const gradient = context.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, 'rgba(255,255,255,0.3)');
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.18)');
    gradient.addColorStop(0.75, 'rgba(255,255,255,0.05)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    this.scene.textures.addCanvas(QuestLightSystem.GLOW_TEXTURE, canvas);
  }
}
