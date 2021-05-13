import {app, BrowserWindow, dialog, ipcMain, Menu} from 'electron'
import { menu } from './mainmenu';
import * as path from "path";
import * as url from "url";
import __basedir from '../basepath';
import { saveFile } from './dialogs';
// import installExtension, { REDUX_DEVTOOLS } from 'electron-devtools-installer';

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow: Electron.BrowserWindow;

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 2000, height: 1000, show: false,  webPreferences: {
    nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    //nodeIntegrationInWorker: true,
  } });

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__basedir, __dirname, "../renderer/index.html"),
    protocol: "file:",
    slashes: true,
}));

  // Open the DevTools.
  mainWindow.webContents.openDevTools()

  mainWindow.once('ready-to-show', () => mainWindow.show())

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null as any;
  })

  ipcMain.on('saveNew', () => {
    saveFile(dialog, mainWindow); 
  });

  Menu.setApplicationMenu(menu);
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