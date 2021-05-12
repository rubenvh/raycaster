import { importTexture, openFile, saveFile } from './dialogs';
import { dialog, Menu } from "electron"

const template: (Electron.MenuItemConstructorOptions | Electron.MenuItem)[] = [
  {
    label: 'World',
    role: 'fileMenu',
    submenu: [
      {
        label: 'New',
        accelerator: 'CommandOrControl+Shift+N',
        click: (_, focusedWindow) => { if (focusedWindow) { focusedWindow.webContents.send('newFile'); }}
      },
      {
        label: 'Open',
        accelerator: 'CommandOrControl+Shift+O',
        click: (_, focusedWindow) => { if (focusedWindow) { openFile(dialog, focusedWindow); }}
      },
      {
        label: 'Save',
        accelerator: 'CommandOrControl+S',
        click: (_, focusedWindow) => { if (focusedWindow) { focusedWindow.webContents.send('saveFile');}},
      },
      {
        label: 'Save as',
        accelerator: 'CommandOrControl+Shift+S',
        click: (_, focusedWindow) => { if (focusedWindow) { saveFile(dialog, focusedWindow); }},
      }
    ]
  },
  {
    label: 'Textures',
    role: 'appMenu',
    submenu: [
      {
        label: 'Import',
        //accelerator: 'CommandOrControl+Shift+N',
        click: (_, focusedWindow) => { if (focusedWindow) { importTexture(dialog, focusedWindow); }}
      },
      {
        label: 'Library',
        //accelerator: 'CommandOrControl+Shift+O',
        //click: (item, focusedWindow) => { if (focusedWindow) { openFile(dialog, focusedWindow); }}
      },
    ]
  },
  {
    label: 'Geometry',
    role: 'appMenu',
    submenu: [
      {
        label: 'Create polygon',
        accelerator: 'Control+A',
        click: (_, focusedWindow) => { if (focusedWindow) { focusedWindow.webContents.send('geometry_polygon_create'); }}
      },    
      {
        label: 'Clone polygon',
        accelerator: 'Control+D',
        click: (_, focusedWindow) => { if (focusedWindow) { focusedWindow.webContents.send('geometry_polygon_clone'); }}
      },      
      {
        label: 'Expand polygon',
        accelerator: 'Control+E',
        click: (_, focusedWindow) => { if (focusedWindow) { focusedWindow.webContents.send('geometry_polygon_expand'); }}
      },  
      {
        label: 'Split polygon',
        accelerator: 'Control+Shift+S',
        click: (_, focusedWindow) => { if (focusedWindow) { focusedWindow.webContents.send('geometry_polygon_split'); }}
      },  
      {
        label: 'Rotate polygon',
        accelerator: 'Control+Shift+R',
        click: (_, focusedWindow) => { if (focusedWindow) { focusedWindow.webContents.send('geometry_polygon_rotate'); }}
      }, 
      {
        label: 'Reverse polygon',
        accelerator: 'Control+Alt+R',
        click: (_, focusedWindow) => { if (focusedWindow) { focusedWindow.webContents.send('geometry_polygon_reverse'); }}
      }, 
      {
        type: 'separator'
      },
      {
        label: 'Split edge',
        accelerator: 'Control+S',
        click: (_, focusedWindow) => { if (focusedWindow) { focusedWindow.webContents.send('geometry_edge_split'); }}
      },   
      {
        label: 'Toggle immaterial',
        accelerator: 'Control+I',
        click: (_, focusedWindow) => { if (focusedWindow) { focusedWindow.webContents.send('geometry_edge_immaterial'); }}
      },
      {
        label: 'Toggle texture',
        accelerator: 'Control+T',
        click: (_, focusedWindow) => { if (focusedWindow) { focusedWindow.webContents.send('geometry_edge_texture'); }}
      },
      {
        label: 'Next texture',
        accelerator: 'Control+PageUp',
        click: (_, focusedWindow) => { if (focusedWindow) { focusedWindow.webContents.send('geometry_edge_texture_scroll', -1); }}
      },
      {
        label: 'Previous texture',
        accelerator: 'Control+PageDown',
        click: (_, focusedWindow) => { if (focusedWindow) { focusedWindow.webContents.send('geometry_edge_texture_scroll', 1); }}
      },
      {
        label: 'Increase translucency',
        accelerator: 'Control+]',
        click: (_, focusedWindow) => { if (focusedWindow) { focusedWindow.webContents.send('geometry_edge_translucency', -1); }}
      },
      {
        label: 'Decrease translucency',
        accelerator: 'Control+[',
        click: (_, focusedWindow) => { if (focusedWindow) { focusedWindow.webContents.send('geometry_edge_translucency', 1); }}
      },
      {
        type: 'separator'
      },
      {
        label: 'Remove',
        accelerator: 'Control+X',
        click: (_, focusedWindow) => { if (focusedWindow) { focusedWindow.webContents.send('geometry_remove'); }}
      },
      {
        label: 'Adapt fading strategy',
        accelerator: 'Control+Shift+F',
        click: (_, focusedWindow) => { if (focusedWindow) { focusedWindow.webContents.send('geometry_config_fadeOut'); }}
      },
      {
        type: 'separator'
      },
      {
        label: 'Recalculate BSP',
        accelerator: 'Control+R',
        click: (_, focusedWindow) => { if (focusedWindow) { focusedWindow.webContents.send('bsp_generate'); }}
      },   
    ]
  },
  {
    label: 'Edit',
    submenu: [
        {
          label: 'Undo',
          accelerator: 'Control+Z',
          click: (_, focusedWindow) => { if (focusedWindow) { focusedWindow.webContents.send('undo'); }}
        },
        {
          label: 'Redo',
          accelerator: 'Control+Y',
          click: (_, focusedWindow) => { if (focusedWindow) { focusedWindow.webContents.send('redo'); }}
        },
        // {
        //   type: 'separator'
        // },
        // {
        //   role: 'cut'
        // },
        // {
        //   role: 'copy'
        // },
        // {
        //   role: 'paste'
        // },
        // {
        //   role: 'pasteAndMatchStyle'
        // },
        // {
        //   role: 'delete'
        // },
        // {
        //   role: 'selectAll'
        // }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click (_, focusedWindow) {
            if (focusedWindow) focusedWindow.reload()
          }
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click (_, focusedWindow) {
            if (focusedWindow) focusedWindow.webContents.toggleDevTools()
          }
        },
        {
          type: 'separator'
        },
        {
          role: 'resetZoom'
        },
        {
          role: 'zoomIn'
        },
        {
          role: 'zoomOut'
        },
        {
          type: 'separator'
        },
        {
          role: 'togglefullscreen'
        }
      ]
    },
    {
      role: 'window',
      submenu: [
        {
          role: 'minimize'
        },
        {
          role: 'close'
        }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click () { require('electron').shell.openExternal('http://electron.atom.io') }
        }
      ]
    }
  ];
  
  
  
  export const menu = Menu.buildFromTemplate(template);
  