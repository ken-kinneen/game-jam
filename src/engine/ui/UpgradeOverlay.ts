import { eventBus } from '../core/EventBus';
import { registry } from '../core/ContentRegistry';
import { inventoryManager } from '../core/InventoryManager';
import type { UpgradeDef } from '../schemas/upgrade.schema';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import type { StatSheet } from '../stats/StatSheet';

/** DOM upgrade menu (alternate full-screen shop for upgrade action props). */
export class UpgradeOverlay {
  private root: HTMLDivElement;
  private openFlag = false;
  private upgradeSystem = new UpgradeSystem(eventBus);
  private unsubs: (() => void)[] = [];

  constructor(private getPlayerStats: () => StatSheet) {
    this.root = document.createElement('div');
    this.root.style.cssText =
      'position:fixed;inset:0;z-index:40;display:none;background:rgba(0,0,0,0.8);font-family:monospace;color:#eee;';
    document.body.appendChild(this.root);

    window.addEventListener('keydown', (e) => {
      if (!this.openFlag) return;
      if (e.code === 'Escape' || e.code === 'KeyE') this.close();
    });
  }

  /** Open the upgrade menu. */
  open(): void {
    if (this.openFlag) return;
    this.openFlag = true;
    eventBus.emit('shop:opened', {});
    this.root.style.display = 'block';
    this.render();
    this.unsubs = [
      eventBus.on('upgrade:acquired', () => this.render()),
      eventBus.on('inventory:changed', () => this.render()),
    ];
  }

  /** Close the upgrade menu. */
  close(): void {
    if (!this.openFlag) return;
    this.openFlag = false;
    this.root.style.display = 'none';
    for (const u of this.unsubs) u();
    this.unsubs = [];
    eventBus.emit('shop:closed', {});
  }

  private render(): void {
    const upgrades = registry.getAll('upgrade') as UpgradeDef[];
    const list = upgrades
      .map((upg) => {
        const owned = this.upgradeSystem.hasUpgrade(upg.id);
        const can = this.upgradeSystem.canAcquire(upg) && inventoryManager.canAfford(upg.cost);
        return `<div style="padding:10px;border-bottom:1px solid #333;display:flex;justify-content:space-between;gap:12px;">
          <div><b>${upg.name}</b><div style="opacity:0.75;font-size:12px;">${upg.rarity}</div></div>
          <button data-id="${upg.id}" ${owned || !can ? 'disabled' : ''} style="cursor:pointer;padding:6px 10px;">
            ${owned ? 'Owned' : 'Buy'}
          </button>
        </div>`;
      })
      .join('');

    this.root.innerHTML = `
      <div style="position:absolute;inset:8%;background:#121218;border:2px solid #555;border-radius:10px;padding:16px;overflow:auto;pointer-events:auto;">
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
          <h2 style="margin:0;">Upgrades</h2>
          <button id="upg-close" style="padding:8px 14px;cursor:pointer;">Close</button>
        </div>
        ${list}
      </div>`;

    this.root.querySelector('#upg-close')?.addEventListener('click', () => this.close());
    this.root.querySelectorAll('button[data-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.id!;
        const upg = upgrades.find((u) => u.id === id);
        if (!upg) return;
        if (!inventoryManager.spend(upg.cost)) return;
        this.upgradeSystem.acquire(upg, this.getPlayerStats());
        this.render();
      });
    });
  }
}
