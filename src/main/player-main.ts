import { app, BrowserWindow, dialog, ipcMain, Menu, session } from 'electron';
import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs';
import { imageSize } from 'image-size';
import __basedir from '../basepath';

// The player is a stripped-down Electron main process that only shows the 3D view.
// It accepts a map file path via command-line argument or shows a file-open dialog.
// When launched with --dance, it activates dance mode (audio-driven camera).

let mainWindow: Electron.BrowserWindow;

// Check for --dance flag in process argv
const isDanceMode = process.argv.includes('--dance');

function createWindow() {
    const preloadPath = path.join(__dirname, 'preload-bundle.js');

    mainWindow = new BrowserWindow({
        fullscreen: true,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: preloadPath,
        }
    });

    // Load the player HTML
    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, '../../player/player.html'),
        protocol: 'file:',
        slashes: true,
    }));

    mainWindow.once('ready-to-show', () => mainWindow.show());

    mainWindow.on('closed', () => {
        mainWindow = null as any;
    });

    // Grant microphone permission for dance mode
    if (isDanceMode) {
        session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
            if (permission === 'media') {
                callback(true);
            } else {
                callback(false);
            }
        });
    }

    // IPC handler: renderer can query whether dance mode is active
    ipcMain.handle('dance:isEnabled', async () => isDanceMode);

    // Register only the IPC handlers needed for playback
    ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
        try {
            return await fs.promises.readFile(filePath);
        } catch (error) {
            console.error('Error reading file:', filePath, error);
            throw error;
        }
    });

    ipcMain.handle('fs:readFileAsBuffer', async (_event, filePath: string) => {
        try {
            return await fs.promises.readFile(filePath);
        } catch (error) {
            console.error('Error reading file as buffer:', filePath, error);
            throw error;
        }
    });

    ipcMain.handle('fs:getImageSize', async (_event, filePath: string) => {
        try {
            const buffer = await fs.promises.readFile(filePath);
            const dimensions = imageSize(buffer);
            return { width: dimensions.width || 0, height: dimensions.height || 0 };
        } catch (error) {
            console.error('Error getting image size:', filePath, error);
            throw error;
        }
    });

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

    ipcMain.handle('skybox:load', async (_event, filename: string) => {
        try {
            const skyboxDir = path.join(__basedir, 'assets', 'skyboxes');
            const filePath = path.join(skyboxDir, filename);
            if (!filePath.startsWith(skyboxDir)) {
                throw new Error('Invalid skybox path');
            }
            const data = await fs.promises.readFile(filePath);
            const dimensions = imageSize(data);
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

    // Minimal menu: just window controls
    const menu = Menu.buildFromTemplate([
        {
            label: 'Window',
            submenu: [
                { role: 'toggleDevTools', accelerator: 'F12' },
                { role: 'togglefullscreen' },
                { role: 'minimize' },
                { type: 'separator' },
                { role: 'close' }
            ]
        }
    ]);
    Menu.setApplicationMenu(menu);

    // Determine the map file to load.
    // We must wait for BOTH the renderer to finish loading AND the map path
    // to be resolved before sending the map IPC message. Without this, the
    // message arrives before PlayerLoader has registered its listener.
    const rendererReady = new Promise<void>(resolve => {
        mainWindow.webContents.once('did-finish-load', resolve);
    });

    // Send dance mode IPC as soon as the renderer is ready — don't wait for
    // map file resolution (which may show a file dialog and block for seconds).
    if (isDanceMode) {
        rendererReady.then(() => {
            mainWindow.webContents.send('danceMode', { enabled: true });
        });
    }

    Promise.all([rendererReady, resolveMapFile()]).then(([, mapFilePath]) => {
        if (mapFilePath) {
            mainWindow.webContents.send('loadMapFile', { filePath: mapFilePath });
        } else {
            // No map specified and dialog was cancelled — quit
            app.quit();
        }
    });
}

/**
 * Resolve the map file path from command-line arguments or a file-open dialog.
 * 
 * Usage: electron player-main-bundle.js [path/to/map.json]
 * 
 * If no argument is provided, a native file-open dialog is shown.
 */
async function resolveMapFile(): Promise<string | null> {
    // Check command-line arguments for a map file path.
    // In packaged apps, argv[0] is electron, argv[1] is the script.
    // Extra args start at argv[2] (or later, skipping Electron flags).
    // Filter out Electron flags and our own --dance flag
    const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));

    if (args.length > 0) {
        const mapPath = path.resolve(args[0]);
        try {
            await fs.promises.access(mapPath, fs.constants.R_OK);
            return mapPath;
        } catch {
            console.error(`Map file not found: ${mapPath}`);
            // Fall through to dialog
        }
    }

    // No valid CLI arg — show a file-open dialog
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Open Map',
        defaultPath: path.join(__basedir, 'assets', 'maps'),
        filters: [{ name: 'Map Files', extensions: ['json'] }],
        properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }
    return result.filePaths[0];
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
