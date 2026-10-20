import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTUSession } from '../state/TUSessionState'
import { tuSeriesAPI, storageAPI } from '@shared/api/bridge'
import type { RecentConnection } from '@shared/types/RecentConnection'
import { getDeviceImage, getDeviceFallbackIcon } from '@shared/deviceImageMap'
import '@shared/components/ConnectionPageShared.css'

export const TUConnectionPage: React.FC = () => {
  const navigate = useNavigate()
  const { state, dispatch } = useTUSession()
  const [deviceName, setDeviceName] = useState('')
  const [ipAddress, setIpAddress]   = useState('')
  const [testing, setTesting]       = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null)
  const [recentConns, setRecentConns] = useState<RecentConnection[]>([])

  useEffect(() => { storageAPI().getConnections('TU').then(setRecentConns).catch(console.error) }, [])

  const handleTestConnection = useCallback(async () => {
    if (!ipAddress) return
    setTesting(true); setTestResult(null)
    try {
      const r = await tuSeriesAPI().testConnection({ ipAddress })
      setTestResult({ success: r.success, msg: r.message })
    } catch { setTestResult({ success: false, msg: 'Test bağlantısı başarısız.' }) }
    finally { setTesting(false) }
  }, [ipAddress])

  const handleConnect = useCallback(async () => {
    if (!ipAddress) return
    const sessionId = crypto.randomUUID()
    dispatch({ type: 'CONNECTING', payload: { sessionId, deviceName: deviceName || 'TU Series Cihazı', ipAddress } })
    try {
      const result = await tuSeriesAPI().connect({ sessionId, ipAddress })
      if (result.success) {
        await storageAPI().saveConnection({ displayName: deviceName || 'TU Series Cihazı', deviceSeries: 'TU', ipAddress, port: 5201 }).catch(() => {})
        setRecentConns(await storageAPI().getConnections('TU').catch(() => []))
        dispatch({ type: 'CONNECTED', payload: { deviceInfo: result.deviceInfo as Record<string,string> } })
        if ((result as any).systemStatus) dispatch({ type: 'UPDATE_DATA', payload: { systemStatus: (result as any).systemStatus } })
        navigate('/tuseries/dashboard')
      } else { dispatch({ type: 'ERROR', payload: { message: result.message } }) }
    } catch (err) { dispatch({ type: 'ERROR', payload: { message: String(err) } }) }
  }, [ipAddress, deviceName, dispatch, navigate])

  const handleConnectRecent = useCallback(async (conn: RecentConnection) => {
    const sessionId = crypto.randomUUID()
    dispatch({ type: 'CONNECTING', payload: { sessionId, deviceName: conn.displayName, ipAddress: conn.ipAddress! } })
    try {
      const result = await tuSeriesAPI().connect({ sessionId, ipAddress: conn.ipAddress! })
      if (result.success) {
        await storageAPI().touchConnection(conn.id).catch(() => {})
        dispatch({ type: 'CONNECTED', payload: { deviceInfo: result.deviceInfo as Record<string,string> } })
        if ((result as any).systemStatus) dispatch({ type: 'UPDATE_DATA', payload: { systemStatus: (result as any).systemStatus } })
        navigate('/tuseries/dashboard')
      } else { dispatch({ type: 'ERROR', payload: { message: result.message } }) }
    } catch (err) { dispatch({ type: 'ERROR', payload: { message: String(err) } }) }
  }, [dispatch, navigate])

  const isConnecting = state.status === 'connecting'

  return (
    <div className="connection-page">
      <div className="conn-topbar">
        <button className="conn-back-btn" id="btn-tu-back" onClick={() => navigate('/')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Ana Menü
        </button>
        <div className="conn-topbar-divider" />
        <span className="conn-topbar-title">TU Series Bağlantısı</span>
        <span className="conn-series-pill" style={{ background: 'rgba(124,94,245,0.12)', color: 'var(--color-tu)' }}>TU</span>
      </div>
      <div className="conn-body">
        <div className="conn-panel-left">
          <div>
            <div className="conn-panel-title">Yeni Bağlantı</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>TU Series cihazına TCP üzerinden bağlanın.</p>
          </div>
          <div className="conn-form">
            <div className="form-group">
              <label className="form-label" htmlFor="tu-device-name">Cihaz Adı</label>
              <input id="tu-device-name" className="form-input" placeholder="örn. TU Series #1" value={deviceName} onChange={e => setDeviceName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="tu-ip">IP Adresi</label>
              <input id="tu-ip" className="form-input" placeholder="192.168.1.100" value={ipAddress} onChange={e => setIpAddress(e.target.value)} />
            </div>
            {state.lastError && <div className="conn-result conn-result-error">⚠ {state.lastError}</div>}
            {testResult && <div className={`conn-result ${testResult.success ? 'conn-result-success' : 'conn-result-error'}`}>{testResult.success ? '✓' : '✗'} {testResult.msg}</div>}
            <div className="conn-actions">
              <button id="btn-tu-test" className="btn btn-secondary" onClick={handleTestConnection} disabled={!ipAddress || testing || isConnecting}>
                {testing ? <><span className="spinner" /> Test Ediliyor...</> : 'Bağlantıyı Test Et'}
              </button>
              <button id="btn-tu-connect" className="btn btn-primary" onClick={handleConnect} disabled={!ipAddress || isConnecting}>
                {isConnecting ? <><span className="spinner" /> Bağlanıyor...</> : 'Bağlan'}
              </button>
            </div>
          </div>
        </div>
        <div className="conn-panel-right">
          <div className="conn-panel-title">Hızlı Bağlantılar</div>
          {recentConns.length === 0 ? (
            <div className="conn-recent-empty">
              <div className="conn-recent-empty-icon">{getDeviceFallbackIcon('TU')}</div>
              <p>Henüz kayıtlı TU Series bağlantısı yok.</p>
            </div>
          ) : recentConns.map(conn => (
            <div key={conn.id} className="recent-card">
              <div className="recent-card-icon" style={{ background: 'rgba(124,94,245,0.10)', overflow: 'hidden' }}>
                {getDeviceImage('TU') ? (
                  <img src={getDeviceImage('TU')} alt="TU Device" style={{ width: '100%', height: '100%', objectFit: 'contain' }} draggable={false} />
                ) : (
                  getDeviceFallbackIcon('TU')
                )}
              </div>
              <div className="recent-card-info">
                <div className="recent-card-name">{conn.displayName}</div>
                <div className="recent-card-detail">{conn.ipAddress}</div>
                <div className="recent-card-date">{new Date(conn.lastConnectedAt).toLocaleDateString('tr-TR')}</div>
              </div>
              <div className="recent-card-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => handleConnectRecent(conn)}>Bağlan</button>
                <button className="btn btn-danger btn-sm btn-icon" onClick={() => storageAPI().deleteConnection(conn.id).then(() => setRecentConns(p => p.filter(c => c.id !== conn.id)))}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
