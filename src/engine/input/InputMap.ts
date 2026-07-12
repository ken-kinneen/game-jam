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

const DEFAULT_BINDINGS: Record<InputAction, string[]> = {
  move_up: ['KeyW'],
  move_down: ['KeyS'],
  move_left: ['KeyA'],
  move_right: ['KeyD'],
  aim_up: ['ArrowUp'],
  aim_down: ['ArrowDown'],
  aim_left: ['ArrowLeft'],
  aim_right: ['ArrowRight'],
  interact: ['KeyE'],
  pause: ['Escape'],
};

/** Reads physical keys and exposes logical action states (DOM keyboard). */
export class InputMap {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private codeToActions = new Map<string, InputAction[]>();
  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;

  constructor() {
    for (const [action, codes] of Object.entries(DEFAULT_BINDINGS)) {
      for (const code of codes) {
        const list = this.codeToActions.get(code) ?? [];
        list.push(action as InputAction);
        this.codeToActions.set(code, list);
      }
    }

    this.onKeyDown = (e: KeyboardEvent) => {
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    };
    this.onKeyUp = (e: KeyboardEvent) => {
      this.down.delete(e.code);
      this.pressed.delete(e.code);
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  /** Clear just-pressed flags at end of frame. */
  endFrame(): void {
    this.pressed.clear();
  }

  /** Whether an action's key is currently held down. */
  isDown(action: InputAction): boolean {
    const codes = DEFAULT_BINDINGS[action];
    return codes.some((c) => this.down.has(c));
  }

  /** Whether an action's key was just pressed this frame. */
  justPressed(action: InputAction): boolean {
    const codes = DEFAULT_BINDINGS[action];
    return codes.some((c) => this.pressed.has(c));
  }

  /** Get the normalized movement intent vector (WASD).
   * Y maps to Babylon Z; +Z is "screen up" under our isometric camera, so W is +.
   */
  getMoveVector(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.isDown('move_left')) x -= 1;
    if (this.isDown('move_right')) x += 1;
    if (this.isDown('move_up')) y += 1;
    if (this.isDown('move_down')) y -= 1;
    const len = Math.hypot(x, y);
    if (len > 0) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  /** Get the normalized aim intent vector (arrows). Matches move axes. */
  getAimVector(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.isDown('aim_left')) x -= 1;
    if (this.isDown('aim_right')) x += 1;
    if (this.isDown('aim_up')) y += 1;
    if (this.isDown('aim_down')) y -= 1;
    const len = Math.hypot(x, y);
    if (len > 0) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  /** Remove DOM listeners. */
  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}
