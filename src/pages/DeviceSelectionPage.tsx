import React from 'react'
import { useNavigate } from 'react-router-dom'
import { getDeviceImage } from '@shared/deviceImageMap'
import './DeviceSelectionPage.css'

interface DeviceCard {
  id: string
  series: 'H' | 'TU' | 'VX' | 'MCTRL' | 'Taurus'
  title: string
  subtitle: string
  description: string
  /** Fallback emoji — gösterilir yalnızca görsel yüklenemezse */
  icon: string
  accentColor: string
  route: string
  tags: string[]
}

const DEVICE_CARDS: DeviceCard[] = [
  {
    id: 'h-series',
    series: 'H',
    title: 'H Series',
    subtitle: 'Video Wall Splicer',
    description: 'Büyük ölçekli video duvarı kontrolü ve yönetimi için profesyonel splicer çözümü.',
    icon: '🖥',
    accentColor: 'var(--color-h)',
    route: '/hseries/connect',
    tags: ['TCP/IP', 'Video Wall', 'Splicer']
  },
  {
    id: 'tu-series',
    series: 'TU',
    title: 'TU Series',
    subtitle: 'Playback & Kumanda',
    description: 'Gelişmiş playback yönetimi ve uzaktan kumanda işlemleri için entegre kontrol birimi.',
    icon: '📺',
    accentColor: 'var(--color-tu)',
    route: '/tuseries/connect',
    tags: ['TCP/IP', 'Playback', 'Remote']
  },
  {
    id: 'vx-series',
    series: 'VX',
    title: 'VX Series',
    subtitle: 'Video Processor',
    description: 'Yüksek çözünürlüklü video işleme ve sinyal dönüştürme ünitesi kontrolü.',
    icon: '⚡',
    accentColor: 'var(--color-vx)',
    route: '/vxseries/select',
    tags: ['TCP/IP', 'Processor', 'Discovery']
  },
  {
    id: 'mctrl-series',
    series: 'MCTRL',
    title: 'MCTRL Series',
    subtitle: 'Sending Controller',
    description: 'COM port üzerinden RS232 protokolu ile LED gönderici kart kontrolü.',
    icon: '🔌',
    accentColor: 'var(--color-mctrl)',
    route: '/mctrl/connect',
    tags: ['COM Port', 'RS232', 'Serial']
  },
  {
    id: 'taurus',
    series: 'Taurus',
    title: 'TB / TCC Serisi',
    subtitle: 'Taurus Media Player',
    description: 'TCP/IP ağı üzerinden Taurus serisi cihazlar ile bağlantı ve içerik kontrolü.',
    icon: '🌐',
    accentColor: 'var(--color-taurus, #63c3ff)',
    route: '/taurus/connect',
    tags: ['TCP/IP', 'HTTPS', 'Discovery']
  }
]

export const DeviceSelectionPage: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div className="device-selection-page">
      {/* Background grid decoration */}
      <div className="dsp-bg-grid" aria-hidden="true" />
      <div className="dsp-bg-glow" aria-hidden="true" />

      <div className="dsp-content">
        {/* Header */}
        <header className="dsp-header">
          <div className="dsp-logo">
            <span className="dsp-logo-text">LeDeck</span>
            <span className="dsp-logo-badge">Pro</span>
          </div>
          <h1 className="dsp-title">Cihaz Seçimi</h1>
          <p className="dsp-subtitle">
            Kontrol etmek istediğiniz NovaStar cihaz serisini seçin.
            Her seri kendi izole modülünde çalışır.
          </p>
        </header>

        {/* Cards Grid */}
        <div className="dsp-grid">
          {DEVICE_CARDS.map((card, idx) => (
            <div
              key={card.id}
              id={`device-card-${card.id}`}
              className="dsp-card"
              style={{
                '--card-accent': card.accentColor,
                animationDelay: `${idx * 80}ms`
              } as React.CSSProperties}
              onClick={() => navigate(card.route)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate(card.route)}
            >
              <div className="dsp-card-glow" />

              {/* Device image area */}
              <div className="dsp-card-image-wrap">
                {getDeviceImage(card.series)
                  ? (
                    <img
                      src={getDeviceImage(card.series)}
                      alt={`${card.title} device`}
                      className="dsp-card-image"
                      draggable={false}
                    />
                  )
                  : (
                    <div className="dsp-card-image-fallback">{card.icon}</div>
                  )
                }
              </div>

              <div className="dsp-card-header">
                <div className="dsp-card-series-badge" style={{ color: card.accentColor }}>
                  {card.series}
                </div>
              </div>

              <div className="dsp-card-body">
                <h3 className="dsp-card-title">{card.title}</h3>
                <p className="dsp-card-subtitle">{card.subtitle}</p>
                <p className="dsp-card-desc">{card.description}</p>

                <div className="dsp-card-tags">
                  {card.tags.map((tag) => (
                    <span key={tag} className="dsp-tag">{tag}</span>
                  ))}
                </div>
              </div>

              <div className="dsp-card-footer">
                <button
                  className="btn dsp-manage-btn"
                  id={`btn-manage-${card.id}`}
                  onClick={(e) => { e.stopPropagation(); navigate(card.route) }}
                >
                  <span>Yönet</span>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <footer className="dsp-footer">
          <span>LeDeck v1.0.0</span>
          <span>·</span>
          <span>NovaStar Device Control Platform</span>
        </footer>
      </div>
    </div>
  )
}
