import React, { createContext, useContext, useReducer } from 'react'

export type VXConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface VXSessionState {
  status: VXConnectionStatus
  sessionId: string | null
  deviceName: string
  ipAddress: string
  port: number
  deviceInfo: Record<string, string> | null
  lastError: string | null
  lastCommandResult: string | null
  commandBusy: boolean
  dashboardReady: boolean
  discoveredDevices: Array<{ ipAddress: string; port: number; model?: string }>
}

const initialState: VXSessionState = {
  status: 'disconnected', sessionId: null, deviceName: '', ipAddress: '', port: 5200,
  deviceInfo: null, lastError: null, lastCommandResult: null, commandBusy: false,
  dashboardReady: false, discoveredDevices: [],
}

type VXAction =
  | { type: 'CONNECTING'; payload: { sessionId: string; deviceName: string; ipAddress: string; port: number } }
  | { type: 'CONNECTED'; payload: { deviceInfo?: Record<string, string> } }
  | { type: 'DISCONNECTED' }
  | { type: 'ERROR'; payload: { message: string } }
  | { type: 'SET_COMMAND_BUSY'; payload: boolean }
  | { type: 'SET_COMMAND_RESULT'; payload: string }
  | { type: 'SET_DISCOVERED_DEVICES'; payload: Array<{ ipAddress: string; port: number; model?: string }> }
  | { type: 'CLEAR_ERROR' }

function vxReducer(state: VXSessionState, action: VXAction): VXSessionState {
  switch (action.type) {
    case 'CONNECTING': return { ...state, status: 'connecting', lastError: null, ...action.payload, dashboardReady: false }
    case 'CONNECTED':  return { ...state, status: 'connected', deviceInfo: action.payload.deviceInfo ?? null, dashboardReady: true }
    case 'DISCONNECTED': return { ...initialState }
    case 'ERROR': return { ...state, status: 'error', lastError: action.payload.message, commandBusy: false }
    case 'SET_COMMAND_BUSY': return { ...state, commandBusy: action.payload }
    case 'SET_COMMAND_RESULT': return { ...state, lastCommandResult: action.payload, commandBusy: false }
    case 'SET_DISCOVERED_DEVICES': return { ...state, discoveredDevices: action.payload }
    case 'CLEAR_ERROR': return { ...state, lastError: null }
    default: return state
  }
}

interface VXSessionContextValue { state: VXSessionState; dispatch: React.Dispatch<VXAction> }
const VXSessionContext = createContext<VXSessionContextValue | null>(null)

export const VXSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(vxReducer, initialState)
  return <VXSessionContext.Provider value={{ state, dispatch }}>{children}</VXSessionContext.Provider>
}

export function useVXSession(): VXSessionContextValue {
  const ctx = useContext(VXSessionContext)
  if (!ctx) throw new Error('useVXSession must be used within VXSessionProvider')
  return ctx
}
