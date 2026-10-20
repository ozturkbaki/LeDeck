import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVXSession } from '../state/VXSessionState'
import { vxSeriesAPI } from '@shared/api/bridge'
import { VXDevicePage } from '../pages/VXDevicePage'
import { VXControlPage } from '../pages/VXControlPage'
import '@shared/components/DashboardShared.css'

type VXTab = 'device' | 'control'

const NAV_ITEMS: Array<{ tab: VXTab; icon: string; label: string }> = [
  { tab: 'device',  icon: '🖥',  label: 'Cihaz' },
  { tab: 'control', icon: '🎛',  label: 'Kontrol' },
]

export const VXDashboardPage: React.FC = () => {
  const navigate = useNavigate()
  const { state, dispatch } = useVXSession()
  const [activeTab, setActiveTab] = useState<VXTab>('device')

  const handleDisconnect = async () => {
    if (state.sessionId) {
      await vxSeriesAPI().disconnect({ sessionId: state.sessionId }).catch(() => {})
    }
    dispatch({ type: 'DISCONNECTED' })
    navigate('/vxseries/connect')
  }

  return (
    <div className="dashboard-page">
      {/* Top bar */}
      <div className="dash-topbar">
        <div className="dash-topbar-left">
          <div>
            <div className="dash-device-name">{state.deviceName || 'VX Series Cihazı'}</div>
            <div className="dash-device-info">{state.ipAddress}:{state.port}</div>
          </div>
          <span className="badge badge-connected">
            <span className="badge-dot" />
            Bağlı
          </span>
        </div>
        <div className="dash-topbar-right">
          <button className="btn btn-secondary btn-sm" id="btn-vx-disconnect" onClick={handleDisconnect}>
            Bağlantıyı Kes
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>Ana Menü</button>
        </div>
      </div>

      <div className="dash-body">
        {/* Left nav */}
        <nav className="dash-nav">
          <div className="dash-nav-label">VX Series</div>
          {NAV_ITEMS.map(item => (
            <button
              key={item.tab}
              id={`btn-vx-nav-${item.tab}`}
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
          {activeTab === 'device'  && <VXDevicePage />}
          {activeTab === 'control' && <VXControlPage />}
        </div>
      </div>
    </div>
  )
}
