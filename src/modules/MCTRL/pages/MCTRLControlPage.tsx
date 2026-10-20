import React, { useCallback, useRef, useState } from 'react'
import { useMCTRLSession } from '../state/MCTRLSessionState'
import { mctrlAPI } from '@shared/api/bridge'
import './MCTRLControlPage.css'

const PACING_MS = 300

function hexToBytes(hex: string): number[] {
  const out: number[] = []
  for (let i = 0; i + 1 < hex.length; i += 2)
    out.push(parseInt(hex.slice(i, i + 2), 16))
  return out
}

function rawToPercent(raw: number): number { return Math.round((raw / 255) * 100) }
function percentToRaw(pct: number): number { return Math.round((pct / 100) * 255) }

// Input source definitions — mirrors MCTRLProtocolBuilder.INPUT_SOURCE_MAP
const INPUT_SOURCES: { id: string; code: number; label: string; icon: string }[] = [
  { id: 'DVI',       code: 0x58, label: 'DVI',      icon: '🖥' },
  { id: 'Dual_DVI',  code: 0x61, label: 'Dual DVI', icon: '🖥' },
  { id: 'HDMI',      code: 0x05, label: 'HDMI',     icon: '📺' },
  { id: 'HDMI1.4',   code: 0x5A, label: 'HDMI 1.4', icon: '📺' },
  { id: '3G-SDI',    code: 0x01, label: '3G-SDI',   icon: '📡' },
  { id: 'DP',        code: 0x5F, label: 'DP',        icon: '🔌' },
]

