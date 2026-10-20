import React, { useState } from 'react'
import { useTUSession } from '../state/TUSessionState'
import { tuSeriesAPI } from '@shared/api/bridge'
import './TURemotePage.css'

export const TURemotePage: React.FC = () => {
  const { state, dispatch } = useTUSession()
  const [busyKeys, setBusyKeys] = useState<Record<string, boolean>>({})

  const sendRemoteCommand = async (actionByte: number, keyName: string, isPower = false) => {
    if (!state.sessionId) return

    if (isPower) {
       const confirm = window.confirm("Power komutu gönderilecek. Cihazın davranışı değişebilir. Devam etmek istiyor musunuz?")
       if (!confirm) return
    }

    setBusyKeys(prev => ({ ...prev, [keyName]: true }))
    dispatch({ type: 'SET_COMMAND_RESULT', payload: `Gönderiliyor: ${keyName}...` })

    try {
      const res = await tuSeriesAPI().sendCommand({ 
         sessionId: state.sessionId, 
         command: 'setRemoteCommand', 
         params: { actionByte } 
      })

      if (res.success && (res.data as any)?.ack !== false) {
         dispatch({ type: 'SET_COMMAND_RESULT', payload: `Başarılı: ${keyName}` })
      } else {
         dispatch({ type: 'COMMAND_ERROR', payload: { message: `Başarısız: ${keyName}` } })
      }
    } catch (err) {
      dispatch({ type: 'COMMAND_ERROR', payload: { message: `Hata: ${String(err)}` } })
    } finally {
      setBusyKeys(prev => ({ ...prev, [keyName]: false }))
    }
  }

  const isDisconnected = state.status !== 'connected'

  return (
    <div className="page-panel fade-in tu-remote-page">
      <div className="page-panel-header">
        <h2 className="page-panel-title">Kumanda</h2>
        <p>Cihazınızı uzaktan yönetmek için temel navigasyon ve kontrol tuşları.</p>
      </div>

      <div className="remote-wrapper">
         <div className="remote-controller">
           {/* Üst Grup */}
           <div className="remote-top-group">
              <button 
                className="remote-btn btn-danger" 
                disabled={isDisconnected || busyKeys['Power']}
                onClick={() => sendRemoteCommand(0x04, 'Power', true)}
              >
                 ⏻
              </button>
              <button 
                className="remote-btn" 
                disabled={isDisconnected || busyKeys['Home']}
                onClick={() => sendRemoteCommand(0x01, 'Home')}
              >
                 🏠
              </button>
              <button 
                className="remote-btn" 
                disabled={isDisconnected || busyKeys['Menu']}
                onClick={() => sendRemoteCommand(0x03, 'Menu')}
              >
                 ≡
              </button>
              <button 
                className="remote-btn" 
                disabled={isDisconnected || busyKeys['Back']}
                onClick={() => sendRemoteCommand(0x02, 'Back')}
              >
                 ↩
              </button>
           </div>

           {/* Orta Grup - D-Pad */}
           <div className="remote-dpad-group">
              <div className="dpad-row">
                 <button 
                   className="remote-btn dpad-btn" 
                   disabled={isDisconnected || busyKeys['Up']}
                   onClick={() => sendRemoteCommand(0x08, 'Up')}
                 >
                    ▲
                 </button>
              </div>
              <div className="dpad-row dpad-middle-row">
                 <button 
                   className="remote-btn dpad-btn" 
                   disabled={isDisconnected || busyKeys['Left']}
                   onClick={() => sendRemoteCommand(0x0A, 'Left')}
                 >
                    ◀
                 </button>
                 <button 
                   className="remote-btn dpad-confirm" 
                   disabled={isDisconnected || busyKeys['Confirm']}
                   onClick={() => sendRemoteCommand(0x0C, 'Confirm')}
                 >
                    OK
                 </button>
                 <button 
                   className="remote-btn dpad-btn" 
                   disabled={isDisconnected || busyKeys['Right']}
                   onClick={() => sendRemoteCommand(0x0B, 'Right')}
                 >
                    ▶
                 </button>
              </div>
              <div className="dpad-row">
                 <button 
                   className="remote-btn dpad-btn" 
                   disabled={isDisconnected || busyKeys['Down']}
                   onClick={() => sendRemoteCommand(0x09, 'Down')}
                 >
                    ▼
                 </button>
              </div>
           </div>

           {/* Ek Grup */}
           <div className="remote-bottom-group">
              <button 
                className="remote-btn source-btn" 
                disabled={isDisconnected || busyKeys['Source']}
                onClick={() => sendRemoteCommand(0x05, 'Source')}
              >
                 📡 Switch Signal Source
              </button>
           </div>
         </div>
      </div>

      {state.lastCommandResult && (
        <div className="result-box mt-4">
          <div className="result-box-label">Son İşlem</div>
          <pre className="result-box-content">{state.lastCommandResult}</pre>
        </div>
      )}
      
      {state.lastError && (
        <div className="error-box mt-4">
          <span>⚠ {state.lastError}</span>
          <button className="btn btn-ghost btn-xs" onClick={() => dispatch({ type: 'CLEAR_ERROR' })}>✕</button>
        </div>
      )}
    </div>
  )
}
