import type { ConfigSection } from '../core/ConfigManager';

/** Camera tuning: zoom, follow lerp, deadzone. */
export const cameraConfig: ConfigSection = {
  id: 'camera',
  label: 'Camera',
  fields: [
    {
      key: 'zoom',
      label: 'Zoom',
      type: 'number',
      min: 1,
      max: 8,
      step: 0.25,
      defaultValue: 1.5,
    },
    {
      key: 'lerpX',
      label: 'Follow Lerp X',
      type: 'number',
      min: 0.01,
      max: 1,
      step: 0.01,
      defaultValue: 0.1,
    },
    {
      key: 'lerpY',
      label: 'Follow Lerp Y',
      type: 'number',
      min: 0.01,
      max: 1,
      step: 0.01,
      defaultValue: 0.1,
    },
    {
      key: 'deadzoneWidth',
      label: 'Deadzone Width',
      type: 'number',
      min: 0,
      max: 200,
      step: 4,
      defaultValue: 0,
    },
    {
      key: 'deadzoneHeight',
      label: 'Deadzone Height',
      type: 'number',
      min: 0,
      max: 200,
      step: 4,
      defaultValue: 0,
    },
    {
      key: 'roundPixels',
      label: 'Round Pixels',
      type: 'boolean',
      defaultValue: true,
    },
  ],
};
