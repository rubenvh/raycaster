import { BrowserWindow, Dialog } from 'electron';
export const saveFile = (dialog: Dialog, window: BrowserWindow) => {
    dialog.showSaveDialog(window, { filters: [{name: "json", extensions: ["json"]}], properties: ['showOverwriteConfirmation']})
        .then((files) => {
            if (files !== undefined && !files.canceled) {
                window.webContents.send('saveFileAs', files);
            }
        }
    );
}
export const openFile = (dialog: Dialog, window: BrowserWindow) => {
    dialog.showOpenDialog(window, { filters: [{name: "json", extensions: ["json"]}], properties: ['openFile']})
        .then((files) => {
            if (files !== undefined && !files.canceled) {
                window.webContents.send('openFile', files);                            
            }
        }
    );
}