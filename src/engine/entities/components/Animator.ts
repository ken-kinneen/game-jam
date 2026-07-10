/** Runtime animation state for an entity with a directional walk cycle. */
export class Animator {
  direction: 'down' | 'up' | 'side' = 'down';
  facingRight = true; // only meaningful for 'side' — mirrored via sprite.setFlipX
  currentAnimKey: string | null = null;

  constructor(public animIdPrefix: string) {}
}
