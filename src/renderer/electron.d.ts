/**
 * Type declarations for the Electron API exposed via preload script.
 * This provides type-safe access to window.electronAPI in renderer processes.
 */

export interface ElectronAPI {
  /**
   * Read a file from the filesystem.
   * @param filePath - Absolute path to the file
   * @returns Promise resolving to file contents as Buffer
   */
  readFile(filePath: string): Promise<Buffer>;

  /**
   * Write data to a file on the filesystem.
   * @param filePath - Absolute path to the file
   * @param data - String data to write
   * @returns Promise that resolves when write is complete
   */
  writeFile(filePath: string, data: string): Promise<void>;

  /**
   * Read a file as a raw Buffer (for binary files like images).
   * @param filePath - Absolute path to the file
   * @returns Promise resolving to file contents as Buffer
   */
  readFileAsBuffer(filePath: string): Promise<Buffer>;

  /**
   * Get dimensions of an image file.
   * @param filePath - Absolute path to the image file
   * @returns Promise resolving to width and height
   */
  getImageSize(filePath: string): Promise<{width: number, height: number}>;

  /**
   * Send a one-way message to the main process.
   * @param channel - The IPC channel name
   * @param args - Arguments to send
   */
  send(channel: string, ...args: unknown[]): void;

  /**
   * Listen for messages from the main process.
   * @param channel - The IPC channel name
   * @param callback - Function to call when message is received
   */
  on(channel: string, callback: (...args: any[]) => void): void;

  /**
   * Remove a specific listener from a channel.
   * @param channel - The IPC channel name
   * @param callback - The callback function to remove
   */
  removeListener(channel: string, callback: (...args: any[]) => void): void;

  /**
   * Remove all listeners from a channel.
   * @param channel - The IPC channel name
   */
  removeAllListeners(channel: string): void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
