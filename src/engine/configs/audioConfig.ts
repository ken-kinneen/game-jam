import type { ConfigSection } from '../core/ConfigManager';

/** Audio tuning: master volume. Add music/sfx channels later. */
export const audioConfig: ConfigSection = {
  id: 'audio',
  label: 'Audio',
  fields: [
    {
      key: 'masterVolume',
      label: 'Master Volume',
      type: 'number',
      min: 0,
      max: 1,
      step: 0.05,
      defaultValue: 1,
    },
    {
      key: 'mute',
      label: 'Mute',
      type: 'boolean',
      defaultValue: false,
    },
  ],
};
