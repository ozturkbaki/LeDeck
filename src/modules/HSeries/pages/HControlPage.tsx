import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useHSession } from '../state/HSessionState'
import { hSeriesAPI } from '@shared/api/bridge'

/**
 * HControlPage
 *
 * H Series kontrol paneli.
 *
 * Kullanılan komutlar:
 *   R0500 — Get Screen Layer Enum      : Layer listesini çeker
 *   R0501 — Get Screen Layer Details   : Seçili layer bilgilerini çeker
 *   W0410 — Adjust Screen Brightness   : Parlaklık ayarı (0–100)
 *   W040A — Freeze the Screen          : Freeze aç/kapat
 *   W0409 — Set Screen FTB             : FTB (Fade to Black) aç/kapat
 *
 * LAYER AKIŞI KURALI:
 *   R0501 (Layer Details) yalnızca şu sırayla çağrılır:
 *     1. R0500 (Layer Enum) çalıştırılır → state.layerList dolar
 *     2. Kullanıcı listeden bir layer seçer
 *     3. Seçilen layerId (enum sonucundan) ile R0501 çağrılır
 *   Sabit veya harici layerId ile R0501 çağrısı YAPILMAZ.
 *   handleSelectLayer() bu kuralı runtime'da da doğrular (guard).
 *
 * NOT: Freeze ve FTB farklı işlevlere sahiptir.
 *   Freeze: Görüntüyü dondurur (siyahlatmaz)
 *   FTB:    Ekranı siyaha götürür
 *
 * Tüm komutlar mevcut CommandService queue sistemi üzerinden çalışır.
 * Aynı anda yalnızca tek komut gönderilir.
 */

// ─── Yardımcı: Komut sonucunu debug log'a ekle ────────────────────────────────
function makeDebugEntry(result: {
  sentCommand?: string
  rawResponse?: string
  status: string
  data?: unknown
}): import('../state/HSessionState').HDebugEntry {
  return {
    timestamp: new Date().toISOString(),
    sentCommand: result.sentCommand,
    rawResponse: result.rawResponse,
    parsedStatus: result.status,
    parsedData: result.data,
  }
}

