import { eventBus } from '../core/EventBus';
import { registry } from '../core/ContentRegistry';
import { inventoryManager } from '../core/InventoryManager';
import type { UpgradeDef } from '../schemas/upgrade.schema';
import type { ItemDef } from '../schemas/item.schema';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import type { StatSheet } from '../stats/StatSheet';
import { ensureShopStyles } from './shopStyles';
import { ShopCharacterPreview } from './ShopCharacterPreview';

const STAT_LABELS: Record<string, string> = {
  moveSpeed: 'Move Speed',
  pickupRadius: 'Pickup Radius',
  maxHealth: 'Max Health',
  damage: 'Damage',
  attackSpeed: 'Attack Speed',
  carryCapacity: 'Carry Capacity',
  luck: 'Luck',
  glowRadius: 'Lamp Radius',
  fuelBurnRate: 'Fuel Burn',
};

const SIDEBAR_STATS = [
  'moveSpeed',
  'pickupRadius',
  'carryCapacity',
  'glowRadius',
  'fuelBurnRate',
  'luck',
] as const;

/** Letter / mark when an upgrade has no sprite art. */
const UPGRADE_GLYPHS: Record<string, string> = {
  'core:quick_feet': 'QF',
  'core:bright_lamp': 'BL',
  'core:deep_pockets': 'DP',
  'core:fuel_efficiency': 'FE',
  'core:lamp_blue': 'LB',
  'core:lamp_purple': 'LP',
  'core:lamp_orange': 'LO',
};

/** DOM shop overlay — rustic scrapyard upgrade counter. */
export class ShopOverlay {
  private root: HTMLDivElement;
  private openFlag = false;
  private upgradeSystem = new UpgradeSystem(eventBus);
  private unsubs: (() => void)[] = [];
  private preview: ShopCharacterPreview | null = null;

  constructor(private getPlayerStats: () => StatSheet) {
    ensureShopStyles();
    this.root = document.createElement('div');
    this.root.className = 'shop-root';
    document.body.appendChild(this.root);

    window.addEventListener('keydown', (e) => {
      if (!this.openFlag) return;
      if (e.code === 'Escape' || e.code === 'KeyE') this.close();
    });
  }

  /** Open the shop panel. */
  open(): void {
    if (this.openFlag) return;
    this.openFlag = true;
    eventBus.emit('shop:opened', {});
    this.root.classList.add('is-open');
    this.render();
    this.unsubs = [
      eventBus.on('upgrade:acquired', () => this.render()),
      eventBus.on('inventory:changed', () => this.render()),
    ];
  }

  /** Close the shop panel. */
  close(): void {
    if (!this.openFlag) return;
    this.openFlag = false;
    this.root.classList.remove('is-open');
    this.preview?.dispose();
    this.preview = null;
    this.root.replaceChildren();
    for (const u of this.unsubs) u();
    this.unsubs = [];
    eventBus.emit('shop:closed', {});
  }

  private render(): void {
    this.preview?.dispose();
    this.preview = null;

    const upgrades = registry.getAll('upgrade') as UpgradeDef[];
    const stats = this.getPlayerStats();

    const cards = upgrades.map((upg) => this.renderCard(upg)).join('');
    const statLines = SIDEBAR_STATS.map((s) => {
      try {
        return `<div class="shop-stat"><span>${STAT_LABELS[s]}</span><span>${formatStat(s, stats.get(s))}</span></div>`;
      } catch {
        return '';
      }
    }).join('');

    const invChips = this.renderInventoryChips();

    this.root.innerHTML = `
      <div class="shop-shell">
        <aside class="shop-side">
          <div>
            <p class="shop-brand">TRASHED</p>
            <h1 class="shop-title">Scrap Counter</h1>
          </div>
          <div class="shop-char" id="shop-char">
            <span class="shop-char-label">You</span>
          </div>
          <div class="shop-stats">${statLines}</div>
          <div class="shop-inv">
            <div class="shop-inv-title">Your scrap</div>
            <div class="shop-inv-row">${invChips}</div>
          </div>
        </aside>
        <section class="shop-main">
          <div class="shop-header">
            <div>
              <h2>Upgrades</h2>
              <p>Trade junk for gear. Better lamps, quicker feet, deeper pockets — whatever keeps you alive down there.</p>
            </div>
            <button type="button" class="shop-close" id="shop-close">Close · E</button>
          </div>
          <div class="shop-grid">${cards}</div>
        </section>
      </div>`;

    this.root.querySelector('#shop-close')?.addEventListener('click', () => this.close());
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

    const charHost = this.root.querySelector('#shop-char') as HTMLElement | null;
    if (charHost) {
      this.preview = new ShopCharacterPreview();
      void this.preview.mount(charHost);
    }
  }

