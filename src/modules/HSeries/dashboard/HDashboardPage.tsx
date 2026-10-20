import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHSession } from '../state/HSessionState'
import { hSeriesAPI } from '@shared/api/bridge'
import { HDevicePage } from '../pages/HDevicePage'
import { HControlPage } from '../pages/HControlPage'
import { HPresetsPage } from '../pages/HPresetsPage'
import '@shared/components/DashboardShared.css'

type HTab = 'device' | 'control' | 'presets'

const NAV_ITEMS: Array<{ tab: HTab; icon: string; label: string }> = [
  { tab: 'device',  icon: '🖥',  label: 'Cihaz' },
  { tab: 'control', icon: '🎛',  label: 'Kontrol' },
  { tab: 'presets', icon: '💾',  label: 'Presetler' },
]

export const HDashboardPage: React.FC = () => {
  const navigate  = useNavigate()
  const { state, dispatch } = useHSession()
  const [activeTab, setActiveTab] = useState<HTab>('device')

  const handleDisconnect = async () => {
    if (state.sessionId) {
      await hSeriesAPI().disconnect({ sessionId: state.sessionId }).catch(() => {})
    }
    dispatch({ type: 'DISCONNECTED' })
    navigate('/hseries/connect')
  }

  return (
    <div className="dashboard-page">
      {/* Top bar */}
      <div className="dash-topbar">
        <div className="dash-topbar-left">
          <div>
            <div className="dash-device-name">{state.deviceName || 'H Series Cihazı'}</div>
            <div className="dash-device-info">{state.ipAddress} · UDP:6000</div>
          </div>
          <span className="badge badge-connected">
            <span className="badge-dot" />
            Bağlı
          </span>
        </div>
        <div className="dash-topbar-right">
          <button className="btn btn-secondary btn-sm" id="btn-h-disconnect" onClick={handleDisconnect}>
            Bağlantıyı Kes
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>Ana Menü</button>
        </div>
      </div>

      <div className="dash-body">
        {/* Left nav */}
        <nav className="dash-nav">
          <div className="dash-nav-label">H Series</div>
          {NAV_ITEMS.map(item => (
            <button
              key={item.tab}
              id={`btn-h-nav-${item.tab}`}
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
          {activeTab === 'device'  && <HDevicePage />}
          {activeTab === 'control' && <HControlPage />}
          {activeTab === 'presets' && <HPresetsPage />}
        </div>
      </div>
    </div>
  )
}
