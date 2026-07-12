import { eventBus } from '../core/EventBus';
import { configManager } from '../core/ConfigManager';

interface QuickButton {
  label: string;
  action: () => void;
}

/** Bottom-left debug quick-action buttons. Toggled via dev.showDebugButtons config. */
export class DebugButtons {
  private root: HTMLDivElement;
  private unsub: (() => void) | null = null;

  constructor() {
    this.root = document.createElement('div');
    this.root.style.cssText =
      'position:fixed;bottom:16px;left:16px;display:flex;flex-direction:column;gap:6px;z-index:30;';

    const buttons: QuickButton[] = [
      {
        label: 'Home',
        action: () => eventBus.emit('debug:request_transition', { sceneId: 'core:home' }),
      },
      {
        label: 'Cave',
        action: () => eventBus.emit('debug:request_transition', { sceneId: 'core:cave' }),
      },
      {
        label: 'Shop',
        action: () => eventBus.emit('debug:request_transition', { sceneId: 'core:shop' }),
      },
    ];

    for (const btn of buttons) {
      const el = document.createElement('button');
      el.textContent = btn.label;
      el.style.cssText =
        'pointer-events:auto;padding:4px 12px;font:12px monospace;background:rgba(0,0,0,0.6);' +
        'color:#ccc;border:1px solid #555;border-radius:4px;cursor:pointer;';
      el.addEventListener('mouseenter', () => {
        el.style.background = 'rgba(60,60,60,0.8)';
      });
      el.addEventListener('mouseleave', () => {
        el.style.background = 'rgba(0,0,0,0.6)';
      });
      el.addEventListener('click', btn.action);
      this.root.appendChild(el);
    }

    document.body.appendChild(this.root);
    this.applyVisibility();

    this.unsub = configManager.onChange((section, key) => {
      if (section === 'dev' && key === 'showDebugButtons') this.applyVisibility();
    });
  }

  private applyVisibility(): void {
    const show = configManager.get<boolean>('dev', 'showDebugButtons');
    this.root.style.display = show ? 'flex' : 'none';
  }

  dispose(): void {
    this.unsub?.();
    this.root.remove();
  }
}
