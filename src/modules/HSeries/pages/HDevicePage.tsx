import React, { useEffect } from 'react'
import { useHSession, HDeviceDetails } from '../state/HSessionState'
import { hSeriesAPI } from '@shared/api/bridge'
import { DeviceImageBanner } from '@shared/components/DeviceImageBanner'

/**
 * HDevicePage — H Series cihaz bilgileri ve ekran detayları
 *
 * R0100 (Get Device Details) ve R0401 (Get Screen Details) komutlarını kullanır.
 * Komutlar CommandService queue'su üzerinden sırayla çalıştırılır.
 */
export const HDevicePage: React.FC = () => {
  const { state, dispatch } = useHSession()

  // Sayfa açılınca otomatik olarak cihaz bilgilerini çek
  useEffect(() => {
    if (state.sessionId && state.status === 'connected' && !state.deviceDetails && !state.commandBusy) {
      handleRefreshDevice()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sessionId, state.status])

  /** R0100 — Get Device Details */
  const handleRefreshDevice = async () => {
    if (!state.sessionId) return
    dispatch({ type: 'SET_COMMAND_BUSY', payload: true })
    try {
      const result = await hSeriesAPI().getDeviceDetails({ sessionId: state.sessionId })

      // Debug log'a ekle
      dispatch({
        type: 'ADD_DEBUG_LOG',
        payload: {
          timestamp: new Date().toISOString(),
          sentCommand: result.sentCommand,
          rawResponse: result.rawResponse,
          parsedStatus: result.status,
          parsedData: result.data,
        },
      })

      if (result.status === 'ok' && result.deviceDetails) {
        dispatch({ type: 'SET_DEVICE_DETAILS', payload: result.deviceDetails })
        dispatch({ type: 'SET_COMMAND_RESULT', payload: 'Cihaz bilgileri alındı.' })
      } else {
        dispatch({ type: 'ERROR', payload: { message: result.message || 'Cihaz bilgisi alınamadı.' } })
      }
    } catch (err) {
      dispatch({ type: 'ERROR', payload: { message: `Cihaz bilgisi alınamadı: ${String(err)}` } })
    } finally {
      dispatch({ type: 'SET_COMMAND_BUSY', payload: false })
    }
  }

  /** R0401 — Get Screen Details */
  const handleRefreshScreen = async () => {
    if (!state.sessionId) return
    dispatch({ type: 'SET_COMMAND_BUSY', payload: true })
    try {
      const result = await hSeriesAPI().getScreenDetails({ sessionId: state.sessionId })

      dispatch({
        type: 'ADD_DEBUG_LOG',
        payload: {
          timestamp: new Date().toISOString(),
          sentCommand: result.sentCommand,
          rawResponse: result.rawResponse,
          parsedStatus: result.status,
          parsedData: result.data,
        },
      })

      if (result.status === 'ok' && result.screenDetails) {
        dispatch({ type: 'SET_SCREEN_DETAILS', payload: result.screenDetails })
        dispatch({ type: 'SET_COMMAND_RESULT', payload: 'Ekran bilgileri alındı.' })
      } else {
        dispatch({ type: 'ERROR', payload: { message: result.message || 'Ekran bilgisi alınamadı.' } })
      }
    } catch (err) {
      dispatch({ type: 'ERROR', payload: { message: `Ekran bilgisi alınamadı: ${String(err)}` } })
    } finally {
      dispatch({ type: 'SET_COMMAND_BUSY', payload: false })
    }
  }

  const d: HDeviceDetails | null = state.deviceDetails

  return (
    <div className="page-panel">
      {/* ── Cihaz görseli banner ─────────────────────────────────────────── */}
      <DeviceImageBanner
        series="H"
        deviceName={state.deviceName}
        ipAddress={state.ipAddress}
        protocol="UDP:6000"
        statusLabel="Bağlı & Doğrulandı"
        accentColor="var(--color-h)"
      />

      <div className="page-panel-header">
        <h2 className="page-panel-title">Cihaz Bilgileri</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            id="btn-h-refresh-screen"
            onClick={handleRefreshScreen}
            disabled={state.commandBusy}
          >
            {state.commandBusy ? '…' : '↻ Ekran'}
          </button>
          <button
            className="btn btn-primary btn-sm"
            id="btn-h-refresh-device"
            onClick={handleRefreshDevice}
            disabled={state.commandBusy}
          >
            {state.commandBusy ? 'Yükleniyor…' : '↻ Cihaz'}
          </button>
        </div>
      </div>

      {/* Temel bağlantı bilgileri */}
      <div className="info-grid">
        <div className="info-card">
          <div className="info-card-label">Bağlantı Durumu</div>
          <div className="info-card-value status-connected">● Bağlı (UDP)</div>
        </div>
        <div className="info-card">
          <div className="info-card-label">IP Adresi</div>
          <div className="info-card-value">{state.ipAddress || '—'}</div>
        </div>
        <div className="info-card">
          <div className="info-card-label">Port</div>
          <div className="info-card-value">6000 (sabit)</div>
        </div>
        <div className="info-card">
          <div className="info-card-label">Cihaz Adı</div>
          <div className="info-card-value">{state.deviceName || 'H Series'}</div>
        </div>
      </div>

      {/* R0100 yanıtından gelen cihaz detayları */}
      {d && (
        <>
          <div style={{ margin: '16px 0 8px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Cihaz Detayları (R0100)
          </div>
          <div className="info-grid">
            {d.name !== undefined && d.name !== '' && (
              <div className="info-card">
                <div className="info-card-label">Cihaz Adı (Cihazdan)</div>
                <div className="info-card-value">{d.name}</div>
              </div>
            )}
            {d.protoVersion !== undefined && (
              <div className="info-card">
                <div className="info-card-label">Protokol Versiyonu</div>
                <div className="info-card-value">{d.protoVersion}</div>
              </div>
            )}
            {d.MAC !== undefined && (
              <div className="info-card">
                <div className="info-card-label">MAC Adresi</div>
                <div className="info-card-value" style={{ fontFamily: 'monospace', fontSize: 12 }}>{d.MAC}</div>
              </div>
            )}
            {d.modelId !== undefined && (
              <div className="info-card">
                <div className="info-card-label">Model ID</div>
                <div className="info-card-value">{d.modelId}</div>
              </div>
            )}
            {d.status !== undefined && (
              <div className="info-card">
                <div className="info-card-label">Cihaz Durumu</div>
                <div className={`info-card-value ${d.status === 1 ? 'status-connected' : ''}`}>
                  {d.status === 1 ? '● Hazır' : '○ Meşgul'}
                </div>
              </div>
            )}
            {d.volt !== undefined && (
              <div className="info-card">
                <div className="info-card-label">Voltaj</div>
                <div className={`info-card-value ${d.volt === 1 ? 'status-error' : ''}`}>
                  {d.volt === 0 ? '✓ Normal' : '⚠ Anormal'}
                </div>
              </div>
            )}
            {d.temp !== undefined && (
              <div className="info-card">
                <div className="info-card-label">Sıcaklık</div>
                <div className={`info-card-value ${d.temp === 1 ? 'status-error' : ''}`}>
                  {d.temp === 0 ? '✓ Normal' : '⚠ Anormal'}
                </div>
              </div>
            )}
            {d.fanList && d.fanList.length > 0 && (
              <div className="info-card">
                <div className="info-card-label">Fan Sayısı</div>
                <div className="info-card-value">{d.fanList.length}</div>
              </div>
            )}
          </div>
        </>
      )}

      {/* R0401 ekran detayları */}
      {state.screenDetails && (
        <>
          <div style={{ margin: '16px 0 8px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Ekran Detayları (R0401)
          </div>
          <div className="info-grid">
            {state.screenDetails.general?.name && (
              <div className="info-card">
                <div className="info-card-label">Ekran Adı</div>
                <div className="info-card-value">{state.screenDetails.general.name}</div>
              </div>
            )}
            {state.screenDetails.brightness !== undefined && (
              <div className="info-card">
                <div className="info-card-label">Parlaklık</div>
                <div className="info-card-value">{state.screenDetails.brightness}%</div>
              </div>
            )}
            {state.screenDetails.gamma !== undefined && (
              <div className="info-card">
                <div className="info-card-label">Gamma</div>
                <div className="info-card-value">{state.screenDetails.gamma}</div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Son yanıt */}
      {state.lastCommandResult && (
        <div className="result-box">
          <div className="result-box-label">Son İşlem</div>
          <pre className="result-box-content">{state.lastCommandResult}</pre>
        </div>
      )}

      {/* Hata */}
      {state.lastError && (
        <div className="error-box">
          <span>⚠ {state.lastError}</span>
          <button className="btn btn-ghost btn-xs" onClick={() => dispatch({ type: 'CLEAR_ERROR' })}>✕</button>
        </div>
      )}
    </div>
  )
}
