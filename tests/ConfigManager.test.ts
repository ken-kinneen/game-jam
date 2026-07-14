import { describe, it, expect, vi } from 'vitest';
import { ConfigManager, type ConfigSection } from '../src/engine/core/ConfigManager';

const testSection: ConfigSection = {
  id: 'test',
  label: 'Test Config',
  fields: [
    { key: 'speed', label: 'Speed', type: 'number', min: 0, max: 500, step: 10, defaultValue: 200 },
    { key: 'enabled', label: 'Enabled', type: 'boolean', defaultValue: true },
    {
      key: 'mode',
      label: 'Mode',
      type: 'choice',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
      defaultValue: 'a',
    },
  ],
};

describe('ConfigManager', () => {
  it('initializes fields to defaults on register', () => {
    const mgr = new ConfigManager();
    mgr.register(testSection);
    expect(mgr.get('test', 'speed')).toBe(200);
    expect(mgr.get('test', 'enabled')).toBe(true);
    expect(mgr.get('test', 'mode')).toBe('a');
  });

  it('set updates value and clamps numbers', () => {
    const mgr = new ConfigManager();
    mgr.register(testSection);
    mgr.set('test', 'speed', 999);
    expect(mgr.get('test', 'speed')).toBe(500);

    mgr.set('test', 'speed', -10);
    expect(mgr.get('test', 'speed')).toBe(0);
  });

  it('resets unknown choice values to the field default', () => {
    const mgr = new ConfigManager();
    mgr.register(testSection);
    mgr.set('test', 'mode', 'removed_option');
    expect(mgr.get('test', 'mode')).toBe('a');
  });

  it('notifies listeners on change', () => {
    const mgr = new ConfigManager();
    mgr.register(testSection);
    const listener = vi.fn();
    mgr.onChange(listener);

    mgr.set('test', 'speed', 100);
    expect(listener).toHaveBeenCalledWith('test', 'speed', 100);
  });

  it('unsubscribe stops notifications', () => {
    const mgr = new ConfigManager();
    mgr.register(testSection);
    const listener = vi.fn();
    const unsub = mgr.onChange(listener);

    mgr.set('test', 'speed', 100);
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    mgr.set('test', 'speed', 150);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reset restores section to defaults', () => {
    const mgr = new ConfigManager();
    mgr.register(testSection);
    mgr.set('test', 'speed', 42);
    mgr.set('test', 'enabled', false);
    mgr.reset('test');
    expect(mgr.get('test', 'speed')).toBe(200);
    expect(mgr.get('test', 'enabled')).toBe(true);
  });

  it('getSections returns all registered sections', () => {
    const mgr = new ConfigManager();
    mgr.register(testSection);
    mgr.register({ id: 'other', label: 'Other', fields: [] });
    expect(mgr.getSections()).toHaveLength(2);
  });
});
