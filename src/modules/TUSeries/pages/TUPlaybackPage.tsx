import React, { useState } from 'react'
import { useTUSession } from '../state/TUSessionState'
import { tuSeriesAPI } from '@shared/api/bridge'
import './TUPlaybackPage.css'

export const TUPlaybackPage: React.FC = () => {
  const { state, dispatch } = useTUSession()
  const [programCount, setProgramCount] = useState<number | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number>(1)
  const [lastPlayedProgram, setLastPlayedProgram] = useState<number | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  const isDisconnected = state.status !== 'connected'
  const isPlaybackDisabled = isDisconnected || programCount === null

  const handleCommand = async (commandName: string, actionName: string, params?: Record<string, any>) => {
    if (!state.sessionId) return
    setBusyAction(actionName)
    dispatch({ type: 'SET_COMMAND_BUSY', payload: true })
    
    try {
      const res = await tuSeriesAPI().sendCommand({
        sessionId: state.sessionId,
        command: commandName,
        params
      })

      if (res.success && (res.data as any)?.ack !== false) {
         dispatch({ type: 'SET_COMMAND_RESULT', payload: `Başarılı: ${actionName}` })
         
         if (commandName === 'initProgramList' && res.data) {
             const data = res.data as { programCount?: number }
             if (data.programCount !== undefined) {
                 setProgramCount(data.programCount)
             }
         } else if (commandName === 'setPlayProgram') {
             setLastPlayedProgram(params?.index || null)
         }

      } else {
         dispatch({ type: 'COMMAND_ERROR', payload: { message: `Başarısız: ${actionName}` } })
      }
    } catch (err) {
      dispatch({ type: 'COMMAND_ERROR', payload: { message: `Hata: ${String(err)}` } })
    } finally {
      setBusyAction(null)
      dispatch({ type: 'SET_COMMAND_BUSY', payload: false })
    }
  }

  const programOptions = []
  if (programCount) {
     for (let i = 1; i <= programCount; i++) {
        programOptions.push(i)
     }
  }

  return (
    <div className="page-panel fade-in tu-playback-page">
      <div className="page-panel-header">
        <h2 className="page-panel-title">Oynatma (Playback)</h2>
        <p>Cihaz üzerindeki programları listele ve yönet.</p>
      </div>

      <div className="pb-cards-grid">
         {/* Program Initialization Card */}
         <div className="pb-card">
            <h3>Program Listesi</h3>
            <p>Medya kontrollerini açmak için cihazdaki program listesini yükleyin.</p>
            <div className="pb-action-row">
               <button 
                  className="btn btn-primary"
                  onClick={() => handleCommand('initProgramList', 'Program Yükle')}
                  disabled={isDisconnected || busyAction !== null}
               >
                  {busyAction === 'Program Yükle' ? 'Yükleniyor...' : 'Programları Yükle'}
               </button>
               {programCount !== null && (
                  <div className="pb-badge">
                     Toplam: {programCount} Program
                  </div>
               )}
            </div>
         </div>

         {/* Screen Power Card */}
         <div className="pb-card">
            <h3>Ekran Gücü</h3>
            <p>Oynatmadan bağımsız olarak ekran ışığını açıp kapatabilirsiniz.</p>
            <div className="pb-action-row">
               <button 
                  className="btn btn-success"
                  onClick={() => handleCommand('setScreenPower', 'Screen On', { isOn: true })}
                  disabled={isDisconnected || busyAction !== null}
               >
                  Screen On
               </button>
               <button 
                  className="btn btn-danger"
                  onClick={() => handleCommand('setScreenPower', 'Screen Off', { isOn: false })}
                  disabled={isDisconnected || busyAction !== null}
               >
                  Screen Off
               </button>
            </div>
         </div>
      </div>

      <div className={`pb-playback-area ${isPlaybackDisabled ? 'disabled' : ''}`}>
         <h3>Oynatma Kontrolleri</h3>
         
         <div className="pb-select-row">
            <select 
               className="pb-select"
               value={selectedIndex}
               onChange={(e) => setSelectedIndex(Number(e.target.value))}
               disabled={isPlaybackDisabled || busyAction !== null}
            >
               {programOptions.length > 0 ? programOptions.map(num => (
                  <option key={num} value={num}>Program {num}</option>
               )) : <option value={1}>Liste Boş</option>}
            </select>
            <button 
               className="btn btn-primary"
               onClick={() => handleCommand('setPlayProgram', `Play Program ${selectedIndex}`, { index: selectedIndex })}
               disabled={isPlaybackDisabled || busyAction !== null}
            >
               Seçili Programı Oynat
            </button>
         </div>

         {lastPlayedProgram !== null && (
            <div className="pb-last-played">
               Son oynatılan: Program {lastPlayedProgram}
            </div>
         )}

         <div className="pb-media-controls">
            <button 
               className="pb-media-btn"
               onClick={() => handleCommand('setPlaybackAction', 'Previous', { actionByte: 0x06 })}
               disabled={isPlaybackDisabled || busyAction !== null}
               title="Önceki Program"
            >
               ⏮
            </button>
            <button 
               className="pb-media-btn"
               onClick={() => handleCommand('setPlaybackAction', 'Pause', { actionByte: 0x03 })}
               disabled={isPlaybackDisabled || busyAction !== null}
               title="Duraklat"
            >
               ⏸
            </button>
            <button 
               className="pb-media-btn"
               onClick={() => handleCommand('setPlaybackAction', 'Resume', { actionByte: 0x04 })}
               disabled={isPlaybackDisabled || busyAction !== null}
               title="Devam Et"
            >
               ▶
            </button>
            <button 
               className="pb-media-btn"
               onClick={() => handleCommand('setPlaybackAction', 'Exit', { actionByte: 0x05 })}
               disabled={isPlaybackDisabled || busyAction !== null}
               title="Çıkış (Exit)"
            >
               ⏹
            </button>
            <button 
               className="pb-media-btn"
               onClick={() => handleCommand('setPlaybackAction', 'Next', { actionByte: 0x07 })}
               disabled={isPlaybackDisabled || busyAction !== null}
               title="Sonraki Program"
            >
               ⏭
            </button>
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
