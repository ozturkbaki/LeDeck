import React from 'react'
import { useVXProSession } from '../../state/VXProSessionState'
import { DeviceImageBanner } from '@shared/components/DeviceImageBanner'

interface VXProDevicePageProps {
  /** En son kontrol sayfasında başarıyla uygulanan parlaklık değeri (0–100). */
  lastBrightness: number | null
}

export const VXProDevicePage: React.FC<VXProDevicePageProps> = ({ lastBrightness }) => {
  const { state } = useVXProSession()

  return (
    <div className="page-panel">
      {/* ── Cihaz görseli banner ─────────────────────────────────────────── */}
      <DeviceImageBanner
        series="VXPro"
        deviceName={state.deviceName}
        ipAddress={state.ipAddress}
        protocol="TCP:15200"
        statusLabel="Bağlı &amp; Doğrulandı"
        accentColor="#00e0a1"
      />

      {/* Page header */}
      <div className="page-panel-header">
        <h2 className="page-panel-title">Cihaz Bilgileri</h2>
      </div>

      {/* ── Bağlantı kartları ─────────────────────────────────────────────── */}
      <div className="info-grid">
        <InfoCard
          label="Cihaz Adı"
          value={state.deviceName || '—'}
          icon="🏷"
        />
        <InfoCard
          label="IP Adresi"
          value={state.ipAddress ?? '—'}
          icon="🌐"
          mono
        />
        <InfoCard
          label="TCP Port"
          value="15200"
          icon="🔌"
          mono
        />
        <InfoCard
          label="Bağlantı Durumu"
          value="Bağlı &amp; Doğrulandı"
          valueClass="status-connected"
          icon="✓"
        />
      </div>

      {/* ── Ekran durumu kartları ─────────────────────────────────────────── */}
      <div>
        <div style={sectionLabelStyle}>Ekran Durumu</div>
        <div className="info-grid">
          <InfoCard
            label="Güncel Parlaklık"
            value={lastBrightness !== null ? `%${lastBrightness}` : 'Henüz ayarlanmadı'}
            icon="☀"
            sub={lastBrightness !== null
              ? 'Kontrol sayfasından ayarlandı'
              : 'Kontrol → Parlaklık kartını kullanın'}
          />
          <InfoCard
            label="Fan Durumu"
            value="N/A"
            icon="💨"
            sub="Sonraki fazda eklenecek"
            dimmed
          />
          <InfoCard
            label="FTB Durumu"
            value="N/A"
            icon="⬛"
            sub="Sonraki fazda eklenecek"
            dimmed
          />
          <InfoCard
            label="Freeze Durumu"
            value="N/A"
            icon="🧊"
            sub="Sonraki fazda eklenecek"
            dimmed
          />
        </div>
      </div>

      {/* ── Protokol bilgisi ──────────────────────────────────────────────── */}
      <div className="todo-banner" style={{ marginTop: 0, borderStyle: 'solid', borderColor: 'rgba(0,224,161,0.15)', background: 'rgba(0,224,161,0.05)', color: 'var(--text-muted)' }}>
        <strong style={{ color: '#00e0a1' }}>VX Pro Faz 2</strong> · Güncel parlaklık bilgisi cihazdan çekme komutu sonraki fazda eklenecektir.
        Şu an "parlaklık" kolonu kontrol sayfasında en son uygulanan değeri göstermektedir.
      </div>
    </div>
  )
}

// ─── Info card sub-component ──────────────────────────────────────────────────
interface InfoCardProps {
  label: string
  value: string
  icon: string
  sub?: string
  mono?: boolean
  dimmed?: boolean
  valueClass?: string
}

const InfoCard: React.FC<InfoCardProps> = ({ label, value, icon, sub, mono, dimmed, valueClass }) => (
  <div className="info-card" style={{ opacity: dimmed ? 0.55 : 1 }}>
    <div className="info-card-label">{icon} {label}</div>
    <div
      className={`info-card-value ${valueClass ?? ''}`}
      style={mono ? { fontFamily: 'var(--font-mono)' } : undefined}
      dangerouslySetInnerHTML={{ __html: value }}
    />
    {sub && (
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>
        {sub}
      </div>
    )}
  </div>
)

// ─── Style ───────────────────────────────────────────────────────────────────
const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 10,
}
