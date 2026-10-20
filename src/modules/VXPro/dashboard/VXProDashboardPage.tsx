import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVXProSession } from '../state/VXProSessionState'
import { vxProAPI } from '@shared/api/bridge'
import { VXProDevicePage }  from './pages/VXProDevicePage'
import { VXProControlPage } from './pages/VXProControlPage'
import { VXProPresetsPage } from './pages/VXProPresetsPage'
import '@shared/components/DashboardShared.css'

type VXProTab = 'device' | 'control' | 'presets'

const NAV_ITEMS: Array<{ tab: VXProTab; icon: string; label: string }> = [
  { tab: 'device',   icon: '🖥',  label: 'Cihaz' },
  { tab: 'control',  icon: '🎛',  label: 'Kontrol' },
  { tab: 'presets',  icon: '💾',  label: 'Presetler' },
]

export const VXProDashboardPage: React.FC = () => {
  const navigate = useNavigate()
  const { state, dispatch } = useVXProSession()

  const [activeTab, setActiveTab]         = useState<VXProTab>('device')
  const [lastBrightness, setLastBrightness] = useState<number | null>(null)

  const handleDisconnect = async () => {
    try {
      await vxProAPI().disconnect()
    } catch { /* best-effort */ }
    dispatch({ type: 'DISCONNECT' })
    navigate('/vxpro/connect')
  }

  const handleBrightnessApplied = useCallback((val: number) => {
    setLastBrightness(val)
  }, [])

  // Guard: doğrulanmış bağlantı yoksa yönlendir
  if (state.status !== 'connected_verified') {
    return (
      <div className="dashboard-page" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 16,
          padding: '48px 56px',
          textAlign: 'center',
          maxWidth: 400,
        }}>
          <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.4 }}>⚡</div>
          <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Bağlantı Doğrulanamadı</h2>
          <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Dashboard'a erişmek için önce doğrulanmış bir VX Pro bağlantısı gerekli.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/vxpro/connect')}>
            Bağlantı Sayfasına Dön
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-page">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="dash-topbar">
        <div className="dash-topbar-left">
          <div>
            <div className="dash-device-name">
              {state.deviceName || state.ipAddress || 'VX Pro Cihazı'}
            </div>
            <div className="dash-device-info">
              {state.ipAddress} · TCP:15200
            </div>
          </div>
          <span className="badge badge-connected">
            <span className="badge-dot" />
            Bağlı &amp; Doğrulandı
          </span>
        </div>
        <div className="dash-topbar-right">
          <button
            id="btn-vxpro-disconnect"
            className="btn btn-secondary btn-sm"
            onClick={handleDisconnect}
          >
            Bağlantıyı Kes
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
            Ana Menü
          </button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="dash-body">
        {/* Left sidebar nav */}
        <nav className="dash-nav">
          <div className="dash-nav-label">VX Pro</div>
          {NAV_ITEMS.map(item => (
            <button
              key={item.tab}
              id={`btn-vxpro-nav-${item.tab}`}
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
          {activeTab === 'device' && (
            <VXProDevicePage lastBrightness={lastBrightness} />
          )}
          {activeTab === 'control' && (
            <VXProControlPage
              lastBrightness={lastBrightness}
              onBrightnessApplied={handleBrightnessApplied}
              onNavigateToPresets={() => setActiveTab('presets')}
            />
          )}
          {activeTab === 'presets' && <VXProPresetsPage />}
        </div>
      </div>
    </div>
  )
}
