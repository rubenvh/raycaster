import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Whitelist of valid channels for receiving messages from main process
const validReceiveChannels = [
  // File operations
  'openFile',
  'saveFileAs', 
  'saveFile',
  'newFile',
  'importTexture',
  'importSkybox',
  // Edit operations
  'undo',
  'redo',
  // Geometry operations
  'geometry_config_fadeOut',
  'geometry_polygon_create',
  'geometry_polygon_clone',
  'geometry_polygon_split',
  'geometry_polygon_rotate',
  'geometry_polygon_expand',
  'geometry_polygon_reverse',
  'geometry_polygon_flip_h',
  'geometry_polygon_flip_v',
  'geometry_polygon_scale_up',
  'geometry_polygon_scale_down',
  'geometry_polygon_regularize',
  'geometry_polygon_convex_hull',
  'geometry_polygon_inset',
  'geometry_polygon_merge',
  'geometry_polygon_generate',
  'geometry_polygon_generate_sides',
  'geometry_polygon_align_top',
  'geometry_polygon_align_bottom',
  'geometry_polygon_align_left',
  'geometry_polygon_align_right',
  'geometry_polygon_align_center_h',
  'geometry_polygon_align_center_v',
  'geometry_remove',
  'geometry_edge_split',
  'geometry_edge_immaterial',
  'geometry_edge_texture',
  'geometry_edge_texture_scroll',
  'geometry_edge_translucency',
  'geometry_edge_subdivide',
  'geometry_edge_inset',
  'geometry_vertex_bevel',
  'geometry_vertex_align_h',
  'geometry_vertex_align_v',
  'geometry_vertex_weld',
  // BSP operations
  'bsp_generate',
  'bsp_cancel',
  // Skybox operations
  // Player operations
  'loadMapFile',
  // Dance mode
  'danceMode',
];

// Whitelist of valid channels for sending messages to main process
const validSendChannels = [
  'saveNew',
  'selection-state',
  'importSkybox-request',
];

// Type for the callback function
type IpcCallback = (event: IpcRendererEvent, ...args: any[]) => void;

// Store callbacks for removal
const callbackMap = new Map<Function, IpcCallback>();

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations via IPC invoke (async request/response)
  readFile: (filePath: string): Promise<Buffer> => {
    return ipcRenderer.invoke('fs:readFile', filePath);
  },
  
  writeFile: (filePath: string, data: string): Promise<void> => {
    return ipcRenderer.invoke('fs:writeFile', filePath, data);
  },

  readFileAsBuffer: (filePath: string): Promise<Buffer> => {
    return ipcRenderer.invoke('fs:readFileAsBuffer', filePath);
  },

  getImageSize: (filePath: string): Promise<{width: number, height: number}> => {
    return ipcRenderer.invoke('fs:getImageSize', filePath);
  },

  // One-way IPC send (renderer -> main)
  send: (channel: string, ...args: any[]): void => {
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    } else {
      console.warn(`Attempted to send on invalid channel: ${channel}`);
    }
  },

  // Listen for IPC messages (main -> renderer)
  on: (channel: string, callback: (...args: any[]) => void): void => {
    if (validReceiveChannels.includes(channel)) {
      // Wrap the callback to strip the event parameter for cleaner API
      const wrappedCallback: IpcCallback = (_event, ...args) => callback(...args);
      callbackMap.set(callback, wrappedCallback);
      ipcRenderer.on(channel, wrappedCallback);
    } else {
      console.warn(`Attempted to listen on invalid channel: ${channel}`);
    }
  },

  // Remove IPC listener
  removeListener: (channel: string, callback: (...args: any[]) => void): void => {
    if (validReceiveChannels.includes(channel)) {
      const wrappedCallback = callbackMap.get(callback);
      if (wrappedCallback) {
        ipcRenderer.removeListener(channel, wrappedCallback);
        callbackMap.delete(callback);
      }
    }
  },

  // Remove all listeners for a channel
  removeAllListeners: (channel: string): void => {
    if (validReceiveChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },

  // Alias for removeListener (common event emitter pattern)
  off: (channel: string, callback: (...args: any[]) => void): void => {
    if (validReceiveChannels.includes(channel)) {
      const wrappedCallback = callbackMap.get(callback);
      if (wrappedCallback) {
        ipcRenderer.removeListener(channel, wrappedCallback);
        callbackMap.delete(callback);
      }
    }
  },

  // Invoke an IPC handler on the main process (async request/response)
  invoke: (channel: string, ...args: any[]): Promise<any> => {
    return ipcRenderer.invoke(channel, ...args);
  }
});