export const MCTRLControlPage: React.FC = () => {
  const { state, dispatch } = useMCTRLSession()

  // ── Brightness state ──────────────────────────────────────────────────────
  const brightnessRef = useRef(false)
  const [sliderValue, setSliderValue] = useState<number>(state.brightnessPercent ?? 100)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Input Source state ────────────────────────────────────────────────────
  const inputSrcRef = useRef(false)
  const [settingSource, setSettingSource] = useState<number | null>(null)

  // ─── Brightness Read ──────────────────────────────────────────────────────
  const readBrightness = useCallback(async () => {
    if (!state.sessionId || brightnessRef.current) return
    brightnessRef.current = true
    try {
      const res = await mctrlAPI().sendCommand({ sessionId: state.sessionId, command: 'getBrightness' })
      if (res.success && res.data) {
        const bytes = hexToBytes((res.data as any).rawHex ?? '')
        if (bytes.length >= 5) {
          const raw = bytes[0]
          const pct = rawToPercent(raw)
          dispatch({ type: 'UPDATE_DATA', payload: { currentBrightness: raw, brightnessPercent: pct } })
          setSliderValue(pct)
        }
      }
    } catch (err) { console.error('[Control] getBrightness:', err) }
    finally { brightnessRef.current = false }
  }, [state.sessionId, dispatch])

  // ─── Brightness Write ─────────────────────────────────────────────────────
  const sendBrightness = useCallback(async (percent: number) => {
    if (!state.sessionId || brightnessRef.current) return
    brightnessRef.current = true
    try {
      const res = await mctrlAPI().sendCommand({
        sessionId: state.sessionId,
        command: 'setBrightness',
        params: { value: percentToRaw(percent) },
      })
      if (res.success) {
        await new Promise(r => setTimeout(r, PACING_MS))
        brightnessRef.current = false
        await readBrightness()
        return
      } else {
        setSliderValue(state.brightnessPercent ?? 100)
      }
    } catch { setSliderValue(state.brightnessPercent ?? 100) }
    finally { brightnessRef.current = false }
  }, [state.sessionId, state.brightnessPercent, readBrightness])

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = Number(e.target.value)
    setSliderValue(pct)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => sendBrightness(pct), 300)
  }

  // ─── Input Source Read ────────────────────────────────────────────────────
  const readInputSource = useCallback(async () => {
    if (!state.sessionId || inputSrcRef.current) return
    inputSrcRef.current = true
    try {
      // Step 1: check manual/auto status
      const statusRes = await mctrlAPI().sendCommand({
        sessionId: state.sessionId,
        command: 'checkInputSourceStatus',
      })
      let manual: boolean | null = null
      if (statusRes.success && statusRes.data) {
        const bytes = hexToBytes((statusRes.data as any).rawHex ?? '')
        if (bytes.length >= 1) manual = bytes[0] === 0x5A
      }

      await new Promise(r => setTimeout(r, PACING_MS))

      // Step 2: get active source
      const srcRes = await mctrlAPI().sendCommand({
        sessionId: state.sessionId,
        command: 'getInputSource',
      })
      if (srcRes.success && srcRes.data) {
        const bytes = hexToBytes((srcRes.data as any).rawHex ?? '')
        if (bytes.length >= 1) {
          const code = bytes[0]
          const found = INPUT_SOURCES.find(s => s.code === code)
          dispatch({ type: 'UPDATE_DATA', payload: {
            inputSourceCode: code,
            inputSourceName: found?.label ?? `0x${code.toString(16).padStart(2,'0')}`,
            inputSourceManual: manual,
          }})
        }
      }
    } catch (err) { console.error('[Control] readInputSource:', err) }
    finally { inputSrcRef.current = false }
  }, [state.sessionId, dispatch])

  // ─── Input Source Mode Write ────────────────────────────────────────────────
  const handleToggleMode = useCallback(async () => {
    if (!state.sessionId || inputSrcRef.current || state.inputSourceManual === null) return
    inputSrcRef.current = true
    const newMode = !state.inputSourceManual
    try {
      const res = await mctrlAPI().sendCommand({
        sessionId: state.sessionId,
        command: 'setInputSourceMode',
        params: { manual: newMode },
      })
      if (res.success) {
        await new Promise(r => setTimeout(r, PACING_MS))
        inputSrcRef.current = false
        await readInputSource()
      }
    } catch (err) { console.error('[Control] toggleMode:', err) }
    finally { inputSrcRef.current = false }
  }, [state.sessionId, state.inputSourceManual, readInputSource])

  // ─── Input Source Write ───────────────────────────────────────────────────
  const handleSetSource = useCallback(async (code: number) => {
    if (!state.sessionId || inputSrcRef.current) return
    inputSrcRef.current = true
    setSettingSource(code)
    try {
      // Force manual mode if we're currently auto
      if (state.inputSourceManual === false) {
        console.log('[Control] Auto mode detected. Switching to Manual before setting source...')
        await mctrlAPI().sendCommand({
          sessionId: state.sessionId,
          command: 'setInputSourceMode',
          params: { manual: true },
        })
        await new Promise(r => setTimeout(r, PACING_MS))
      }

      const res = await mctrlAPI().sendCommand({
        sessionId: state.sessionId,
        command: 'setInputSource',
        params: { sourceCode: code },
      })
      if (res.success) {
        await new Promise(r => setTimeout(r, PACING_MS))
        inputSrcRef.current = false
        await readInputSource()
        return
      } else {
        dispatch({ type: 'COMMAND_ERROR', payload: { message: `Kaynak değiştirilemedi: ${res.message ?? ''}` } })
      }
    } catch (err) {
      dispatch({ type: 'COMMAND_ERROR', payload: { message: String(err) } })
    } finally {
      inputSrcRef.current = false
      setSettingSource(null)
    }
  }, [state.sessionId, state.inputSourceManual, dispatch, readInputSource])

  const isConnected    = state.status === 'connected'
  const brightnessbusy = !isConnected || brightnessRef.current
  const inputSrcBusy   = !isConnected || inputSrcRef.current

  return (
    <div className="page-panel fade-in mctrl-control-page">
      <div className="page-panel-header">
        <h2 className="page-panel-title">Kontrol</h2>
        <p>MCTRL cihazına kontrol komutları gönderin.</p>
      </div>

      {/* ── Brightness ── */}
      <div className="mctrl-ctrl-section">
        <div className="mctrl-ctrl-section-label">Parlaklık</div>
        <div className="mctrl-ctrl-card">
          <div className="mctrl-ctrl-card-header">
            <span className="mctrl-ctrl-card-icon">☀</span>
            <div>
              <div className="mctrl-ctrl-card-title">Ekran Parlaklığı</div>
              <div className="mctrl-ctrl-card-sub">Tüm alıcı kartlara broadcast edilir</div>
            </div>
            <button className="btn btn-secondary btn-sm mctrl-refresh-inline"
              onClick={readBrightness} disabled={brightnessbusy} title="Parlaklığı Oku">↻</button>
          </div>
          <div className="mctrl-brightness-body">
            <div className="mctrl-brightness-value">
              <span className="mctrl-brightness-number">{sliderValue}</span>
              <span className="mctrl-brightness-unit">%</span>
            </div>
            <input id="mctrl-brightness-slider" type="range" min={0} max={100}
              value={sliderValue} onChange={handleSliderChange}
              disabled={brightnessbusy} className="mctrl-slider" />
            <div className="mctrl-slider-labels"><span>0%</span><span>50%</span><span>100%</span></div>
            {state.currentBrightness !== null && (
              <div className="mctrl-brightness-raw">Ham değer: {state.currentBrightness} / 255</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Input Source ── */}
      <div className="mctrl-ctrl-section">
        <div className="mctrl-ctrl-section-label">Giriş Kaynağı</div>
        <div className="mctrl-ctrl-card">
          <div className="mctrl-ctrl-card-header">
            <span className="mctrl-ctrl-card-icon">📡</span>
            <div>
              <div className="mctrl-ctrl-card-title">
                Aktif Kaynak:&nbsp;
                <span className="mctrl-source-active-label">
                  {state.inputSourceName ?? '—'}
                </span>
              </div>
              <div className="mctrl-ctrl-card-sub mctrl-mode-line">
                <span>Mod: </span>
                <button
                  className={`mctrl-mode-toggle ${state.inputSourceManual ? 'manual' : 'auto'}`}
                  onClick={handleToggleMode}
                  disabled={inputSrcBusy || state.inputSourceManual === null}
                  title="Manuel/Otomatik modu değiştir"
                >
                  {state.inputSourceManual === null ? 'Bilinmiyor'
                    : state.inputSourceManual ? 'Manuel Seçim' : 'Otomatik Seçim'}
                </button>
              </div>
            </div>
            <button className="btn btn-secondary btn-sm mctrl-refresh-inline"
              onClick={readInputSource} disabled={inputSrcBusy} title="Kaynağı Oku">↻</button>
          </div>

          <div className="mctrl-source-grid">
            {INPUT_SOURCES.map(src => {
              const isActive  = state.inputSourceCode === src.code
              const isSetting = settingSource === src.code
              return (
                <button
                  key={src.id}
                  id={`btn-mctrl-source-${src.id}`}
                  className={`mctrl-source-btn ${isActive ? 'mctrl-source-btn-active' : ''}`}
                  onClick={() => handleSetSource(src.code)}
                  disabled={inputSrcBusy}
                >
                  {isSetting ? <span className="mctrl-spin">↻</span> : src.icon}
                  <span>{src.label}</span>
                  {isActive && <span className="mctrl-source-check">✓</span>}
                </button>
              )
            })}
          </div>
        </div>
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
