/** Typed publish/subscribe event bus — ALL cross-system communication goes through here. */
export interface GameEvents {
  'item:picked_up': { entityId: string; itemId: string; qty: number };
  'entity:died': { entityId: string; defId: string; killerId?: string };
  'entity:spawned': { entityId: string; defId: string };
  'player:damaged': { amount: number; sourceId: string };
  'player:healed': { amount: number };
  'upgrade:acquired': { upgradeId: string };
  'scene:enter': { sceneId: string };
  'scene:exit': { sceneId: string };
  'craft:completed': { recipeId: string };
  'inventory:changed': { entityId: string };
  'inventory:full': { entityId: string; itemId: string };
  'stat:changed': { entityId: string; stat: string; value: number };
  'lamp:fuel_changed': { fuel: number; maxFuel: number; ratio: number };
  'lamp:refueled': { amount: number; fuel: number };
  'lamp:extinguished': Record<string, never>;
  'exit:nearby': { exitTo: string; label: string };
  'exit:left': Record<string, never>;
  'upgrade:available': { upgradeIds: string[] };
  'shop:opened': Record<string, never>;
  'shop:closed': Record<string, never>;
  'lamp:color_changed': { color: string };
  'lamp:fuel_critical': { ratio: number };
  'player:footstep': Record<string, never>;
  'wire:spark': { x: number; y: number };
  'relay:nearby': { relayId: string; distance: number };
  'relay:reset': { relayId: string };
  'transformer:activated': Record<string, never>;
  'item:interact': { itemId: string };
}

type EventCallback<T> = (data: T) => void;

export class EventBus {
  private listeners = new Map<string, Set<EventCallback<unknown>>>();

  /** Subscribe to a typed game event. Returns an unsubscribe function. */
  on<K extends keyof GameEvents>(event: K, callback: EventCallback<GameEvents[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const cbs = this.listeners.get(event)!;
    cbs.add(callback as EventCallback<unknown>);

    return () => {
      cbs.delete(callback as EventCallback<unknown>);
    };
  }

  /** Emit a typed game event to all listeners. */
  emit<K extends keyof GameEvents>(event: K, data: GameEvents[K]): void {
    const cbs = this.listeners.get(event);
    if (!cbs) return;
    for (const cb of cbs) {
      cb(data);
    }
  }

  /** Subscribe to an event, auto-unsubscribe after first fire. */
  once<K extends keyof GameEvents>(event: K, callback: EventCallback<GameEvents[K]>): () => void {
    const unsub = this.on(event, (data) => {
      unsub();
      callback(data);
    });
    return unsub;
  }

  /** Remove all listeners, useful for scene teardown. */
  clear(): void {
    this.listeners.clear();
  }

  /** Create a subscription group that can be bulk-unsubscribed (e.g., per-scene). */
  createGroup(): EventGroup {
    return new EventGroup(this);
  }
}

/** A group of event subscriptions that can be torn down together. */
export class EventGroup {
  private subscriptions: (() => void)[] = [];

  constructor(private bus: EventBus) {}

  on<K extends keyof GameEvents>(event: K, callback: EventCallback<GameEvents[K]>): void {
    this.subscriptions.push(this.bus.on(event, callback));
  }

  /** Remove all subscriptions in this group. */
  clear(): void {
    for (const unsub of this.subscriptions) {
      unsub();
    }
    this.subscriptions = [];
  }
}

/** Singleton event bus for the game. */
export const eventBus = new EventBus();
