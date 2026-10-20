import React, { useCallback, useEffect, useRef } from 'react'
import { useMCTRLSession } from '../state/MCTRLSessionState'
import { mctrlAPI } from '@shared/api/bridge'
import './MCTRLDevicePage.css'

const PACING_MS = 400

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** Browser-safe hex string to byte array — no Node.js Buffer needed */
function hexToBytes(hex: string): number[] {
  const bytes: number[] = []
  for (let i = 0; i + 1 < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16))
  }
  return bytes
}

export const MCTRLDevicePage: React.FC = () => {
  const { state, dispatch } = useMCTRLSession()
  const fetchingRef = useRef(false)

  const modelName = (state.deviceInfo as Record<string, string> | null)?.modelName ?? 'Bilinmiyor'

  const runReadCycle = useCallback(async () => {
    if (!state.sessionId || fetchingRef.current) return
    fetchingRef.current = true
    dispatch({ type: 'SET_COMMAND_BUSY', payload: true })

    console.log('[MCTRL Read Cycle] Starting...')

    try {
      // 1. Firmware Version
      console.log('[MCTRL Read Cycle] 1/2 getFirmwareVersion')
      const fwRes = await mctrlAPI().sendCommand({
        sessionId: state.sessionId,
        command: 'getFirmwareVersion',
      })

      if (fwRes.success && fwRes.data) {
        const rawHex = (fwRes.data as any).rawHex as string | undefined
        if (rawHex) {
          const bytes = hexToBytes(rawHex)
          if (bytes.length >= 4) {
            const version = `${bytes[0]}.${bytes[1]}.${bytes[2]}.${bytes[3]}`
            dispatch({ type: 'UPDATE_DATA', payload: { firmwareVersion: version } })
          }
        }
      }

      await delay(PACING_MS)

      // 2. DVI Signal Status
      console.log('[MCTRL Read Cycle] 2/2 getDviSignalStatus')
      const dviRes = await mctrlAPI().sendCommand({
        sessionId: state.sessionId,
        command: 'getDviSignalStatus',
      })

      if (dviRes.success && dviRes.data) {
        const rawHex = (dviRes.data as any).rawHex as string | undefined
        if (rawHex) {
          const bytes = hexToBytes(rawHex)
          if (bytes.length >= 1) {
            dispatch({ type: 'UPDATE_DATA', payload: { dviSignalActive: bytes[0] !== 0x00 } })
          }
        }
      }

      dispatch({ type: 'UPDATE_DATA', payload: { initialFetchDone: true } })
      console.log('[MCTRL Read Cycle] Complete.')

    } catch (err) {
      console.error('[MCTRL Read Cycle] Error:', err)
      dispatch({ type: 'COMMAND_ERROR', payload: { message: `Okuma hatası: ${String(err)}` } })
    } finally {
      fetchingRef.current = false
      dispatch({ type: 'SET_COMMAND_BUSY', payload: false })
    }
  }, [state.sessionId, dispatch])

  // Auto-fetch on first mount
  useEffect(() => {
    if (state.status === 'connected' && !state.initialFetchDone) {
      runReadCycle()
    }
  }, [state.status, state.initialFetchDone, runReadCycle])

  const isConnected = state.status === 'connected'
  const isBusy = state.commandBusy || fetchingRef.current

  const infoCards = [
    { label: 'Cihaz Adı',         value: state.deviceName || 'MCTRL Cihazı',       icon: '🖥' },
    { label: 'Model',              value: modelName,                                  icon: '🔖' },
    { label: 'COM Port',           value: state.comPort,                              icon: '🔌' },
    { label: 'Baud Rate',          value: `${state.baudRate.toLocaleString()} bps`,  icon: '📶' },
  ]

  const dataCards = [
    {
      label: 'Firmware Versiyonu',
      value: state.firmwareVersion ?? (state.initialFetchDone ? 'Okunamadı' : '—'),
      icon: '⚙',
      loading: !state.initialFetchDone && isBusy,
    },
    {
      label: 'DVI Sinyal Durumu',
      value: state.dviSignalActive === null
        ? (state.initialFetchDone ? 'Okunamadı' : '—')
        : state.dviSignalActive ? 'Aktif' : 'Sinyal Yok',
      icon: state.dviSignalActive ? '🟢' : (state.dviSignalActive === false ? '🔴' : '⬜'),
      loading: !state.initialFetchDone && isBusy,
      accent: state.dviSignalActive === true ? 'success' : state.dviSignalActive === false ? 'danger' : undefined,
    },
  ]

  return (
    <div className="page-panel fade-in mctrl-device-page">
      <div className="page-panel-header mctrl-device-header">
        <div>
          <h2 className="page-panel-title">Cihaz Bilgileri</h2>
          <p>MCTRL cihazına ait bağlantı ve durum bilgileri.</p>
        </div>
        <button
          className="btn btn-secondary btn-sm mctrl-refresh-btn"
          onClick={runReadCycle}
          disabled={!isConnected || isBusy}
          title="Verileri Yenile"
        >
          <span className={isBusy ? 'mctrl-spin' : ''}>↻</span>
          {isBusy ? 'Yükleniyor...' : 'Yenile'}
        </button>
      </div>

      {/* Static connection info */}
      <div className="mctrl-section-label">Bağlantı</div>
      <div className="mctrl-cards-grid">
        {infoCards.map(card => (
          <div key={card.label} className="mctrl-info-card">
            <span className="mctrl-info-icon">{card.icon}</span>
            <div className="mctrl-info-body">
              <div className="mctrl-info-label">{card.label}</div>
              <div className="mctrl-info-value">{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Dynamic device data */}
      <div className="mctrl-section-label" style={{ marginTop: 24 }}>Cihaz Durumu</div>
      <div className="mctrl-cards-grid">
        {dataCards.map(card => (
          <div key={card.label} className={`mctrl-info-card ${card.accent ? `mctrl-accent-${card.accent}` : ''}`}>
            <span className="mctrl-info-icon">{card.loading ? <span className="mctrl-spin">↻</span> : card.icon}</span>
            <div className="mctrl-info-body">
              <div className="mctrl-info-label">{card.label}</div>
              <div className="mctrl-info-value">{card.loading ? 'Okunuyor...' : card.value}</div>
            </div>
          </div>
        ))}
      </div>

      {state.lastError && (
        <div className="error-box mt-4">
          <span>⚠ {state.lastError}</span>
          <button className="btn btn-ghost btn-xs" onClick={() => dispatch({ type: 'CLEAR_ERROR' })}>✕</button>
        </div>
      )}
    </div>
  )
}
