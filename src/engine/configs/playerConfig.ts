import type { ConfigSection } from '../core/ConfigManager';

/** Player tuning: sprite scale, movement feel (speed, accel, friction), pickup radius, body size. */
export const playerConfig: ConfigSection = {
  id: 'player',
  label: 'Player',
  fields: [
    {
      key: 'scale',
      label: 'Sprite Scale',
      type: 'number',
      min: 0.5,
      max: 4,
      step: 0.25,
      defaultValue: 1,
    },
    {
      key: 'maxSpeed',
      label: 'Max Speed',
      type: 'number',
      min: 20,
      max: 600,
      step: 10,
      defaultValue: 100,
    },
    {
      key: 'acceleration',
      label: 'Acceleration',
      type: 'number',
      min: 200,
      max: 6000,
      step: 100,
      defaultValue: 2000,
    },
    {
      key: 'friction',
      label: 'Friction',
      type: 'number',
      min: 200,
      max: 6000,
      step: 100,
      defaultValue: 1600,
    },
    {
      key: 'pickupRadius',
      label: 'Pickup Radius',
      type: 'number',
      min: 8,
      max: 200,
      step: 4,
      defaultValue: 32,
    },
    {
      key: 'bodyRadiusPercent',
      label: 'Body Radius %',
      type: 'number',
      min: 0.1,
      max: 1,
      step: 0.05,
      defaultValue: 0.35,
    },
  ],
};
