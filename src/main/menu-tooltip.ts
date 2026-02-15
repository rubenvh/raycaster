import { BrowserWindow, screen } from 'electron';
import tooltips, { MenuTooltip } from './menu-tooltips-data';

// Help window for geometry menu sections.
// Opens a proper window showing ASCII art descriptions of operations in a section.

export type HelpEntry = { key: string; accelerator?: string };

type ResolvedEntry = MenuTooltip & { accelerator?: string };

let helpWindow: BrowserWindow | null = null;

const HELP_WIDTH = 520;
const HELP_HEIGHT = 600;

/**
 * Show a help window for a group of operations.
 * @param entries - Keys into the tooltips data (with optional accelerators) to display
 * @param sectionTitle - Title for the help window
 */
export function showSectionHelp(entries: HelpEntry[], sectionTitle: string): void {
  const resolved: ResolvedEntry[] = [];
  for (const e of entries) {
    const tip = tooltips[e.key];
    if (tip) {
      resolved.push({ ...tip, accelerator: e.accelerator });
    }
  }

  if (resolved.length === 0) return;

  const point = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(point);
  const bounds = display.workArea;

  let x = Math.min(point.x + 20, bounds.x + bounds.width - HELP_WIDTH);
  let y = Math.min(point.y, bounds.y + bounds.height - HELP_HEIGHT);
  x = Math.max(x, bounds.x);
  y = Math.max(y, bounds.y);

  if (helpWindow && !helpWindow.isDestroyed()) {
    helpWindow.setBounds({ x, y, width: HELP_WIDTH, height: HELP_HEIGHT });
  } else {
    helpWindow = new BrowserWindow({
      width: HELP_WIDTH,
      height: HELP_HEIGHT,
      x, y,
      frame: true,
      resizable: true,
      minimizable: false,
      maximizable: false,
      skipTaskbar: false,
      alwaysOnTop: true,
      title: `Help: ${sectionTitle}`,
      backgroundColor: '#1e1e2e',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    helpWindow.on('closed', () => {
      helpWindow = null;
    });

    helpWindow.setMenuBarVisibility(false);
  }

  const html = buildHelpHtml(sectionTitle, resolved);
  helpWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  helpWindow.show();
  helpWindow.focus();
}

export function destroyHelpWindow(): void {
  if (helpWindow && !helpWindow.isDestroyed()) {
    helpWindow.destroy();
  }
  helpWindow = null;
}

function buildHelpHtml(sectionTitle: string, entries: ResolvedEntry[]): string {
  const items = entries.map(e => {
    const shortcut = e.accelerator
      ? `<span class="shortcut">${esc(e.accelerator)}</span>`
      : '';
    return `
    <div class="item">
      <div class="item-header">
        <span class="item-title">${esc(e.title)}</span>
        ${shortcut}
      </div>
      <div class="requires">Requires: ${esc(e.requiresDescription)}</div>
      <pre class="ascii">${esc(e.ascii)}</pre>
    </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Consolas', 'Courier New', monospace;
    background: #1e1e2e;
    color: #cdd6f4;
    padding: 16px;
    overflow-y: auto;
  }
  h1 {
    font-size: 14px;
    color: #89b4fa;
    margin-bottom: 12px;
    border-bottom: 1px solid #45475a;
    padding-bottom: 8px;
  }
  .item {
    margin-bottom: 16px;
    padding: 10px;
    background: #181825;
    border: 1px solid #313244;
    border-radius: 4px;
  }
  .item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }
  .item-title {
    font-size: 12px;
    font-weight: bold;
    color: #f5c2e7;
  }
  .shortcut {
    font-size: 10px;
    color: #a6e3a1;
    background: #313244;
    padding: 1px 6px;
    border-radius: 3px;
    border: 1px solid #45475a;
  }
  .requires {
    font-size: 10px;
    color: #6c7086;
    margin-bottom: 6px;
    font-style: italic;
  }
  .ascii {
    font-size: 10px;
    line-height: 1.3;
    color: #a6adc8;
    white-space: pre;
  }
</style>
</head>
<body>
  <h1>${esc(sectionTitle)}</h1>
  ${items}
</body>
</html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
