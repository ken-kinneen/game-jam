let injected = false;

export function ensureShopStyles(): void {
  if (injected) return;
  injected = true;

  const fonts = document.createElement('link');
  fonts.rel = 'stylesheet';
  fonts.href =
    'https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap';
  document.head.appendChild(fonts);

  const style = document.createElement('style');
  style.id = 'trashed-shop-styles';
  style.textContent = SHOP_CSS;
  document.head.appendChild(style);
}

const SHOP_CSS = `
.shop-root {
  --ink: #f2e8d5;
  --ink-dim: #b8a890;
  --panel: #1c1612;
  --panel-2: #261e18;
  --edge: #5c4634;
  --brass: #d4a84b;
  --rust: #c45c2a;
  --moss: #6a8f5a;
  --danger: #c44;
  --shadow: rgba(0,0,0,0.55);
  position: fixed;
  inset: 0;
  z-index: 40;
  display: none;
  font-family: "DM Sans", system-ui, sans-serif;
  color: var(--ink);
  background:
    radial-gradient(ellipse 80% 60% at 50% 20%, rgba(212,168,75,0.08), transparent 55%),
    radial-gradient(ellipse 70% 50% at 80% 90%, rgba(196,92,42,0.12), transparent 50%),
    rgba(8,6,5,0.82);
  backdrop-filter: blur(4px);
}

.shop-root.is-open { display: flex; align-items: center; justify-content: center; padding: 24px; }

.shop-shell {
  width: min(1100px, 96vw);
  height: min(720px, 92vh);
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 0;
  background:
    linear-gradient(165deg, #2a221c 0%, var(--panel) 40%, #14100e 100%);
  border: 1px solid var(--edge);
  box-shadow:
    0 0 0 1px rgba(212,168,75,0.15),
    0 24px 64px var(--shadow),
    inset 0 1px 0 rgba(255,255,255,0.04);
  overflow: hidden;
  position: relative;
}

.shop-shell::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.07;
  background-image: url("/mods/core/assets/sprites/tilesets/shop_floor.png");
  background-size: 180px;
  image-rendering: pixelated;
  mix-blend-mode: overlay;
}

.shop-side {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px 18px;
  border-right: 1px solid var(--edge);
  background: linear-gradient(180deg, rgba(38,30,24,0.95), rgba(20,16,12,0.98));
}

.shop-main {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 18px 20px 20px;
}

.shop-brand {
  font-family: Syne, sans-serif;
  font-weight: 800;
  font-size: 13px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--brass);
  margin: 0 0 4px;
}

.shop-title {
  font-family: Syne, sans-serif;
  font-weight: 700;
  font-size: 28px;
  margin: 0 0 12px;
  line-height: 1.1;
}

.shop-char {
  position: relative;
  height: 200px;
  border: 1px solid var(--edge);
  background:
    radial-gradient(circle at 50% 70%, rgba(212,168,75,0.18), transparent 55%),
    #0e0b09;
  overflow: hidden;
}

.shop-char-fallback {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
  padding: 12px;
  filter: drop-shadow(0 8px 16px rgba(0,0,0,0.5));
}

.shop-char-label {
  position: absolute;
  left: 8px;
  bottom: 6px;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-dim);
  background: rgba(0,0,0,0.45);
  padding: 2px 6px;
}

.shop-stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.shop-stat {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  padding: 6px 8px;
  background: rgba(0,0,0,0.25);
  border-left: 2px solid var(--edge);
}

.shop-stat span:last-child {
  color: var(--brass);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.shop-inv {
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid var(--edge);
}

.shop-inv-title {
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ink-dim);
  margin-bottom: 8px;
}

.shop-inv-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.shop-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px 4px 4px;
  background: rgba(0,0,0,0.35);
  border: 1px solid var(--edge);
  font-size: 12px;
}

.shop-chip img {
  width: 22px;
  height: 22px;
  image-rendering: pixelated;
  object-fit: contain;
}

.shop-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.shop-header h2 {
  font-family: Syne, sans-serif;
  font-size: 22px;
  font-weight: 700;
  margin: 0;
}

.shop-header p {
  margin: 4px 0 0;
  color: var(--ink-dim);
  font-size: 13px;
  max-width: 42ch;
}

.shop-close {
  appearance: none;
  border: 1px solid var(--edge);
  background: var(--panel-2);
  color: var(--ink);
  font-family: Syne, sans-serif;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 10px 14px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.shop-close:hover {
  border-color: var(--brass);
  color: var(--brass);
}

.shop-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
  overflow: auto;
  padding-right: 4px;
  flex: 1;
}

.shop-card {
  appearance: none;
  text-align: left;
  border: 1px solid var(--edge);
  background: linear-gradient(160deg, #2c241e, #1a1511);
  color: inherit;
  padding: 0;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  min-height: 168px;
  transition: transform 0.12s ease, border-color 0.12s, box-shadow 0.12s;
  font: inherit;
}
.shop-card:not(:disabled):hover {
  transform: translateY(-2px);
  border-color: var(--brass);
  box-shadow: 0 10px 28px rgba(0,0,0,0.35);
}
.shop-card:disabled {
  cursor: default;
  opacity: 0.72;
}
.shop-card.is-owned {
  border-color: var(--moss);
  background: linear-gradient(160deg, #1e2a1c, #141a12);
}
.shop-card.is-locked {
  opacity: 0.5;
  filter: grayscale(0.35);
}

.shop-card-top {
  display: flex;
  gap: 12px;
  padding: 12px 12px 8px;
}

.shop-icon {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  background: #0e0b09;
  border: 1px solid var(--edge);
  image-rendering: pixelated;
}
.shop-icon img {
  width: 40px;
  height: 40px;
  object-fit: contain;
  image-rendering: pixelated;
}
.shop-icon-fallback {
  font-family: Syne, sans-serif;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--brass);
  line-height: 1;
}

.shop-card-meta { min-width: 0; flex: 1; }
.shop-card-name {
  font-family: Syne, sans-serif;
  font-weight: 700;
  font-size: 15px;
  margin: 0 0 4px;
}
.shop-rarity {
  display: inline-block;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 2px 6px;
  border: 1px solid currentColor;
}
.shop-rarity.common { color: #9a9a9a; }
.shop-rarity.uncommon { color: var(--moss); }
.shop-rarity.rare { color: #5b8dd9; }
.shop-rarity.legendary { color: var(--brass); }

.shop-card-desc {
  padding: 0 12px 8px;
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--ink-dim);
}

.shop-card-effects {
  padding: 0 12px 10px;
  font-size: 11px;
  color: #cfc3ae;
}

.shop-card-foot {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--edge);
  background: rgba(0,0,0,0.28);
}

.shop-cost {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.shop-cost-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
}
.shop-cost-item img {
  width: 18px;
  height: 18px;
  image-rendering: pixelated;
}

.shop-status {
  font-family: Syne, sans-serif;
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--brass);
}
.shop-status.owned { color: var(--moss); }
.shop-status.locked, .shop-status.broke { color: var(--rust); }
`;