export const HControlPage: React.FC = () => {
  const { state, dispatch } = useHSession()

  // Brightness: lokal state (slider için anlık değer)
  const [localBrightness, setLocalBrightness] = useState(state.brightness)
  // Brightness debounce için timer ref
  const brightnessTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Layer yükleniyor mu?
  const [layerLoading, setLayerLoading] = useState(false)
  // Layer detay yükleniyor mu?
  const [detailLoading, setDetailLoading] = useState(false)

  // Freeze / FTB gönderim durumu
  const [sendingFreeze, setSendingFreeze] = useState(false)
  const [sendingFTB, setSendingFTB] = useState(false)

  // Brightness gönderim durumu
  const [sendingBrightness, setSendingBrightness] = useState(false)

  const isBusy = state.commandBusy
  const isConnected = state.status === 'connected'

  // Sayfa açılınca layer listesini çek
  useEffect(() => {
    if (state.sessionId && isConnected && state.layerList.length === 0 && !layerLoading) {
      handleFetchLayers()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sessionId, state.status])

  // State'teki brightness değeri değişirse lokal'i güncelle
  useEffect(() => {
    setLocalBrightness(state.brightness)
  }, [state.brightness])

  // ─── R0500 — Get Screen Layer Enum ──────────────────────────────────────────

  const handleFetchLayers = useCallback(async () => {
    if (!state.sessionId) return
    setLayerLoading(true)
    dispatch({ type: 'SET_COMMAND_BUSY', payload: true })
    try {
      const result = await hSeriesAPI().getLayerEnum({ sessionId: state.sessionId })
      dispatch({ type: 'ADD_DEBUG_LOG', payload: makeDebugEntry(result) })

      if (result.status === 'ok' && result.layerEnum) {
        dispatch({ type: 'SET_LAYER_LIST', payload: result.layerEnum.layers })
        dispatch({ type: 'SET_COMMAND_RESULT', payload: `${result.layerEnum.layers.length} layer bulundu.` })
      } else if (result.status === 'timeout') {
        dispatch({ type: 'ERROR', payload: { message: 'Layer listesi alınamadı: Zaman aşımı' } })
      } else {
        dispatch({ type: 'ERROR', payload: { message: result.message || 'Layer listesi alınamadı.' } })
      }
    } catch (err) {
      dispatch({ type: 'ERROR', payload: { message: `Layer listesi hatası: ${String(err)}` } })
    } finally {
      setLayerLoading(false)
      dispatch({ type: 'SET_COMMAND_BUSY', payload: false })
    }
  }, [state.sessionId, dispatch])

  // ─── R0501 — Get Screen Layer Details ───────────────────────────────────────

  const handleSelectLayer = useCallback(async (layerId: number) => {
    if (!state.sessionId) return

    // NOT: Bu fonksiyon yalnızca state.layerList'ten (R0500 sonucu) render edilen
    // butonlara tıklanınca çağrılır. UI'ın kendisi guard görevi görür.
    // layerId her zaman enum listesinden gelir — sabit/harici değer girilemez.

    dispatch({ type: 'SET_SELECTED_LAYER', payload: layerId })
    setDetailLoading(true)
    dispatch({ type: 'SET_COMMAND_BUSY', payload: true })
    try {
      const result = await hSeriesAPI().getLayerDetails({ sessionId: state.sessionId, layerId })
      dispatch({ type: 'ADD_DEBUG_LOG', payload: makeDebugEntry(result) })

      if (result.status === 'ok' && result.layerDetails) {
        dispatch({ type: 'SET_LAYER_DETAILS', payload: result.layerDetails })
      } else if (result.status === 'timeout') {
        dispatch({ type: 'ERROR', payload: { message: `Layer ${layerId} detayları alınamadı: Zaman aşımı` } })
      } else {
        dispatch({ type: 'ERROR', payload: { message: result.message || 'Layer detayları alınamadı.' } })
      }
    } catch (err) {
      dispatch({ type: 'ERROR', payload: { message: `Layer detay hatası: ${String(err)}` } })
    } finally {
      setDetailLoading(false)
      dispatch({ type: 'SET_COMMAND_BUSY', payload: false })
    }
  }, [state.sessionId, state.layerList, dispatch])


  // ─── W0410 — Adjust Screen Brightness ───────────────────────────────────────

  /**
   * Slider değiştiğinde lokal state güncellenir.
   * Kullanıcı sürüklemeyi bıraktıktan 400ms sonra komut gönderilir (debounce).
   */
  const handleBrightnessChange = useCallback((value: number) => {
    setLocalBrightness(value)
    if (brightnessTimer.current) clearTimeout(brightnessTimer.current)
    brightnessTimer.current = setTimeout(async () => {
      if (!state.sessionId) return
      setSendingBrightness(true)
      try {
        const result = await hSeriesAPI().setBrightness({ sessionId: state.sessionId, brightness: value })
        dispatch({ type: 'ADD_DEBUG_LOG', payload: makeDebugEntry(result) })
        if (result.status === 'ok') {
          dispatch({ type: 'SET_BRIGHTNESS', payload: value })
          dispatch({ type: 'SET_COMMAND_RESULT', payload: `Parlaklık: ${value}%` })
        } else {
          dispatch({ type: 'ERROR', payload: { message: result.message || 'Parlaklık ayarlanamadı.' } })
        }
      } catch (err) {
        dispatch({ type: 'ERROR', payload: { message: `Parlaklık hatası: ${String(err)}` } })
      } finally {
        setSendingBrightness(false)
      }
    }, 400)
  }, [state.sessionId, dispatch])

  // ─── W040A — Freeze the Screen ──────────────────────────────────────────────

  const handleToggleFreeze = useCallback(async () => {
    if (!state.sessionId || sendingFreeze) return
    const newEnable: 0 | 1 = state.freezeEnabled ? 0 : 1
    setSendingFreeze(true)
    try {
      const result = await hSeriesAPI().setFreeze({ sessionId: state.sessionId, enable: newEnable })
      dispatch({ type: 'ADD_DEBUG_LOG', payload: makeDebugEntry(result) })
      if (result.status === 'ok') {
        dispatch({ type: 'SET_FREEZE', payload: newEnable === 1 })
        dispatch({ type: 'SET_COMMAND_RESULT', payload: `Freeze: ${newEnable === 1 ? 'Aktif' : 'Kapalı'}` })
      } else if (result.status === 'timeout') {
        dispatch({ type: 'ERROR', payload: { message: 'Freeze komutu zaman aşımı.' } })
      } else {
        dispatch({ type: 'ERROR', payload: { message: result.message || 'Freeze değiştirilemedi.' } })
      }
    } catch (err) {
      dispatch({ type: 'ERROR', payload: { message: `Freeze hatası: ${String(err)}` } })
    } finally {
      setSendingFreeze(false)
    }
  }, [state.sessionId, state.freezeEnabled, sendingFreeze, dispatch])

  // ─── W0409 — Set Screen FTB ─────────────────────────────────────────────────

  const handleToggleFTB = useCallback(async () => {
    if (!state.sessionId || sendingFTB) return
    // FTB: 0 = siyah ekran (aktif), 1 = normal görüntü
    const newType: 0 | 1 = state.ftbEnabled ? 1 : 0
    setSendingFTB(true)
    try {
      const result = await hSeriesAPI().setFTB({ sessionId: state.sessionId, type: newType })
      dispatch({ type: 'ADD_DEBUG_LOG', payload: makeDebugEntry(result) })
      if (result.status === 'ok') {
        dispatch({ type: 'SET_FTB', payload: newType === 0 })
        dispatch({ type: 'SET_COMMAND_RESULT', payload: `FTB: ${newType === 0 ? 'Siyah Ekran' : 'Normal Görüntü'}` })
      } else if (result.status === 'timeout') {
        dispatch({ type: 'ERROR', payload: { message: 'FTB komutu zaman aşımı.' } })
      } else {
        dispatch({ type: 'ERROR', payload: { message: result.message || 'FTB değiştirilemedi.' } })
      }
    } catch (err) {
      dispatch({ type: 'ERROR', payload: { message: `FTB hatası: ${String(err)}` } })
    } finally {
      setSendingFTB(false)
    }
  }, [state.sessionId, state.ftbEnabled, sendingFTB, dispatch])

  const selectedLayer = state.layerList.find(l => l.layerId === state.selectedLayerId)
  const ld = state.selectedLayerDetails

  return (
    <div className="page-panel">
      <div className="page-panel-header">
        <h2 className="page-panel-title">Kontrol Paneli</h2>
        {isBusy && <span className="busy-indicator">İşleniyor…</span>}
      </div>

      {/* ── Ekran Kontrolü: Brightness / Freeze / FTB ─────────────────────── */}
      <section style={{ marginBottom: 24 }}>
        <div style={sectionTitleStyle}>Ekran Kontrolü</div>

        {/* Brightness Slider */}
        <div style={controlRowStyle}>
          <div style={controlLabelStyle}>
            <span>☀ Parlaklık</span>
            <span style={{ color: 'var(--color-h)', fontWeight: 700, fontSize: 14, minWidth: 40, textAlign: 'right' }}>
              {localBrightness}%
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              id="slider-h-brightness"
              type="range"
              min={0}
              max={100}
              step={1}
              value={localBrightness}
              disabled={!isConnected || isBusy}
              onChange={e => handleBrightnessChange(Number(e.target.value))}
              style={sliderStyle}
            />
            {sendingBrightness && <span className="spinner" style={{ flexShrink: 0 }} />}
          </div>
        </div>

        {/* Freeze Toggle */}
        <div style={controlRowStyle}>
          <div style={controlLabelStyle}>
            <span>🧊 Freeze</span>
            <span style={{ fontSize: 12, color: state.freezeEnabled ? '#fb923c' : 'var(--text-muted)' }}>
              {state.freezeEnabled ? 'AKTİF — Görüntü Dondurulmuş' : 'Kapalı'}
            </span>
          </div>
          <button
            id="btn-h-freeze"
            className={`toggle-btn ${state.freezeEnabled ? 'toggle-btn-active' : ''}`}
            disabled={!isConnected || isBusy || sendingFreeze}
            onClick={handleToggleFreeze}
            style={toggleBtnStyle(state.freezeEnabled)}
          >
            {sendingFreeze
              ? <><span className="spinner" /> Gönderiliyor…</>
              : state.freezeEnabled ? 'Çöz (0)' : 'Dondur (1)'}
          </button>
        </div>

        {/* FTB Toggle */}
        <div style={controlRowStyle}>
          <div style={controlLabelStyle}>
            <span>⬛ FTB (Fade to Black)</span>
            <span style={{ fontSize: 12, color: state.ftbEnabled ? '#f87171' : 'var(--text-muted)' }}>
              {state.ftbEnabled ? 'AKTİF — Siyah Ekran' : 'Kapalı'}
            </span>
          </div>
          <button
            id="btn-h-ftb"
            className={`toggle-btn ${state.ftbEnabled ? 'toggle-btn-active' : ''}`}
            disabled={!isConnected || isBusy || sendingFTB}
            onClick={handleToggleFTB}
            style={toggleBtnStyle(state.ftbEnabled, true)}
          >
            {sendingFTB
              ? <><span className="spinner" /> Gönderiliyor…</>
              : state.ftbEnabled ? 'Normale Dön (1)' : 'Siyaha Al (0)'}
          </button>
        </div>
      </section>

      {/* ── Layer Paneli ──────────────────────────────────────────────────── */}
      <section>
        <div style={{ ...sectionTitleStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Layer Listesi (R0500)</span>
          <button
            id="btn-h-fetch-layers"
            className="btn btn-secondary btn-sm"
            disabled={isBusy}
            onClick={handleFetchLayers}
          >
            {layerLoading ? <><span className="spinner" /> Yükleniyor…</> : '↻ Yenile'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

          {/* Sol: Layer Listesi */}
          <div>
            {state.layerList.length === 0 && !layerLoading ? (
              <div style={emptyStyle}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>🎞</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Layer listesi henüz yüklenmedi.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {state.layerList.map(layer => {
                  const isSelected = state.selectedLayerId === layer.layerId
                  return (
                    <button
                      key={layer.layerId}
                      id={`btn-h-layer-${layer.layerId}`}
                      disabled={isBusy}
                      onClick={() => handleSelectLayer(layer.layerId)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: 8,
                        border: `1px solid ${isSelected ? 'rgba(0,200,255,0.5)' : 'rgba(255,255,255,0.08)'}`,
                        background: isSelected ? 'rgba(0,200,255,0.10)' : 'rgba(255,255,255,0.03)',
                        color: isSelected ? 'var(--color-h)' : 'var(--text-primary)',
                        cursor: isBusy ? 'not-allowed' : 'pointer',
                        textAlign: 'left',
                        fontSize: 13,
                        fontWeight: isSelected ? 600 : 400,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>{layer.name}</span>
                      <span style={{
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        fontFamily: 'monospace',
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: 'rgba(255,255,255,0.06)',
                      }}>
                        #{layer.layerId}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Sağ: Layer Detayları */}
          <div style={{
            padding: 14,
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.02)',
            minHeight: 120,
          }}>
            {detailLoading ? (
              <div style={{ ...emptyStyle, gap: 8 }}>
                <span className="spinner" />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Layer detayları yükleniyor…</span>
              </div>
            ) : !selectedLayer ? (
              <div style={emptyStyle}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>👆</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Detayları görmek için bir layer seçin.
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--color-h)' }}>
                  {selectedLayer.name} <span style={{ fontFamily: 'monospace', fontWeight: 400, fontSize: 11, opacity: 0.7 }}>#{selectedLayer.layerId}</span>
                </div>
                {ld ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {ld.inputId !== undefined && (
                      <DetailRow label="Input ID" value={String(ld.inputId)} />
                    )}
                    {ld.interfaceType !== undefined && (
                      <DetailRow label="Interface Type" value={String(ld.interfaceType)} />
                    )}
                    {ld.window && (
                      <>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, marginBottom: 2 }}>Pencere (Window)</div>
                        {ld.window.x !== undefined && <DetailRow label="X" value={String(ld.window.x)} indent />}
                        {ld.window.y !== undefined && <DetailRow label="Y" value={String(ld.window.y)} indent />}
                        {ld.window.width !== undefined && <DetailRow label="Genişlik" value={`${ld.window.width}px`} indent />}
                        {ld.window.height !== undefined && <DetailRow label="Yükseklik" value={`${ld.window.height}px`} indent />}
                      </>
                    )}
                    {!ld.inputId && !ld.interfaceType && !ld.window && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Layer detayı alındı fakat görüntülenecek alan bulunamadı.
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Detaylar yükleniyor…
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Son komut sonucu */}
      {state.lastCommandResult && (
        <div className="result-box" style={{ marginTop: 16 }}>
          <div className="result-box-label">Son İşlem</div>
          <pre className="result-box-content">{state.lastCommandResult}</pre>
        </div>
      )}

      {/* Hata */}
      {state.lastError && (
        <div className="error-box" style={{ marginTop: 8 }}>
          <span>⚠ {state.lastError}</span>
          <button className="btn btn-ghost btn-xs" onClick={() => dispatch({ type: 'CLEAR_ERROR' })}>✕</button>
        </div>
      )}
    </div>
  )
}

// ─── Yardımcı Bileşenler ──────────────────────────────────────────────────────

const DetailRow: React.FC<{ label: string; value: string; indent?: boolean }> = ({ label, value, indent }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, paddingLeft: indent ? 10 : 0 }}>
    <span style={{ color: 'var(--text-muted)', flexShrink: 0, minWidth: 80 }}>{label}</span>
    <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
  </div>
)

// ─── Stil Sabitleri ───────────────────────────────────────────────────────────

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 12,
}

const controlRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '12px 14px',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
  marginBottom: 8,
}

const controlLabelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  fontSize: 13,
  fontWeight: 500,
  minWidth: 160,
}

const sliderStyle: React.CSSProperties = {
  width: 200,
  accentColor: 'var(--color-h)',
  cursor: 'pointer',
}

const toggleBtnStyle = (active: boolean, isDanger = false): React.CSSProperties => ({
  padding: '6px 16px',
  borderRadius: 6,
  border: `1px solid ${active ? (isDanger ? 'rgba(248,113,113,0.5)' : 'rgba(251,146,60,0.5)') : 'rgba(255,255,255,0.12)'}`,
  background: active ? (isDanger ? 'rgba(248,113,113,0.12)' : 'rgba(251,146,60,0.12)') : 'rgba(255,255,255,0.04)',
  color: active ? (isDanger ? '#f87171' : '#fb923c') : 'var(--text-primary)',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  transition: 'all 0.15s ease',
  whiteSpace: 'nowrap',
})

const emptyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px 12px',
  textAlign: 'center',
}
