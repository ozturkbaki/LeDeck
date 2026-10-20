/**
 * bridge.ts — Typed wrapper for window.electronAPI
 * 
 * Provides full TypeScript types for the preload-exposed API.
 * The renderer NEVER calls ipcRenderer directly. Everything goes through this.
 */

import type { RecentConnection } from '../types/RecentConnection'

// ─── Type declarations matching preload contextBridge ─────────────────────────
interface ConnectionResult {
  success: boolean
  message: string
  deviceInfo?: Record<string, string>
  code?: string
}

/** VX Pro — verification fazındaki hata kodları */
export type VXProErrorCode =
  | 'ERR_TCP_CONNECT'       // TCP bağlantısı kurulamadı
  | 'ERR_NO_RESPONSE'       // TCP kuruldu ama ModeID'ye cevap gelmedi
  | 'ERR_INVALID_FRAME'     // Response geldi ama 55 AA frame başlığı geçersiz
  | 'ERR_PARSE_FAILED'      // Frame açıldı ama içerik parse edilemedi
  | 'ERR_ALREADY_CONNECTED'

/** VX Pro connect çağrısının genişletilmiş sonucu */
interface VXProConnectResult extends ConnectionResult {
  code?: VXProErrorCode
  /** Debug: gönderilen komutun hex gösterimi */
  sentHex?: string
  /** Debug: cihazdan gelen ham yanıtın hex gösterimi */
  receivedHex?: string
  /** Debug: parse edilen ModelID (bilgi amaçlı) */
  parsedModelId?: number | null
}

/** VX Pro komut (brightness vb.) yanıtı */
interface VXProCommandResult {
  success: boolean
  message: string
  code?: VXProErrorCode
  sentHex?: string
  receivedHex?: string
}

interface StorageAPI {
  getConnections: (deviceSeries?: string) => Promise<RecentConnection[]>
  saveConnection: (data: Omit<RecentConnection, 'id' | 'createdAt' | 'lastConnectedAt'>) => Promise<RecentConnection>
  updateConnection: (id: string, updates: Partial<RecentConnection>) => Promise<RecentConnection | null>
  deleteConnection: (id: string) => Promise<boolean>
  touchConnection: (id: string) => Promise<boolean>
}

interface IPConnectionArgs {
  sessionId: string
  ipAddress: string
  // port: H Series için kullanıcıdan alınmaz, hardcoded 6000
  timeoutMs?: number
}

interface CommandArgs {
  sessionId: string
  command: string
  params?: Record<string, unknown>
}

/** H Series komut sonucu (ok / error / timeout) */
interface HCommandResult {
  status: 'ok' | 'error' | 'timeout' | 'invalid'
  message: string
  data?: unknown
  /** Debug: gönderilen ham JSON komut */
  sentCommand?: string
  /** Debug: cihazdan gelen ham yanıt */
  rawResponse?: string
  /** Debug: parse edilmiş sonuç */
  parsedResult?: unknown
  /** R0100 — cihaz detayları */
  deviceDetails?: {
    deviceId: number
    modelId?: number
    name?: string
    status?: number
    protoVersion?: string
    MAC?: string
    volt?: number
    temp?: number
    fanList?: unknown[]
    powerList?: unknown[]
    slotList?: unknown[]
  }
  /** R0401 — ekran detayları */
  screenDetails?: {
    deviceId: number
    screenId: number
    brightness?: number
    gamma?: number
    general?: { name?: string }
  }
  /** R0600 — preset listesi */
  presetList?: {
    deviceId: number
    screenId: number
    presets: Array<{ presetId: number; name: string }>
  }
  /** R0500 — layer listesi */
  layerEnum?: {
    deviceId: number
    screenId: number
    layers: Array<{ layerId: number; name: string }>
  }
  /** R0501 — layer detayları */
  layerDetails?: {
    deviceId: number
    screenId: number
    layerId: number
    name?: string
    inputId?: number
    interfaceType?: number
    window?: { x?: number; y?: number; width?: number; height?: number }
    raw?: Record<string, unknown>
  }
}

interface HSeriesAPI {
  /** sessionId + ipAddress — port girilmez */
  connect: (args: Omit<IPConnectionArgs, never>) => Promise<ConnectionResult>
  testConnection: (args: { ipAddress: string; timeoutMs?: number }) => Promise<ConnectionResult>
  disconnect: (args: { sessionId: string }) => Promise<{ success: boolean }>
  sendCommand: (args: CommandArgs) => Promise<{ success: boolean; message?: string; data?: unknown }>
  getStatus: (args: { sessionId: string }) => Promise<{ connected: boolean }>
  // Gerçek protokol komutları
  getDeviceDetails: (args: { sessionId: string }) => Promise<HCommandResult>
  getScreenDetails: (args: { sessionId: string }) => Promise<HCommandResult>
  getPresetList: (args: { sessionId: string }) => Promise<HCommandResult>
  loadPreset: (args: { sessionId: string; presetId: number }) => Promise<HCommandResult>
  // Kontrol komutları
  getLayerEnum: (args: { sessionId: string }) => Promise<HCommandResult>
  getLayerDetails: (args: { sessionId: string; layerId: number }) => Promise<HCommandResult>
  setBrightness: (args: { sessionId: string; brightness: number }) => Promise<HCommandResult>
  setFreeze: (args: { sessionId: string; enable: 0 | 1 }) => Promise<HCommandResult>
  setFTB: (args: { sessionId: string; type: 0 | 1 }) => Promise<HCommandResult>
}

interface TUSeriesAPI extends HSeriesAPI {}

