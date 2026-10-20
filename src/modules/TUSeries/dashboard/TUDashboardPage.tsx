import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTUSession } from '../state/TUSessionState'
import { tuSeriesAPI } from '@shared/api/bridge'
import { TUDevicePage } from '../pages/TUDevicePage'
import { TUControlPage } from '../pages/TUControlPage'
import { TUPlaybackPage } from '../pages/TUPlaybackPage'
import { TURemotePage } from '../pages/TURemotePage'
import { getDeviceImage, getDeviceFallbackIcon } from '@shared/deviceImageMap'
import '@shared/components/DashboardShared.css'

type TUTab = 'device' | 'control' | 'playback' | 'remote'

const NAV_ITEMS: Array<{ tab: TUTab; icon: string; label: string }> = [
  { tab: 'device',   icon: '🖥',  label: 'Cihaz' },
  { tab: 'control',  icon: '🎛',  label: 'Kontrol' },
  { tab: 'playback', icon: '▶',   label: 'Oynatma' },
  { tab: 'remote',   icon: '📡',  label: 'Kumanda' },
]

export const TUDashboardPage: React.FC = () => {
  const navigate = useNavigate()
  const { state, dispatch } = useTUSession()
  const [activeTab, setActiveTab] = useState<TUTab>('device')

  const handleDisconnect = async () => {
    if (state.sessionId) {
      await tuSeriesAPI().disconnect({ sessionId: state.sessionId }).catch(() => {})
    }
    dispatch({ type: 'DISCONNECTED' })
    navigate('/tuseries/connect')
  }

  return (
    <div className="dashboard-page">
      {/* Top bar */}
      <div className="dash-topbar">
        <div className="dash-topbar-left">
          {getDeviceImage('TU') ? (
            <img 
              src={getDeviceImage('TU')} 
              alt="TU" 
              style={{ width: 44, height: 44, objectFit: 'contain', marginRight: 8, background: 'rgba(124, 94, 245, 0.15)', padding: 4, borderRadius: 8 }} 
              draggable={false} 
            />
          ) : (
            <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginRight: 8, background: 'rgba(124, 94, 245, 0.15)', borderRadius: 8 }}>
              {getDeviceFallbackIcon('TU')}
            </div>
          )}
          <div>
            <div className="dash-device-name">{state.deviceName || 'TU Series Cihazı'}</div>
            <div className="dash-device-info">{state.ipAddress}</div>
          </div>
          <span className="badge badge-connected" style={{ marginLeft: 12 }}>
            <span className="badge-dot" />
            Bağlı
          </span>
        </div>
        <div className="dash-topbar-right">
          <button className="btn btn-secondary btn-sm" id="btn-tu-disconnect" onClick={handleDisconnect}>
            Bağlantıyı Kes
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>Ana Menü</button>
        </div>
      </div>

      <div className="dash-body">
        {/* Left nav */}
        <nav className="dash-nav">
          <div className="dash-nav-label">TU Series</div>
          {NAV_ITEMS.map(item => (
            <button
              key={item.tab}
              id={`btn-tu-nav-${item.tab}`}
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
          {activeTab === 'device'   && <TUDevicePage />}
          {activeTab === 'control'  && <TUControlPage />}
          {activeTab === 'playback' && <TUPlaybackPage />}
          {activeTab === 'remote'   && <TURemotePage />}
        </div>
      </div>
    </div>
  )
}
