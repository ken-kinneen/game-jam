import { eventBus } from '../core/EventBus';
import { inventoryManager } from '../core/InventoryManager';
import { registry } from '../core/ContentRegistry';

/** DOM HUD overlay: fuel bar (caves), trash count, status + interact prompt. */
export class HudOverlay {
  private root: HTMLDivElement;
  private fuelWrap: HTMLDivElement;
  private fuelFill: HTMLDivElement;
  private trashEl: HTMLDivElement;
  private promptEl: HTMLDivElement;
  private statusEl: HTMLDivElement;
  private displayedFuel = 1;
  private currentFuel = 1;
  private isCave = false;
  private unsubs: (() => void)[] = [];

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'hud-overlay';
    this.root.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:20;font-family:monospace;color:#eee;';

    this.fuelWrap = el(
      'div',
      'position:absolute;top:16px;left:16px;width:180px;height:14px;background:#222;border:1px solid #555;border-radius:4px;overflow:hidden;display:none;',
    );
    this.fuelFill = el(
      'div',
      'height:100%;width:100%;background:#d4a017;transition:width 0.05s linear;',
    );
    this.fuelWrap.appendChild(this.fuelFill);

    this.trashEl = el('div', 'position:absolute;top:16px;right:16px;font-size:16px;');
    this.promptEl = el(
      'div',
      'position:absolute;bottom:48px;left:50%;transform:translateX(-50%);font-size:18px;padding:8px 14px;background:rgba(0,0,0,0.55);border-radius:6px;display:none;',
    );
    this.statusEl = el(
      'div',
      'position:absolute;bottom:96px;left:50%;transform:translateX(-50%);font-size:14px;opacity:0;transition:opacity 0.3s;',
    );

    this.root.append(this.fuelWrap, this.trashEl, this.promptEl, this.statusEl);
    document.body.appendChild(this.root);

    this.bind();
    this.refreshTrash();
  }

  /** Show HUD for a scene (cave vs home styling). */
  show(sceneId: string): void {
    const def = registry.get('scene', sceneId);
    this.isCave = def?.kind === 'cave';
    this.fuelWrap.style.display = this.isCave ? 'block' : 'none';
  }

  /** Set bottom interact prompt text, or hide when null. */
  setPrompt(text: string | null): void {
    if (!text) {
      this.promptEl.style.display = 'none';
      return;
    }
    this.promptEl.textContent = text;
    this.promptEl.style.display = 'block';
  }

  /** Lerp fuel bar each frame. */
  update(): void {
    this.displayedFuel += (this.currentFuel - this.displayedFuel) * 0.1;
    this.fuelFill.style.width = `${Math.max(0, Math.min(1, this.displayedFuel)) * 100}%`;
    const r = this.displayedFuel;
    this.fuelFill.style.background = r > 0.5 ? '#d4a017' : r > 0.2 ? '#e07020' : '#cc3030';
    if (r <= 0.2) {
      const flicker = 0.65 + 0.35 * Math.sin(performance.now() * 0.008);
      this.fuelFill.style.opacity = String(flicker);
    } else {
      this.fuelFill.style.opacity = '1';
    }
  }

  private bind(): void {
    this.unsubs = [
      eventBus.on('item:picked_up', () => this.refreshTrash()),
      eventBus.on('inventory:changed', () => this.refreshTrash()),
      eventBus.on('lamp:fuel_changed', ({ ratio }) => {
        this.currentFuel = ratio;
      }),
      eventBus.on('lamp:refueled', () => this.flashStatus('Fuel refilled')),
      eventBus.on('lamp:extinguished', () => this.flashStatus('Lamp out!')),
      eventBus.on('inventory:full', () => this.flashStatus('Inventory full')),
      eventBus.on('scene:enter', ({ sceneId }) => this.show(sceneId)),
    ];
  }

  private refreshTrash(): void {
    this.trashEl.textContent = `Trash: ${inventoryManager.totalCount()}`;
  }

  private flashStatus(msg: string): void {
    this.statusEl.textContent = msg;
    this.statusEl.style.opacity = '1';
    setTimeout(() => {
      this.statusEl.style.opacity = '0';
    }, 1600);
  }
}

function el(tag: string, css: string): HTMLDivElement {
  const n = document.createElement(tag) as HTMLDivElement;
  n.style.cssText = css;
  return n;
}
