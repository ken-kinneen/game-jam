/** Movement state for an entity — velocity model with accel/friction for Isaac-style feel. */
export class Movement {
  velocityX = 0;
  velocityY = 0;

  constructor(
    public maxSpeed: number,
    public acceleration: number = 2000,
    public friction: number = 1600,
  ) {}
}
