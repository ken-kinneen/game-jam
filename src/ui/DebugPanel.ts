import {
  type ConfigManager,
  type ConfigSection,
  type ConfigField,
  type NumberField,
  type BooleanField,
  type ChoiceField,
} from '../engine/core/ConfigManager';

const PANEL_ID = 'debug-panel';
const TOGGLE_BTN_ID = 'debug-toggle';
const TOGGLE_KEY = 'Backquote';

/**
 * HTML overlay debug panel. Auto-generates sliders, toggles, and dropdowns
 * from any ConfigManager section. Sections are individually collapsible.
 * Toggle entire panel with backtick (`) or the floating icon.
 */
export class DebugPanel {
  private root: HTMLDivElement | null = null;
  private toggleBtn: HTMLButtonElement | null = null;
  private visible = false;
  private fieldElements = new Map<string, HTMLElement>();
  private sectionBodies = new Map<string, HTMLElement>();
  private sectionCollapsed = new Map<string, boolean>();
  private sectionArrows = new Map<string, HTMLSpanElement>();

  constructor(private config: ConfigManager) {}

  /** Create the DOM elements and keyboard listener. Call once after configs are registered. */
  mount(): void {
    if (document.getElementById(PANEL_ID)) return;

    this.createToggleButton();
    this.createPanel();

    window.addEventListener('keydown', (e) => {
      if (e.code === TOGGLE_KEY) this.toggle();
    });

    this.config.onChange(() => this.syncAllFields());
  }

  /** Show or hide the panel. */
  toggle(): void {
    this.visible = !this.visible;
    if (this.root) this.root.style.display = this.visible ? 'flex' : 'none';
    if (this.toggleBtn) this.toggleBtn.style.display = this.visible ? 'none' : 'flex';
  }

  /** Rebuild the panel (e.g., if new configs are registered at runtime). */
  rebuild(): void {
    this.root?.remove();
    this.toggleBtn?.remove();
    this.root = null;
    this.toggleBtn = null;
    this.fieldElements.clear();
    this.sectionBodies.clear();
    this.mount();
  }

  private createToggleButton(): void {
    this.toggleBtn = document.createElement('button');
    this.toggleBtn.id = TOGGLE_BTN_ID;
    this.toggleBtn.innerHTML = '\u2699';
    Object.assign(this.toggleBtn.style, {
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      width: '36px',
      height: '36px',
      borderRadius: '8px',
      border: '2px solid #555',
      background: 'rgba(0,0,0,0.7)',
      color: '#ff0',
      fontSize: '20px',
      cursor: 'pointer',
      zIndex: '10000',
      display: this.visible ? 'none' : 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      lineHeight: '1',
      padding: '0',
    });
    this.toggleBtn.title = 'Open Debug Panel (`)';
    this.toggleBtn.addEventListener('click', () => this.toggle());
    document.body.appendChild(this.toggleBtn);
  }

