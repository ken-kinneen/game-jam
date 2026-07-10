import type { EventBus, GameEvents } from '../core/EventBus';
import type { ConfigManager } from '../core/ConfigManager';
import type { ContentRegistry } from '../core/ContentRegistry';
import type { SoundDef } from '../schemas/sound.schema';

interface ActiveBinding {
  unsub: () => void;
}

/**
 * Plays sound effects in response to EventBus events.
 * All sounds are defined as data in mods (SoundDef JSON), never hardcoded.
 */
export class SoundSystem {
  private bindings: ActiveBinding[] = [];
  private lastPlayedAt = new Map<string, number>();
  private unsubConfig: (() => void) | null = null;

  constructor(
    private scene: Phaser.Scene,
    private eventBus: EventBus,
    private config: ConfigManager,
    private registry: ContentRegistry,
  ) {
    this.bindAll();
    this.unsubConfig = this.config.onChange((sectionId) => {
      if (sectionId === 'audio') this.applyVolume();
    });
  }

  /** Tear down all subscriptions. Call on scene shutdown. */
  destroy(): void {
    for (const b of this.bindings) b.unsub();
    this.bindings = [];
    this.unsubConfig?.();
    this.lastPlayedAt.clear();
  }

  /** Play a sound by its def ID. Returns false if on cooldown or missing. */
  play(soundId: string): boolean {
    const def = this.registry.get('sound', soundId) as SoundDef | undefined;
    if (!def) return false;
    return this.playDef(def);
  }

  private bindAll(): void {
    const defs = this.registry.getAll('sound') as SoundDef[];
    for (const def of defs) {
      for (const trigger of def.triggers) {
        const eventName = trigger.event as keyof GameEvents;
        const filter = trigger.filter;

        const unsub = this.eventBus.on(eventName, (data: unknown) => {
          if (filter && !this.matchesFilter(data, filter)) return;
          this.playDef(def);
        });

        this.bindings.push({ unsub });
      }
    }
  }

  private playDef(def: SoundDef): boolean {
    const now = Date.now();
    const last = this.lastPlayedAt.get(def.id) ?? 0;
    if (def.cooldown > 0 && now - last < def.cooldown) return false;

    const muted = this.config.get<boolean>('audio', 'mute');
    if (muted) return false;

    const masterVol = this.config.get<number>('audio', 'masterVolume');
    const sfxVol = this.config.get<number>('audio', 'sfxVolume');
    const finalVol = def.volume * masterVol * sfxVol;

    const [minRate, maxRate] = def.pitchRange;
    const rate = minRate + Math.random() * (maxRate - minRate);

    try {
      this.scene.sound.play(def.asset, {
        volume: finalVol,
        rate,
      });
    } catch {
      return false;
    }

    this.lastPlayedAt.set(def.id, now);
    return true;
  }

  private matchesFilter(data: unknown, filter: Record<string, string | number | boolean>): boolean {
    if (typeof data !== 'object' || data === null) return false;
    const obj = data as Record<string, unknown>;
    for (const [key, expected] of Object.entries(filter)) {
      if (obj[key] !== expected) return false;
    }
    return true;
  }

  private applyVolume(): void {
    if (this.scene.sound) {
      this.scene.sound.volume = this.config.get<number>('audio', 'masterVolume');
      this.scene.sound.mute = this.config.get<boolean>('audio', 'mute');
    }
  }
}
