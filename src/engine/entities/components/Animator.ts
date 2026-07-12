/** Runtime animation state for an entity with a directional walk cycle. */
export class Animator {
  direction: 'down' | 'up' | 'side' = 'down';
  facingRight = true;
  currentAnimKey: string | null = null;

  // Procedural overlay state
  prevSpeed = 0;
  baseScaleX = 1;
  baseScaleY = 1;
  squashX = 1;
  squashY = 1;
  leanAngle = 0;

  // Idle breathing
  breathPhase = 0;

  // Walk bob
  bobPhase = 0;
  bobOffsetY = 0;

  // Stop settle (damped spring on walk→idle)
  settleVelocity = 0;
  settleOffsetY = 0;
  wasMoving = false;

  // Applied Y offset from last frame (undone before next apply)
  appliedOffsetY = 0;

  constructor(public animIdPrefix: string) {}
}
