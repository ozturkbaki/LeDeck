import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from './ipc/ipc-channels'

/**
 * LEDECA — Preload Script
 * 
 * This is the ONLY bridge between the renderer (React) and the main process.
 * 
 * Security rules enforced here:
 *  - contextIsolation: true  — renderer cannot access Node globals
 *  - nodeIntegration: false  — renderer has no require(), process, etc.
 *  - All IPC calls go through named channels only (whitelist)
 *  - Renderer never gets a raw ipcRenderer reference
 */

// ─── Storage API ─────────────────────────────────────────────────────────────
const storageApi = {
  getConnections: (deviceSeries?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.STORAGE_GET_CONNECTIONS, deviceSeries),

  saveConnection: (data: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.STORAGE_SAVE_CONNECTION, data),

  updateConnection: (id: string, updates: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.STORAGE_UPDATE_CONNECTION, id, updates),

  deleteConnection: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.STORAGE_DELETE_CONNECTION, id),

  touchConnection: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.STORAGE_UPDATE_LAST_CONNECTED, id),
}

// ─── H Series API ─────────────────────────────────────────────────────────────
const hSeriesApi = {
  // Port alınmaz — hardcoded 6000
  connect: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.HSERIES_CONNECT, args),

  testConnection: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.HSERIES_TEST_CONNECTION, args),

  disconnect: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.HSERIES_DISCONNECT, args),

  sendCommand: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.HSERIES_SEND_COMMAND, args),

  getStatus: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.HSERIES_GET_STATUS, args),

  // Gerçek protokol komutları
  getDeviceDetails: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.HSERIES_GET_DEVICE_DETAILS, args),

  getScreenDetails: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.HSERIES_GET_SCREEN_DETAILS, args),

  getPresetList: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.HSERIES_GET_PRESET_LIST, args),

  loadPreset: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.HSERIES_LOAD_PRESET, args),

  // Kontrol komutları
  getLayerEnum: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.HSERIES_GET_LAYER_ENUM, args),

  getLayerDetails: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.HSERIES_GET_LAYER_DETAILS, args),

  setBrightness: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.HSERIES_SET_BRIGHTNESS, args),

  setFreeze: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.HSERIES_SET_FREEZE, args),

  setFTB: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.HSERIES_SET_FTB, args),
}

// ─── TU Series API ───────────────────────────────────────────────────────────
const tuSeriesApi = {
  connect: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.TUSERIES_CONNECT, args),

  testConnection: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.TUSERIES_TEST_CONNECTION, args),

  disconnect: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.TUSERIES_DISCONNECT, args),

  sendCommand: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.TUSERIES_SEND_COMMAND, args),

  getStatus: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.TUSERIES_GET_STATUS, args),
}

// ─── VX Series API ───────────────────────────────────────────────────────────
const vxSeriesApi = {
  connect: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.VXSERIES_CONNECT, args),

  searchDevices: (args?: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.VXSERIES_SEARCH_DEVICES, args),

  disconnect: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.VXSERIES_DISCONNECT, args),

  sendCommand: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.VXSERIES_SEND_COMMAND, args),

  getStatus: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.VXSERIES_GET_STATUS, args),
}

// ─── VX Pro API ─────────────────────────────────────────────────────────────
const vxProApi = {
  connect: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.VXPRO_CONNECT, args),

  disconnect: (args?: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.VXPRO_DISCONNECT, args),

  getStatus: (args?: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.VXPRO_GET_STATUS, args),

  setBrightness: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.VXPRO_SET_BRIGHTNESS, args),

  setFTB: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.VXPRO_SET_FTB, args),

  setFreeze: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.VXPRO_SET_FREEZE, args),

  loadPreset: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.VXPRO_LOAD_PRESET, args),
}

// ─── MCTRL API ───────────────────────────────────────────────────────────────
const mctrlApi = {
  listPorts: () =>
    ipcRenderer.invoke(IPC_CHANNELS.MCTRL_LIST_PORTS),

  scan: () =>
    ipcRenderer.invoke(IPC_CHANNELS.MCTRL_SCAN),

  connect: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.MCTRL_CONNECT, args),

  testConnection: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.MCTRL_TEST_CONNECTION, args),

  disconnect: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.MCTRL_DISCONNECT, args),

  sendCommand: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.MCTRL_SEND_COMMAND, args),

  getStatus: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.MCTRL_GET_STATUS, args),
}

// ─── Taurus (TB/TCC) API ───────────────────────────────────────────────────
const taurusApi = {
  getLocalSubnets: () =>
    ipcRenderer.invoke(IPC_CHANNELS.TAURUS_GET_LOCAL_SUBNETS),

  discover: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.TAURUS_DISCOVER, args),

  cancelDiscover: () =>
    ipcRenderer.invoke(IPC_CHANNELS.TAURUS_CANCEL_DISCOVER),

  fetchBaseInfoAnon: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.TAURUS_FETCH_BASE_INFO_ANON, args),

  connect: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.TAURUS_CONNECT, args),

  disconnect: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.TAURUS_DISCONNECT, args),

  sendCommand: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.TAURUS_SEND_COMMAND, args),

  getStatus: (args: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.TAURUS_GET_STATUS, args),

  // Event Listeners
  onDisconnected: (callback: (data: any) => void) => {
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.TAURUS_EVENT_DISCONNECTED, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TAURUS_EVENT_DISCONNECTED, listener)
  },
  onReconnected: (callback: (data: any) => void) => {
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.TAURUS_EVENT_RECONNECTED, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TAURUS_EVENT_RECONNECTED, listener)
  },
}

// ─── Expose to renderer via contextBridge ────────────────────────────────────
contextBridge.exposeInMainWorld('electronAPI', {
  storage: storageApi,
  hSeries: hSeriesApi,
  tuSeries: tuSeriesApi,
  vxSeries: vxSeriesApi,
  vxPro: vxProApi,
  mctrl: mctrlApi,
  taurus: taurusApi,
})
