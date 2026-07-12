import type { EventBus } from '../core/EventBus';
import type { ConfigManager } from '../core/ConfigManager';

interface AmbientLayer {
  key: string;
  scene: string;
  baseVolume: number;
  sound: Phaser.Sound.BaseSound | null;
}

/**
 * Manages looping ambient audio layers per scene.
 * Crossfades between layers on scene transitions.
 * Falls back gracefully when audio files are missing.
 */
export class AmbientAudioSystem {
  private layers: AmbientLayer[] = [];
  private activeScene = '';
  private unsubEnter: (() => void) | null = null;
  private unsubFuel: (() => void) | null = null;
  private fuelRatio = 1;

  private static readonly LAYERS: Omit<AmbientLayer, 'sound'>[] = [
    { key: 'ambience/hut_room', scene: 'core:home', baseVolume: 0.3 },
    { key: 'ambience/corridor_hum', scene: 'core:cave', baseVolume: 0.4 },
    { key: 'ambience/electrical_drone', scene: 'core:cave', baseVolume: 0.2 },
  ];

  constructor(
    private phaserScene: Phaser.Scene,
    private eventBus: EventBus,
    private config: ConfigManager,
  ) {}

  create(): void {
    this.layers = AmbientAudioSystem.LAYERS.map((l) => ({ ...l, sound: null }));

    this.unsubEnter = this.eventBus.on('scene:enter', ({ sceneId }) => {
      this.crossfadeTo(sceneId);
    });

    this.unsubFuel = this.eventBus.on('lamp:fuel_changed', ({ ratio }) => {
      this.fuelRatio = ratio;
    });
  }

  update(): void {
    if (this.config.get<boolean>('audio', 'mute')) return;

    const masterVol = this.config.get<number>('audio', 'masterVolume');

    for (const layer of this.layers) {
      if (!layer.sound || !layer.sound.isPlaying) continue;

      let vol = layer.baseVolume * masterVol;

      // In caves, the drone intensifies as fuel drops
      if (layer.key === 'ambience/electrical_drone') {
        vol *= 0.5 + (1 - this.fuelRatio) * 1.5;
      }

      (layer.sound as Phaser.Sound.WebAudioSound).setVolume(vol);
    }
  }

  destroy(): void {
    this.unsubEnter?.();
    this.unsubFuel?.();
    for (const layer of this.layers) {
      layer.sound?.stop();
      layer.sound?.destroy();
    }
    this.layers = [];
  }

  private crossfadeTo(sceneId: string): void {
    this.activeScene = sceneId;

    for (const layer of this.layers) {
      const shouldPlay = layer.scene === sceneId;

      if (shouldPlay && !layer.sound) {
        this.tryStartLayer(layer);
      } else if (shouldPlay && layer.sound && !layer.sound.isPlaying) {
        this.tryStartLayer(layer);
      } else if (!shouldPlay && layer.sound?.isPlaying) {
        layer.sound.stop();
      }
    }
  }

  private tryStartLayer(layer: AmbientLayer): void {
    if (!this.phaserScene.cache.audio.exists(layer.key)) return;

    try {
      layer.sound = this.phaserScene.sound.add(layer.key, {
        loop: true,
        volume: layer.baseVolume * this.config.get<number>('audio', 'masterVolume'),
      });
      layer.sound.play();
    } catch {
      layer.sound = null;
    }
  }
}
