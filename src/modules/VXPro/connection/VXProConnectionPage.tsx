import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVXProSession } from '../state/VXProSessionState'
import { vxProAPI, storageAPI } from '@shared/api/bridge'
import type { VXProErrorCode } from '@shared/api/bridge'
import type { RecentConnection } from '@shared/types/RecentConnection'
import '@shared/components/ConnectionPageShared.css'

/**
 * VXProConnectionPage
 *
 * VX Pro bağlantı sayfası.
 *
 * UI KURALI:
 *   - Kullanıcı Cihaz Adı (opsiyonel) ve IP Adresi girer
 *   - Port alanı yoktur; protokol sabit TCP 15200 kullanır
 *   - Hızlı bağlantılar cihaz adı öncelikli gösterilir
 *
 * Debug Modu:
 *   - Her bağlantı denemesinde sent/received hex ve hata fazı gösterilir
 *   - Dashboard'a geçiş yalnızca connected_verified durumunda olur
 */

// ─── Error code → Türkçe mesaj ───────────────────────────────────────────────
const ERROR_MESSAGES: Record<VXProErrorCode, { title: string; detail: string }> = {
  ERR_TCP_CONNECT: {
    title:  'TCP bağlantısı kurulamadı.',
    detail: 'Cihaz kapalı, IP hatalı veya port 15200 erişilemiyor olabilir.',
  },
  ERR_NO_RESPONSE: {
    title:  'Bağlantı kuruldu ancak ModeID komutuna cevap gelmedi.',
    detail: 'Cihaz TCP bağlantısını kabul etti fakat doğrulama komutunu yanıtlamadı. Cihazın VX Pro protokolünü desteklediğini kontrol edin.',
  },
  ERR_INVALID_FRAME: {
    title:  'Cihazdan beklenmeyen formatta cevap geldi.',
    detail: 'Response alındı ancak NovaStar frame başlığı (55 AA) bulunamadı. Farklı bir cihaz veya protokol konuşuyor olabilir.',
  },
  ERR_PARSE_FAILED: {
    title:  'Cihazdan veri geldi ancak cevap parse edilemedi.',
    detail: 'Frame başlığı geçerli görünüyor fakat içerik okunamadı.',
  },
  ERR_ALREADY_CONNECTED: {
    title:  'Zaten bir bağlantı mevcut.',
    detail: 'Önce mevcut bağlantıyı kesin.',
  },
}

function getErrorInfo(code?: string): { title: string; detail: string } | null {
  if (!code) return null
  return ERROR_MESSAGES[code as VXProErrorCode] ?? null
}

// ─── Debug panel ─────────────────────────────────────────────────────────────
interface DebugInfo {
  phase:          string          // hangi aşama
  sentHex?:       string
  receivedHex?:   string
  parsedModelId?: number | null
  errorCode?:     string
}

