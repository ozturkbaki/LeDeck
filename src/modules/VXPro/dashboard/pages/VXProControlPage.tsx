import React, { useState, useCallback, useRef } from 'react'
import { vxProAPI } from '@shared/api/bridge'

interface VXProControlPageProps {
  lastBrightness: number | null
  onBrightnessApplied: (val: number) => void
  onNavigateToPresets: () => void
}

type CmdStatus = { kind: 'idle' } | { kind: 'sending' } | { kind: 'ok'; msg: string } | { kind: 'err'; msg: string }

export const VXProControlPage: React.FC<VXProControlPageProps> = ({
  lastBrightness,
  onBrightnessApplied,
  onNavigateToPresets,
}) => {
  // ── Brightness ──────────────────────────────────────────────────────────────
  const [sliderVal, setSliderVal]      = useState(lastBrightness ?? 50)
  const [inputVal, setInputVal]        = useState(String(lastBrightness ?? 50))
  const [brightnessStatus, setBStatus] = useState<CmdStatus>({ kind: 'idle' })
  const brightnessTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── FTB ─────────────────────────────────────────────────────────────────────
  const [ftbEnabled, setFtbEnabled]    = useState(false)
  const [ftbStatus, setFtbStatus]      = useState<CmdStatus>({ kind: 'idle' })

  // ── Freeze ───────────────────────────────────────────────────────────────────
  const [freezeEnabled, setFreezeEnabled] = useState(false)
  const [freezeStatus, setFreezeStatus]   = useState<CmdStatus>({ kind: 'idle' })

  // ── Brightness handlers ─────────────────────────────────────────────────────
  const syncSlider = (val: number) => { setSliderVal(val); setInputVal(String(val)); setBStatus({ kind: 'idle' }) }
  const syncInput  = (raw: string) => {
    setInputVal(raw)
    const n = parseInt(raw, 10)
    if (!isNaN(n) && n >= 0 && n <= 100) setSliderVal(n)
    setBStatus({ kind: 'idle' })
  }

  const applyBrightness = useCallback(async (percent: number) => {
    setBStatus({ kind: 'sending' })
    try {
      const result = await vxProAPI().setBrightness({ percent })
      if (result.success) {
        setBStatus({ kind: 'ok', msg: result.message })
        onBrightnessApplied(percent)
      } else {
        setBStatus({ kind: 'err', msg: result.message })
      }
    } catch (err) {
      setBStatus({ kind: 'err', msg: String(err) })
    }
  }, [onBrightnessApplied])

  const handleApplyBrightness = useCallback(() => {
    const percent = Math.max(0, Math.min(100, parseInt(inputVal, 10) || 0))
    setSliderVal(percent)
    setInputVal(String(percent))
    applyBrightness(percent)
  }, [inputVal, applyBrightness])

  const handleSliderCommit = useCallback((val: number) => {
    setSliderVal(val); setInputVal(String(val))
    if (brightnessTimer.current) clearTimeout(brightnessTimer.current)
    brightnessTimer.current = setTimeout(() => applyBrightness(val), 400)
  }, [applyBrightness])

  // ── FTB handler — real command ──────────────────────────────────────────────
  const handleToggleFTB = useCallback(async () => {
    if (ftbStatus.kind === 'sending') return
    const newEnable = !ftbEnabled
    setFtbStatus({ kind: 'sending' })
    try {
      const result = await vxProAPI().setFTB({ enable: newEnable })
      if (result.success) {
        setFtbEnabled(newEnable)
        setFtbStatus({ kind: 'ok', msg: result.message })
      } else {
        setFtbStatus({ kind: 'err', msg: result.message })
      }
    } catch (err) {
      setFtbStatus({ kind: 'err', msg: String(err) })
    }
  }, [ftbEnabled, ftbStatus.kind])

  // ── Freeze handler — real command ───────────────────────────────────────────
  const handleToggleFreeze = useCallback(async () => {
    if (freezeStatus.kind === 'sending') return
    const newEnable = !freezeEnabled
    setFreezeStatus({ kind: 'sending' })
    try {
      const result = await vxProAPI().setFreeze({ enable: newEnable })
      if (result.success) {
        setFreezeEnabled(newEnable)
        setFreezeStatus({ kind: 'ok', msg: result.message })
      } else {
        setFreezeStatus({ kind: 'err', msg: result.message })
      }
    } catch (err) {
      setFreezeStatus({ kind: 'err', msg: String(err) })
    }
  }, [freezeEnabled, freezeStatus.kind])

  const isBrightnessLoading = brightnessStatus.kind === 'sending'
  const isFTBLoading        = ftbStatus.kind === 'sending'
  const isFreezeLoading     = freezeStatus.kind === 'sending'

  return (
    <div className="page-panel">
      <div className="page-panel-header">
        <h2 className="page-panel-title">Kontrol Paneli</h2>
      </div>

      {/* ── Parlaklık ─────────────────────────────────────────────────────────── */}
      <section>
        <div style={sectionLabel}>☀ Parlaklık</div>
        <div className="dash-section">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 20 }}>
            <span style={{ fontSize: 56, fontWeight: 800, color: 'var(--accent-primary)', letterSpacing: -2, lineHeight: 1 }}>
              {sliderVal}
            </span>
            <span style={{ fontSize: 22, color: 'var(--accent-primary)', opacity: 0.6, fontWeight: 600 }}>%</span>
          </div>

          <input
            id="vxpro-brightness-slider"
            type="range" min={0} max={100} step={1} value={sliderVal}
            disabled={isBrightnessLoading}
            onChange={e => syncSlider(Number(e.target.value))}
            onMouseUp={e  => handleSliderCommit(Number((e.target as HTMLInputElement).value))}
            onTouchEnd={e => handleSliderCommit(Number((e.target as HTMLInputElement).value))}
            style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer', marginBottom: 8 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
            <span>0%</span><span>50%</span><span>100%</span>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                id="vxpro-brightness-input"
                type="number" min={0} max={100} value={inputVal}
                disabled={isBrightnessLoading}
                onChange={e => syncInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleApplyBrightness()}
                className="form-input"
                style={{ width: '100%', textAlign: 'center', fontWeight: 600, boxSizing: 'border-box' }}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-muted)', pointerEvents: 'none' }}>%</span>
            </div>
            <button
              id="btn-vxpro-brightness-apply"
              className="btn btn-primary"
              style={{ minWidth: 110, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', whiteSpace: 'nowrap' }}
              disabled={isBrightnessLoading}
              onClick={handleApplyBrightness}
            >
              {isBrightnessLoading ? <><span className="spinner" /> Gönderiliyor…</> : 'Ayarla'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {[0, 25, 50, 75, 100].map(p => (
              <button
                key={p}
                className="dash-cmd-btn"
                style={{ flex: 1, minWidth: 48, height: 36, fontSize: 12, fontWeight: 600,
                  ...(sliderVal === p ? { borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)', background: 'rgba(0,200,255,0.08)' } : {}) }}
                disabled={isBrightnessLoading}
                onClick={() => handleSliderCommit(p)}
              >
                {p}%
              </button>
            ))}
          </div>

          {brightnessStatus.kind === 'ok' && (
            <div className="result-box" style={{ marginTop: 12 }}>
              <div className="result-box-label">Başarılı</div>
              <pre className="result-box-content">{brightnessStatus.msg}</pre>
            </div>
          )}
          {brightnessStatus.kind === 'err' && (
            <div className="error-box" style={{ marginTop: 12 }}>
              <span>⚠ {brightnessStatus.msg}</span>
              <button className="btn btn-ghost btn-xs" onClick={() => setBStatus({ kind: 'idle' })}>✕</button>
            </div>
          )}
        </div>
      </section>

      {/* ── FTB + Freeze ─────────────────────────────────────────────────────── */}
      <section>
        <div style={sectionLabel}>Ekran Kontrolleri</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          {/* FTB */}
          <div className="dash-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 22 }}>⬛</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>FTB</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Fade to Black</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: ftbStatus.kind !== 'idle' ? 10 : 0 }}>
              <span style={{ fontSize: 13, color: ftbEnabled ? '#f87171' : 'var(--text-muted)' }}>
                {ftbEnabled ? 'AKTİF — Siyah Ekran' : 'Kapalı'}
              </span>
              <button
                id="btn-vxpro-ftb"
                disabled={isFTBLoading}
                onClick={handleToggleFTB}
                style={toggleStyle(ftbEnabled, 'danger')}
              >
                {isFTBLoading
                  ? <><span className="spinner" /> …</>
                  : ftbEnabled ? 'Normale Dön' : 'Siyaha Al'}
              </button>
            </div>
            {ftbStatus.kind === 'ok' && (
              <div style={{ fontSize: 11, color: 'var(--accent-primary)', marginTop: 4 }}>✓ {ftbStatus.msg}</div>
            )}
            {ftbStatus.kind === 'err' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--accent-danger)', lineHeight: 1.4 }}>⚠ {ftbStatus.msg}</div>
                <button className="btn btn-ghost btn-xs" onClick={() => setFtbStatus({ kind: 'idle' })}>✕</button>
              </div>
            )}
          </div>

          {/* Freeze */}
          <div className="dash-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 22 }}>🧊</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Freeze</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Görüntü Dondur</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: freezeStatus.kind !== 'idle' ? 10 : 0 }}>
              <span style={{ fontSize: 13, color: freezeEnabled ? '#fb923c' : 'var(--text-muted)' }}>
                {freezeEnabled ? 'AKTİF — Dondurulmuş' : 'Kapalı'}
              </span>
              <button
                id="btn-vxpro-freeze"
                disabled={isFreezeLoading}
                onClick={handleToggleFreeze}
                style={toggleStyle(freezeEnabled, 'warning')}
              >
                {isFreezeLoading
                  ? <><span className="spinner" /> …</>
                  : freezeEnabled ? 'Çöz' : 'Dondur'}
              </button>
            </div>
            {freezeStatus.kind === 'ok' && (
              <div style={{ fontSize: 11, color: 'var(--accent-primary)', marginTop: 4 }}>✓ {freezeStatus.msg}</div>
            )}
            {freezeStatus.kind === 'err' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--accent-danger)', lineHeight: 1.4 }}>⚠ {freezeStatus.msg}</div>
                <button className="btn btn-ghost btn-xs" onClick={() => setFreezeStatus({ kind: 'idle' })}>✕</button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Presets navigasyon kartı ──────────────────────────────────────────── */}
      <section>
        <div style={sectionLabel}>Hızlı Erişim</div>
        <button
          id="btn-vxpro-goto-presets"
          className="dash-section"
          onClick={onNavigateToPresets}
          style={{
            cursor: 'pointer', textAlign: 'left', width: '100%',
            display: 'flex', alignItems: 'center', gap: 16,
            border: '1px solid var(--border-subtle)',
            transition: 'border-color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-accent)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)' }}
        >
          <span style={{ fontSize: 32 }}>💾</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>Presetler</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Preset listesini görüntüle ve yükle →</div>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 18, color: 'var(--text-muted)' }}>›</span>
        </button>
      </section>
    </div>
  )
}

// ─── Style helpers ────────────────────────────────────────────────────────────
const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
}

const toggleStyle = (active: boolean, variant: 'danger' | 'warning'): React.CSSProperties => {
  const c = variant === 'danger'
    ? { on: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.4)' }
    : { on: '#fb923c', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.4)' }
  return {
    padding: '5px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500,
    display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s', whiteSpace: 'nowrap',
    border: `1px solid ${active ? c.border : 'rgba(255,255,255,0.12)'}`,
    background: active ? c.bg : 'rgba(255,255,255,0.04)',
    color: active ? c.on : 'var(--text-primary)',
  }
}