interface VXSeriesAPI {
  /** sessionId + ipAddress + port */
  connect: (args: { sessionId: string; ipAddress: string; port: number; timeoutMs?: number }) => Promise<ConnectionResult>
  disconnect: (args: { sessionId: string }) => Promise<{ success: boolean }>
  sendCommand: (args: CommandArgs) => Promise<{ success: boolean; message?: string; data?: unknown }>
  getStatus: (args: { sessionId: string }) => Promise<{ connected: boolean }>
  searchDevices: (args?: { timeoutMs?: number }) => Promise<{ success: boolean; devices: unknown[] }>
}

interface MCTRLConnectionArgs {
  sessionId: string
  comPort: string
  baudRate: number
  timeoutMs?: number
}

interface MCTRLPortInfo {
  path: string
  manufacturer?: string
  serialNumber?: string
}

interface MCTRLDiscoveredDevice {
  comPort: string
  baudRate: number
  modelIdLow: number
  modelIdHigh: number
  modelName: string
  displayName: string
}

interface MCTRLAPI {
  listPorts: () => Promise<{ success: boolean; ports: MCTRLPortInfo[] }>
  scan: () => Promise<{ success: boolean; devices: MCTRLDiscoveredDevice[]; message?: string }>
  connect: (args: MCTRLConnectionArgs) => Promise<ConnectionResult>
  testConnection: (args: Omit<MCTRLConnectionArgs, 'sessionId'>) => Promise<ConnectionResult>
  disconnect: (args: { sessionId: string }) => Promise<{ success: boolean }>
  sendCommand: (args: CommandArgs) => Promise<{ success: boolean; message?: string; data?: unknown }>
  getStatus: (args: { sessionId: string }) => Promise<{ connected: boolean }>
}

interface VXProAPI {
  connect: (args: { sessionId: string; ipAddress: string; deviceName?: string; timeoutMs?: number }) => Promise<VXProConnectResult>
  disconnect: () => Promise<{ success: boolean }>
  getStatus: () => Promise<{ status: string; ipAddress?: string; lastError?: string; errorCode?: VXProErrorCode }>
  setBrightness: (args: { percent: number; timeoutMs?: number }) => Promise<VXProCommandResult>
  setFTB:        (args: { enable: boolean; timeoutMs?: number }) => Promise<VXProCommandResult>
  setFreeze:     (args: { enable: boolean; timeoutMs?: number }) => Promise<VXProCommandResult>
  loadPreset:    (args: { presetIndex: number; timeoutMs?: number }) => Promise<VXProCommandResult>
}

interface TaurusDiscoveredDevice {
  ip:                        string
  sn:                        string
  productName:               string
  modelId:                   number
  aliasName:                 string
  terminalEntrancePortHttps: number
  ftpPort:                   number
  tcpPort:                   number
  logined:                   boolean
  osVersion:                 string
  platform:                  string
  width:                     number
  height:                    number
}

interface TaurusDiscoveryResult {
  success:  boolean
  devices:  TaurusDiscoveredDevice[]
  errors:   { target: string; message: string }[]
  elapsed:  number
}

interface TaurusConnectResult {
  success:    boolean
  message?:   string
  code?:      number
  deviceName?: string
  ip?:         string
  port?:       number
  sn?:         string
}

interface TaurusCommandResult {
  success:  boolean
  message?: string
  data?:    unknown
  code?:    number
}

interface TaurusAPI {
  getLocalSubnets: () => Promise<{ success: boolean; subnets: string[] }>
  discover: (args?: { targets?: string[]; timeoutMs?: number; dllPath?: string }) => Promise<TaurusDiscoveryResult>
  cancelDiscover: () => Promise<{ success: boolean }>
  fetchBaseInfoAnon: (args: { ip: string; port?: number }) => Promise<{ success: boolean; data?: unknown; message?: string }>
  connect: (args: { sessionId: string; ip: string; port?: number; username: string; password: string; sn?: string; deviceName?: string; snHint?: string }) => Promise<TaurusConnectResult>
  disconnect: (args: { sessionId: string }) => Promise<{ success: boolean }>
  sendCommand: (args: { sessionId: string; command: string; params?: Record<string, unknown> }) => Promise<TaurusCommandResult>
  getStatus: (args: { sessionId: string }) => Promise<{ connected: boolean }>
}

declare global {
  interface Window {
    electronAPI: {
      storage:  StorageAPI
      hSeries:  HSeriesAPI
      tuSeries: TUSeriesAPI
      vxSeries: VXSeriesAPI
      vxPro:    VXProAPI
      mctrl:    MCTRLAPI
      taurus:   TaurusAPI
    }
  }
}

// ─── Typed accessors ─────────────────────────────────────────────────────────

function getElectronAPI() {
  if (!window.electronAPI) {
    throw new Error(
      'electronAPI bulunamadı. Uygulamayı tarayıcıda değil, ' +
      'Electron penceresi üzerinden açtığınızdan emin olun (npm run dev).'
    )
  }
  return window.electronAPI
}

export const storageAPI = (): StorageAPI => getElectronAPI().storage
export const hSeriesAPI = (): HSeriesAPI => getElectronAPI().hSeries
export const tuSeriesAPI = (): TUSeriesAPI => getElectronAPI().tuSeries
export const vxSeriesAPI = (): VXSeriesAPI => getElectronAPI().vxSeries
export const vxProAPI = (): VXProAPI => getElectronAPI().vxPro
export const mctrlAPI = (): MCTRLAPI => getElectronAPI().mctrl
export const taurusAPI = (): TaurusAPI => getElectronAPI().taurus
