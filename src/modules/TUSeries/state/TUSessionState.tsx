import React, { createContext, useContext, useReducer } from 'react'

export type TUConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface TUSessionState {
  status: TUConnectionStatus
  sessionId: string | null
  deviceName: string
  ipAddress: string
  port: number
  deviceInfo: Record<string, string> | null
  lastError: string | null
  lastCommandResult: string | null
  commandBusy: boolean
  dashboardReady: boolean
  
  sourceIndex: number | null
  sourceStatus: 'loading' | 'verified' | 'provisional' | 'unreadable'
  volume: number | null
  isMuted: boolean | null
  isWiredNetworkConnected: boolean | null
  systemStatus: string | null
  sourceAvailability: Record<number, boolean> | null
  brightness: number | null
  initialFetchDone: boolean
}

const initialState: TUSessionState = {
  status: 'disconnected',
  deviceName: '',
  ipAddress: '',
  port: 5201,
  deviceInfo: null,
  lastError: null,
  lastCommandResult: null,
  commandBusy: false,
  dashboardReady: false,
  sourceIndex: null,
  sourceStatus: 'loading',
  volume: null,
  isMuted: null,
  isWiredNetworkConnected: null,
  systemStatus: null,
  sourceAvailability: null,
  brightness: null,
  initialFetchDone: false,
}

type TUAction =
  | { type: 'CONNECTING'; payload: { sessionId: string; deviceName: string; ipAddress: string } }
  | { type: 'CONNECTED'; payload: { deviceInfo?: Record<string, string> } }
  | { type: 'DISCONNECTED' }
  | { type: 'ERROR'; payload: { message: string } }
  | { type: 'COMMAND_ERROR'; payload: { message: string } }
  | { type: 'SET_COMMAND_BUSY'; payload: boolean }
  | { type: 'SET_COMMAND_RESULT'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'UPDATE_DATA'; payload: Partial<TUSessionState> }

function tuReducer(state: TUSessionState, action: TUAction): TUSessionState {
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

interface TUSessionContextValue { state: TUSessionState; dispatch: React.Dispatch<TUAction> }
const TUSessionContext = createContext<TUSessionContextValue | null>(null)

export const TUSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(tuReducer, initialState)
  return <TUSessionContext.Provider value={{ state, dispatch }}>{children}</TUSessionContext.Provider>
}

export function useTUSession(): TUSessionContextValue {
  const ctx = useContext(TUSessionContext)
  if (!ctx) throw new Error('useTUSession must be used within TUSessionProvider')
  return ctx
}
