import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMCTRLSession } from '../state/MCTRLSessionState'
import { mctrlAPI } from '@shared/api/bridge'
import { MCTRLDevicePage } from '../pages/MCTRLDevicePage'
import { MCTRLControlPage } from '../pages/MCTRLControlPage'
import '@shared/components/DashboardShared.css'

type MCTRLTab = 'device' | 'control'

const NAV_ITEMS: Array<{ tab: MCTRLTab; icon: string; label: string }> = [
  { tab: 'device',  icon: '🖥',  label: 'Cihaz' },
  { tab: 'control', icon: '🎛',  label: 'Kontrol' },
]

export const MCTRLDashboardPage: React.FC = () => {
  const navigate = useNavigate()
  const { state, dispatch } = useMCTRLSession()
  const [activeTab, setActiveTab] = useState<MCTRLTab>('device')

  const handleDisconnect = async () => {
    if (state.sessionId) {
      await mctrlAPI().disconnect({ sessionId: state.sessionId }).catch(() => {})
    }
    dispatch({ type: 'DISCONNECTED' })
    navigate('/mctrl/connect')
  }

  return (
    <div className="dashboard-page">
      {/* Top bar */}
      <div className="dash-topbar">
        <div className="dash-topbar-left">
          <div>
            <div className="dash-device-name">{state.deviceName || 'MCTRL Cihazı'}</div>
            <div className="dash-device-info">{state.comPort} — {state.baudRate} baud</div>
          </div>
          <span className="badge badge-connected">
            <span className="badge-dot" />
            Bağlı
          </span>
        </div>
        <div className="dash-topbar-right">
          <button className="btn btn-secondary btn-sm" id="btn-mctrl-disconnect" onClick={handleDisconnect}>
            Bağlantıyı Kes
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>Ana Menü</button>
        </div>
      </div>

      <div className="dash-body">
        {/* Left nav */}
        <nav className="dash-nav">
          <div className="dash-nav-label">MCTRL</div>
          {NAV_ITEMS.map(item => (
            <button
              key={item.tab}
              id={`btn-mctrl-nav-${item.tab}`}
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
          {activeTab === 'device'  && <MCTRLDevicePage />}
          {activeTab === 'control' && <MCTRLControlPage />}
        </div>
      </div>
    </div>
  )
}
