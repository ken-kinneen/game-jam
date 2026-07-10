/** Action-based input mapping: systems read actions, not key codes. */
export type InputAction =
  | 'move_up'
  | 'move_down'
  | 'move_left'
  | 'move_right'
  | 'aim_up'
  | 'aim_down'
  | 'aim_left'
  | 'aim_right'
  | 'interact'
  | 'pause';

const DEFAULT_BINDINGS: Record<InputAction, number[]> = {
  move_up: [Phaser.Input.Keyboard.KeyCodes.W],
  move_down: [Phaser.Input.Keyboard.KeyCodes.S],
  move_left: [Phaser.Input.Keyboard.KeyCodes.A],
  move_right: [Phaser.Input.Keyboard.KeyCodes.D],
  aim_up: [Phaser.Input.Keyboard.KeyCodes.UP],
  aim_down: [Phaser.Input.Keyboard.KeyCodes.DOWN],
  aim_left: [Phaser.Input.Keyboard.KeyCodes.LEFT],
  aim_right: [Phaser.Input.Keyboard.KeyCodes.RIGHT],
  interact: [Phaser.Input.Keyboard.KeyCodes.E],
  pause: [Phaser.Input.Keyboard.KeyCodes.ESC],
};

/** Reads physical keys and exposes logical action states. */
export class InputMap {
  private keys = new Map<InputAction, Phaser.Input.Keyboard.Key[]>();

  constructor(private scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard!;
    for (const [action, codes] of Object.entries(DEFAULT_BINDINGS)) {
      this.keys.set(
        action as InputAction,
        codes.map((code) => keyboard.addKey(code)),
      );
    }
  }

  /** Whether an action's key is currently held down. */
  isDown(action: InputAction): boolean {
    return this.keys.get(action)?.some((k) => k.isDown) ?? false;
  }

  /** Whether an action's key was just pressed this frame. */
  justPressed(action: InputAction): boolean {
    return (
      this.keys.get(action)?.some((k) => Phaser.Input.Keyboard.JustDown(k)) ?? false
    );
  }

  /** Get the normalized movement intent vector (WASD). */
  getMoveVector(): Phaser.Math.Vector2 {
    let x = 0;
    let y = 0;
    if (this.isDown('move_left')) x -= 1;
    if (this.isDown('move_right')) x += 1;
    if (this.isDown('move_up')) y -= 1;
    if (this.isDown('move_down')) y += 1;

    const vec = new Phaser.Math.Vector2(x, y);
    if (vec.length() > 0) vec.normalize();
    return vec;
  }

  /** Get the normalized aim intent vector (arrows). */
  getAimVector(): Phaser.Math.Vector2 {
    let x = 0;
    let y = 0;
    if (this.isDown('aim_left')) x -= 1;
    if (this.isDown('aim_right')) x += 1;
    if (this.isDown('aim_up')) y -= 1;
    if (this.isDown('aim_down')) y += 1;

    const vec = new Phaser.Math.Vector2(x, y);
    if (vec.length() > 0) vec.normalize();
    return vec;
  }
}
