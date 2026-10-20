import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { vxProAPI } from '@shared/api/bridge'

export type VXProStatus = 'disconnected' | 'connecting' | 'connected_unverified' | 'connected_verified' | 'error'

interface VXProState {
  status: VXProStatus
  sessionId?: string
  ipAddress?: string
  deviceName?: string
  lastError?: string
}

type VXProAction =
  | { type: 'CONNECTING'; payload: { sessionId: string; ipAddress: string; deviceName?: string } }
  | { type: 'CONNECTED_UNVERIFIED' }
  | { type: 'CONNECTED_VERIFIED' }
  | { type: 'ERROR'; payload: { message: string } }
  | { type: 'DISCONNECT' }

const initialState: VXProState = {
  status: 'disconnected',
}

function vxProReducer(state: VXProState, action: VXProAction): VXProState {
  switch (action.type) {
    case 'CONNECTING':
      return {
        ...state,
        status: 'connecting',
        sessionId: action.payload.sessionId,
        ipAddress: action.payload.ipAddress,
        deviceName: action.payload.deviceName,
        lastError: undefined,
      }
    case 'CONNECTED_UNVERIFIED':
      return { ...state, status: 'connected_unverified', lastError: undefined }
    case 'CONNECTED_VERIFIED':
      return { ...state, status: 'connected_verified', lastError: undefined }
    case 'ERROR':
      return { ...state, status: 'error', lastError: action.payload.message }
    case 'DISCONNECT':
      return { ...initialState }
    default:
      return state
  }
}

const VXProSessionContext = createContext<{
  state: VXProState
  dispatch: React.Dispatch<VXProAction>
} | null>(null)

export const VXProSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(vxProReducer, initialState)

  // Arka planla senkronizasyon için basit polling
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const result = await vxProAPI().getStatus()
        if (result.status !== state.status) {
          if (result.status === 'connected_verified') dispatch({ type: 'CONNECTED_VERIFIED' })
          else if (result.status === 'connected_unverified') dispatch({ type: 'CONNECTED_UNVERIFIED' })
          else if (result.status === 'error') dispatch({ type: 'ERROR', payload: { message: result.lastError || 'Unknown Error' } })
          else if (result.status === 'disconnected') dispatch({ type: 'DISCONNECT' })
        }
      } catch (err) {
        /* silent */
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [state.status])

  return (
    <VXProSessionContext.Provider value={{ state, dispatch }}>
      {children}
    </VXProSessionContext.Provider>
  )
}

export function useVXProSession() {
  const context = useContext(VXProSessionContext)
  if (!context) {
    throw new Error('useVXProSession must be used within a VXProSessionProvider')
  }
  return context
}
