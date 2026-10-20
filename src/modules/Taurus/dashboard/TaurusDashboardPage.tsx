import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTaurusSession } from '../state/TaurusSessionState'
import { taurusAPI } from '@shared/api/bridge'
import '@shared/components/DashboardShared.css'

type TaurusTab = 'device' | 'control' | 'screen'

const NAV_ITEMS: Array<{ tab: TaurusTab; icon: string; label: string }> = [
  { tab: 'device',  icon: '🖥', label: 'Cihaz' },
  { tab: 'screen',  icon: '📏', label: 'Ekran' },
  { tab: 'control', icon: '🎛', label: 'Kontrol' },
]

export const TaurusDashboardPage: React.FC = () => {
  const navigate = useNavigate()
  const { state, dispatch } = useTaurusSession()
  const [activeTab, setActiveTab] = useState<TaurusTab>('device')
  
  // Screenshot states
  const [showSS, setShowSS] = useState(false)
  const [ssImage, setSsImage] = useState<string | null>(null)
  const [ssLoading, setSsLoading] = useState(false)
  const [isLive, setIsLive] = useState(false)
  
  // Connection monitoring states
  const [isLost, setIsLost] = useState(false)

  // Redirect if not connected
  useEffect(() => {
    if (state.status === 'disconnected') navigate('/taurus/connect', { replace: true })
  }, [state.status, navigate])

  // Listen for background connection status events
  useEffect(() => {
    if (!state.sessionId) return
    
    const unSubLost = taurusAPI().onDisconnected(() => {
      setIsLost(true)
      setIsLive(false) // Kopunca canlı yayını durdur
    })
    
    const unSubWon = taurusAPI().onReconnected(() => {
      setIsLost(false)
    })

    return () => {
      unSubLost()
      unSubWon()
    }
  }, [state.sessionId])

  const handleCaptureSS = useCallback(async () => {
    if (!state.sessionId || ssLoading || isLost) return
    setSsLoading(true)
    if (!showSS) setShowSS(true)
    try {
      const res = await taurusAPI().sendCommand({ 
        sessionId: state.sessionId, 
        command: 'captureScreenshot',
        params: { width: 800, height: 600 } // Canlı modda hızı artırmak için çözünürlüğü biraz düşürdük
      })
      if (res.success && (res.data as any).base64) {
        setSsImage((res.data as any).base64)
      }
    } catch (err) {
      console.error('SS Error:', err)
      if (!isLive) alert('Hata: ' + String(err))
    } finally {
      setSsLoading(false)
    }
  }, [state.sessionId, ssLoading, showSS, isLive])

  // Live Mode Interval
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (isLive && showSS) {
      interval = setInterval(() => {
        handleCaptureSS()
      }, 1000)
    }
    return () => { if (interval) clearInterval(interval) }
  }, [isLive, showSS, handleCaptureSS])

  // Close live when modal closed
  useEffect(() => {
    if (!showSS) setIsLive(false)
  }, [showSS])

  // Initial data fetch on mount
  useEffect(() => {
    if (state.status !== 'connected' || !state.sessionId) return
    fetchBaseInfo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sessionId])

  const fetchBaseInfo = useCallback(async () => {
    if (!state.sessionId) return
    try {
      // 1. Temel Cihaz Bilgisi (base-info)
      let baseInfoData: Record<string, unknown> | null = null
      const res = await taurusAPI().sendCommand({ sessionId: state.sessionId, command: 'getBaseInfo' }).catch(() => null)
      if (res && res.success && res.data) {
        baseInfoData = res.data as Record<string, unknown>
      }

      // 2. Parlaklık Bilgisi (brightness)
      let brightnessVal = '—'
      const bRes = await taurusAPI().sendCommand({ sessionId: state.sessionId, command: 'getBrightness' }).catch(() => null)
      if (bRes && bRes.success && bRes.data) {
        const ratio = (bRes.data as any).ratio
        if (ratio !== undefined) brightnessVal = `%${ratio}`
      }

      // 3. Sender Card Bilgisi
      let senderCardData: Record<string, unknown> | null = null
      const sRes = await taurusAPI().sendCommand({ sessionId: state.sessionId, command: 'getSenderCardInfo' }).catch(() => null)
      if (sRes && sRes.success && sRes.data) {
        senderCardData = sRes.data as Record<string, unknown>
      }

      // 4. Verileri Birleştir
      const finalBaseInfo = baseInfoData || { 
        productName: state.deviceName || 'Taurus Device', 
        sn: state.sn, 
        ip: state.ip 
      }
      finalBaseInfo.brightness = brightnessVal
      if (senderCardData) finalBaseInfo.senderCard = senderCardData

      dispatch({ type: 'UPDATE_DATA', payload: { baseInfo: finalBaseInfo } })
    } catch (err) {
      console.error('[TaurusDashboard] fetch error:', err)
      dispatch({ type: 'UPDATE_DATA', payload: { baseInfo: { productName: state.deviceName || 'Taurus Device', sn: state.sn, ip: state.ip, brightness: '—' } } })
    }
  }, [state.sessionId, dispatch, state.deviceName, state.sn, state.ip])

  const handleDisconnect = useCallback(async () => {
    if (!state.sessionId) return
    try {
      // Arka plandaki temizliği beklemiyoruz (özellikle cihaz kapalıyken logout timeout beklememek için)
      taurusAPI().disconnect({ sessionId: state.sessionId }).catch(err => {
        console.warn('[Taurus IPC] Arka plan disconnect hatası (göz ardı edildi):', err)
      })
      
      // Hemen state'i temizle ve yönlendir
      dispatch({ type: 'DISCONNECTED' })
      navigate('/taurus/connect', { replace: true })
    } catch (err) {
      console.error('Disconnect UI error:', err)
    }
  }, [state.sessionId, navigate, dispatch])

  return (
    <div className="dashboard-page">
      {/* Top bar */}
      <div className="dash-topbar">
        <div className="dash-topbar-left">
          <div>
            <div className="dash-device-name">{state.deviceName || 'Taurus Cihazı'}</div>
            <div className="dash-device-info">{state.ip}:{state.port}</div>
          </div>
          <span className={`badge ${isLost ? 'badge-error' : 'badge-connected'}`}>
            <span className="badge-dot" />
            {isLost ? 'Bağlantı Koptu' : 'Bağlı'}
          </span>
        </div>
        <div className="dash-topbar-right">
          <button 
            className="btn btn-primary btn-sm btn-ss-hover" 
            onClick={handleCaptureSS}
            disabled={isLost}
          >
            📸 Ekran İzleme
          </button>
          <button className="btn btn-secondary btn-sm" id="btn-taurus-disconnect" onClick={handleDisconnect}>
            Bağlantıyı Kes
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>Ana Menü</button>
        </div>
      </div>

      {/* Connection Lost Overlay */}
      {isLost && (
        <div className="lost-overlay">
          <div className="lost-modal fade-in">
            <div className="lost-icon">⚠️</div>
            <h3>Cihaz Bağlantısı Kesildi</h3>
            <p>Cihaza ulaşılamıyor. Arka planda yeniden bağlanmaya çalışılıyor...</p>
            <div className="lost-actions">
              <button className="btn btn-primary" onClick={handleDisconnect}>🔄 Bağlantıyı Sıfırla ve Başa Dön</button>
              <button className="btn btn-secondary" onClick={handleDisconnect}>🔌 Bağlantıyı Sonlandır</button>
            </div>
          </div>
        </div>
      )}

      <div className="dash-body">
        {/* Left nav */}
        <nav className="dash-nav">
          <div className="dash-nav-label">TAURUS</div>
          {NAV_ITEMS.map(item => (
            <button
              key={item.tab}
              id={`btn-taurus-nav-${item.tab}`}
              className={`dash-nav-item ${activeTab === item.tab ? 'active' : ''}`}
              onClick={() => setActiveTab(item.tab)}
            >
              <span className="dash-nav-item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="dash-content">
          {activeTab === 'device'  && <TaurusDeviceTab />}
          {activeTab === 'screen'  && <TaurusScreenTab />}
          {activeTab === 'control' && <TaurusControlTab />}
        </div>
      </div>

      {/* Screenshot Modal */}
      {showSS && (
        <div className="ss-overlay" onClick={() => setShowSS(false)}>
          <div className="ss-modal fade-in" onClick={e => e.stopPropagation()}>
            <div className="ss-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span>Canlı Ekran Önizleme</span>
                {isLive && <span className="badge-live">LIVE</span>}
              </div>
              <div className="ss-header-actions">
                <button 
                  className={`btn btn-sm ${isLive ? 'btn-danger' : 'btn-secondary'}`} 
                  onClick={() => setIsLive(!isLive)}
                >
                  {isLive ? '⏹ Yayını Durdur' : '📡 Canlı Yayın'}
                </button>
                <button className="btn btn-primary btn-sm" onClick={handleCaptureSS} disabled={ssLoading || isLive}>
                  {ssLoading ? '...' : '🔄 Tekrar Al'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowSS(false)}>✕</button>
              </div>
            </div>
            <div className="ss-body">
              {ssLoading && !ssImage && <div className="ss-loader">Görüntü oluşturuluyor...</div>}
              {ssImage && <img src={ssImage} alt="Screen Preview" className={ssLoading ? 'loading' : ''} />}
              {!ssLoading && !ssImage && <div className="ss-error">Görüntü alınamadı.</div>}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .btn-ss-hover {
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(var(--primary-rgb), 0.2);
        }
        .btn-ss-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(var(--primary-rgb), 0.4);
        }
        .ss-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.8);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .ss-modal {
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 16px;
          width: 80vw;
          max-width: 1024px;
          overflow: hidden;
          box-shadow: 0 24px 48px rgba(0,0,0,0.5);
        }
        .ss-header {
          padding: 16px 24px;
          background: #222;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #333;
        }
        .ss-header span { font-weight: 600; color: #fff; }
        .ss-header-actions { display: flex; gap: 12px; }
        .ss-body {
          min-height: 400px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #000;
          position: relative;
        }
        .ss-body img {
          max-width: 100%;
          max-height: 70vh;
          object-fit: contain;
          transition: opacity 0.3s ease;
        }
        .ss-body img.loading { opacity: 0.5; }
        .ss-loader { color: var(--primary-color); font-weight: 500; }
        .ss-error { color: #dc3545; }
        .badge-live {
          background: #dc3545;
          color: white;
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: bold;
          animation: blink 1s infinite;
        }
        @keyframes blink {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        .btn-danger {
          background: #dc3545;
          color: white;
          border: none;
        }
        .btn-danger:hover {
          background: #c82333;
        }
        .badge-error {
          background: rgba(220, 53, 69, 0.1);
          color: #dc3545;
          border: 1px solid rgba(220, 53, 69, 0.2);
          animation: blink 1.5s infinite;
        }
        .lost-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
        }
        .lost-modal {
          background: #1a1a1a;
          border: 1px solid #333;
          padding: 40px;
          border-radius: 24px;
          text-align: center;
          max-width: 400px;
          box-shadow: 0 32px 64px rgba(0,0,0,0.5);
        }
        .lost-icon { font-size: 48px; margin-bottom: 20px; }
        .lost-modal h3 { color: #fff; margin-bottom: 12px; }
        .lost-modal p { color: var(--text-muted); margin-bottom: 24px; line-height: 1.5; }
        .lost-actions { display: flex; flex-direction: column; gap: 12px; }
      `}</style>
    </div>
  )
}

// ─── Device Tab ───────────────────────────────────────────────────────────────

const TaurusDeviceTab: React.FC = () => {
  const { state } = useTaurusSession()
  const info = state.baseInfo as any

  // ─── Veri Gruplandırma ──────────────────────────────────────────────────────
  
  const availableRows: [string, any][] = []
  const missingRows:   [string, any][] = []

  if (info) {
    const sc = info.senderCard as Record<string, any> | undefined

    // Temel Bilgiler (Kesin Gelenler)
    availableRows.push(['SN', info.sn || sc?.sn || state.sn])
    availableRows.push(['IP', info.ip || state.ip])
    availableRows.push(['Ürün Adı', info.productName || sc?.productName || '—'])
    availableRows.push(['Cihaz Adı', sc?.aliasName || '—'])
    availableRows.push(['Model', sc?.model || '—'])
    availableRows.push(['Versiyon', sc?.version || info.osVersion || '—'])
    availableRows.push(['Platform', sc?.platform || '—'])
    availableRows.push(['Ekran Tipi', sc?.displayDevice || '—'])
    
    if (sc?.runningTime) {
      const h = Math.floor(sc.runningTime / 3600)
      const m = Math.floor((sc.runningTime % 3600) / 60)
      availableRows.push(['Çalışma Süresi', `${h} sa ${m} dk`])
    }

    availableRows.push(['Ağ Portları (Eth)', String(sc?.networkPortsNum || '—')])
    availableRows.push(['Gönderici MAC', sc?.mac || '—'])
    availableRows.push(['Parlaklık', info.brightness !== undefined ? `%${info.brightness}` : '—'])
    availableRows.push(['Ekran Durumu', sc?.status ? 'Aktif' : 'Pasif'])

    // Eksik Bilgiler (Null/Undefined Gelenler)
    if (!sc?.signalSource) missingRows.push(['Sinyal Kaynağı', 'Veri Bekleniyor...'])
    else availableRows.push(['Sinyal Kaynağı', sc.signalSource])

    if (!sc?.timeZone) missingRows.push(['Zaman Dilimi', 'Veri Bekleniyor...'])
    else availableRows.push(['Zaman Dilimi', sc.timeZone])

    if (!sc?.reportTime) missingRows.push(['Son Rapor', 'Veri Bekleniyor...'])
    else availableRows.push(['Son Rapor', sc.reportTime])
  }

  const rows = [...availableRows, ...missingRows]

  return (
    <div className="page-panel fade-in">
      <div className="page-panel-header">
        <h2 className="page-panel-title">Cihaz Bilgisi</h2>
        <p>Bağlı Taurus cihazının temel verileri.</p>
      </div>

      {rows.length > 0 ? (
        <table className="info-table">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <td className="info-table-label">{label}</td>
                <td className="info-table-value">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: 16 }}>
          Cihaz bilgisi yükleniyor...
        </div>
      )}
    </div>
  )
}

// ─── Control Tab (Faz 2'de genişletilecek) ───────────────────────────────────

const TaurusControlTab: React.FC = () => {
  const { state } = useTaurusSession()
  const [isRebooting, setIsRebooting] = useState(false)

  const handleReboot = async () => {
    if (!state.sessionId) return
    const confirm = window.confirm('Cihazı yeniden başlatmak istediğinize emin misiniz?')
    if (!confirm) return

    setIsRebooting(true)
    try {
      const res = await taurusAPI().sendCommand({ sessionId: state.sessionId, command: 'reboot' })
      if (res.success) {
        alert('Yeniden başlatma komutu başarıyla gönderildi. Cihaz kapanıp açılacak.')
      } else {
        alert('Hata: ' + (res.message || 'Komut gönderilemedi'))
      }
    } catch (err) {
      alert('Hata: ' + String(err))
    } finally {
      setIsRebooting(false)
    }
  }

  return (
    <div className="page-panel fade-in">
      <div className="page-panel-header">
        <h2 className="page-panel-title">Kontrol</h2>
        <p>Parlaklık, ses ve güç kontrolü.</p>
      </div>
      <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button 
            className="btn btn-primary" 
            onClick={handleReboot}
            disabled={isRebooting}
            style={{ backgroundColor: '#dc3545', borderColor: '#dc3545' }}
          >
            {isRebooting ? 'Gönderiliyor...' : '🔄 Cihazı Yeniden Başlat (Reboot)'}
          </button>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: '24px' }}>
          🎛 Diğer kontrol özellikleri bir sonraki fazda eklenecek.
        </div>
      </div>
    </div>
  )
}

// ─── Screen Tab ─────────────────────────────────────────────────────────────

const TaurusScreenTab: React.FC = () => {
  const { state } = useTaurusSession()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!state.sessionId) return
    setLoading(true)
    taurusAPI().sendCommand({ sessionId: state.sessionId, command: 'getScreenInfo' })
      .then(res => {
        if (res.success) setData(res.data)
        else setError(res.message || 'Ekran bilgisi alınamadı')
      })
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [state.sessionId])

  return (
    <div className="page-panel fade-in">
      <div className="page-panel-header">
        <h2 className="page-panel-title">Ekran ve Alıcı Kart Yerleşimi</h2>
        <p>Cihaz üzerindeki portlar ve bağlanan alıcı kartların çözünürlük bilgileri.</p>
      </div>
      
      <div style={{ padding: 24 }}>
        {loading && <div style={{ color: 'var(--text-muted)' }}>Alıcı kart bilgileri taranıyor...</div>}
        {error && <div style={{ color: '#dc3545', padding: '16px', background: 'rgba(220, 53, 69, 0.1)', borderRadius: 8 }}>⚠ {error}</div>}
        
        {!loading && !error && data?.receiveCardRegionInfo && data.receiveCardRegionInfo.length > 0 && (
          <table className="info-table" style={{ marginTop: 0 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Port No</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Sıra (Connect Index)</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Koordinat (X, Y)</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Çözünürlük (G×Y)</th>
              </tr>
            </thead>
            <tbody>
              {data.receiveCardRegionInfo.map((card: any, i: number) => (
                <tr key={i}>
                  <td className="info-table-value">Port {card.portIndex + 1}</td>
                  <td className="info-table-value">{card.connectIndex + 1}. Kart</td>
                  <td className="info-table-value">{card.X}, {card.Y}</td>
                  <td className="info-table-value">{card.width} × {card.height} px</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && !error && (!data?.receiveCardRegionInfo || data.receiveCardRegionInfo.length === 0) && (
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Sistemde kayıtlı herhangi bir alıcı kart yerleşimi bulunamadı.
          </div>
        )}
      </div>
    </div>
  )
}
