import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useVXSession } from '../state/VXSessionState'
import { vxSeriesAPI, storageAPI } from '@shared/api/bridge'
import type { RecentConnection } from '@shared/types/RecentConnection'
import '@shared/components/ConnectionPageShared.css'

export const VXConnectionPage: React.FC = () => {
  const navigate = useNavigate()
  const { state, dispatch } = useVXSession()
  const [deviceName, setDeviceName] = useState('')
  const [ipAddress, setIpAddress]   = useState('')
  const [port, setPort]             = useState(5200)
  const [searching, setSearching]   = useState(false)
  const [recentConns, setRecentConns] = useState<RecentConnection[]>([])

  useEffect(() => { storageAPI().getConnections('VX').then(setRecentConns).catch(console.error) }, [])

  const handleSearch = useCallback(async () => {
    setSearching(true)
    try {
      const result = await vxSeriesAPI().searchDevices({ timeoutMs: 3000 }) as { success: boolean; devices: Array<{ ipAddress: string; port: number }> }
      if (result.devices?.length > 0) {
        const first = result.devices[0]
        setIpAddress(first.ipAddress)
        setPort(first.port)
        dispatch({ type: 'SET_DISCOVERED_DEVICES', payload: result.devices })
      }
    } catch { /* search failure is non-fatal */ }
    finally { setSearching(false) }
  }, [dispatch])

  /** Raw hata mesajını kullanıcı dostu Türkçe metne çevirir */
  const friendlyError = (raw: string): string => {
    if (/timeout/i.test(raw))            return 'Bağlantı zaman aşımına uğradı. Cihaz erişilebilir mi?'
    if (/ECONNREFUSED/i.test(raw))       return 'Bağlantı reddedildi. IP veya port hatalı olabilir.'
    if (/EHOSTUNREACH/i.test(raw))       return 'Cihaz bulunamadı. IP adresini kontrol edin.'
    if (/ENETUNREACH/i.test(raw))        return 'Ağa erişilemiyor. Bağlantıyı kontrol edin.'
    if (/ENOTFOUND/i.test(raw))          return 'IP adresi çözümlenemedi.'
    if (/Connection error/i.test(raw))   return 'Bağlantı hatası. Cihaz açık ve ağda mı?'
    return raw
  }

  const handleConnect = useCallback(async () => {
    if (!ipAddress) return
    const sessionId = crypto.randomUUID()
    dispatch({ type: 'CONNECTING', payload: { sessionId, deviceName: deviceName || 'VX Series Cihazı', ipAddress, port } })
    try {
      const result = await vxSeriesAPI().connect({ sessionId, ipAddress, port })
      if (result.success) {
        await storageAPI().saveConnection({ displayName: deviceName || 'VX Series Cihazı', deviceSeries: 'VX', ipAddress, port }).catch(() => {})
        setRecentConns(await storageAPI().getConnections('VX').catch(() => []))
        dispatch({ type: 'CONNECTED', payload: { deviceInfo: result.deviceInfo as Record<string,string> } })
        navigate('/vxseries/dashboard')
      } else {
        dispatch({ type: 'ERROR', payload: { message: friendlyError(result.message) } })
      }
    } catch (err) {
      dispatch({ type: 'ERROR', payload: { message: friendlyError(String(err)) } })
    }
  }, [ipAddress, port, deviceName, dispatch, navigate])

  const isConnecting = state.status === 'connecting'
  const isError      = state.status === 'error'

  /** location.state'den gelen variant: 'standard' | 'pro' */
  const location = useLocation()
  const isPro = (location.state as { variant?: string } | null)?.variant === 'pro'
  const variantLabel = isPro ? 'VX Pro' : 'VX'
  const variantPill  = isPro ? 'VX Pro' : 'VX'

  return (
    <div className="connection-page">
      <div className="conn-topbar">
        <button className="conn-back-btn" id="btn-vx-back" onClick={() => navigate('/vxseries/select')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Geri
        </button>
        <div className="conn-topbar-divider" />
        <span className="conn-topbar-title">{variantLabel} Bağlantısı</span>
        <span className="conn-series-pill" style={{ background: 'rgba(0,224,161,0.12)', color: 'var(--color-vx)' }}>{variantPill}</span>
      </div>
      <div className="conn-body">
        <div className="conn-panel-left">
          <div>
            <div className="conn-panel-title">Yeni Bağlantı</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>VX Series cihazını ağda arayın veya IP girin.</p>
          </div>
          <div className="conn-form">
            <div className="form-group">
              <label className="form-label" htmlFor="vx-device-name">Cihaz Adı</label>
              <input id="vx-device-name" className="form-input" placeholder="örn. VX600 #1" value={deviceName} onChange={e => setDeviceName(e.target.value)} />
            </div>
            <button id="btn-vx-search" className="btn btn-secondary" onClick={handleSearch} disabled={searching}>
              {searching ? <><span className="spinner" /> Aranıyor...</> : '🔍 Cihazları Ara'}
            </button>
            {state.discoveredDevices.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--accent-success)' }}>
                ✓ {state.discoveredDevices.length} cihaz bulundu — IP otomatik dolduruldu
              </div>
            )}
            <div className="form-group">
              <label className="form-label" htmlFor="vx-ip">IP Adresi</label>
              <input id="vx-ip" className="form-input" placeholder="192.168.1.100" value={ipAddress} onChange={e => setIpAddress(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="vx-port">Port</label>
              <input id="vx-port" className="form-input" type="number" value={port} onChange={e => setPort(Number(e.target.value))} />
            </div>
            {/* Bağlantı durumu geri bildirimi */}
            {isConnecting && (
              <div className="conn-result conn-result-info">
                <span className="spinner" /> Bağlanıyor...
              </div>
            )}
            {isError && state.lastError && (
              <div className="conn-result conn-result-error">⚠ {state.lastError}</div>
            )}
            {state.status === 'connected' && (
              <div className="conn-result conn-result-success">✓ Bağlantı başarılı</div>
            )}
            <div className="conn-actions">
              <button
                id="btn-vx-connect"
                className="btn btn-primary"
                onClick={handleConnect}
                disabled={!ipAddress || isConnecting}
              >
                {isConnecting
                  ? <><span className="spinner" /> Bağlanıyor...</>
                  : 'Bağlan'}
              </button>
            </div>
          </div>
        </div>
        <div className="conn-panel-right">
          <div className="conn-panel-title">Hızlı Bağlantılar</div>
          {recentConns.length === 0 ? (
            <div className="conn-recent-empty"><div className="conn-recent-empty-icon">⚡</div><p>Henüz kayıtlı VX Series bağlantısı yok.</p></div>
          ) : recentConns.map(conn => (
            <div key={conn.id} className="recent-card">
              <div className="recent-card-icon" style={{ background: 'rgba(0,224,161,0.10)' }}>⚡</div>
              <div className="recent-card-info">
                <div className="recent-card-name">{conn.displayName}</div>
                <div className="recent-card-detail">{conn.ipAddress}:{conn.port}</div>
                <div className="recent-card-date">{new Date(conn.lastConnectedAt).toLocaleDateString('tr-TR')}</div>
              </div>
              <div className="recent-card-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => { setIpAddress(conn.ipAddress!); setPort(conn.port!) }}>Doldur</button>
                <button className="btn btn-danger btn-sm btn-icon" onClick={() => storageAPI().deleteConnection(conn.id).then(() => setRecentConns(p => p.filter(c => c.id !== conn.id)))}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
