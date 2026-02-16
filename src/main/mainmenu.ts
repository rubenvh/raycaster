import { importTexture, openFile, saveFile } from './dialogs';
import { dialog, Menu, BrowserWindow } from 'electron';
import getIcons from './menu-icons';
import tooltips, { SelectionType } from './menu-tooltips-data';
import { showSectionHelp, HelpEntry } from './menu-tooltip';

// Helper to safely cast BaseWindow to BrowserWindow for menu click handlers
const asBrowserWindow = (win: Electron.BaseWindow | undefined): BrowserWindow | undefined =>
  win as BrowserWindow | undefined;

// Selection state received from renderer
export type SelectionState = {
  kind: 'none' | 'polygon' | 'polygons' | 'edge' | 'vertex' | 'vertices' | 'mixed';
  count: number;
};

const NO_SELECTION: SelectionState = { kind: 'none', count: 0 };

/**
 * Check whether a menu item should be enabled given the current selection state.
 * The `requires` field from tooltip data defines what selection is needed.
 */
function isEnabled(requires: SelectionType, sel: SelectionState): boolean {
  switch (requires) {
    case 'none': return true; // Always available
    case 'any': return sel.kind !== 'none';
    case 'polygon': return sel.kind === 'polygon' || sel.kind === 'polygons';
    case 'polygons': return sel.kind === 'polygons';
    case 'edge': return sel.kind === 'edge';
    case 'vertex': return sel.kind === 'vertex' || sel.kind === 'vertices';
    case 'vertices': return sel.kind === 'vertices';
    default: return true;
  }
}

/**
 * Create a geometry menu item that sends an IPC message on click.
 */
function geoItem(
  label: string,
  channel: string,
  tooltipKey: string,
  sel: SelectionState,
  opts?: {
    accelerator?: string;
    data?: unknown;
    iconKey?: string;
  }
): Electron.MenuItemConstructorOptions {
  const icons = getIcons();
  const tip = tooltips[tooltipKey];
  const iconKey = opts?.iconKey ?? tooltipKey;
  const icon = icons[iconKey];
  const requires = tip?.requires ?? 'any';

  return {
    label,
    accelerator: opts?.accelerator,
    icon: icon || undefined,
    enabled: isEnabled(requires, sel),
    click: (_, focusedWindow) => {
      const win = asBrowserWindow(focusedWindow);
      if (win) {
        if (opts?.data !== undefined) {
          win.webContents.send(channel, opts.data);
        } else {
          win.webContents.send(channel);
        }
      }
    }
  };
}

/**
 * Create a "Help..." menu item that opens a help window for a section.
 */
function helpItem(sectionTitle: string, entries: HelpEntry[]): Electron.MenuItemConstructorOptions {
  return {
    label: 'Help...',
    click: () => {
      showSectionHelp(entries, sectionTitle);
    }
  };
}

/**
 * Build the full application menu template.
 * Called every time selection state changes to update enabled/disabled states.
 */
