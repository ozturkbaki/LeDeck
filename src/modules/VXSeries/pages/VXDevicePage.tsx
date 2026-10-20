import React from 'react'
import { useVXSession } from '../state/VXSessionState'
import { vxSeriesAPI } from '@shared/api/bridge'

export const VXDevicePage: React.FC = () => {
  const { state, dispatch } = useVXSession()

  const handleRefresh = async () => {
    if (!state.sessionId) return
    dispatch({ type: 'SET_COMMAND_BUSY', payload: true })
    try {
      const result = await vxSeriesAPI().sendCommand({ sessionId: state.sessionId, command: 'GET_DEVICE_INFO' })
      if (result.success && result.message) dispatch({ type: 'SET_COMMAND_RESULT', payload: result.message })
    } catch {
      dispatch({ type: 'ERROR', payload: { message: 'Cihaz bilgisi alınamadı.' } })
    }
  }

  return (
    <div className="page-panel">
      <div className="page-panel-header">
        <h2 className="page-panel-title">Cihaz Bilgileri</h2>
        <button className="btn btn-primary btn-sm" id="btn-vx-refresh-device" onClick={handleRefresh} disabled={state.commandBusy}>
          {state.commandBusy ? 'Yükleniyor…' : '↻ Yenile'}
        </button>
      </div>
      <div className="info-grid">
        <div className="info-card"><div className="info-card-label">Bağlantı Durumu</div><div className="info-card-value status-connected">● Bağlı</div></div>
        <div className="info-card"><div className="info-card-label">IP Adresi</div><div className="info-card-value">{state.ipAddress || '—'}</div></div>
        <div className="info-card"><div className="info-card-label">Port</div><div className="info-card-value">{state.port || '—'}</div></div>
        <div className="info-card"><div className="info-card-label">Cihaz Adı</div><div className="info-card-value">{state.deviceName || 'VX Series'}</div></div>
        {state.deviceInfo && Object.entries(state.deviceInfo).map(([k, v]) => (
          <div className="info-card" key={k}><div className="info-card-label">{k}</div><div className="info-card-value">{v}</div></div>
        ))}
      </div>
      {state.lastCommandResult && <div className="result-box"><div className="result-box-label">Son Yanıt</div><pre className="result-box-content">{state.lastCommandResult}</pre></div>}
      {state.lastError && <div className="error-box"><span>⚠ {state.lastError}</span><button className="btn btn-ghost btn-xs" onClick={() => dispatch({ type: 'CLEAR_ERROR' })}>✕</button></div>}
    </div>
  )
}
