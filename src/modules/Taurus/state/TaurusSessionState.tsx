import React, { createContext, useContext, useReducer } from 'react'

export type TaurusConnectionStatus = 'disconnected' | 'discovering' | 'connecting' | 'connected' | 'error'

export interface TaurusDiscoveredDevice {
  ip:                        string
  sn:                        string
  productName:               string
  modelId:                   number
  aliasName:                 string
  terminalEntrancePortHttps: number
  logined:                   boolean
  osVersion:                 string
  platform:                  string
}

export interface TaurusSessionState {
  status:        TaurusConnectionStatus
  sessionId:     string | null
  // Bağlı cihaz bilgileri
  deviceName:    string
  ip:            string
  port:          number
  sn:            string
  // Discovery
  discoveredDevices: TaurusDiscoveredDevice[]
  // Hata / UI
  lastError:     string | null
  commandBusy:   boolean
  dashboardReady: boolean
  // Cihaz verileri (dashboard)
  baseInfo:      Record<string, unknown> | null
  brightnessRatio: number | null
  volumeRatio:     number | null
  screenOn:        boolean | null
}

const initialState: TaurusSessionState = {
  status: 'disconnected', sessionId: null,
  deviceName: '', ip: '', port: 16674, sn: '',
  discoveredDevices: [],
  lastError: null, commandBusy: false, dashboardReady: false,
  baseInfo: null, brightnessRatio: null, volumeRatio: null, screenOn: null,
}

type TaurusAction =
  | { type: 'DISCOVERING' }
  | { type: 'DISCOVERY_DONE'; payload: { devices: TaurusDiscoveredDevice[] } }
  | { type: 'CONNECTING'; payload: { sessionId: string; ip: string; port: number } }
  | { type: 'CONNECTED'; payload: { deviceName: string; sn: string } }
  | { type: 'DISCONNECTED' }
  | { type: 'ERROR'; payload: { message: string } }
  | { type: 'COMMAND_ERROR'; payload: { message: string } }
  | { type: 'CLEAR_ERROR' }
  | { type: 'UPDATE_DATA'; payload: Partial<TaurusSessionState> }
  | { type: 'SET_BUSY'; payload: boolean }

function taurusReducer(state: TaurusSessionState, action: TaurusAction): TaurusSessionState {
  switch (action.type) {
    case 'DISCOVERING':
      return { ...state, status: 'discovering', discoveredDevices: [], lastError: null }
    case 'DISCOVERY_DONE':
      return { ...state, status: 'disconnected', discoveredDevices: action.payload.devices }
    case 'CONNECTING':
      return { ...state, status: 'connecting', lastError: null, ...action.payload, dashboardReady: false }
    case 'CONNECTED':
      return { ...state, status: 'connected', dashboardReady: true, ...action.payload }
    case 'DISCONNECTED':
      return { ...initialState }
    case 'ERROR':
      return { ...state, status: 'error', lastError: action.payload.message, commandBusy: false }
    case 'COMMAND_ERROR':
      return { ...state, lastError: action.payload.message, commandBusy: false }
    case 'CLEAR_ERROR':
      return { ...state, lastError: null }
    case 'UPDATE_DATA':
      return { ...state, ...action.payload }
    case 'SET_BUSY':
      return { ...state, commandBusy: action.payload }
    default:
      return state
  }
}

interface TaurusSessionContextValue {
  state:    TaurusSessionState
  dispatch: React.Dispatch<TaurusAction>
}

const TaurusSessionContext = createContext<TaurusSessionContextValue | null>(null)

export const TaurusSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(taurusReducer, initialState)
  return (
    <TaurusSessionContext.Provider value={{ state, dispatch }}>
      {children}
    </TaurusSessionContext.Provider>
  )
}

export function useTaurusSession(): TaurusSessionContextValue {
  const ctx = useContext(TaurusSessionContext)
  if (!ctx) throw new Error('useTaurusSession must be used within TaurusSessionProvider')
  return ctx
}
