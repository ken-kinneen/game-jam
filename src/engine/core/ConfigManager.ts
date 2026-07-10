/**
 * Data-driven config system. Each config section is a schema of typed fields
 * with ranges and defaults. The DebugPanel auto-generates UI from these.
 * Adding a new config = one registerConfig() call with a field list.
 */

export type FieldType = 'number' | 'boolean' | 'choice';

interface BaseField {
  key: string;
  label: string;
}

export interface NumberField extends BaseField {
  type: 'number';
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

export interface BooleanField extends BaseField {
  type: 'boolean';
  defaultValue: boolean;
}

export interface ChoiceField extends BaseField {
  type: 'choice';
  options: { value: string; label: string }[];
  defaultValue: string;
}

export type ConfigField = NumberField | BooleanField | ChoiceField;

export interface ConfigSection {
  id: string;
  label: string;
  fields: ConfigField[];
}

type FieldValue = number | boolean | string;
type ChangeListener = (sectionId: string, key: string, value: FieldValue) => void;

/** Stores runtime-tunable config values and notifies listeners on change. */
export class ConfigManager {
  private sections = new Map<string, ConfigSection>();
  private values = new Map<string, Map<string, FieldValue>>();
  private listeners: ChangeListener[] = [];

  /** Register a config section. Initializes all fields to their defaults. */
  register(section: ConfigSection): void {
    this.sections.set(section.id, section);
    const vals = new Map<string, FieldValue>();
    for (const field of section.fields) {
      vals.set(field.key, field.defaultValue);
    }
    this.values.set(section.id, vals);
  }

  /** Get all registered sections (for the debug panel to iterate). */
  getSections(): ConfigSection[] {
    return Array.from(this.sections.values());
  }

  /** Get the current value of a config field. */
  get<T extends FieldValue = FieldValue>(sectionId: string, key: string): T {
    return (this.values.get(sectionId)?.get(key) ?? this.getDefault(sectionId, key)) as T;
  }

  /** Set a config field value and notify listeners. */
  set(sectionId: string, key: string, value: FieldValue): void {
    const vals = this.values.get(sectionId);
    if (!vals) return;

    const section = this.sections.get(sectionId);
    const field = section?.fields.find((f) => f.key === key);
    if (!field) return;

    if (field.type === 'number') {
      value = Math.min(field.max, Math.max(field.min, value as number));
    }

    vals.set(key, value);
    for (const listener of this.listeners) {
      listener(sectionId, key, value);
    }
  }

  /** Reset a section to its defaults. */
  reset(sectionId: string): void {
    const section = this.sections.get(sectionId);
    if (!section) return;
    for (const field of section.fields) {
      this.set(sectionId, field.key, field.defaultValue);
    }
  }

  /** Reset all sections to defaults. */
  resetAll(): void {
    for (const id of this.sections.keys()) {
      this.reset(id);
    }
  }

  /** Subscribe to value changes. Returns an unsubscribe function. */
  onChange(listener: ChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  private getDefault(sectionId: string, key: string): FieldValue {
    const section = this.sections.get(sectionId);
    const field = section?.fields.find((f) => f.key === key);
    if (!field) return 0;
    return field.defaultValue;
  }
}

/** Singleton config manager for the game. */
export const configManager = new ConfigManager();
