import React from 'react'
import { useNavigate } from 'react-router-dom'
import { getDeviceImage, getDeviceFallbackIcon } from '@shared/deviceImageMap'
import '@shared/components/ConnectionPageShared.css'
import './VXSelectionPage.css'

interface VXVariantCard {
  id: string
  variant: 'standard' | 'pro'
  /** DeviceSeries key — merkezi image map için */
  seriesKey: 'VX' | 'VXPro'
  title: string
  subtitle: string
  description: string
  badge: string
  tags: string[]
  route: string
}

const VX_VARIANTS: VXVariantCard[] = [
  {
    id: 'vx-standard',
    variant: 'standard',
    seriesKey: 'VX',
    title: 'VX Series',
    subtitle: 'Video Processor',
    description:
      'Standart VX serisi video işleme ve sinyal dönüştürme ünitesi. TCP/IP üzerinden cihaz yönetimi.',
    badge: 'VX',
    tags: ['TCP/IP', 'Video Processor', 'Standard'],
    route: '/vxseries/connect/standard',
  },
  {
    id: 'vx-pro',
    variant: 'pro',
    seriesKey: 'VXPro',
    title: 'VX Pro',
    subtitle: 'Professional Video Processor',
    description:
      'Gelişmiş VX Pro serisi; daha yüksek kanal kapasitesi ve genişletilmiş kontrol özellikleriyle. Manuel TCP bağlantısı.',
    badge: 'VX Pro',
    tags: ['TCP/IP', 'Pro', 'Manuel', '15200'],
    route: '/vxpro/connect',
  },
]

export const VXSelectionPage: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div className="vxsel-page">
      {/* Topbar */}
      <div className="conn-topbar">
        <button
          className="conn-back-btn"
          id="btn-vxsel-back"
          onClick={() => navigate('/')}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Ana Menü
        </button>
        <div className="conn-topbar-divider" />
        <span className="conn-topbar-title">VX Series — Model Seçimi</span>
        <span
          className="conn-series-pill"
          style={{ background: 'rgba(0,224,161,0.12)', color: 'var(--color-vx)' }}
        >
          VX
        </span>
      </div>

      {/* Content */}
      <div className="vxsel-content">
        <div className="vxsel-header">
          <h1 className="vxsel-title">Cihaz Modelini Seçin</h1>
          <p className="vxsel-subtitle">
            Bağlanmak istediğiniz VX Series modelini seçin.
          </p>
        </div>

        <div className="vxsel-grid">
          {VX_VARIANTS.map((card, idx) => (
            <div
              key={card.id}
              id={`vxsel-card-${card.id}`}
              className="vxsel-card"
              style={{ animationDelay: `${idx * 80}ms` }}
              onClick={() =>
                navigate(card.route, { state: { variant: card.variant } })
              }
              role="button"
              tabIndex={0}
              onKeyDown={(e) =>
                e.key === 'Enter' &&
                navigate(card.route, { state: { variant: card.variant } })
              }
            >
              <div className="vxsel-card-glow" />

              {/* Device image — merkezi image map'ten */}
              <div className="vxsel-card-image-wrap">
                {getDeviceImage(card.seriesKey)
                  ? (
                    <img
                      src={getDeviceImage(card.seriesKey)}
                      alt={`${card.title} device`}
                      className="vxsel-card-image"
                      draggable={false}
                    />
                  )
                  : (
                    <div className="vxsel-card-image-fallback">
                      {getDeviceFallbackIcon(card.seriesKey)}
                    </div>
                  )
                }
              </div>

              <div className="vxsel-card-top">
                <span className="vxsel-badge">{card.badge}</span>
              </div>

              <div className="vxsel-card-body">
                <h2 className="vxsel-card-title">{card.title}</h2>
                <p className="vxsel-card-subtitle">{card.subtitle}</p>
                <p className="vxsel-card-desc">{card.description}</p>

                <div className="vxsel-tags">
                  {card.tags.map((tag) => (
                    <span key={tag} className="vxsel-tag">{tag}</span>
                  ))}
                </div>
              </div>

              <div className="vxsel-card-footer">
                <button
                  className="btn btn-primary vxsel-connect-btn"
                  id={`btn-vxsel-${card.id}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(card.route, { state: { variant: card.variant } })
                  }}
                >
                  <span>Seç ve Bağlan</span>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