export const VXProConnectionPage: React.FC = () => {
  const navigate = useNavigate()
  const { state, dispatch } = useVXProSession()

  // Form state
  const [deviceName, setDeviceName] = useState('')
  const [ipAddress, setIpAddress]   = useState('')

  // UI / debug state
  const [recentConns, setRecentConns] = useState<RecentConnection[]>([])
  const [saving, setSaving]           = useState(false)
  const [debugInfo, setDebugInfo]     = useState<DebugInfo | null>(null)
  const [showDebug, setShowDebug]     = useState(false)

  // VX Pro kayıtlı bağlantıları yükle
  useEffect(() => {
    storageAPI().getConnections('VXPro').then(setRecentConns).catch(console.error)
  }, [])

  // ── Yeni bağlantı ──────────────────────────────────────────────────────────
  const handleConnect = useCallback(async () => {
    if (!ipAddress) return
    const sessionId = crypto.randomUUID()
    const label = deviceName.trim() || ipAddress

    setDebugInfo(null)
    dispatch({
      type: 'CONNECTING',
      payload: { sessionId, ipAddress, deviceName: deviceName.trim() || undefined },
    })

    try {
      const result = await vxProAPI().connect({ sessionId, ipAddress })

      // Debug bilgilerini kaydet (her durumda)
      setDebugInfo({
        phase:          result.success ? 'connected_verified' : (result.code ?? 'unknown'),
        sentHex:        result.sentHex,
        receivedHex:    result.receivedHex,
        parsedModelId:  result.parsedModelId,
        errorCode:      result.code,
      })

      if (result.success) {
        setSaving(true)
        try {
          await storageAPI().saveConnection({
            displayName: label,
            deviceName:  deviceName.trim() || undefined,
            deviceSeries: 'VXPro',
            ipAddress,
          })
          const updated = await storageAPI().getConnections('VXPro')
          setRecentConns(updated)
        } catch { /* storage hataları fatal değil */ }
        setSaving(false)

        dispatch({ type: 'CONNECTED_VERIFIED' })
        navigate('/vxpro/dashboard')
      } else {
        // Hata mesajı error code'dan türetilir
        const errInfo = getErrorInfo(result.code)
        dispatch({ type: 'ERROR', payload: { message: errInfo?.title ?? result.message } })
      }
    } catch (err) {
      dispatch({ type: 'ERROR', payload: { message: String(err) } })
    }
  }, [ipAddress, deviceName, dispatch, navigate])

  // ── Kayıtlı bağlantıdan bağlan ────────────────────────────────────────────
  const handleConnectRecent = useCallback(async (conn: RecentConnection) => {
    const sessionId = crypto.randomUUID()
    setDebugInfo(null)
    dispatch({
      type: 'CONNECTING',
      payload: {
        sessionId,
        ipAddress:  conn.ipAddress!,
        deviceName: conn.deviceName || conn.displayName,
      },
    })
    try {
      const result = await vxProAPI().connect({ sessionId, ipAddress: conn.ipAddress! })

      setDebugInfo({
        phase:         result.success ? 'connected_verified' : (result.code ?? 'unknown'),
        sentHex:       result.sentHex,
        receivedHex:   result.receivedHex,
        parsedModelId: result.parsedModelId,
        errorCode:     result.code,
      })

      if (result.success) {
        await storageAPI().touchConnection(conn.id).catch(() => {})
        const updated = await storageAPI().getConnections('VXPro')
        setRecentConns(updated)
        dispatch({ type: 'CONNECTED_VERIFIED' })
        navigate('/vxpro/dashboard')
      } else {
        const errInfo = getErrorInfo(result.code)
        dispatch({ type: 'ERROR', payload: { message: errInfo?.title ?? result.message } })
      }
    } catch (err) {
      dispatch({ type: 'ERROR', payload: { message: String(err) } })
    }
  }, [dispatch, navigate])

  const handleDeleteRecent = useCallback(async (id: string) => {
    await storageAPI().deleteConnection(id).catch(() => {})
    setRecentConns(prev => prev.filter(c => c.id !== id))
  }, [])

  // ── Derived UI state ────────────────────────────────────────────────────────
  const isConnecting  = state.status === 'connecting'
  const isVerifying   = state.status === 'connected_unverified'
  const isBusy        = isConnecting || isVerifying || saving
  const isError       = state.status === 'error'
  const errorInfo     = isError ? getErrorInfo(debugInfo?.errorCode) : null

  return (
    <div className="connection-page">
      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div className="conn-topbar">
        <button className="conn-back-btn" id="btn-vxpro-back" onClick={() => navigate('/vxseries/select')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Geri
        </button>
        <div className="conn-topbar-divider" />
        <span className="conn-topbar-title">VX Pro Bağlantısı</span>
        <span className="conn-series-pill" style={{ background: 'rgba(0,224,161,0.12)', color: 'var(--color-vx)' }}>VX Pro</span>
      </div>

      <div className="conn-body">
        {/* ── Sol: Yeni bağlantı formu ───────────────────────────────────── */}
        <div className="conn-panel-left">
          <div>
            <div className="conn-panel-title">Yeni Bağlantı</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              VX Pro cihazına <strong>TCP</strong> üzerinden bağlanın.
              Port <strong>15200</strong> olarak sabit kullanılır.
            </p>
          </div>

          <div className="conn-form">
            {/* Cihaz Adı */}
            <div className="form-group">
              <label className="form-label" htmlFor="vxpro-device-name">Cihaz Adı</label>
              <input
                id="vxpro-device-name"
                className="form-input"
                placeholder="örn. VX Pro Sahne-1"
                value={deviceName}
                onChange={e => setDeviceName(e.target.value)}
                disabled={isBusy}
              />
            </div>

            {/* IP Adresi */}
            <div className="form-group">
              <label className="form-label" htmlFor="vxpro-ip">IP Adresi</label>
              <input
                id="vxpro-ip"
                className="form-input"
                placeholder="Örn: 192.168.1.100"
                value={ipAddress}
                onChange={e => setIpAddress(e.target.value)}
                disabled={isBusy}
              />
            </div>

            {/* Port bilgisi — sabit */}
            <div className="form-group">
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 6,
                background: 'rgba(0,224,161,0.06)',
                border: '1px solid rgba(0,224,161,0.15)',
                fontSize: 12, color: 'var(--text-muted)',
              }}>
                <span style={{ fontSize: 14 }}>🔌</span>
                <span>TCP Port: <strong style={{ color: 'var(--color-vx)' }}>15200</strong> (protokol standardı)</span>
              </div>
            </div>

            {/* ── Durum geri bildirimi ─────────────────────────────────── */}
            {isConnecting && (
              <div className="conn-result conn-result-info">
                <span className="spinner" /> TCP bağlantısı kuruluyor ({ipAddress}:15200)...
              </div>
            )}
            {isVerifying && (
              <div className="conn-result conn-result-info" style={{ color: 'var(--color-warning)' }}>
                <span className="spinner" /> TCP bağlandı. ModeID komutu gönderildi, yanıt bekleniyor...
              </div>
            )}

            {/* Hata: ayrıştırılmış mesaj */}
            {isError && state.lastError && (
              <div className="conn-result conn-result-error" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                <div style={{ fontWeight: 600 }}>⚠ {state.lastError}</div>
                {errorInfo?.detail && (
                  <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.5 }}>{errorInfo.detail}</div>
                )}
                {debugInfo?.errorCode && (
                  <div style={{ fontSize: 11, opacity: 0.55, marginTop: 2, fontFamily: 'monospace' }}>
                    [{debugInfo.errorCode}]
                  </div>
                )}
              </div>
            )}

            {state.status === 'connected_verified' && (
              <div className="conn-result conn-result-success">✓ Bağlantı doğrulandı (Verified)</div>
            )}

            {/* ── Debug paneli ─────────────────────────────────────────── */}
            {debugInfo && (
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={() => setShowDebug(v => !v)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', fontSize: 12,
                    display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0',
                  }}
                >
                  <span style={{ fontSize: 10 }}>{showDebug ? '▼' : '▶'}</span>
                  Debug bilgileri {showDebug ? 'gizle' : 'göster'}
                </button>

                {showDebug && (
                  <div style={{
                    marginTop: 6,
                    padding: '10px 12px',
                    borderRadius: 6,
                    background: 'rgba(0,0,0,0.35)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    fontSize: 11,
                    fontFamily: 'monospace',
                    lineHeight: 1.8,
                    color: 'var(--text-muted)',
                  }}>
                    <DebugRow label="Faz" value={debugInfo.phase} />
                    {debugInfo.sentHex && (
                      <DebugRow
                        label="→ Gönderilen (HEX)"
                        value={debugInfo.sentHex}
                        highlight="var(--color-vx)"
                      />
                    )}
                    {debugInfo.receivedHex ? (
                      <DebugRow
                        label="← Alınan (HEX)"
                        value={debugInfo.receivedHex}
                        highlight="#f6c90e"
                      />
                    ) : (
                      debugInfo.errorCode === 'ERR_NO_RESPONSE' && (
                        <DebugRow label="← Alınan (HEX)" value="(yanıt gelmedi)" />
                      )
                    )}
                    {debugInfo.parsedModelId !== undefined && debugInfo.parsedModelId !== null && (
                      <DebugRow
                        label="ModelID"
                        value={`${debugInfo.parsedModelId} (0x${debugInfo.parsedModelId.toString(16).toUpperCase()})`}
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="conn-actions">
              <button
                id="btn-vxpro-connect"
                className="btn btn-primary"
                onClick={handleConnect}
                disabled={!ipAddress || isBusy}
                style={{ width: '100%' }}
              >
                {isBusy
                  ? <><span className="spinner" /> İşlem sürüyor...</>
                  : 'Bağlan'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Sağ: Hızlı bağlantılar ────────────────────────────────────── */}
        <div className="conn-panel-right">
          <div className="conn-panel-title">Hızlı Bağlantılar</div>

          {recentConns.length === 0 ? (
            <div className="conn-recent-empty">
              <div className="conn-recent-empty-icon">🔌</div>
              <p>Henüz kayıtlı VX Pro bağlantısı yok.</p>
            </div>
          ) : (
            recentConns.map((conn) => {
              const primaryLabel   = conn.deviceName || conn.displayName || conn.ipAddress!
              const secondaryLabel = conn.deviceName ? conn.ipAddress : null

              return (
                <div key={conn.id} className="recent-card">
                  <div className="recent-card-icon" style={{ background: 'rgba(0,224,161,0.10)' }}>🖥</div>
                  <div className="recent-card-info">
                    <div className="recent-card-name">{primaryLabel}</div>
                    <div className="recent-card-detail">
                      {secondaryLabel && <span>{secondaryLabel} · </span>}
                      TCP:15200
                    </div>
                    <div className="recent-card-date">
                      {new Date(conn.lastConnectedAt).toLocaleDateString('tr-TR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <div className="recent-card-actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleConnectRecent(conn)}
                      disabled={isBusy}
                    >
                      Bağlan
                    </button>
                    <button
                      className="btn btn-danger btn-sm btn-icon"
                      onClick={() => handleDeleteRecent(conn.id)}
                      title="Sil"
                    >✕</button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Debug row bileşeni ───────────────────────────────────────────────────────
function DebugRow({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ minWidth: 160, opacity: 0.6, flexShrink: 0 }}>{label}:</span>
      <span
        style={{
          color: highlight ?? 'inherit',
          wordBreak: 'break-all',
          flex: 1,
        }}
      >
        {value}
      </span>
    </div>
  )
}