export function buildMenu(sel: SelectionState = NO_SELECTION): Electron.Menu {
  // Tooltip key groups for each submenu's Help item (with accelerators)
  const polygonKeys: HelpEntry[] = [
    { key: 'createPolygon', accelerator: 'Ctrl+Space' },
    { key: 'clonePolygon', accelerator: 'Ctrl+D' },
    { key: 'expandPolygon', accelerator: 'Ctrl+E' },
    { key: 'splitPolygon', accelerator: 'Ctrl+Shift+P' },
    { key: 'rotatePolygon', accelerator: 'Ctrl+Shift+R' },
    { key: 'reversePolygon', accelerator: 'Ctrl+Alt+R' },
  ];
  const transformKeys: HelpEntry[] = [
    { key: 'flipH', accelerator: 'Ctrl+Alt+H' },
    { key: 'flipV', accelerator: 'Ctrl+Alt+V' },
    { key: 'scaleUp', accelerator: 'Ctrl+Alt+=' },
    { key: 'scaleDown', accelerator: 'Ctrl+Alt+-' },
    { key: 'regularize', accelerator: 'Ctrl+Alt+G' },
    { key: 'convexHull', accelerator: 'Ctrl+Alt+C' },
    { key: 'insetPolygon', accelerator: 'Ctrl+Alt+I' },
    { key: 'mergePolygons', accelerator: 'Ctrl+Alt+M' },
    { key: 'generatePolygon', accelerator: 'Ctrl+Alt+Space' },
  ];
  const alignKeys: HelpEntry[] = [
    { key: 'alignTop' },
    { key: 'alignBottom' },
    { key: 'alignLeft' },
    { key: 'alignRight' },
    { key: 'alignCenterH' },
    { key: 'alignCenterV' },
  ];
  const edgeKeys: HelpEntry[] = [
    { key: 'splitEdge', accelerator: 'Ctrl+Shift+E' },
    { key: 'subdivideEdge', accelerator: 'Ctrl+Alt+S' },
    { key: 'insetEdge', accelerator: 'Ctrl+Alt+E' },
    { key: 'immaterial', accelerator: 'Ctrl+I' },
    { key: 'texture', accelerator: 'Ctrl+T' },
  ];
  const vertexKeys: HelpEntry[] = [
    { key: 'bevelVertex', accelerator: 'Ctrl+Alt+B' },
    { key: 'alignVerticesH' },
    { key: 'alignVerticesV' },
    { key: 'weldVertices', accelerator: 'Ctrl+Alt+W' },
  ];

  const template: (Electron.MenuItemConstructorOptions | Electron.MenuItem)[] = [
    // ==================== World ====================
    {
      label: 'World',
      role: 'fileMenu',
      submenu: [
        {
          label: 'New',
          accelerator: 'CommandOrControl+Shift+N',
          click: (_, focusedWindow) => { const win = asBrowserWindow(focusedWindow); if (win) win.webContents.send('newFile'); }
        },
        {
          label: 'Open',
          accelerator: 'CommandOrControl+Shift+O',
          click: (_, focusedWindow) => { const win = asBrowserWindow(focusedWindow); if (win) openFile(dialog, win); }
        },
        {
          label: 'Save',
          accelerator: 'CommandOrControl+S',
          click: (_, focusedWindow) => { const win = asBrowserWindow(focusedWindow); if (win) win.webContents.send('saveFile'); }
        },
        {
          label: 'Save as',
          accelerator: 'CommandOrControl+Shift+S',
          click: (_, focusedWindow) => { const win = asBrowserWindow(focusedWindow); if (win) saveFile(dialog, win); }
        }
      ]
    },

    // ==================== Textures ====================
    {
      label: 'Textures',
      submenu: [
        {
          label: 'Import',
          click: (_, focusedWindow) => { const win = asBrowserWindow(focusedWindow); if (win) importTexture(dialog, win); }
        },
        {
          label: 'Library',
          enabled: false,
        },
      ]
    },

    // ==================== Geometry ====================
    {
      label: 'Geometry',
      submenu: [
        // --- Polygon submenu ---
        {
          label: 'Polygon',
          submenu: [
            geoItem('Create', 'geometry_polygon_create', 'createPolygon', sel, { accelerator: 'Control+Space' }),
            geoItem('Clone', 'geometry_polygon_clone', 'clonePolygon', sel, { accelerator: 'Control+D' }),
            geoItem('Expand', 'geometry_polygon_expand', 'expandPolygon', sel, { accelerator: 'Control+E' }),
            geoItem('Split', 'geometry_polygon_split', 'splitPolygon', sel, { accelerator: 'Control+Shift+P' }),
            geoItem('Rotate', 'geometry_polygon_rotate', 'rotatePolygon', sel, { accelerator: 'Control+Shift+R' }),
            geoItem('Reverse winding', 'geometry_polygon_reverse', 'reversePolygon', sel, { accelerator: 'Control+Alt+R' }),
            { type: 'separator' },
            helpItem('Polygon Operations', polygonKeys),
          ]
        },

        // --- Transform submenu ---
        {
          label: 'Transform',
          submenu: [
            geoItem('Flip horizontal', 'geometry_polygon_flip_h', 'flipH', sel, { accelerator: 'Control+Alt+H' }),
            geoItem('Flip vertical', 'geometry_polygon_flip_v', 'flipV', sel, { accelerator: 'Control+Alt+V' }),
            { type: 'separator' },
            geoItem('Scale up (10%)', 'geometry_polygon_scale_up', 'scaleUp', sel, { accelerator: 'Control+Alt+=' }),
            geoItem('Scale down (10%)', 'geometry_polygon_scale_down', 'scaleDown', sel, { accelerator: 'Control+Alt+-' }),
            { type: 'separator' },
            geoItem('Regularize', 'geometry_polygon_regularize', 'regularize', sel, { accelerator: 'Control+Alt+G' }),
            geoItem('Convex hull', 'geometry_polygon_convex_hull', 'convexHull', sel, { accelerator: 'Control+Alt+C' }),
            geoItem('Inset', 'geometry_polygon_inset', 'insetPolygon', sel, { accelerator: 'Control+Alt+I' }),
            geoItem('Merge', 'geometry_polygon_merge', 'mergePolygons', sel, { accelerator: 'Control+Alt+M' }),
            { type: 'separator' },
            geoItem('Generate regular polygon', 'geometry_polygon_generate', 'generatePolygon', sel, { accelerator: 'Control+Alt+Space' }),
            { type: 'separator' },
            helpItem('Transform Operations', transformKeys),
          ]
        },

        // --- Align submenu ---
        {
          label: 'Align',
          submenu: [
            geoItem('Align top', 'geometry_polygon_align_top', 'alignTop', sel),
            geoItem('Align bottom', 'geometry_polygon_align_bottom', 'alignBottom', sel),
            geoItem('Align left', 'geometry_polygon_align_left', 'alignLeft', sel),
            geoItem('Align right', 'geometry_polygon_align_right', 'alignRight', sel),
            { type: 'separator' },
            geoItem('Center horizontally', 'geometry_polygon_align_center_h', 'alignCenterH', sel),
            geoItem('Center vertically', 'geometry_polygon_align_center_v', 'alignCenterV', sel),
            { type: 'separator' },
            helpItem('Alignment Operations', alignKeys),
          ]
        },

        { type: 'separator' },

        // --- Edge submenu ---
        {
          label: 'Edge',
          submenu: [
            geoItem('Split', 'geometry_edge_split', 'splitEdge', sel, { accelerator: 'Control+Shift+E' }),
            geoItem('Subdivide', 'geometry_edge_subdivide', 'subdivideEdge', sel, { accelerator: 'Control+Alt+S' }),
            geoItem('Inset', 'geometry_edge_inset', 'insetEdge', sel, { accelerator: 'Control+Alt+E' }),
            { type: 'separator' },
            geoItem('Toggle immaterial', 'geometry_edge_immaterial', 'immaterial', sel, { accelerator: 'Control+I' }),
            geoItem('Toggle texture', 'geometry_edge_texture', 'texture', sel, { accelerator: 'Control+T' }),
            geoItem('Next texture', 'geometry_edge_texture_scroll', 'texture', sel, { accelerator: 'Control+PageUp', data: -1, iconKey: 'texture' }),
            geoItem('Previous texture', 'geometry_edge_texture_scroll', 'texture', sel, { accelerator: 'Control+PageDown', data: 1, iconKey: 'texture' }),
            { type: 'separator' },
            geoItem('Increase translucency', 'geometry_edge_translucency', 'immaterial', sel, { accelerator: 'Control+]', data: -1, iconKey: 'translucency' }),
            geoItem('Decrease translucency', 'geometry_edge_translucency', 'immaterial', sel, { accelerator: 'Control+[', data: 1, iconKey: 'translucency' }),
            { type: 'separator' },
            helpItem('Edge Operations', edgeKeys),
          ]
        },

        // --- Vertex submenu ---
        {
          label: 'Vertex',
          submenu: [
            geoItem('Bevel', 'geometry_vertex_bevel', 'bevelVertex', sel, { accelerator: 'Control+Alt+B' }),
            { type: 'separator' },
            geoItem('Align horizontally', 'geometry_vertex_align_h', 'alignVerticesH', sel),
            geoItem('Align vertically', 'geometry_vertex_align_v', 'alignVerticesV', sel),
            { type: 'separator' },
            geoItem('Weld', 'geometry_vertex_weld', 'weldVertices', sel, { accelerator: 'Control+Alt+W' }),
            { type: 'separator' },
            helpItem('Vertex Operations', vertexKeys),
          ]
        },

        { type: 'separator' },

        // --- Misc ---
        geoItem('Remove', 'geometry_remove', 'remove', sel, { accelerator: 'Control+X' }),
        geoItem('Adapt fading strategy', 'geometry_config_fadeOut', 'fadeStrategy', sel, { accelerator: 'Control+Shift+F' }),

        { type: 'separator' },

        geoItem('Recalculate BSP', 'bsp_generate', 'bsp', sel, { accelerator: 'Control+B' }),
      ]
    },

    // ==================== Edit ====================
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'Control+Z',
          click: (_, focusedWindow) => { const win = asBrowserWindow(focusedWindow); if (win) win.webContents.send('undo'); }
        },
        {
          label: 'Redo',
          accelerator: 'Control+Y',
          click: (_, focusedWindow) => { const win = asBrowserWindow(focusedWindow); if (win) win.webContents.send('redo'); }
        },
      ]
    },

    // ==================== View ====================
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click(_, focusedWindow) {
            const win = asBrowserWindow(focusedWindow);
            if (win) win.reload();
          }
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click(_, focusedWindow) {
            const win = asBrowserWindow(focusedWindow);
            if (win) win.webContents.toggleDevTools();
          }
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },

    // ==================== Window ====================
    {
      role: 'window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },

    // ==================== Help ====================
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click() { require('electron').shell.openExternal('http://electron.atom.io'); }
        },
      ]
    }
  ];

  return Menu.buildFromTemplate(template);
}

// Default export for backward compatibility during transition
export const menu = buildMenu();
