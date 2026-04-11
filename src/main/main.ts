import {app, BrowserWindow, dialog, ipcMain, Menu} from 'electron'
import { buildMenu, SelectionState } from './mainmenu';
import { destroyHelpWindow } from './menu-tooltip';
import * as path from "path";
import * as url from "url";
import * as fs from "fs";
import { imageSize } from 'image-size';
import __basedir from '../basepath';
import { importSkybox, saveFile } from './dialogs';
// import installExtension, { REDUX_DEVTOOLS } from 'electron-devtools-installer';

// Parse --resolution <N> from command-line arguments (default 640)
function parseResolution(): number {
  const idx = process.argv.indexOf('--resolution');
  if (idx !== -1 && idx + 1 < process.argv.length) {
    const val = parseInt(process.argv[idx + 1], 10);
    if (!isNaN(val) && val > 0) return val;
  }
  return 640;
}
const resolution = parseResolution();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow: Electron.BrowserWindow;

function createWindow () {
  // Create the browser window.
  // Note: __dirname in webpack with electron-main target points to the dist folder
  const preloadPath = path.join(__dirname, 'preload-bundle.js');
  console.log('Preload path:', preloadPath);
  
  mainWindow = new BrowserWindow({width: 1920, height: 1080, show: false,  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    preload: preloadPath,
  } });

  // and load the index.html of the app.
  // __dirname points to src/main/dist, so we go up two levels to src, then to renderer
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, "../../renderer/index.html"),
    protocol: "file:",
    slashes: true,
    search: resolution !== 640 ? `?resolution=${resolution}` : undefined,
  }));

  // Open the DevTools.
  mainWindow.webContents.openDevTools()

  mainWindow.once('ready-to-show', () => mainWindow.show())

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    destroyHelpWindow();
    mainWindow = null as any;
  })

  ipcMain.on('saveNew', () => {
    saveFile(dialog, mainWindow); 
  });

  // File system operations via IPC invoke (async request/response)
  ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
    try {
      const data = await fs.promises.readFile(filePath);
      return data;
    } catch (error) {
      console.error('Error reading file:', filePath, error);
      throw error;
    }
  });

  ipcMain.handle('fs:writeFile', async (_event, filePath: string, data: string) => {
    try {
      await fs.promises.writeFile(filePath, data);
    } catch (error) {
      console.error('Error writing file:', filePath, error);
      throw error;
    }
  });

  ipcMain.handle('fs:readFileAsBuffer', async (_event, filePath: string) => {
    try {
      const data = await fs.promises.readFile(filePath);
      return data;
    } catch (error) {
      console.error('Error reading file as buffer:', filePath, error);
      throw error;
    }
  });

  ipcMain.handle('fs:getImageSize', async (_event, filePath: string) => {
    try {
      // image-size v2 requires buffer input, read file first
      const buffer = await fs.promises.readFile(filePath);
      const dimensions = imageSize(buffer);
      return { width: dimensions.width || 0, height: dimensions.height || 0 };
    } catch (error) {
      console.error('Error getting image size:', filePath, error);
      throw error;
    }
  });

  // Handle skybox import request from renderer (world editor import button)
  ipcMain.on('importSkybox-request', () => {
    importSkybox(dialog, mainWindow);
  });

  // Skybox operations: copy an imported file into assets/skyboxes/
  ipcMain.handle('skybox:copyToAssets', async (_event, sourcePath: string) => {
    try {
      const skyboxDir = path.join(__basedir, 'assets', 'skyboxes');
      await fs.promises.mkdir(skyboxDir, { recursive: true });
      const fileName = path.basename(sourcePath);
      const destPath = path.join(skyboxDir, fileName);
      await fs.promises.copyFile(sourcePath, destPath);
      return fileName;
    } catch (error) {
      console.error('Error copying skybox to assets:', error);
      throw error;
    }
  });

  // Skybox operations: list bundled skyboxes
  ipcMain.handle('skybox:list', async () => {
    try {
      const skyboxDir = path.join(__basedir, 'assets', 'skyboxes');
      const files = await fs.promises.readdir(skyboxDir);
      return files.filter(f => /\.(png|jpg|jpeg|gif)$/i.test(f));
    } catch (error) {
      console.error('Error listing skyboxes:', error);
      return [];
    }
  });

  // Skybox operations: load a bundled skybox by filename
  ipcMain.handle('skybox:load', async (_event, filename: string) => {
    try {
      const skyboxDir = path.join(__basedir, 'assets', 'skyboxes');
      const filePath = path.join(skyboxDir, filename);
      // Security: ensure the resolved path is still within skyboxDir
      if (!filePath.startsWith(skyboxDir)) {
        throw new Error('Invalid skybox path');
      }
      const data = await fs.promises.readFile(filePath);
      const dimensions = imageSize(data);
      const uint8Array = new Uint8Array(data);
      const CHUNK_SIZE = 8192;
      const chunks: string[] = [];
      for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
        const chunk = uint8Array.subarray(i, Math.min(i + CHUNK_SIZE, uint8Array.length));
        chunks.push(String.fromCharCode.apply(null, chunk as any));
      }
      const base64 = Buffer.from(data).toString('base64');
      const extension = filename.split('.').pop()?.toLowerCase();
      const mimeType = extension === 'jpg' || extension === 'jpeg'
        ? 'image/jpeg'
        : extension === 'gif'
          ? 'image/gif'
          : 'image/png';
      return {
        id: filename,
        data: base64,
        mimeType,
        width: dimensions.width || 0,
        height: dimensions.height || 0
      };
    } catch (error) {
      console.error('Error loading bundled skybox:', error);
      return null;
    }
  });

  // Build and set the initial menu with no selection
  let currentSelection: SelectionState = { kind: 'none', count: 0 };
  Menu.setApplicationMenu(buildMenu(currentSelection));

  // Listen for selection state updates from renderer
  ipcMain.on('selection-state', (_event, state: SelectionState) => {
    // Only rebuild menu if selection kind or count actually changed
    if (state.kind !== currentSelection.kind || state.count !== currentSelection.count) {
      currentSelection = state;
      Menu.setApplicationMenu(buildMenu(currentSelection));
    }
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.


// app.whenReady().then(() => {
//   installExtension(REDUX_DEVTOOLS)
//       .then((name) => console.log(`Added Extension:  ${name}`))
//       .catch((err) => console.log('An error occurred: ', err));
// });