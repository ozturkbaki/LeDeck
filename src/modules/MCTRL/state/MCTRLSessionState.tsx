import React, { createContext, useContext, useReducer } from 'react'

export type MCTRLConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface MCTRLSessionState {
  status: MCTRLConnectionStatus
  sessionId: string | null
  deviceName: string
  comPort: string
  baudRate: number
  deviceInfo: Record<string, string> | null
  lastError: string | null
  lastCommandResult: string | null
  commandBusy: boolean
  dashboardReady: boolean
  // Phase 2 — device read data
  firmwareVersion: string | null
  dviSignalActive: boolean | null
  initialFetchDone: boolean
  // Phase 3 — brightness
  currentBrightness: number | null
  brightnessPercent: number | null
  // Phase 4 — input source
  inputSourceCode: number | null    // raw byte e.g. 0x05 for HDMI
  inputSourceName: string | null    // human name e.g. "HDMI"
  inputSourceManual: boolean | null // true = manual, false = auto
}

const initialState: MCTRLSessionState = {
  status: 'disconnected', sessionId: null, deviceName: '', comPort: '', baudRate: 115200,
  deviceInfo: null, lastError: null, lastCommandResult: null, commandBusy: false, dashboardReady: false,
  firmwareVersion: null, dviSignalActive: null, initialFetchDone: false,
  currentBrightness: null, brightnessPercent: null,
  inputSourceCode: null, inputSourceName: null, inputSourceManual: null,
}

type MCTRLAction =
  | { type: 'CONNECTING'; payload: { sessionId: string; deviceName: string; comPort: string; baudRate: number } }
  | { type: 'CONNECTED'; payload: { deviceInfo?: Record<string, string> } }
  | { type: 'DISCONNECTED' }
  | { type: 'ERROR'; payload: { message: string } }
  | { type: 'COMMAND_ERROR'; payload: { message: string } }
  | { type: 'SET_COMMAND_BUSY'; payload: boolean }
  | { type: 'SET_COMMAND_RESULT'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'UPDATE_DATA'; payload: Partial<MCTRLSessionState> }

function mctrlReducer(state: MCTRLSessionState, action: MCTRLAction): MCTRLSessionState {
  switch (action.type) {
    case 'CONNECTING': return { ...state, status: 'connecting', lastError: null, ...action.payload, dashboardReady: false }
    case 'CONNECTED':  return { ...state, status: 'connected', deviceInfo: action.payload.deviceInfo ?? null, dashboardReady: true }
    case 'DISCONNECTED': return { ...initialState }
    case 'ERROR': return { ...state, status: 'error', lastError: action.payload.message, commandBusy: false }
    case 'COMMAND_ERROR': return { ...state, lastError: action.payload.message, commandBusy: false }
    case 'SET_COMMAND_BUSY': return { ...state, commandBusy: action.payload }
    case 'SET_COMMAND_RESULT': return { ...state, lastCommandResult: action.payload, commandBusy: false }
    case 'CLEAR_ERROR': return { ...state, lastError: null }
    case 'UPDATE_DATA': return { ...state, ...action.payload }
    default: return state
  }
}

interface MCTRLSessionContextValue { state: MCTRLSessionState; dispatch: React.Dispatch<MCTRLAction> }
const MCTRLSessionContext = createContext<MCTRLSessionContextValue | null>(null)

export const MCTRLSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(mctrlReducer, initialState)
  return <MCTRLSessionContext.Provider value={{ state, dispatch }}>{children}</MCTRLSessionContext.Provider>
}

export function useMCTRLSession(): MCTRLSessionContextValue {
  const ctx = useContext(MCTRLSessionContext)
  if (!ctx) throw new Error('useMCTRLSession must be used within MCTRLSessionProvider')
  return ctx
}
