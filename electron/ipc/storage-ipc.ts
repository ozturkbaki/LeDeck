import { ipcMain } from 'electron'
import { IPC_CHANNELS } from './ipc-channels'
import {
  getConnections,
  saveConnection,
  updateConnection,
  deleteConnection,
  touchConnection
} from '../storage/connection-store'

/**
 * Registers all storage-related IPC handlers.
 * Called once from main.ts during app initialization.
 */
export function registerStorageIpc(): void {
  // Get all connections (or filtered by deviceSeries)
  ipcMain.handle(IPC_CHANNELS.STORAGE_GET_CONNECTIONS, (_event, deviceSeries?: string) => {
    const all = getConnections()
    if (deviceSeries) {
      return all.filter((c) => c.deviceSeries === deviceSeries)
    }
    return all
  })

  // Save a new connection profile
  ipcMain.handle(IPC_CHANNELS.STORAGE_SAVE_CONNECTION, (_event, data) => {
    return saveConnection(data)
  })

  // Update an existing connection profile
  ipcMain.handle(IPC_CHANNELS.STORAGE_UPDATE_CONNECTION, (_event, id: string, updates) => {
    return updateConnection(id, updates)
  })

  // Delete a connection profile
  ipcMain.handle(IPC_CHANNELS.STORAGE_DELETE_CONNECTION, (_event, id: string) => {
    return deleteConnection(id)
  })

  // Touch lastConnectedAt timestamp
  ipcMain.handle(IPC_CHANNELS.STORAGE_UPDATE_LAST_CONNECTED, (_event, id: string) => {
    return touchConnection(id)
  })
}
