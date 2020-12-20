import { importTexture, openFile, saveFile } from './../storage/dialogs';
import { dialog, Menu } from "electron"

const template: (Electron.MenuItemConstructorOptions | Electron.MenuItem)[] = [
  {
    label: 'World',
    role: 'fileMenu',
    submenu: [
      {
        label: 'New',
        accelerator: 'CommandOrControl+Shift+N',
        click: (item, focusedWindow) => { if (focusedWindow) { focusedWindow.webContents.send('newFile'); }}
      },
      {
        label: 'Open',
        accelerator: 'CommandOrControl+Shift+O',
        click: (item, focusedWindow) => { if (focusedWindow) { openFile(dialog, focusedWindow); }}
      },
      {
        label: 'Save',
        accelerator: 'CommandOrControl+S',
        click: (item, focusedWindow) => { if (focusedWindow) { focusedWindow.webContents.send('saveFile');}},
      },
      {
        label: 'Save as',
        accelerator: 'CommandOrControl+Shift+S',
        click: (item, focusedWindow) => { if (focusedWindow) { saveFile(dialog, focusedWindow); }},
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
        click: (item, focusedWindow) => { if (focusedWindow) { importTexture(dialog, focusedWindow); }}
      },
      {
        label: 'Library',
        //accelerator: 'CommandOrControl+Shift+O',
        //click: (item, focusedWindow) => { if (focusedWindow) { openFile(dialog, focusedWindow); }}
      },
    ]
  },
  // {
  //   label: 'Edit',
  //   submenu: [
  //       {
  //         role: 'undo'
  //       },
  //       {
  //         role: 'redo'
  //       },
  //       {
  //         type: 'separator'
  //       },
  //       {
  //         role: 'cut'
  //       },
  //       {
  //         role: 'copy'
  //       },
  //       {
  //         role: 'paste'
  //       },
  //       {
  //         role: 'pasteAndMatchStyle'
  //       },
  //       {
  //         role: 'delete'
  //       },
  //       {
  //         role: 'selectAll'
  //       }
  //     ]
  //   },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click (item, focusedWindow) {
            if (focusedWindow) focusedWindow.reload()
          }
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click (item, focusedWindow) {
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
  