  private renderCard(upg: UpgradeDef): string {
    const owned = this.upgradeSystem.hasUpgrade(upg.id);
    const can = this.upgradeSystem.canAcquire(upg) && inventoryManager.canAfford(upg.cost);
    const locked = !owned && !this.upgradeSystem.canAcquire(upg);
    const disabled = owned || locked || !can;

    const status = owned ? 'owned' : locked ? 'locked' : can ? 'buy' : 'broke';
    const statusLabel =
      status === 'owned'
        ? 'Owned'
        : status === 'locked'
          ? 'Locked'
          : status === 'buy'
            ? 'Buy'
            : 'Need scrap';

    const effects = upg.effects
      .map((e) =>
        e.kind === 'stat'
          ? `${STAT_LABELS[e.stat] ?? e.stat} ${formatEffect(e.mod, e.value)}`
          : (e.description ?? e.behavior),
      )
      .join(' · ');

    const desc =
      upg.description ??
      upg.effects.find(
        (e): e is Extract<typeof e, { kind: 'behavior' }> =>
          e.kind === 'behavior' && !!e.description,
      )?.description ??
      effects;

    const icon = this.renderUpgradeIcon(upg);
    const cost = Object.entries(upg.cost)
      .map(([id, n]) => {
        const item = registry.get('item', id) as ItemDef | undefined;
        const src = itemSpriteUrl(item);
        const name = item?.name ?? id.split(':')[1] ?? id;
        return `<span class="shop-cost-item" title="${escapeHtml(name)}">${
          src ? `<img src="${src}" alt="" />` : ''
        }${n}</span>`;
      })
      .join('');

    const cls = ['shop-card', owned ? 'is-owned' : '', locked ? 'is-locked' : '']
      .filter(Boolean)
      .join(' ');

    return `<button type="button" class="${cls}" data-id="${upg.id}" ${disabled ? 'disabled' : ''}>
      <div class="shop-card-top">
        <div class="shop-icon">${icon}</div>
        <div class="shop-card-meta">
          <p class="shop-card-name">${escapeHtml(upg.name)}</p>
          <span class="shop-rarity ${upg.rarity}">${upg.rarity}</span>
        </div>
      </div>
      <p class="shop-card-desc">${escapeHtml(desc)}</p>
      <div class="shop-card-effects">${escapeHtml(effects)}</div>
      <div class="shop-card-foot">
        <div class="shop-cost">${cost || '—'}</div>
        <span class="shop-status ${status}">${statusLabel}</span>
      </div>
    </button>`;
  }

  private renderUpgradeIcon(upg: UpgradeDef): string {
    if (upg.sprite && upg.sprite !== 'placeholder') {
      const url = `/mods/core/assets/${spriteFile(upg.sprite)}`;
      return `<img src="${url}" alt="" />`;
    }
    // Prefer first cost item art as the badge
    const firstCostId = Object.keys(upg.cost)[0];
    if (firstCostId) {
      const item = registry.get('item', firstCostId) as ItemDef | undefined;
      const src = itemSpriteUrl(item);
      if (src) return `<img src="${src}" alt="" />`;
    }
    const glyph = UPGRADE_GLYPHS[upg.id] ?? '✦';
    return `<span class="shop-icon-fallback" aria-hidden="true">${glyph}</span>`;
  }

  private renderInventoryChips(): string {
    const items = registry.getAll('item') as ItemDef[];
    const chips = items
      .map((item) => {
        const qty = inventoryManager.count(item.id);
        if (qty <= 0) return '';
        const src = itemSpriteUrl(item);
        return `<span class="shop-chip">${
          src ? `<img src="${src}" alt="" />` : ''
        }<span>${escapeHtml(item.name)} ×${qty}</span></span>`;
      })
      .filter(Boolean)
      .join('');
    return chips || `<span class="shop-chip">Empty pockets</span>`;
  }
}

function formatStat(stat: string, value: number): string {
  if (stat === 'fuelBurnRate') return `${(value * 100).toFixed(0)}%`;
  if (stat === 'moveSpeed' || stat === 'pickupRadius' || stat === 'glowRadius') {
    return value.toFixed(0);
  }
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

function formatEffect(mod: string, value: number): string {
  if (mod === 'flat') return value >= 0 ? `+${value}` : `${value}`;
  if (mod === 'increased')
    return value >= 0 ? `+${Math.round(value * 100)}%` : `${Math.round(value * 100)}%`;
  return `×${(1 + value).toFixed(2)}`;
}

function itemSpriteUrl(item: ItemDef | undefined): string | null {
  if (!item || !item.sprite || item.sprite === 'placeholder') return null;
  return `/mods/core/assets/${spriteFile(item.sprite)}`;
}

/** Map manifest key like items/rusty_can → sprites/items/rusty_can.png */
function spriteFile(key: string): string {
  if (key.includes('.')) return key.startsWith('sprites/') ? key : `sprites/${key}`;
  // Manifest keys are usually "items/foo" → file sprites/items/foo.png
  if (key.startsWith('items/')) return `sprites/${key}.png`;
  if (key.startsWith('tilesets/')) return `sprites/${key}.png`;
  return `sprites/${key}.png`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
