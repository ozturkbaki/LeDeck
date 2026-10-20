import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTaurusSession, type TaurusDiscoveredDevice } from '../state/TaurusSessionState'
import { taurusAPI } from '@shared/api/bridge'
import './TaurusConnectionPage.css'

const DEFAULT_PORT     = 16674
const DEFAULT_USERNAME = 'admin'
const DEFAULT_PASSWORD = 'Taksi12345!'

export const TaurusConnectionPage: React.FC = () => {
  const navigate = useNavigate()
  const { state, dispatch } = useTaurusSession()

  // ── Discovery ──────────────────────────────────────────────────────────────
  const [discovering, setDiscovering]   = useState(false)
  const [discoverMsg, setDiscoverMsg]   = useState<string | null>(null)
  const [localSubnets, setLocalSubnets] = useState<string[]>([])
  const discoverRef = useRef(false)

  // ── Form ───────────────────────────────────────────────────────────────────
  const [selectedDevice, setSelectedDevice] = useState<TaurusDiscoveredDevice | null>(null)
  const [username, setUsername] = useState(DEFAULT_USERNAME)
  const [password, setPassword] = useState(DEFAULT_PASSWORD)
  const [connecting, setConnecting] = useState(false)

  // ── Manuel IP ──────────────────────────────────────────────────────────────
  const [showManual, setShowManual] = useState(false)
  const [manualIp,   setManualIp]   = useState('')
  const [manualPort, setManualPort] = useState(String(DEFAULT_PORT))

  // ── Error & hints ─────────────────────────────────────────────────────────
  const [error, setError]       = useState<string | null>(null)
  const [snHint, setSnHint]     = useState<string | null>(null)   // code 18 → SN hint mesajı göster

  // ── Redirect ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.status === 'connected') navigate('/taurus/dashboard', { replace: true })
  }, [state.status, navigate])

  // ── Local subnets ──────────────────────────────────────────────────────────
  useEffect(() => {
    taurusAPI().getLocalSubnets()
      .then(res => { if (res.success) setLocalSubnets(res.subnets) })
      .catch(console.error)
  }, [])

  // ── Discovery ──────────────────────────────────────────────────────────────
  const handleDiscover = useCallback(async () => {
    if (discoverRef.current) {
      await taurusAPI().cancelDiscover().catch(() => {})
      discoverRef.current = false
      setDiscovering(false)
      setDiscoverMsg('Tarama iptal edildi.')
      return
    }

    discoverRef.current = true
    setDiscovering(true)
    setDiscoverMsg('Yerel ağ taranıyor...')
    setError(null)
    setSnHint(null)
    dispatch({ type: 'DISCOVERING' })
    setSelectedDevice(null)

    try {
      const result = await taurusAPI().discover({
        targets:   localSubnets.length > 0 ? localSubnets : undefined,
        timeoutMs: 5000,
      })

      dispatch({ type: 'DISCOVERY_DONE', payload: { devices: result.devices } })

      if (result.devices.length === 0) {
        setDiscoverMsg('Taurus cihazı bulunamadı. Manuel IP ile bağlanabilirsiniz.')
        setShowManual(true)
      } else {
        const noSnCount = result.devices.filter(d => !d.sn).length
        let msg = `${result.devices.length} cihaz bulundu (${result.elapsed}ms)`
        if (noSnCount > 0) msg += ` • ${noSnCount} cihaz için giriş gerekli`
        setDiscoverMsg(msg)
      }
    } catch (err) {
      setError(String(err))
      setDiscoverMsg(null)
      dispatch({ type: 'DISCOVERY_DONE', payload: { devices: [] } })
    } finally {
      discoverRef.current = false
      setDiscovering(false)
    }
  }, [localSubnets, dispatch])

  // ── Ortak bağlan yardımcısı ────────────────────────────────────────────────
  const doConnect = useCallback(async (
    ip:         string,
    port:       number,
    sn:         string | undefined,
    deviceName: string | undefined,
  ) => {
    if (connecting) return
    setConnecting(true)
    setError(null)
    setSnHint(null)

    const sessionId = `taurus-${Date.now()}`
    dispatch({ type: 'CONNECTING', payload: { sessionId, ip, port } })

    try {
      const result = await taurusAPI().connect({
        sessionId,
        ip,
        port,
        username,
        password,
        sn:         sn || undefined,
        deviceName: deviceName || undefined,
      })

      if (result.success) {
        dispatch({ type: 'CONNECTED', payload: {
          deviceName: result.deviceName ?? deviceName ?? ip,
          sn:         result.sn ?? sn ?? '',
        }})
        navigate('/taurus/dashboard')
      } else {
        // apiCode 3 = ERR_INVALID_PARAM / "sn not match" (dok. kodu 3)
        // apiCode 17 = ERR_FORBIDDEN / brute force
        const apiCode = (result as any).apiCode as number | undefined
        if (apiCode === 3) {
          setSnHint('Bu cihaz giriş için Seri Numarası (SN) gerektiriyor. Cihazın alt etiketinden veya web arayüzünden tam SN değerini öğrenip girin.')
        }
        setError(result.message ?? 'Bağlantı başarısız')
        dispatch({ type: 'DISCOVERY_DONE', payload: { devices: state.discoveredDevices } })
      }
    } catch (err) {
      setError(String(err))
      dispatch({ type: 'DISCOVERY_DONE', payload: { devices: state.discoveredDevices } })
    } finally {
      setConnecting(false)
    }
  }, [connecting, username, password, dispatch, navigate, state.discoveredDevices])

  // ── Discovery'den seçili cihaz bağlantısı ────────────────────────────────
  const handleConnect = useCallback((device: TaurusDiscoveredDevice) => {
    doConnect(
      device.ip,
      device.terminalEntrancePortHttps || DEFAULT_PORT,
      device.sn || undefined,
      device.productName || device.aliasName,
    )
  }, [doConnect])

  // ── Manuel IP bağlantısı ──────────────────────────────────────────────────
  const handleManualConnect = useCallback(() => {
    if (!manualIp.trim()) return
    doConnect(manualIp.trim(), parseInt(manualPort, 10) || DEFAULT_PORT, undefined, undefined)
  }, [manualIp, manualPort, doConnect])

  const isBusy = discovering || connecting
  const showLoginForm = selectedDevice !== null || showManual

  return (
    <div className="taurus-conn-page">

      {/* Back */}
      <button className="taurus-back-btn" onClick={() => navigate('/')} disabled={isBusy}>
        ← Ana Menü
      </button>

      {/* Header */}
      <div className="taurus-conn-header">
        <div className="taurus-conn-badge">TB / TCC Serisi</div>
        <h1 className="taurus-conn-title">Taurus Cihaz Bağlantısı</h1>
        <p className="taurus-conn-subtitle">
          Ağdaki Taurus cihazlarını otomatik keşfedin veya IP adresiyle manuel bağlanın.
        </p>
      </div>

      <div className="taurus-conn-main">

        {/* Error box */}
        {error && (
          <div className="taurus-error-box">
            <div>
              <div>⚠ {error}</div>
              {snHint && (
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9, lineHeight: 1.5 }}>
                  💡 {snHint}
                </div>
              )}
            </div>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', flexShrink: 0 }}
              onClick={() => { setError(null); setSnHint(null) }}>✕</button>
          </div>
        )}

        {/* ── Discovery Panel ── */}
        <div className="taurus-panel">
          <div className="taurus-panel-header">
            <div className="taurus-panel-title">
              <span>🔍</span> Otomatik Keşif
            </div>
            <button
              id="btn-taurus-discover"
              className={`btn ${discovering ? 'btn-secondary' : 'btn-primary'} btn-sm`}
              onClick={handleDiscover}
              disabled={connecting}
              style={{ minWidth: 100 }}
            >
              {discovering ? <><span className="taurus-spinner" /> İptal</> : 'Tara'}
            </button>
          </div>

          <div className="taurus-panel-body">
            {localSubnets.length > 0 && (
              <div className="taurus-subnet-pills">
                {localSubnets.map(s => (
                  <span key={s} className="taurus-subnet-pill">{s}</span>
                ))}
              </div>
            )}

            {discoverMsg && (
              <div className="taurus-discover-status">
                {discovering && <span className="taurus-spinner" />}
                <span>{discoverMsg}</span>
              </div>
            )}

            {state.discoveredDevices.length > 0 && (
              <div className="taurus-device-list">
                {state.discoveredDevices.map((device, idx) => {
                  const key      = device.sn || device.ip
                  const name     = [device.productName, device.aliasName].filter(Boolean).join(' - ') || 'Taurus Device'
                  const needAuth = !device.sn
                  const isSelected = selectedDevice
                    ? (selectedDevice.sn ? selectedDevice.sn === device.sn : selectedDevice.ip === device.ip)
                    : false

                  return (
                    <div
                      key={key + idx}
                      id={`btn-taurus-device-${key}`}
                      className="taurus-device-card"
                      onClick={() => { setSelectedDevice(device); setError(null); setSnHint(null) }}
                      style={isSelected ? {
                        borderColor: 'var(--color-taurus, #63c3ff)',
                        background:  'rgba(99, 195, 255, 0.07)',
                      } : {}}
                    >
                      <div className="taurus-device-card-info">
                        <div className="taurus-device-name">
                          {name}
                          {needAuth && (
                            <span style={{ fontSize: 11, color: '#f5a623', marginLeft: 8, fontWeight: 500 }}>
                              🔒 Giriş gerekli
                            </span>
                          )}
                        </div>
                        <div className="taurus-device-meta">
                          <span>📍 {device.ip}:{device.terminalEntrancePortHttps}</span>
                          {device.sn && (
                            <span className="taurus-device-sn">SN: {device.sn}</span>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <span style={{ color: 'var(--color-taurus, #63c3ff)', fontSize: 18, flexShrink: 0 }}>✓</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {!discovering && state.discoveredDevices.length === 0 && !discoverMsg && (
              <div className="taurus-no-devices">
                Taramayı başlatmak için <strong>Tara</strong> butonuna basın.
              </div>
            )}
          </div>
        </div>

        {/* ── Login Form ── */}
        {showLoginForm && (
          <div className="taurus-panel">
            <div className="taurus-panel-header">
              <div className="taurus-panel-title">
                <span>🔐</span> Giriş Bilgileri
                {selectedDevice && (
                  <span style={{ color: 'var(--color-taurus, #63c3ff)', fontWeight: 400 }}>
                    — {selectedDevice.productName || selectedDevice.ip}
                  </span>
                )}
              </div>
            </div>
            <div className="taurus-panel-body">
              <div className="taurus-form-grid">
                <div className="taurus-form-group">
                  <label>Kullanıcı Adı</label>
                  <input
                    id="input-taurus-username"
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    disabled={isBusy}
                    autoComplete="off"
                  />
                </div>
                <div className="taurus-form-group">
                  <label>Şifre</label>
                  <input
                    id="input-taurus-password"
                    type="text"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={isBusy}
                    autoComplete="off"
                  />
                </div>

              </div>

              {/* Manuel IP */}
              {showManual && !selectedDevice && (
                <div className="taurus-form-grid" style={{ marginTop: 14 }}>
                  <div className="taurus-form-group">
                    <label>IP Adresi</label>
                    <input
                      id="input-taurus-manual-ip"
                      type="text"
                      value={manualIp}
                      onChange={e => setManualIp(e.target.value)}
                      placeholder="192.168.1.100"
                      disabled={isBusy}
                      onKeyDown={e => e.key === 'Enter' && handleManualConnect()}
                    />
                  </div>
                  <div className="taurus-form-group">
                    <label>Port</label>
                    <input
                      id="input-taurus-manual-port"
                      type="number"
                      value={manualPort}
                      onChange={e => setManualPort(e.target.value)}
                      disabled={isBusy}
                    />
                  </div>
                </div>
              )}

              <button
                id="btn-taurus-connect"
                className="taurus-connect-btn"
                disabled={isBusy || (showManual && !selectedDevice && !manualIp.trim())}
                onClick={selectedDevice ? () => handleConnect(selectedDevice) : handleManualConnect}
              >
                {connecting
                  ? <><span className="taurus-spinner" style={{ borderTopColor: '#000', borderColor: 'rgba(0,0,0,0.2)' }} /> Bağlanıyor…</>
                  : 'Bağlan'
                }
              </button>
            </div>
          </div>
        )}

        {/* ── Manual toggle ── */}
        <button
          className="taurus-manual-toggle"
          onClick={() => {
            setShowManual(!showManual)
            setSelectedDevice(null)
            setError(null)
            setSnHint(null)
          }}
        >
          {showManual ? '▲ Otomatik keşfe dön' : '▼ Manuel IP ile bağlan'}
        </button>

      </div>
    </div>
  )
}
