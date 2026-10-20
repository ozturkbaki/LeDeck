import React, { useState, useEffect, useCallback } from 'react'
import { useHSession, HPreset } from '../state/HSessionState'
import { hSeriesAPI } from '@shared/api/bridge'

/**
 * HPresetsPage
 *
 * H Series preset yönetimi sayfası.
 *
 * Kullanılan komutlar:
 *   R0600 — Get Preset List (Enum): Cihazdan gerçek preset listesi çekilir
 *   W0605 — Load Preset: Seçilen preset yüklenir
 *
 * Debug Panel: Son gönderilen komut / ham yanıt / parse sonucu gösterilir.
 */
export const HPresetsPage: React.FC = () => {
  const { state, dispatch } = useHSession()
  const [loading, setLoading] = useState(false)
  const [loadingPresetId, setLoadingPresetId] = useState<number | null>(null)
  const [debugOpen, setDebugOpen] = useState(false)

  // Sayfa açılınca preset listesini çek
  useEffect(() => {
    if (state.sessionId && state.status === 'connected' && state.presetList.length === 0 && !loading) {
      handleFetchPresets()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sessionId, state.status])

  /**
   * R0600 — Get Preset List
   * Cihazdan gerçek preset enum listesini çeker.
   */
  const handleFetchPresets = useCallback(async () => {
    if (!state.sessionId) return
    setLoading(true)
    dispatch({ type: 'SET_COMMAND_BUSY', payload: true })

    try {
      const result = await hSeriesAPI().getPresetList({ sessionId: state.sessionId })

      // Debug log
      dispatch({
        type: 'ADD_DEBUG_LOG',
        payload: {
          timestamp: new Date().toISOString(),
          sentCommand: result.sentCommand,
          rawResponse: result.rawResponse,
          parsedStatus: result.status,
          parsedData: result.data,
        },
      })

      if (result.status === 'ok' && result.presetList) {
        dispatch({ type: 'SET_PRESET_LIST', payload: result.presetList.presets })
        dispatch({ type: 'SET_COMMAND_RESULT', payload: `${result.presetList.presets.length} preset bulundu.` })
      } else if (result.status === 'timeout') {
        dispatch({ type: 'ERROR', payload: { message: 'Preset listesi alınamadı: Zaman aşımı (1s)' } })
      } else {
        dispatch({ type: 'ERROR', payload: { message: result.message || 'Preset listesi alınamadı.' } })
      }
    } catch (err) {
      dispatch({ type: 'ERROR', payload: { message: `Preset listesi hatası: ${String(err)}` } })
    } finally {
      setLoading(false)
      dispatch({ type: 'SET_COMMAND_BUSY', payload: false })
    }
  }, [state.sessionId, dispatch])

  /**
   * W0605 — Load Preset
   * Seçilen preset'i cihaza yükler.
   */
  const handleLoadPreset = useCallback(async (preset: HPreset) => {
    if (!state.sessionId) return
    setLoadingPresetId(preset.presetId)
    dispatch({ type: 'SET_COMMAND_BUSY', payload: true })

    try {
      const result = await hSeriesAPI().loadPreset({ sessionId: state.sessionId, presetId: preset.presetId })

      // Debug log
      dispatch({
        type: 'ADD_DEBUG_LOG',
        payload: {
          timestamp: new Date().toISOString(),
          sentCommand: result.sentCommand,
          rawResponse: result.rawResponse,
          parsedStatus: result.status,
          parsedData: result.data,
        },
      })

      if (result.status === 'ok') {
        dispatch({ type: 'SET_ACTIVE_PRESET', payload: preset.presetId })
        dispatch({ type: 'SET_COMMAND_RESULT', payload: `Preset yüklendi: "${preset.name}"` })
      } else if (result.status === 'timeout') {
        dispatch({ type: 'ERROR', payload: { message: `Preset yükleme zaman aşımı: "${preset.name}"` } })
        dispatch({ type: 'SET_ACTIVE_PRESET', payload: null })
      } else {
        dispatch({ type: 'ERROR', payload: { message: result.message || `Preset yüklenemedi: "${preset.name}"` } })
        dispatch({ type: 'SET_ACTIVE_PRESET', payload: null })
      }
    } catch (err) {
      dispatch({ type: 'ERROR', payload: { message: `Preset yükleme hatası: ${String(err)}` } })
    } finally {
      setLoadingPresetId(null)
      dispatch({ type: 'SET_COMMAND_BUSY', payload: false })
    }
  }, [state.sessionId, dispatch])

  const isBusy = state.commandBusy || loading
  const lastDebug = state.debugLog[0]

  return (
    <div className="page-panel">
      <div className="page-panel-header">
        <h2 className="page-panel-title">Presetler</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setDebugOpen(v => !v)}
            title="Debug Paneli"
          >
            {debugOpen ? '🔍 Debug ▲' : '🔍 Debug ▼'}
          </button>
          <button
            id="btn-h-fetch-presets"
            className="btn btn-secondary btn-sm"
            onClick={handleFetchPresets}
            disabled={isBusy}
          >
            {loading ? <><span className="spinner" /> Yükleniyor...</> : '↻ Listeyi Yenile'}
          </button>
        </div>
      </div>

      {/* Preset listesi */}
      {state.presetList.length === 0 && !loading && !state.commandBusy ? (
        <div className="conn-recent-empty" style={{ marginTop: 24 }}>
          <div className="conn-recent-empty-icon">💾</div>
          <p>Henüz preset listesi yüklenmedi.</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            "Listeyi Yenile" butonunu kullanarak cihazdan preset listesini çekin. (R0600)
          </p>
        </div>
      ) : (
        <div className="preset-list">
          {state.presetList.map(preset => {
            const isActive = state.activePresetId === preset.presetId
            const isLoading = loadingPresetId === preset.presetId
            return (
              <button
                key={preset.presetId}
                id={`btn-h-preset-${preset.presetId}`}
                className={`preset-item ${isActive ? 'active' : ''}`}
                disabled={isBusy || state.status !== 'connected'}
                onClick={() => handleLoadPreset(preset)}
              >
                <span className="preset-icon">💾</span>
                <span className="preset-name">{preset.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
                  #{preset.presetId}
                </span>
                {isLoading && <span className="spinner" style={{ marginLeft: 8 }} />}
                {isActive && !isLoading && (
                  <span className="preset-active-badge">Aktif</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Son komut sonucu */}
      {state.lastCommandResult && (
        <div className="result-box">
          <div className="result-box-label">Son İşlem</div>
          <pre className="result-box-content">{state.lastCommandResult}</pre>
        </div>
      )}

      {/* Hata */}
      {state.lastError && (
        <div className="error-box">
          <span>⚠ {state.lastError}</span>
          <button className="btn btn-ghost btn-xs" onClick={() => dispatch({ type: 'CLEAR_ERROR' })}>✕</button>
        </div>
      )}

      {/* Debug Panel */}
      {debugOpen && (
        <div style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 8,
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.08)',
          fontSize: 11,
          fontFamily: 'monospace',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--color-h)', letterSpacing: '0.05em' }}>
              🔍 DEBUG PANEL
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
              Son {state.debugLog.length} giriş
            </span>
          </div>

          {lastDebug ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ color: 'var(--text-muted)', marginBottom: 3 }}>📤 Gönderilen Komut</div>
                <pre style={{
                  margin: 0, padding: 8, borderRadius: 4,
                  background: 'rgba(0,200,255,0.08)',
                  color: '#7dd3fc',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  maxHeight: 80, overflowY: 'auto',
                }}>
                  {lastDebug.sentCommand ?? '—'}
                </pre>
              </div>

              <div>
                <div style={{ color: 'var(--text-muted)', marginBottom: 3 }}>📥 Ham Yanıt</div>
                <pre style={{
                  margin: 0, padding: 8, borderRadius: 4,
                  background: 'rgba(255,255,255,0.04)',
                  color: '#a3e635',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  maxHeight: 120, overflowY: 'auto',
                }}>
                  {lastDebug.rawResponse ?? '(yanıt yok)'}
                </pre>
              </div>

              <div>
                <div style={{ color: 'var(--text-muted)', marginBottom: 3 }}>
                  ✅ Parse Sonucu —{' '}
                  <span style={{
                    color: lastDebug.parsedStatus === 'ok' ? '#4ade80'
                      : lastDebug.parsedStatus === 'timeout' ? '#fb923c'
                      : '#f87171',
                  }}>
                    {lastDebug.parsedStatus}
                  </span>
                </div>
                <pre style={{
                  margin: 0, padding: 8, borderRadius: 4,
                  background: 'rgba(255,255,255,0.04)',
                  color: '#e2e8f0',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  maxHeight: 100, overflowY: 'auto',
                }}>
                  {lastDebug.parsedData !== undefined
                    ? JSON.stringify(lastDebug.parsedData, null, 2)
                    : '—'}
                </pre>
              </div>

              <div style={{ color: 'var(--text-muted)', fontSize: 10, paddingTop: 4 }}>
                {new Date(lastDebug.timestamp).toLocaleTimeString('tr-TR')}
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>
              Henüz komut gönderilmedi.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