  private createPanel(): void {
    this.root = document.createElement('div');
    this.root.id = PANEL_ID;
    Object.assign(this.root.style, {
      position: 'fixed',
      top: '0',
      right: '0',
      width: '280px',
      maxHeight: '100vh',
      overflowY: 'auto',
      background: 'rgba(10, 10, 15, 0.9)',
      color: '#ddd',
      fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif',
      fontSize: '11px',
      padding: '0',
      zIndex: '9999',
      display: this.visible ? 'flex' : 'none',
      flexDirection: 'column',
      borderLeft: '1px solid #333',
      backdropFilter: 'blur(8px)',
    });

    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 12px',
      borderBottom: '1px solid #333',
      flexShrink: '0',
    });

    const titleSpan = document.createElement('span');
    titleSpan.textContent = 'Debug';
    Object.assign(titleSpan.style, {
      fontSize: '12px',
      fontWeight: '600',
      color: '#ff0',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
    });
    header.appendChild(titleSpan);

    const headerBtns = document.createElement('div');
    headerBtns.style.display = 'flex';
    headerBtns.style.gap = '6px';

    const resetAll = this.makeBtn('Reset All', () => {
      this.config.resetAll();
      this.syncAllFields();
    });
    headerBtns.appendChild(resetAll);

    const closeBtn = this.makeBtn('\u2715', () => this.toggle());
    closeBtn.style.fontSize = '13px';
    closeBtn.style.padding = '2px 6px';
    headerBtns.appendChild(closeBtn);

    header.appendChild(headerBtns);
    this.root.appendChild(header);

    const body = document.createElement('div');
    Object.assign(body.style, {
      overflowY: 'auto',
      flex: '1',
      padding: '4px 0',
    });

    for (const section of this.config.getSections()) {
      body.appendChild(this.buildSection(section));
    }

    this.root.appendChild(body);
    document.body.appendChild(this.root);
  }

  private buildSection(section: ConfigSection): HTMLElement {
    const container = document.createElement('div');
    container.style.borderBottom = '1px solid #222';

    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '6px 12px',
      cursor: 'pointer',
      userSelect: 'none',
      transition: 'background 0.15s',
    });
    header.addEventListener(
      'mouseenter',
      () => (header.style.background = 'rgba(255,255,255,0.04)'),
    );
    header.addEventListener('mouseleave', () => (header.style.background = 'none'));

    const leftSide = document.createElement('div');
    leftSide.style.display = 'flex';
    leftSide.style.alignItems = 'center';
    leftSide.style.gap = '6px';

    const arrow = document.createElement('span');
    arrow.textContent = '\u25BC';
    Object.assign(arrow.style, { fontSize: '8px', color: '#888', transition: 'transform 0.2s' });
    this.sectionArrows.set(section.id, arrow);
    leftSide.appendChild(arrow);

    const label = document.createElement('span');
    label.textContent = section.label;
    Object.assign(label.style, { fontSize: '11px', fontWeight: '600', color: '#ccc' });
    leftSide.appendChild(label);

    header.appendChild(leftSide);

    const resetBtn = this.makeBtn('Reset', () => {
      this.config.reset(section.id);
      this.syncAllFields();
    });
    resetBtn.addEventListener('click', (e) => e.stopPropagation());
    header.appendChild(resetBtn);

    header.addEventListener('click', () => this.toggleSection(section.id));
    container.appendChild(header);

    const sectionBody = document.createElement('div');
    Object.assign(sectionBody.style, {
      padding: '0 12px 8px 12px',
      overflow: 'hidden',
      transition: 'max-height 0.2s ease, opacity 0.2s ease',
      maxHeight: '500px',
      opacity: '1',
    });

    for (const field of section.fields) {
      sectionBody.appendChild(this.buildField(section.id, field));
    }

    this.sectionBodies.set(section.id, sectionBody);
    this.sectionCollapsed.set(section.id, false);
    container.appendChild(sectionBody);

    return container;
  }

  private toggleSection(sectionId: string): void {
    const collapsed = !this.sectionCollapsed.get(sectionId);
    this.sectionCollapsed.set(sectionId, collapsed);

    const body = this.sectionBodies.get(sectionId);
    const arrow = this.sectionArrows.get(sectionId);

    if (body) {
      body.style.maxHeight = collapsed ? '0' : '500px';
      body.style.opacity = collapsed ? '0' : '1';
      body.style.paddingBottom = collapsed ? '0' : '8px';
    }
    if (arrow) {
      arrow.style.transform = collapsed ? 'rotate(-90deg)' : 'rotate(0)';
    }
  }

  private buildField(sectionId: string, field: ConfigField): HTMLElement {
    switch (field.type) {
      case 'number':
        return this.buildNumberField(sectionId, field);
      case 'boolean':
        return this.buildBooleanField(sectionId, field);
      case 'choice':
        return this.buildChoiceField(sectionId, field);
    }
  }

  private buildNumberField(sectionId: string, field: NumberField): HTMLElement {
    const row = document.createElement('div');
    row.style.marginBottom = '5px';

    const labelRow = document.createElement('div');
    Object.assign(labelRow.style, {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '2px',
    });

    const lbl = document.createElement('span');
    lbl.textContent = field.label;
    lbl.style.color = '#999';
    labelRow.appendChild(lbl);

    const valueLabel = document.createElement('span');
    valueLabel.style.color = '#ff0';
    valueLabel.style.fontWeight = '600';
    valueLabel.textContent = String(this.config.get(sectionId, field.key));
    labelRow.appendChild(valueLabel);

    row.appendChild(labelRow);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(field.min);
    slider.max = String(field.max);
    slider.step = String(field.step);
    slider.value = String(this.config.get(sectionId, field.key));
    Object.assign(slider.style, {
      width: '100%',
      height: '4px',
      accentColor: '#ff0',
      cursor: 'pointer',
    });

    slider.addEventListener('input', () => {
      const val = parseFloat(slider.value);
      this.config.set(sectionId, field.key, val);
      valueLabel.textContent = String(val);
    });

    const fieldKey = `${sectionId}.${field.key}`;
    this.fieldElements.set(fieldKey, slider);

    row.appendChild(slider);
    return row;
  }

  private buildBooleanField(sectionId: string, field: BooleanField): HTMLElement {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '5px',
    });

    const lbl = document.createElement('span');
    lbl.textContent = field.label;
    lbl.style.color = '#999';
    row.appendChild(lbl);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = this.config.get<boolean>(sectionId, field.key);
    Object.assign(checkbox.style, { accentColor: '#ff0', cursor: 'pointer' });

    checkbox.addEventListener('change', () => {
      this.config.set(sectionId, field.key, checkbox.checked);
    });

    const fieldKey = `${sectionId}.${field.key}`;
    this.fieldElements.set(fieldKey, checkbox);
    row.appendChild(checkbox);

    return row;
  }

  private buildChoiceField(sectionId: string, field: ChoiceField): HTMLElement {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '5px',
    });

    const lbl = document.createElement('span');
    lbl.textContent = field.label;
    lbl.style.color = '#999';
    row.appendChild(lbl);

    const select = document.createElement('select');
    Object.assign(select.style, {
      background: '#1a1a1a',
      color: '#eee',
      border: '1px solid #444',
      padding: '2px 6px',
      borderRadius: '3px',
      fontFamily: 'inherit',
      fontSize: '11px',
      cursor: 'pointer',
    });

    for (const opt of field.options) {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      select.appendChild(option);
    }
    select.value = this.config.get<string>(sectionId, field.key);

    select.addEventListener('change', () => {
      this.config.set(sectionId, field.key, select.value);
    });

    const fieldKey = `${sectionId}.${field.key}`;
    this.fieldElements.set(fieldKey, select);
    row.appendChild(select);

    return row;
  }

  private makeBtn(text: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    Object.assign(btn.style, {
      background: 'rgba(255,255,255,0.06)',
      color: '#aaa',
      border: '1px solid #444',
      padding: '2px 8px',
      fontFamily: 'inherit',
      fontSize: '10px',
      cursor: 'pointer',
      borderRadius: '4px',
      transition: 'background 0.15s, color 0.15s',
    });
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(255,255,255,0.12)';
      btn.style.color = '#eee';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(255,255,255,0.06)';
      btn.style.color = '#aaa';
    });
    btn.addEventListener('click', onClick);
    return btn;
  }

  private syncAllFields(): void {
    for (const section of this.config.getSections()) {
      for (const field of section.fields) {
        const key = `${section.id}.${field.key}`;
        const el = this.fieldElements.get(key);
        if (!el) continue;

        const val = this.config.get(section.id, field.key);
        if (el instanceof HTMLInputElement) {
          if (el.type === 'checkbox') {
            el.checked = val as boolean;
          } else {
            el.value = String(val);
          }
          const valueSpan = el.closest('div')?.querySelector('span:last-child');
          if (valueSpan && el.type === 'range') {
            valueSpan.textContent = String(val);
          }
        } else if (el instanceof HTMLSelectElement) {
          el.value = String(val);
        }
      }
    }
  }
}
