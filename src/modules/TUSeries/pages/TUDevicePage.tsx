import React, { useEffect, useRef, useState } from 'react'
import { useTUSession } from '../state/TUSessionState'
import { tuSeriesAPI } from '@shared/api/bridge'
import { DeviceImageBanner } from '@shared/components/DeviceImageBanner'
import './TUDevicePage.css'

export const TUDevicePage: React.FC = () => {
  const { state, dispatch } = useTUSession()
  const fetchedRef = useRef(false)
  const fetchStatusRef = useRef(false) // Tek cycle mantığı için kilit
  const [loadingCard, setLoadingCard] = useState<string | null>(null)

  const fetchStatus = async () => {
    if (!state.sessionId) return
    if (fetchStatusRef.current) {
      console.log('[TU Read Cycle] Zaten bir okuma döngüsü çalışıyor, istek reddedildi.')
      return
    }
    
    fetchStatusRef.current = true
    dispatch({ type: 'SET_COMMAND_BUSY', payload: true })
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms))

    // Verification komutuyla çakışmaması için en başta biraz bekleyelim
    await delay(500)

    try {
        console.log('[TU Read Cycle] Başlıyor...')
        
        // 1. Brightness
        console.log('[TU Read Cycle] 1. getBrightness')
        try {
          const brightRes = await tuSeriesAPI().sendCommand({ sessionId: state.sessionId, command: 'getBrightness' })
          if (brightRes.success && brightRes.data) {
             const payloadData = brightRes.data as { brightness?: number }
             if (payloadData.brightness !== undefined) {
               dispatch({ type: 'UPDATE_DATA', payload: { brightness: Number(payloadData.brightness) } })
             }
          }
        } catch (e) { console.error('Brightness fetch error', e) }

        await delay(400)

        // 2. System Volume
        console.log('[TU Read Cycle] 2. getSystemVolume')
        try {
          const volRes = await tuSeriesAPI().sendCommand({ sessionId: state.sessionId, command: 'getSystemVolume' })
          if (volRes.success && volRes.data) {
            const payloadData = volRes.data as { volume?: number | string; isMuted?: boolean | number | string }
            if (payloadData.volume !== undefined) {
              dispatch({ 
                type: 'UPDATE_DATA', 
                payload: { 
                  volume: Number(payloadData.volume), 
                  isMuted: payloadData.isMuted === true || String(payloadData.isMuted) === 'true' || Number(payloadData.isMuted) === 1
                } 
              })
            }
          }
        } catch (e) { console.error('Volume fetch error', e) }

        await delay(400)

        // 3. Wired Network
        console.log('[TU Read Cycle] 3. getWiredNetwork')
        try {
          const netRes = await tuSeriesAPI().sendCommand({ sessionId: state.sessionId, command: 'getWiredNetwork' })
          if (netRes.success && netRes.data) {
            const payloadData = netRes.data as { isConnected?: boolean | number | string }
            if (payloadData.isConnected !== undefined) {
              dispatch({ 
                type: 'UPDATE_DATA', 
                payload: { 
                  isWiredNetworkConnected: payloadData.isConnected === true || String(payloadData.isConnected) === 'true' || Number(payloadData.isConnected) === 1
                } 
              })
            }
          }
        } catch (e) { console.error('Network fetch error', e) }

        await delay(400)

        // 4. System Status
        console.log('[TU Read Cycle] 4. getSystemStatus')
        try {
          const statRes = await tuSeriesAPI().sendCommand({ sessionId: state.sessionId, command: 'getSystemStatus' })
          if (statRes.success && statRes.data) {
            const payloadData = statRes.data as { status?: string }
            if (payloadData.status !== undefined) {
              dispatch({ type: 'UPDATE_DATA', payload: { systemStatus: payloadData.status } })
            }
          }
        } catch (e) { console.error('Status fetch error', e) }
        
        await delay(400)

        // 5. HDMI Status
        console.log('[TU Read Cycle] 5. getHdmiStatus')
        let fallbackSourceIdx: number | null = null;
        try {
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
             // Sadece tek bir aktif kaynak varsa fallback olarak kullanılabilir
             const activeSources: number[] = []
             if (statMap.isAndroidConnected) activeSources.push(0)
             if (statMap.isHdmi1Connected) activeSources.push(1)
             if (statMap.isHdmi2Connected) activeSources.push(2)
             if (statMap.isHdmi3Connected) activeSources.push(3)

             if (activeSources.length === 1) {
                fallbackSourceIdx = activeSources[0]
             }
          }
        } catch (e) { console.error('HDMI Status fetch error', e) }

        await delay(400)

        // 6. Current Source (Synchronous Retry)
        console.log('[TU Read Cycle] 6. getCurrentSource')
        dispatch({ type: 'UPDATE_DATA', payload: { sourceStatus: 'loading' } })
        let sourceSuccess = false
        const retryCount = 3
        
        for (let i = 0; i < retryCount; i++) {
          try {
            const sourceRes = await tuSeriesAPI().sendCommand({ sessionId: state.sessionId!, command: 'getCurrentSource' })
            if (sourceRes.success && sourceRes.data) {
              const payloadData = sourceRes.data as { sourceIndex?: number | string }
              if (payloadData.sourceIndex !== undefined) {
                dispatch({ type: 'UPDATE_DATA', payload: { sourceIndex: Number(payloadData.sourceIndex), sourceStatus: 'verified' } })
                sourceSuccess = true
                break
              }
            }
          } catch (e) {
            console.error(`Source fetch error (attempt ${i + 1})`, e)
          }
          if (i < retryCount - 1) {
             console.log(`[TU Read Cycle] getCurrentSource failed, retrying (${i+1}/${retryCount})...`)
             await delay(500)
          }
        }
        
        if (!sourceSuccess) {
           // Fallback to single active HDMI Status or preserve last known source
           if (fallbackSourceIdx !== null) {
              dispatch({ type: 'UPDATE_DATA', payload: { sourceIndex: fallbackSourceIdx, sourceStatus: 'provisional' } })
           } else if (state.sourceIndex !== null) {
              // Birden fazla varsa veya aktif yoksa, bilinen son kaynağı koru
              dispatch({ type: 'UPDATE_DATA', payload: { sourceStatus: 'provisional' } })
           } else {
              // Hiç veri yoksa tamamen başarısız ol
              dispatch({ type: 'UPDATE_DATA', payload: { sourceIndex: null, sourceStatus: 'unreadable' } })
           }
        }

    } catch (err) {
      console.error('[TUDevicePage] Fatal fetch sequence error:', err)
    } finally {
      dispatch({ type: 'SET_COMMAND_BUSY', payload: false })
      fetchStatusRef.current = false // Döngü kilidini kaldır
      console.log('[TU Read Cycle] Tamamlandı.')
    }
  }

  const refreshCard = async (cardName: string) => {
    if (!state.sessionId || fetchStatusRef.current || loadingCard || state.commandBusy) return
    
    setLoadingCard(cardName)
    dispatch({ type: 'SET_COMMAND_BUSY', payload: true })
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms))

    try {
      console.log(`[TU Mini Refresh] Kart güncelleniyor: ${cardName}`)
      
      if (cardName === 'brightness') {
          const res = await tuSeriesAPI().sendCommand({ sessionId: state.sessionId, command: 'getBrightness' })
          if (res.success && res.data) {
             const payloadData = res.data as { brightness?: number }
             if (payloadData.brightness !== undefined) {
               dispatch({ type: 'UPDATE_DATA', payload: { brightness: Number(payloadData.brightness) } })
               console.log(`[TU Mini Refresh] Başarılı: brightness = ${payloadData.brightness}`)
             }
          }
      }
      else if (cardName === 'volume') {
          const res = await tuSeriesAPI().sendCommand({ sessionId: state.sessionId, command: 'getSystemVolume' })
          if (res.success && res.data) {
             const payloadData = res.data as { volume?: number | string; isMuted?: boolean | number | string }
             if (payloadData.volume !== undefined) {
               dispatch({ 
                 type: 'UPDATE_DATA', 
                 payload: { 
                   volume: Number(payloadData.volume), 
                   isMuted: payloadData.isMuted === true || String(payloadData.isMuted) === 'true' || Number(payloadData.isMuted) === 1
                 } 
               })
               console.log(`[TU Mini Refresh] Başarılı: volume = ${payloadData.volume}`)
             }
          }
      }
      else if (cardName === 'network') {
          const res = await tuSeriesAPI().sendCommand({ sessionId: state.sessionId, command: 'getWiredNetwork' })
          if (res.success && res.data) {
             const payloadData = res.data as { isConnected?: boolean | number | string }
             if (payloadData.isConnected !== undefined) {
               dispatch({ 
                 type: 'UPDATE_DATA', 
                 payload: { 
                   isWiredNetworkConnected: payloadData.isConnected === true || String(payloadData.isConnected) === 'true' || Number(payloadData.isConnected) === 1
                 } 
               })
               console.log(`[TU Mini Refresh] Başarılı: network = ${payloadData.isConnected}`)
             }
          }
      }
      else if (cardName === 'status') {
          const res = await tuSeriesAPI().sendCommand({ sessionId: state.sessionId, command: 'getSystemStatus' })
          if (res.success && res.data) {
             const payloadData = res.data as { status?: string }
             if (payloadData.status !== undefined) {
               dispatch({ type: 'UPDATE_DATA', payload: { systemStatus: payloadData.status } })
               console.log(`[TU Mini Refresh] Başarılı: status = ${payloadData.status}`)
             }
          }
      }
      else if (cardName === 'source') {
          dispatch({ type: 'UPDATE_DATA', payload: { sourceStatus: 'loading' } })
          
          let sourceSuccess = false
          let fallbackSourceIdx: number | null = null;
          const retryCount = 3
          
          for (let i = 0; i < retryCount; i++) {
            try {
              const sourceRes = await tuSeriesAPI().sendCommand({ sessionId: state.sessionId, command: 'getCurrentSource' })
              if (sourceRes.success && sourceRes.data) {
                const payloadData = sourceRes.data as { sourceIndex?: number | string }
                if (payloadData.sourceIndex !== undefined) {
                  dispatch({ type: 'UPDATE_DATA', payload: { sourceIndex: Number(payloadData.sourceIndex), sourceStatus: 'verified' } })
                  sourceSuccess = true
                  console.log(`[TU Mini Refresh] Başarılı: source = ${payloadData.sourceIndex}`)
                  break
                }
              }
            } catch (e) {
              console.error(`[TU Mini Refresh] Source fetch error (attempt ${i + 1})`, e)
            }
            if (i < retryCount - 1) {
               console.log(`[TU Mini Refresh] getCurrentSource başarısız, tekrar deneniyor (${i+1}/${retryCount})...`)
               await delay(500)
            }
          }

          if (!sourceSuccess) {
              console.log(`[TU Mini Refresh] getCurrentSource tamamen başarısız. Fallback için getHdmiStatus aranıyor...`)
              try {
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
                   const activeSources: number[] = []
                   if (statMap.isAndroidConnected) activeSources.push(0)
                   if (statMap.isHdmi1Connected) activeSources.push(1)
                   if (statMap.isHdmi2Connected) activeSources.push(2)
                   if (statMap.isHdmi3Connected) activeSources.push(3)

                   if (activeSources.length === 1) fallbackSourceIdx = activeSources[0]
                }
              } catch (e) { console.error('[TU Mini Refresh] HDMI Status fetch error', e) }

              if (fallbackSourceIdx !== null) {
                 dispatch({ type: 'UPDATE_DATA', payload: { sourceIndex: fallbackSourceIdx, sourceStatus: 'provisional' } })
                 console.log(`[TU Mini Refresh] Fallback to source = ${fallbackSourceIdx}`)
              } else if (state.sourceIndex !== null) {
                 dispatch({ type: 'UPDATE_DATA', payload: { sourceStatus: 'provisional' } })
                 console.log(`[TU Mini Refresh] Fallback to preserved source = ${state.sourceIndex}`)
              } else {
                 dispatch({ type: 'UPDATE_DATA', payload: { sourceIndex: null, sourceStatus: 'unreadable' } })
                 console.log(`[TU Mini Refresh] Failed to determine source.`)
              }
          }
      }
      
    } catch (e) {
      console.error(`[TU Mini Refresh] Fatal error for ${cardName}:`, e)
    } finally {
      dispatch({ type: 'SET_COMMAND_BUSY', payload: false })
      setLoadingCard(null)
    }
  }

  useEffect(() => {
    // Only fetch on the first page load after connecting. Preserves state across navigations.
    if (state.initialFetchDone) return
    dispatch({ type: 'UPDATE_DATA', payload: { initialFetchDone: true } })
    fetchStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sessionId])

  // Mapping Helpers based on strict user rules
  const renderSource = () => {
    if (state.sourceStatus === 'loading') return 'Okunuyor...'
    if (state.sourceStatus === 'unreadable' && state.sourceIndex === null) return 'Tespit edilemedi'
    
    if (state.sourceIndex === null || state.sourceIndex === undefined) return 'Bilinmiyor'
    
    const val = Number(state.sourceIndex)
    let name = 'Bilinmiyor'
    if (val === 0) name = 'Android'
    if (val === 1) name = 'HDMI1'
    if (val === 2) name = 'HDMI2'
    if (val === 3) name = 'HDMI3'
    
    if (state.sourceStatus === 'provisional') {
      return `${name} (Teyitsiz)`
    }
    return name
  }

  const renderVolume = () => {
    if (state.volume === null || state.volume === undefined) return 'Okunuyor...'
    const isMuted = state.isMuted === true || String(state.isMuted) === 'true' || Number(state.isMuted) === 1
    if (isMuted) return 'Sessiz'
    return `%${Number(state.volume)}`
  }

  const renderNetwork = () => {
    if (state.isWiredNetworkConnected === null || state.isWiredNetworkConnected === undefined) return 'Okunuyor...'
    const isConn = state.isWiredNetworkConnected === true || String(state.isWiredNetworkConnected) === 'true' || Number(state.isWiredNetworkConnected) === 1
    return isConn ? 'Bağlı' : 'Bağlı değil'
  }

  const renderStatus = () => {
    if (state.systemStatus === null || state.systemStatus === undefined) return 'Okunuyor...'
    // Ensure capitalization matches user's request exactly
    if (state.systemStatus === 'POWER_FAILED') return 'Service failed'
    if (state.systemStatus === 'Standby') return 'Standby'
    return state.systemStatus 
  }

  const renderBrightness = () => {
    if (state.brightness === null || state.brightness === undefined) return 'Okunuyor...'
    return `%${Number(state.brightness)}`
  }

  const isAnyBusy = state.commandBusy || loadingCard !== null || fetchStatusRef.current || state.status !== 'connected';

  return (
    <div className="tu-device-page">
      <DeviceImageBanner
        series="TU"
        deviceName={state.deviceName}
        ipAddress={state.ipAddress}
        protocol="TCP:5201"
        statusLabel="Bağlı & Doğrulandı"
        accentColor="var(--color-tu)"
        rightElement={
          <button 
            className="btn btn-secondary btn-sm" 
            disabled={isAnyBusy} 
            onClick={() => fetchStatus()}
            style={{ fontWeight: 600, padding: '4px 12px' }}
          >
            {fetchStatusRef.current ? 'Yenileniyor...' : '🔄 Genel Yenile'}
          </button>
        }
      />

      <div className="page-header" style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Cihaz Durumu</h2>
          <p>TU Cihazına ait genel bilgiler ve anlık sistem okumaları.</p>
        </div>
      </div>

      <div className="widgets-grid">
        <div className="widget-card">
          <button 
             className="widget-refresh-btn" 
             onClick={() => refreshCard('source')}
             disabled={isAnyBusy}
             title="Aktif Kaynağı Yenile"
          >
             <div className={loadingCard === 'source' ? 'spin' : ''} style={{display:'flex'}}>🔄</div>
          </button>
          <div className="widget-icon" style={{ background: 'rgba(124, 94, 245, 0.15)' }}>🖥️</div>
          <div className="widget-content">
            <div className="widget-title">Aktif Kaynak</div>
            <div className="widget-value">{renderSource()}</div>
          </div>
        </div>

        <div className="widget-card">
          <button 
             className="widget-refresh-btn" 
             onClick={() => refreshCard('volume')}
             disabled={isAnyBusy}
             title="Sesi Yenile"
          >
             <div className={loadingCard === 'volume' ? 'spin' : ''} style={{display:'flex'}}>🔄</div>
          </button>
          <div className="widget-icon" style={{ background: 'rgba(34, 197, 94, 0.15)' }}>🔊</div>
          <div className="widget-content">
            <div className="widget-title">Sistem Sesi</div>
            <div className="widget-value">{renderVolume()}</div>
          </div>
        </div>

        <div className="widget-card">
          <button 
             className="widget-refresh-btn" 
             onClick={() => refreshCard('network')}
             disabled={isAnyBusy}
             title="Ağı Yenile"
          >
             <div className={loadingCard === 'network' ? 'spin' : ''} style={{display:'flex'}}>🔄</div>
          </button>
          <div className="widget-icon" style={{ background: 'rgba(59, 130, 246, 0.15)' }}>🌐</div>
          <div className="widget-content">
            <div className="widget-title">Kablolu Ağ</div>
            <div className="widget-value">{renderNetwork()}</div>
          </div>
        </div>

        <div className="widget-card">
          <button 
             className="widget-refresh-btn" 
             onClick={() => refreshCard('status')}
             disabled={isAnyBusy}
             title="Durumu Yenile"
          >
             <div className={loadingCard === 'status' ? 'spin' : ''} style={{display:'flex'}}>🔄</div>
          </button>
          <div className="widget-icon" style={{ background: 'rgba(239, 68, 68, 0.15)' }}>⚕️</div>
          <div className="widget-content">
            <div className="widget-title">Sistem Durumu</div>
            <div className="widget-value">{renderStatus()}</div>
          </div>
        </div>

        <div className="widget-card">
          <button 
             className="widget-refresh-btn" 
             onClick={() => refreshCard('brightness')}
             disabled={isAnyBusy}
             title="Parlaklığı Yenile"
          >
             <div className={loadingCard === 'brightness' ? 'spin' : ''} style={{display:'flex'}}>🔄</div>
          </button>
          <div className="widget-icon" style={{ background: 'rgba(234, 179, 8, 0.15)' }}>☀️</div>
          <div className="widget-content">
            <div className="widget-title">Parlaklık</div>
            <div className="widget-value">{renderBrightness()}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
