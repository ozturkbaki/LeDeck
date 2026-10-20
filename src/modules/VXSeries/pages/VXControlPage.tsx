import React, { useState } from 'react'
import { useVXSession } from '../state/VXSessionState'
import { vxSeriesAPI } from '@shared/api/bridge'

const COMMANDS = [
  { id: 'power_on',      label: 'Güç Aç',        icon: '⚡', command: 'POWER_ON' },
  { id: 'power_off',     label: 'Güç Kapat',      icon: '⏻',  command: 'POWER_OFF' },
  { id: 'brightness_up', label: 'Parlaklık +',    icon: '☀',  command: 'BRIGHTNESS_UP' },
  { id: 'brightness_dn', label: 'Parlaklık −',    icon: '🌙', command: 'BRIGHTNESS_DOWN' },
  { id: 'test_pattern',  label: 'Test Deseni',    icon: '⬛', command: 'TEST_PATTERN' },
  { id: 'normal_mode',   label: 'Normal Mod',     icon: '▶',  command: 'NORMAL_MODE' },
  { id: 'hdmi_in',       label: 'HDMI Giriş',     icon: '🔌', command: 'INPUT_HDMI' },
  { id: 'dp_in',         label: 'DP Giriş',       icon: '🔗', command: 'INPUT_DP' },
]

export const VXControlPage: React.FC = () => {
  const { state, dispatch } = useVXSession()
  const [customCmd, setCustomCmd] = useState('')

  const sendCommand = async (command: string) => {
    if (!state.sessionId) return
    dispatch({ type: 'SET_COMMAND_BUSY', payload: true })
    try {
      const result = await vxSeriesAPI().sendCommand({ sessionId: state.sessionId, command })
      dispatch({ type: 'SET_COMMAND_RESULT', payload: result.message ?? 'OK' })
    } catch {
      dispatch({ type: 'ERROR', payload: { message: `Komut başarısız: ${command}` } })
    }
  }

  const sendCustom = async () => {
    if (!customCmd.trim()) return
    await sendCommand(customCmd.trim())
    setCustomCmd('')
  }

  return (
    <div className="page-panel">
      <div className="page-panel-header">
        <h2 className="page-panel-title">Kontrol Paneli</h2>
        {state.commandBusy && <span className="busy-indicator">İşleniyor…</span>}
      </div>
      <div className="command-grid">
        {COMMANDS.map(cmd => (
          <button key={cmd.id} id={`btn-vx-cmd-${cmd.id}`} className="command-btn"
            disabled={state.commandBusy || state.status !== 'connected'} onClick={() => sendCommand(cmd.command)}>
            <span className="command-btn-icon">{cmd.icon}</span>
            <span className="command-btn-label">{cmd.label}</span>
          </button>
        ))}
      </div>
      <div className="custom-command-section">
        <div className="custom-command-label">Özel Komut</div>
        <div className="custom-command-row">
          <input className="input" id="input-vx-custom-cmd" placeholder="Komut kodu girin…" value={customCmd}
            onChange={e => setCustomCmd(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendCustom()} disabled={state.commandBusy} />
          <button className="btn btn-primary" id="btn-vx-send-custom" disabled={state.commandBusy || !customCmd.trim()} onClick={sendCustom}>Gönder</button>
        </div>
      </div>
      {state.lastCommandResult && <div className="result-box"><div className="result-box-label">Son Yanıt</div><pre className="result-box-content">{state.lastCommandResult}</pre></div>}
      {state.lastError && <div className="error-box"><span>⚠ {state.lastError}</span><button className="btn btn-ghost btn-xs" onClick={() => dispatch({ type: 'CLEAR_ERROR' })}>✕</button></div>}
    </div>
  )
}
