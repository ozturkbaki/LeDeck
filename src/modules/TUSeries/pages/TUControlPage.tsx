import React, { useState, useEffect, useRef } from 'react'
import { useTUSession } from '../state/TUSessionState'
import { tuSeriesAPI } from '@shared/api/bridge'
import './TUDevicePage.css' // Re-using existing CSS structure

export const TUControlPage: React.FC = () => {
  const { state, dispatch } = useTUSession()
  const [volInput, setVolInput] = useState<number>(Number(state.volume) || 0)
  const [brightInput, setBrightInput] = useState<number>(Number(state.brightness) || 0)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)
  const brightDebounceTimer = useRef<NodeJS.Timeout | null>(null)

  // Sync internal state if external UI polling catches a new volume
  useEffect(() => {
    if (state.volume !== null && state.volume !== undefined) {
      setVolInput(Number(state.volume))
    }
  }, [state.volume])

  // Sync internal state if external UI polling catches a new brightness
  useEffect(() => {
    if (state.brightness !== null && state.brightness !== undefined) {
      setBrightInput(Number(state.brightness))
    }
  }, [state.brightness])

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms))

  const sendCommandAndVerify = async (commandName: string, params: any, successMsg: string) => {
    if (!state.sessionId) return false
    dispatch({ type: 'SET_COMMAND_BUSY', payload: true })
    try {
      const result = await tuSeriesAPI().sendCommand({ sessionId: state.sessionId, command: commandName, params })
      if (result.success && (result.data as any)?.ack !== false) {
        dispatch({ type: 'SET_COMMAND_RESULT', payload: successMsg })
        return true
      } else {
         dispatch({ type: 'COMMAND_ERROR', payload: { message: result.message || `Komut başarısız oldu (${commandName})` } })
         return false
      }
    } catch (e) {
      dispatch({ type: 'COMMAND_ERROR', payload: { message: `Komut hatası: ${String(e)}` } })
      return false
    } finally {
      dispatch({ type: 'SET_COMMAND_BUSY', payload: false })
    }
  }

  // 1. Source Switch with Read-After-Write Verification and PRE-FLIGHT Check
  const switchSource = async (idx: number, name: string) => {
    if (!state.sessionId) return
    
    // PRE-FLIGHT CHECK: Verify signal presence first
    dispatch({ type: 'SET_COMMAND_BUSY', payload: true })
    try {
      const hdmiStatusRes = await tuSeriesAPI().sendCommand({ sessionId: state.sessionId, command: 'getHdmiStatus' })
      if (!hdmiStatusRes.success || !hdmiStatusRes.data) {
        dispatch({ type: 'COMMAND_ERROR', payload: { message: `Kaynak durumu okunamadi. İşlem iptal edildi.` } })
        return
      }

      const statusMap = hdmiStatusRes.data as any
      // Maps idx to property name retrieved from parser
      const getActiveStatus = (targetIdx: number) => {
         if (targetIdx === 0) return statusMap.isAndroidConnected
         if (targetIdx === 1) return statusMap.isHdmi1Connected
         if (targetIdx === 2) return statusMap.isHdmi2Connected
         if (targetIdx === 3) return statusMap.isHdmi3Connected
         return false
      }

      const newAvailability = {
         0: statusMap.isAndroidConnected === true,
         1: statusMap.isHdmi1Connected === true,
         2: statusMap.isHdmi2Connected === true,
         3: statusMap.isHdmi3Connected === true,
      }
      dispatch({ type: 'UPDATE_DATA', payload: { sourceAvailability: newAvailability } })

      const isActive = getActiveStatus(idx)
      if (!isActive) {
        // Disconnected signal detected
        dispatch({ type: 'COMMAND_ERROR', payload: { message: `Seçilen kaynakta sinyal yok.` } })
        
        // 5s warning auto-hide and re-fetch per UX revision
        setTimeout(async () => {
          dispatch({ type: 'CLEAR_ERROR' })
          
          if (!state.sessionId) return
          // Refresh background reading quietly
          try {
            const readRes = await tuSeriesAPI().sendCommand({ sessionId: state.sessionId, command: 'getCurrentSource' })
            if (readRes.success && readRes.data) {
              const payloadData = readRes.data as { sourceIndex?: number | string }
              if (payloadData.sourceIndex !== undefined) {
                 dispatch({ type: 'UPDATE_DATA', payload: { sourceIndex: Number(payloadData.sourceIndex) } })
              }
            }
          } catch (e) {
             console.error('Source re-fetch error:', e)
          }
        }, 5000)

        return
      }
    } catch (err) {
      dispatch({ type: 'COMMAND_ERROR', payload: { message: `Durum kontrolü hatası: ${String(err)}` } })
      return
    } finally {
      dispatch({ type: 'SET_COMMAND_BUSY', payload: false })
    }

    // IF WE REACH HERE, SOURCE IS ACTIVE!
    // We must wait slightly because we just sent getHdmiStatus
    await delay(1000)

    const success = await sendCommandAndVerify('setSource', { sourceIndex: idx }, `Kaynak değiştiriliyor: ${name}...`)
    if (success) {
      dispatch({ type: 'SET_COMMAND_BUSY', payload: true })
      let verified = false
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        await delay(1200) // Wait before each read attempt
        try {
          const readRes = await tuSeriesAPI().sendCommand({ sessionId: state.sessionId, command: 'getCurrentSource' })
          if (readRes.success && readRes.data) {
            const payloadData = readRes.data as { sourceIndex?: number | string }
            if (payloadData.sourceIndex !== undefined) {
               dispatch({ type: 'UPDATE_DATA', payload: { sourceIndex: Number(payloadData.sourceIndex), sourceStatus: 'verified' } })
               dispatch({ type: 'SET_COMMAND_RESULT', payload: `Kaynak doğrulandı: ${name}` })
               localStorage.setItem(`tu_last_source_${state.ipAddress}`, String(payloadData.sourceIndex))
               verified = true
               break // Escaping the loop early
            }
          }
        } catch (err) {
          console.error(`Doğrulama hatası (Deneme ${attempt}):`, err)
        }
        
        if (!verified && attempt < 3) {
           console.log(`[TU Control] Doğrulama alınamadı, tekrar deneniyor (Deneme ${attempt+1})...`)
        }
      }

      if (!verified) {
         console.log(`[TU Control] Tüm doğrulama denemeleri başarısız. Fallback uygulandı: ${name}`)
         dispatch({ type: 'UPDATE_DATA', payload: { sourceIndex: idx, sourceStatus: 'provisional' } })
         dispatch({ type: 'SET_COMMAND_RESULT', payload: `Geçiş yapıldı (Teyitsiz): ${name}` })
         localStorage.setItem(`tu_last_source_${state.ipAddress}`, String(idx))
      }

      dispatch({ type: 'SET_COMMAND_BUSY', payload: false })
    }
  }

  // 2. Volume Change (Debounced) with Read-After-Write Verification
  const handleVolChange = (valStr: string) => {
    if (!state.sessionId) return
    const val = parseInt(valStr, 10)
    setVolInput(val)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)

    debounceTimer.current = setTimeout(async () => {
      const success = await sendCommandAndVerify('setVolume', { volume: val }, `Ses seviyesi ayarlanıyor: ${val}%...`)
      if (success) {
        await delay(500) // Short wait for device to apply
        dispatch({ type: 'SET_COMMAND_BUSY', payload: true })
        try {
          const readRes = await tuSeriesAPI().sendCommand({ sessionId: state.sessionId, command: 'getSystemVolume' })
          if (readRes.success && readRes.data) {
            const payloadData = readRes.data as { volume?: number | string }
            if (payloadData.volume !== undefined) {
               dispatch({ type: 'UPDATE_DATA', payload: { volume: Number(payloadData.volume) } })
               dispatch({ type: 'SET_COMMAND_RESULT', payload: `Ses doğrulandı: ${Number(payloadData.volume)}%` })
            }
          }
        } catch (err) {
          console.error('Doğrulama hatası:', err)
        } finally {
          dispatch({ type: 'SET_COMMAND_BUSY', payload: false })
        }
      }
    }, 400) // 400ms debounce
  }

  // 3. Brightness Change (Debounced) with Read-After-Write Verification
  const handleBrightChange = (valStr: string) => {
    if (!state.sessionId) return
    const val = parseInt(valStr, 10)
    setBrightInput(val)
    if (brightDebounceTimer.current) clearTimeout(brightDebounceTimer.current)

    brightDebounceTimer.current = setTimeout(async () => {
      const success = await sendCommandAndVerify('setBrightness', { percent: val }, `Parlaklık ayarlanıyor: ${val}%...`)
      if (success) {
        await delay(500) // Short wait for device to apply
        dispatch({ type: 'SET_COMMAND_BUSY', payload: true })
        try {
          const readRes = await tuSeriesAPI().sendCommand({ sessionId: state.sessionId, command: 'getBrightness' })
          if (readRes.success && readRes.data) {
            const payloadData = readRes.data as { brightness?: number | string }
            if (payloadData.brightness !== undefined) {
               dispatch({ type: 'UPDATE_DATA', payload: { brightness: Number(payloadData.brightness) } })
               dispatch({ type: 'SET_COMMAND_RESULT', payload: `Parlaklık doğrulandı: ${Number(payloadData.brightness)}%` })
            }
          }
        } catch (err) {
          console.error('Parlaklık doğrulama hatası:', err)
        } finally {
          dispatch({ type: 'SET_COMMAND_BUSY', payload: false })
        }
      }
    }, 400) // 400ms debounce for Brightness
  }

  // 4. Power Management
  const handlePowerCommand = async (commandName: string, label: string) => {
    if (!state.sessionId) return
    
    if (commandName === 'setPowerOff') {
       const confirmed = window.confirm("Cihaz kapatılacak ve bağlantı kesilebilir. Devam etmek istediğinize emin misiniz?")
       if (!confirmed) return
    }

    const success = await sendCommandAndVerify(commandName, {}, `Komut iletildi: ${label}`)
    if (success && commandName !== 'setPowerOff') {
       // Wait slightly, then verify status
       await delay(1000)
       dispatch({ type: 'SET_COMMAND_BUSY', payload: true })
       try {
          const statRes = await tuSeriesAPI().sendCommand({ sessionId: state.sessionId, command: 'getSystemStatus' })
          if (statRes.success && statRes.data) {
             const payloadData = statRes.data as { status?: string }
             if (payloadData.status !== undefined) {
               dispatch({ type: 'UPDATE_DATA', payload: { systemStatus: payloadData.status } })
               dispatch({ type: 'SET_COMMAND_RESULT', payload: `Durum güncellendi: ${payloadData.status}` })
             }
          }

          if (commandName === 'setWakeUp') {
             await delay(1000) // Ekstra bekleme, cihazın portları tanıması zaman alabilir
             
             // 1. HDMI Status
             const hdmiRes = await tuSeriesAPI().sendCommand({ sessionId: state.sessionId, command: 'getHdmiStatus' })
             if (hdmiRes.success && hdmiRes.data) {
                const statMap = hdmiRes.data as any
                dispatch({
                  type: 'UPDATE_DATA',
                  payload: {
                    sourceAvailability: {
                      0: statMap.isAndroidConnected === true,
                      1: statMap.isHdmi1Connected === true,
                      2: statMap.isHdmi2Connected === true,
                      3: statMap.isHdmi3Connected === true,
                    }
                  }
                })
             }
             
             await delay(500)
             
             // 2. Current Source
             const sourceRes = await tuSeriesAPI().sendCommand({ sessionId: state.sessionId, command: 'getCurrentSource' })
             if (sourceRes.success && sourceRes.data) {
                const srcData = sourceRes.data as any
                if (srcData.sourceIndex !== undefined) {
                   dispatch({ type: 'UPDATE_DATA', payload: { sourceIndex: Number(srcData.sourceIndex), sourceStatus: 'verified' } })
                }
             }
          }
       } catch (err) {
          console.error('Durum doğrulama hatası:', err)
       } finally {
          dispatch({ type: 'SET_COMMAND_BUSY', payload: false })
       }
    }
  }

  const isCmdBusy = state.commandBusy || state.status !== 'connected'

  return (
    <div className="page-panel fade-in">
      <div className="page-panel-header">
        <h2 className="page-panel-title">Kontrol Paneli</h2>
        <p>TU cihazınıza ait yazma ve yönetim kontrolleri buradan sağlanır.</p>
      </div>

      <div className="info-grid">
        
        {/* Source Switch Panel */}
        <div className="info-card" style={{ gridColumn: 'span 2' }}>
          <div className="info-card-label" style={{ marginBottom: 12 }}>Kaynak Seçimi (Source Switch)</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            { [
              { idx: 0, label: 'Android' },
              { idx: 1, label: 'HDMI 1' },
              { idx: 2, label: 'HDMI 2' },
              { idx: 3, label: 'HDMI 3' }
            ].map(src => {
              const isActiveSource = state.sourceIndex === src.idx;
              const isAvailable = state.sourceAvailability?.[src.idx] === true;
              
              let btnClass = 'btn-secondary';
              if (isActiveSource) btnClass = 'btn-success';
              else if (isAvailable) btnClass = 'btn-primary';

              return (
                <button 
                  key={src.idx}
                  className={`btn btn-sm ${btnClass}`} 
                  disabled={isCmdBusy} 
                  onClick={() => switchSource(src.idx, src.label)}
                >
                  {src.label}
                </button>
              )
            }) }
          </div>
        </div>

        {/* Audio Panel - Removed Mute as per revision */}

        {/* Volume Panel */}
        <div className="info-card" style={{ gridColumn: 'span 2' }}>
          <div className="info-card-label" style={{ marginBottom: 16 }}>Sistem Sesi (Volume)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span>0</span>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={volInput} 
              onChange={e => handleVolChange(e.target.value)} 
              disabled={isCmdBusy}
              style={{ flex: 1, accentColor: 'var(--color-tu)', cursor: isCmdBusy ? 'not-allowed' : 'pointer' }}
            />
            <span style={{ fontWeight: 'bold', width: 44, textAlign: 'right' }}>{volInput}%</span>
          </div>
        </div>

        {/* Brightness Panel */}
        <div className="info-card" style={{ gridColumn: 'span 2' }}>
          <div className="info-card-label" style={{ marginBottom: 16 }}>Parlaklık (Brightness)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span>0</span>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={brightInput} 
              onChange={e => handleBrightChange(e.target.value)} 
              disabled={isCmdBusy}
              style={{ flex: 1, accentColor: 'var(--color-tu)', cursor: isCmdBusy ? 'not-allowed' : 'pointer' }}
            />
            <span style={{ fontWeight: 'bold', width: 44, textAlign: 'right' }}>{brightInput}%</span>
          </div>
        </div>

        {/* Power Management Panel */}
        <div className="info-card" style={{ gridColumn: 'span 2' }}>
          <div className="info-card-label" style={{ marginBottom: 12 }}>Güç Yönetimi</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
             <button 
                className="btn btn-sm btn-secondary" 
                disabled={isCmdBusy}
                onClick={() => handlePowerCommand('setStandby', 'Standby (Uyku Modu)')}
             >
                Standby
             </button>
             <button 
                className="btn btn-sm btn-secondary" 
                disabled={isCmdBusy}
                onClick={() => handlePowerCommand('setWakeUp', 'Wake Up (Uyanma)')}
             >
                Wake Up
             </button>
             <button 
                className="btn btn-sm" 
                disabled={isCmdBusy}
                onClick={() => handlePowerCommand('setPowerOff', 'Power Off')}
                style={{ backgroundColor: '#ef4444', color: 'white' }}
             >
                Power Off
             </button>
          </div>
        </div>

      </div>

      {state.lastCommandResult && (
        <div className="result-box mt-4">
          <div className="result-box-label">Son Yanıt</div>
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
