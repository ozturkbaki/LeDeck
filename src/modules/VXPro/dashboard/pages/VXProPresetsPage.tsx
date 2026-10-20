import React, { useState, useCallback } from 'react'
import { vxProAPI } from '@shared/api/bridge'

/** 10 preset için sabit liste (Preset 1–10) */
const PRESETS = Array.from({ length: 10 }, (_, i) => ({
  index: i,           // cihaza gönderilecek değer: 0x00–0x09
  label: `Preset ${i + 1}`,
  number: i + 1,      // kullanıcıya gösterilen numara
}))

type LoadStatus =
  | { kind: 'idle' }
  | { kind: 'loading'; index: number }
  | { kind: 'ok'; index: number; msg: string }
  | { kind: 'err'; index: number; msg: string }

export const VXProPresetsPage: React.FC = () => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [loadStatus, setLoadStatus]       = useState<LoadStatus>({ kind: 'idle' })
  const [lastLoaded, setLastLoaded]       = useState<number | null>(null)   // son başarılı preset index'i

  const isLoading = loadStatus.kind === 'loading'

  const handleSelect = useCallback((index: number) => {
    if (isLoading) return
    setSelectedIndex(index)
    // Yeni seçimde status'u temizle
    setLoadStatus({ kind: 'idle' })
  }, [isLoading])

  const handleLoad = useCallback(async () => {
    if (selectedIndex === null || isLoading) return
    setLoadStatus({ kind: 'loading', index: selectedIndex })
    try {
      const result = await vxProAPI().loadPreset({ presetIndex: selectedIndex })
      if (result.success) {
        setLastLoaded(selectedIndex)
        setLoadStatus({ kind: 'ok', index: selectedIndex, msg: result.message })
      } else {
        setLoadStatus({ kind: 'err', index: selectedIndex, msg: result.message })
      }
    } catch (err) {
      setLoadStatus({ kind: 'err', index: selectedIndex, msg: String(err) })
    }
  }, [selectedIndex, isLoading])

  return (
    <div className="page-panel">
      {/* Header */}
      <div className="page-panel-header">
        <h2 className="page-panel-title">Presetler</h2>
        {isLoading && <span className="busy-indicator">Yükleniyor…</span>}
      </div>

      {/* Preset listesi */}
      <div>
        <div style={sectionLabel}>Preset Listesi (1–10) · Seçin, ardından Yükle</div>
        <div className="preset-list">
          {PRESETS.map(preset => {
            const isSelected  = selectedIndex === preset.index
            const isLastLoaded = lastLoaded === preset.index
            return (
              <button
                key={preset.index}
                id={`btn-vxpro-preset-${preset.number}`}
                className={`preset-item ${isSelected ? 'active' : ''}`}
                disabled={isLoading}
                onClick={() => handleSelect(preset.index)}
              >
                <span className="preset-icon">💾</span>
                <span className="preset-name">{preset.label}</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
                  {isLastLoaded && (
                    <span className="preset-active-badge">Son Yüklenen</span>
                  )}
                  {isSelected && !isLastLoaded && (
                    <span className="preset-active-badge" style={{ background: 'rgba(0,200,255,0.08)', color: 'var(--accent-primary)' }}>
                      Seçili
                    </span>
                  )}
                  <span style={{
                    fontSize: 11, color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    padding: '2px 6px', borderRadius: 4,
                    background: 'rgba(255,255,255,0.05)',
                  }}>
                    0x{preset.index.toString(16).toUpperCase().padStart(2, '0')}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Load button + status */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button
          id="btn-vxpro-load-preset"
          className="btn btn-primary"
          disabled={selectedIndex === null || isLoading}
          onClick={handleLoad}
          style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, minWidth: 160 }}
        >
          {isLoading
            ? <><span className="spinner" /> Yükleniyor…</>
            : selectedIndex !== null
              ? `Yükle → Preset ${selectedIndex + 1}`
              : 'Preset Seçin'}
        </button>

        {/* Success */}
        {loadStatus.kind === 'ok' && (
          <div className="result-box">
            <div className="result-box-label">Başarılı</div>
            <pre className="result-box-content">{loadStatus.msg}</pre>
          </div>
        )}

        {/* Error */}
        {loadStatus.kind === 'err' && (
          <div className="error-box">
            <span>⚠ {loadStatus.msg}</span>
            <button className="btn btn-ghost btn-xs" onClick={() => setLoadStatus({ kind: 'idle' })}>✕</button>
          </div>
        )}
      </div>

      {/* Protocol info */}
      <div style={{
        fontSize: 11, color: 'var(--text-muted)',
        padding: '10px 14px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 8,
        lineHeight: 1.7,
      }}>
        <strong style={{ color: 'var(--text-secondary)' }}>Protokol:</strong> Preset yükleme · TCP:15200 · Load Preset 0x00–0x09<br />
        Preset numarası cihaza <code style={{ background: 'rgba(255,255,255,0.05)', padding: '0 4px', borderRadius: 3 }}>0x00–0x09</code> olarak gönderilir, kullanıcıya 1–10 olarak gösterilir.
      </div>
    </div>
  )
}

const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
}
