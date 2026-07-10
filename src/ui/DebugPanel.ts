import {
  type ConfigManager,
  type ConfigSection,
  type ConfigField,
  type NumberField,
  type BooleanField,
  type ChoiceField,
} from '../engine/core/ConfigManager';

const PANEL_ID = 'debug-panel';
const TOGGLE_KEY = 'Backquote';

/**
 * HTML overlay debug panel. Auto-generates sliders, toggles, and dropdowns
 * from any ConfigManager section. Adding a new config section = zero panel code.
 * Toggle with backtick (`).
 */
export class DebugPanel {
  private root: HTMLDivElement | null = null;
  private visible = true;
  private fieldElements = new Map<string, HTMLElement>();

  constructor(private config: ConfigManager) {}

  /** Create the DOM elements and keyboard listener. Call once after configs are registered. */
  mount(): void {
    if (document.getElementById(PANEL_ID)) return;

    this.root = document.createElement('div');
    this.root.id = PANEL_ID;
    Object.assign(this.root.style, {
      position: 'fixed',
      top: '0',
      right: '0',
      width: '300px',
      maxHeight: '100vh',
      overflowY: 'auto',
      background: 'rgba(0, 0, 0, 0.85)',
      color: '#eee',
      fontFamily: 'monospace',
      fontSize: '12px',
      padding: '12px',
      zIndex: '9999',
      display: 'block',
      borderLeft: '2px solid #555',
    } satisfies Partial<Record<keyof CSSStyleDeclaration, string>>);

    const title = document.createElement('div');
    Object.assign(title.style, {
      fontSize: '14px',
      fontWeight: 'bold',
      marginBottom: '10px',
      color: '#ff0',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    });
    title.textContent = 'Debug Panel';

    const resetAll = document.createElement('button');
    this.styleButton(resetAll, 'Reset All');
    resetAll.addEventListener('click', () => {
      this.config.resetAll();
      this.syncAllFields();
    });
    title.appendChild(resetAll);
    this.root.appendChild(title);

    for (const section of this.config.getSections()) {
      this.root.appendChild(this.buildSection(section));
    }

    document.body.appendChild(this.root);

    window.addEventListener('keydown', (e) => {
      if (e.code === TOGGLE_KEY) {
        this.toggle();
      }
    });

    this.config.onChange((_sectionId, _key, _value) => {
      this.syncAllFields();
    });
  }

  /** Show or hide the panel. */
  toggle(): void {
    this.visible = !this.visible;
    if (this.root) {
      this.root.style.display = this.visible ? 'block' : 'none';
    }
  }

  /** Rebuild the panel (e.g., if new configs are registered at runtime). */
  rebuild(): void {
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
    this.fieldElements.clear();
    this.mount();
  }

  private buildSection(section: ConfigSection): HTMLElement {
    const container = document.createElement('div');
    container.style.marginBottom = '14px';

    const header = document.createElement('div');
    Object.assign(header.style, {
      fontSize: '13px',
      fontWeight: 'bold',
      marginBottom: '6px',
      paddingBottom: '4px',
      borderBottom: '1px solid #444',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    });

    const label = document.createElement('span');
    label.textContent = section.label;
    header.appendChild(label);

    const resetBtn = document.createElement('button');
    this.styleButton(resetBtn, 'Reset');
    resetBtn.addEventListener('click', () => {
      this.config.reset(section.id);
      this.syncAllFields();
    });
    header.appendChild(resetBtn);
    container.appendChild(header);

    for (const field of section.fields) {
      container.appendChild(this.buildField(section.id, field));
    }

    return container;
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
    const row = this.createRow(field.label);
    const fieldKey = `${sectionId}.${field.key}`;

    const valueLabel = document.createElement('span');
    valueLabel.style.minWidth = '40px';
    valueLabel.style.textAlign = 'right';
    valueLabel.textContent = String(this.config.get(sectionId, field.key));

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(field.min);
    slider.max = String(field.max);
    slider.step = String(field.step);
    slider.value = String(this.config.get(sectionId, field.key));
    Object.assign(slider.style, { flex: '1', margin: '0 8px', accentColor: '#ff0' });

    slider.addEventListener('input', () => {
      const val = parseFloat(slider.value);
      this.config.set(sectionId, field.key, val);
      valueLabel.textContent = String(val);
    });

    this.fieldElements.set(fieldKey, slider);

    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.alignItems = 'center';
    controls.appendChild(slider);
    controls.appendChild(valueLabel);
    row.appendChild(controls);

    return row;
  }

  private buildBooleanField(sectionId: string, field: BooleanField): HTMLElement {
    const row = this.createRow(field.label);
    const fieldKey = `${sectionId}.${field.key}`;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = this.config.get<boolean>(sectionId, field.key);
    checkbox.style.accentColor = '#ff0';

    checkbox.addEventListener('change', () => {
      this.config.set(sectionId, field.key, checkbox.checked);
    });

    this.fieldElements.set(fieldKey, checkbox);
    row.appendChild(checkbox);

    return row;
  }

  private buildChoiceField(sectionId: string, field: ChoiceField): HTMLElement {
    const row = this.createRow(field.label);
    const fieldKey = `${sectionId}.${field.key}`;

    const select = document.createElement('select');
    Object.assign(select.style, {
      background: '#222',
      color: '#eee',
      border: '1px solid #555',
      padding: '2px 4px',
      fontFamily: 'monospace',
      fontSize: '11px',
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

    this.fieldElements.set(fieldKey, select);
    row.appendChild(select);

    return row;
  }

  private createRow(label: string): HTMLElement {
    const row = document.createElement('div');
    row.style.marginBottom = '6px';

    const lbl = document.createElement('div');
    lbl.style.color = '#aaa';
    lbl.style.marginBottom = '2px';
    lbl.textContent = label;
    row.appendChild(lbl);

    return row;
  }

  private styleButton(btn: HTMLButtonElement, text: string): void {
    btn.textContent = text;
    Object.assign(btn.style, {
      background: '#333',
      color: '#ccc',
      border: '1px solid #555',
      padding: '2px 8px',
      fontFamily: 'monospace',
      fontSize: '10px',
      cursor: 'pointer',
      borderRadius: '3px',
    });
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
          const valueLabel = el.parentElement?.querySelector('span');
          if (valueLabel && el.type === 'range') {
            valueLabel.textContent = String(val);
          }
        } else if (el instanceof HTMLSelectElement) {
          el.value = String(val);
        }
      }
    }
  }
}
