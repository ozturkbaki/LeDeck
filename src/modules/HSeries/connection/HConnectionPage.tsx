import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHSession } from '../state/HSessionState'
import { hSeriesAPI, storageAPI } from '@shared/api/bridge'
import type { RecentConnection } from '@shared/types/RecentConnection'
import '@shared/components/ConnectionPageShared.css'

/**
 * HConnectionPage
 *
 * H Series bağlantı sayfası.
 *
 * UI KURALI:
 *   - Kullanıcı yalnızca Device Name ve IP Address girer
 *   - Port alanı yoktur; modül içinde sabit 6000 (UDP) kullanılır
 *   - Recent connections'ta port editable alan olarak gösterilmez
 *
 * Protocol: UDP, port 6000 (H_SERIES_UDP_PORT)
 */
export const HConnectionPage: React.FC = () => {
  const navigate = useNavigate()
  const { state, dispatch } = useHSession()

  // Form state — port YOK
  const [deviceName, setDeviceName] = useState('')
  const [ipAddress, setIpAddress]   = useState('')

  // UI state
  const [testing, setTesting]       = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null)
  const [recentConns, setRecentConns] = useState<RecentConnection[]>([])
  const [saving, setSaving]         = useState(false)

  // H Series kayıtlı bağlantıları yükle
  useEffect(() => {
    storageAPI().getConnections('H').then(setRecentConns).catch(console.error)
  }, [])

  /**
   * Test Connection — R0100 komutu gönderir, cihaz cevap verirse başarılı
   * Port kullanıcıdan alınmaz
   */
  const handleTestConnection = useCallback(async () => {
    if (!ipAddress) return
    setTesting(true)
    setTestResult(null)
    try {
      // port parametresi gönderilmez — backend hardcoded 6000 kullanır
      const result = await hSeriesAPI().testConnection({ ipAddress })
      setTestResult({ success: result.success, msg: result.message })
    } catch {
      setTestResult({ success: false, msg: 'Test bağlantısı başarısız.' })
    } finally {
      setTesting(false)
    }
  }, [ipAddress])

  /**
   * Bağlan — UDP soketi açılır, R0100 ile cihaz doğrulanır
   */
  const handleConnect = useCallback(async () => {
    if (!ipAddress) return
    const sessionId = crypto.randomUUID()

    // port YOK — dispatch'e port yok
    dispatch({
      type: 'CONNECTING',
      payload: { sessionId, deviceName: deviceName || 'H Series Cihazı', ipAddress },
    })

    try {
      // port gönderilmez
      const result = await hSeriesAPI().connect({ sessionId, ipAddress })
      if (result.success) {
        setSaving(true)
        try {
          // Kayıtlara port kaydetmiyoruz
          await storageAPI().saveConnection({
            displayName: deviceName || 'H Series Cihazı',
            deviceSeries: 'H',
            ipAddress,
            port: 0, // depolama uyumluluğu için; UI'da gösterilmez
          })
          const updated = await storageAPI().getConnections('H')
          setRecentConns(updated)
        } catch { /* storage hataları fatal değil */ }
        setSaving(false)

        dispatch({ type: 'CONNECTED', payload: { deviceInfo: result.deviceInfo as Record<string,string> } })
        navigate('/hseries/dashboard')
      } else {
        dispatch({ type: 'ERROR', payload: { message: result.message } })
      }
    } catch (err) {
      dispatch({ type: 'ERROR', payload: { message: String(err) } })
    }
  }, [ipAddress, deviceName, dispatch, navigate])

  /**
   * Kayıtlı bağlantıdan bağlan — sadece IP kullanılır, port yok
   */
  const handleConnectRecent = useCallback(async (conn: RecentConnection) => {
    const sessionId = crypto.randomUUID()
    dispatch({
      type: 'CONNECTING',
      payload: { sessionId, deviceName: conn.displayName, ipAddress: conn.ipAddress! },
    })
    try {
      const result = await hSeriesAPI().connect({ sessionId, ipAddress: conn.ipAddress! })
      if (result.success) {
        await storageAPI().touchConnection(conn.id).catch(() => {})
        const updated = await storageAPI().getConnections('H')
        setRecentConns(updated)
        dispatch({ type: 'CONNECTED', payload: { deviceInfo: result.deviceInfo as Record<string,string> } })
        navigate('/hseries/dashboard')
      } else {
        dispatch({ type: 'ERROR', payload: { message: result.message } })
      }
    } catch (err) {
      dispatch({ type: 'ERROR', payload: { message: String(err) } })
    }
  }, [dispatch, navigate])

  const handleDeleteRecent = useCallback(async (id: string) => {
    await storageAPI().deleteConnection(id).catch(() => {})
    setRecentConns(prev => prev.filter(c => c.id !== id))
  }, [])

  const isConnecting = state.status === 'connecting'

  return (
    <div className="connection-page">
      {/* Top bar */}
      <div className="conn-topbar">
        <button className="conn-back-btn" id="btn-h-back" onClick={() => navigate('/')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Ana Menü
        </button>
        <div className="conn-topbar-divider" />
        <span className="conn-topbar-title">H Series Bağlantısı</span>
        <span className="conn-series-pill" style={{ background: 'rgba(0,200,255,0.12)', color: 'var(--color-h)' }}>H</span>
      </div>

      <div className="conn-body">
        {/* Sol: Yeni bağlantı formu */}
        <div className="conn-panel-left">
          <div>
            <div className="conn-panel-title">Yeni Bağlantı</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              H Series cihazına <strong>UDP</strong> üzerinden bağlanın.
              Port <strong>6000</strong> olarak sabit kullanılır.
            </p>
          </div>

          <div className="conn-form">
            {/* Cihaz Adı */}
            <div className="form-group">
              <label className="form-label" htmlFor="h-device-name">Cihaz Adı</label>
              <input
                id="h-device-name"
                className="form-input"
                placeholder="örn. H Series #1"
                value={deviceName}
                onChange={e => setDeviceName(e.target.value)}
              />
            </div>

            {/* IP Adresi */}
            <div className="form-group">
              <label className="form-label" htmlFor="h-ip-address">IP Adresi</label>
              <input
                id="h-ip-address"
                className="form-input"
                placeholder="192.168.1.100"
                value={ipAddress}
                onChange={e => setIpAddress(e.target.value)}
              />
            </div>

            {/* PORT INPUT YOKTUR — hardcoded 6000 */}
            <div className="form-group">
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 6,
                background: 'rgba(0,200,255,0.06)',
                border: '1px solid rgba(0,200,255,0.15)',
                fontSize: 12,
                color: 'var(--text-muted)',
              }}>
                <span style={{ fontSize: 14 }}>🔌</span>
                <span>UDP Port: <strong style={{ color: 'var(--color-h)' }}>6000</strong> (protokol standardı)</span>
              </div>
            </div>

            {/* Hata / başarı */}
            {state.lastError && (
              <div className="conn-result conn-result-error">⚠ {state.lastError}</div>
            )}
            {testResult && (
              <div className={`conn-result ${testResult.success ? 'conn-result-success' : 'conn-result-error'}`}>
                {testResult.success ? '✓' : '✗'} {testResult.msg}
              </div>
            )}

            <div className="conn-actions">
              <button
                id="btn-h-test"
                className="btn btn-secondary"
                onClick={handleTestConnection}
                disabled={!ipAddress || testing || isConnecting}
              >
                {testing ? <><span className="spinner" /> Test Ediliyor...</> : 'Bağlantıyı Test Et'}
              </button>
              <button
                id="btn-h-connect"
                className="btn btn-primary"
                onClick={handleConnect}
                disabled={!ipAddress || isConnecting || saving}
              >
                {isConnecting ? <><span className="spinner" /> Bağlanıyor...</> : 'Bağlan'}
              </button>
            </div>
          </div>
        </div>

        {/* Sağ: Kayıtlı bağlantılar — PORT GÖSTERİLMEZ */}
        <div className="conn-panel-right">
          <div className="conn-panel-title">Hızlı Bağlantılar</div>

          {recentConns.length === 0 ? (
            <div className="conn-recent-empty">
              <div className="conn-recent-empty-icon">🔌</div>
              <p>Henüz kayıtlı H Series bağlantısı yok.</p>
            </div>
          ) : (
            recentConns.map((conn) => (
              <div key={conn.id} className="recent-card">
                <div className="recent-card-icon" style={{ background: 'rgba(0,200,255,0.10)' }}>🖥</div>
                <div className="recent-card-info">
                  <div className="recent-card-name">{conn.displayName}</div>
                  {/* Port gösterilmez, yalnız IP */}
                  <div className="recent-card-detail">{conn.ipAddress} · UDP:6000</div>
                  <div className="recent-card-date">
                    {new Date(conn.lastConnectedAt).toLocaleDateString('tr-TR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                </div>
                <div className="recent-card-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => handleConnectRecent(conn)}>Bağlan</button>
                  <button
                    className="btn btn-danger btn-sm btn-icon"
                    onClick={() => handleDeleteRecent(conn.id)}
                    title="Sil"
                  >✕</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
