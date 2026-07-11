import type { ConfigSection } from '../core/ConfigManager';

/** Dev-only tuning: starting scene, debug toggles. */
export const devConfig: ConfigSection = {
  id: 'dev',
  label: 'Dev',
  fields: [
    {
      key: 'startScene',
      label: 'Start Scene',
      type: 'choice',
      options: [
        { value: 'core:home', label: 'Home' },
        { value: 'core:cave', label: 'Cave' },
        { value: 'core:shop', label: 'Shop' },
        { value: 'core:demo', label: 'FX Demo' },
      ],
      defaultValue: 'core:cave',
    },
  ],
};
