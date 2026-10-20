import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMCTRLSession } from '../state/MCTRLSessionState'
import { mctrlAPI, storageAPI } from '@shared/api/bridge'
import type { RecentConnection } from '@shared/types/RecentConnection'
import '@shared/components/ConnectionPageShared.css'
import './MCTRLConnectionPage.css'

interface DiscoveredDevice {
  comPort: string
  baudRate: number
  modelIdLow: number
  modelIdHigh: number
  modelName: string
  displayName: string
}

export const MCTRLConnectionPage: React.FC = () => {
  const navigate = useNavigate()
  const { state, dispatch } = useMCTRLSession()

  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState<string | null>(null)
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([])
  const [scanError, setScanError] = useState<string | null>(null)
  const [connectingPort, setConnectingPort] = useState<string | null>(null)
  const [recentConns, setRecentConns] = useState<RecentConnection[]>([])

  useEffect(() => {
    storageAPI().getConnections('MCTRL').then(setRecentConns).catch(console.error)
  }, [])

  const handleScan = useCallback(async () => {
    setScanning(true)
    setScanProgress('COM portları listeleniyor...')
    setScanError(null)
    setDiscoveredDevices([])

    try {
      const result = await mctrlAPI().scan()
      if (result.success) {
        setDiscoveredDevices(result.devices)
        if (result.devices.length === 0) {
          setScanProgress('Tarama tamamlandı. MCTRL cihazı bulunamadı.')
        } else {
          setScanProgress(`Tarama tamamlandı. ${result.devices.length} cihaz bulundu.`)
        }
      } else {
        setScanError(result.message ?? 'Tarama başarısız.')
        setScanProgress(null)
      }
    } catch (err) {
      setScanError(String(err))
      setScanProgress(null)
    } finally {
      setScanning(false)
    }
  }, [])

  const handleConnect = useCallback(async (device: DiscoveredDevice) => {
    const sessionId = crypto.randomUUID()
    setConnectingPort(device.comPort)

    dispatch({
      type: 'CONNECTING',
      payload: {
        sessionId,
        deviceName: device.modelName,
        comPort: device.comPort,
        baudRate: device.baudRate,
      }
    })

    try {
      const result = await mctrlAPI().connect({ sessionId, comPort: device.comPort, baudRate: device.baudRate })
      if (result.success) {
        await storageAPI().saveConnection({
          displayName: device.modelName,
          deviceSeries: 'MCTRL',
          comPort: device.comPort,
          baudRate: device.baudRate,
        }).catch(() => {})
        setRecentConns(await storageAPI().getConnections('MCTRL').catch(() => []))
        dispatch({ type: 'CONNECTED', payload: { deviceInfo: { modelName: device.modelName } } })
        navigate('/mctrl/dashboard')
      } else {
        dispatch({ type: 'ERROR', payload: { message: result.message ?? 'Bağlantı kurulamadı.' } })
      }
    } catch (err) {
      dispatch({ type: 'ERROR', payload: { message: String(err) } })
    } finally {
      setConnectingPort(null)
    }
  }, [dispatch, navigate])

  const handleConnectFromRecent = useCallback(async (conn: RecentConnection) => {
    if (!conn.comPort || !conn.baudRate) return
    handleConnect({
      comPort: conn.comPort,
      baudRate: conn.baudRate,
      modelName: conn.displayName,
      displayName: conn.displayName,
      modelIdLow: 0,
      modelIdHigh: 0,
    })
  }, [handleConnect])

  const isConnecting = state.status === 'connecting'
  const isBusy = scanning || isConnecting

  return (
    <div className="connection-page">
      <div className="conn-topbar">
        <button className="conn-back-btn" id="btn-mctrl-back" onClick={() => navigate('/')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Ana Menü
        </button>
        <div className="conn-topbar-divider" />
        <span className="conn-topbar-title">MCTRL Series Bağlantısı</span>
        <span className="conn-series-pill" style={{ background: 'rgba(245,166,35,0.12)', color: 'var(--color-mctrl)' }}>MCTRL</span>
      </div>

      <div className="conn-body">
        {/* Left panel — scan */}
        <div className="conn-panel-left">
          <div>
            <div className="conn-panel-title">Cihaz Tara</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              RS232 bağlantısı için COM portlarını otomatik tarar ve MCTRL cihazlarını listeler.
            </p>
          </div>

          <button
            id="btn-mctrl-scan"
            className="btn btn-primary mctrl-scan-btn"
            onClick={handleScan}
            disabled={isBusy}
          >
            {scanning ? (
              <><span className="spinner" />Taranıyor...</>
            ) : (
              <>🔍 Cihazları Ara</>
            )}
          </button>

          {scanProgress && (
            <div className="mctrl-scan-progress">
              {scanProgress}
            </div>
          )}

          {scanError && (
            <div className="conn-result conn-result-error">⚠ {scanError}</div>
          )}

          {state.lastError && (
            <div className="conn-result conn-result-error">⚠ {state.lastError}</div>
          )}

          {/* Found devices */}
          {discoveredDevices.length > 0 && (
            <div className="mctrl-found-list">
              <div className="mctrl-found-label">Bulunan Cihazlar</div>
              {discoveredDevices.map((dev) => (
                <div key={`${dev.comPort}-${dev.baudRate}`} className="mctrl-found-card">
                  <div className="mctrl-found-icon">🖥</div>
                  <div className="mctrl-found-info">
                    <div className="mctrl-found-model">{dev.modelName}</div>
                    <div className="mctrl-found-detail">{dev.comPort} — {dev.baudRate.toLocaleString()} baud</div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={isBusy || connectingPort === dev.comPort}
                    onClick={() => handleConnect(dev)}
                  >
                    {connectingPort === dev.comPort ? <><span className="spinner" />Bağlanıyor...</> : 'Bağlan'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right panel — recent connections */}
        <div className="conn-panel-right">
          <div className="conn-panel-title">Hızlı Bağlantılar</div>
          {recentConns.length === 0 ? (
            <div className="conn-recent-empty">
              <div className="conn-recent-empty-icon">🔌</div>
              <p>Henüz kayıtlı MCTRL bağlantısı yok.</p>
            </div>
          ) : recentConns.map(conn => (
            <div key={conn.id} className="recent-card">
              <div className="recent-card-icon" style={{ background: 'rgba(245,166,35,0.10)' }}>🔌</div>
              <div className="recent-card-info">
                <div className="recent-card-name">{conn.displayName}</div>
                <div className="recent-card-detail">{conn.comPort} — {conn.baudRate?.toLocaleString()} baud</div>
                <div className="recent-card-date">{new Date(conn.lastConnectedAt).toLocaleDateString('tr-TR')}</div>
              </div>
              <div className="recent-card-actions">
                <button
                  className="btn btn-primary btn-sm"
                  disabled={isBusy}
                  onClick={() => handleConnectFromRecent(conn)}
                >
                  Bağlan
                </button>
                <button
                  className="btn btn-danger btn-sm btn-icon"
                  onClick={() => storageAPI().deleteConnection(conn.id).then(() => setRecentConns(p => p.filter(c => c.id !== conn.id)))}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
