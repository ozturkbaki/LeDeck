import React, { createContext, useContext, useReducer } from 'react'

/**
 * HSessionState — H Series modülünün tüm session state'i burada tutulur.
 *
 * Bu state hiçbir zaman başka modüle expose edilmez.
 *
 * Değişiklikler (gerçek protokol için):
 *   - port field kaldırıldı (hardcoded 6000, kullanıcı görmez)
 *   - deviceDetails, screenDetails alanları eklendi
 *   - presetList eklendi
 *   - debugLog eklendi (son komut / raw yanıt / parse sonucu)
 */

export type HConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

/** R0100 — Cihaz detayları */
export interface HDeviceDetails {
  deviceId: number
  modelId?: number
  name?: string
  status?: number       // 0: busy, 1: ready
  protoVersion?: string
  MAC?: string
  volt?: number         // 0: normal, 1: anormal
  temp?: number         // 0: normal, 1: anormal
  fanList?: unknown[]
  powerList?: unknown[]
  slotList?: unknown[]
}

/** R0401 — Ekran detayları */
export interface HScreenDetails {
  deviceId: number
  screenId: number
  brightness?: number
  gamma?: number
  general?: { name?: string }
}

/** R0600 — Preset */
export interface HPreset {
  presetId: number
  name: string
}

/** R0500 — Layer */
export interface HLayerItem {
  layerId: number
  name: string
}

/** R0501 — Layer Detayları */
export interface HLayerDetails {
  layerId: number
  name?: string
  inputId?: number
  interfaceType?: number
  window?: { x?: number; y?: number; width?: number; height?: number }
  raw?: Record<string, unknown>
}

/** Debug log girişi */
export interface HDebugEntry {
  timestamp: string
  sentCommand?: string
  rawResponse?: string
  parsedStatus?: string
  parsedData?: unknown
}

export interface HSessionState {
  status: HConnectionStatus
  sessionId: string | null
  deviceName: string
  ipAddress: string
  /** Port artık burada yok — hardcoded 6000 kullanılır */
  deviceInfo: Record<string, string> | null
  deviceDetails: HDeviceDetails | null
  screenDetails: HScreenDetails | null
  presetList: HPreset[]
  activePresetId: number | null
  /** R0500 — Layer listesi */
  layerList: HLayerItem[]
  /** Seçili layer ID */
  selectedLayerId: number | null
  /** R0501 — Seçili layer'a ait detaylar */
  selectedLayerDetails: HLayerDetails | null
  /** Mevcut par laklık değeri (0–100) */
  brightness: number
  /** Freeze durumu */
  freezeEnabled: boolean
  /** FTB durumu (true = siyah) */
  ftbEnabled: boolean
  lastError: string | null
  lastCommandResult: string | null
  commandBusy: boolean
  dashboardReady: boolean
  /** Debug log — son 20 giriş */
  debugLog: HDebugEntry[]
}

const initialState: HSessionState = {
  status: 'disconnected',
  sessionId: null,
  deviceName: '',
  ipAddress: '',
  deviceInfo: null,
  deviceDetails: null,
  screenDetails: null,
  presetList: [],
  activePresetId: null,
  layerList: [],
  selectedLayerId: null,
  selectedLayerDetails: null,
  brightness: 100,
  freezeEnabled: false,
  ftbEnabled: false,
  lastError: null,
  lastCommandResult: null,
  commandBusy: false,
  dashboardReady: false,
  debugLog: [],
}

type HAction =
  | { type: 'CONNECTING'; payload: { sessionId: string; deviceName: string; ipAddress: string } }
  | { type: 'CONNECTED'; payload: { deviceInfo?: Record<string, string> } }
  | { type: 'DISCONNECTED' }
  | { type: 'ERROR'; payload: { message: string } }
  | { type: 'SET_COMMAND_BUSY'; payload: boolean }
  | { type: 'SET_COMMAND_RESULT'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_DEVICE_DETAILS'; payload: HDeviceDetails }
  | { type: 'SET_SCREEN_DETAILS'; payload: HScreenDetails }
  | { type: 'SET_PRESET_LIST'; payload: HPreset[] }
  | { type: 'SET_ACTIVE_PRESET'; payload: number | null }
  | { type: 'ADD_DEBUG_LOG'; payload: HDebugEntry }
  | { type: 'SET_LAYER_LIST'; payload: HLayerItem[] }
  | { type: 'SET_SELECTED_LAYER'; payload: number | null }
  | { type: 'SET_LAYER_DETAILS'; payload: HLayerDetails | null }
  | { type: 'SET_BRIGHTNESS'; payload: number }
  | { type: 'SET_FREEZE'; payload: boolean }
  | { type: 'SET_FTB'; payload: boolean }

function hReducer(state: HSessionState, action: HAction): HSessionState {
  switch (action.type) {
    case 'CONNECTING':
      return {
        ...state,
        status: 'connecting',
        lastError: null,
        sessionId: action.payload.sessionId,
        deviceName: action.payload.deviceName,
        ipAddress: action.payload.ipAddress,
        dashboardReady: false,
      }
    case 'CONNECTED':
      return {
        ...state,
        status: 'connected',
        deviceInfo: action.payload.deviceInfo ?? null,
        dashboardReady: true,
      }
    case 'DISCONNECTED':
      return { ...initialState }
    case 'ERROR':
      return { ...state, status: 'error', lastError: action.payload.message, commandBusy: false }
    case 'SET_COMMAND_BUSY':
      return { ...state, commandBusy: action.payload }
    case 'SET_COMMAND_RESULT':
      return { ...state, lastCommandResult: action.payload, commandBusy: false }
    case 'CLEAR_ERROR':
      return { ...state, lastError: null }
    case 'SET_DEVICE_DETAILS':
      return { ...state, deviceDetails: action.payload }
    case 'SET_SCREEN_DETAILS':
      return { ...state, screenDetails: action.payload }
    case 'SET_PRESET_LIST':
      return { ...state, presetList: action.payload }
    case 'SET_ACTIVE_PRESET':
      return { ...state, activePresetId: action.payload }
    case 'SET_LAYER_LIST':
      return { ...state, layerList: action.payload, selectedLayerId: null, selectedLayerDetails: null }
    case 'SET_SELECTED_LAYER':
      return { ...state, selectedLayerId: action.payload, selectedLayerDetails: null }
    case 'SET_LAYER_DETAILS':
      return { ...state, selectedLayerDetails: action.payload }
    case 'SET_BRIGHTNESS':
      return { ...state, brightness: action.payload }
    case 'SET_FREEZE':
      return { ...state, freezeEnabled: action.payload }
    case 'SET_FTB':
      return { ...state, ftbEnabled: action.payload }
    case 'ADD_DEBUG_LOG': {
      // Son 20 girişi tut
      const newLog = [action.payload, ...state.debugLog].slice(0, 20)
      return { ...state, debugLog: newLog }
    }
    default:
      return state
  }
}

interface HSessionContextValue {
  state: HSessionState
  dispatch: React.Dispatch<HAction>
}

const HSessionContext = createContext<HSessionContextValue | null>(null)

export const HSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(hReducer, initialState)
  return <HSessionContext.Provider value={{ state, dispatch }}>{children}</HSessionContext.Provider>
}

export function useHSession(): HSessionContextValue {
  const ctx = useContext(HSessionContext)
  if (!ctx) throw new Error('useHSession must be used within HSessionProvider')
  return ctx
}
