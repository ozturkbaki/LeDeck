import React from 'react'
import type { DeviceSeries } from '../types/DeviceSeries'
import { getDeviceImage, getDeviceFallbackIcon } from '../deviceImageMap'
import './DeviceImageBanner.css'

interface DeviceImageBannerProps {
  /** Cihaz serisi — merkezi image map'ten görsel alınır */
  series: DeviceSeries | string
  /** Cihaz adı (kullanıcı tarafından girilen) */
  deviceName?: string
  /** IP adresi */
  ipAddress?: string
  /** Bağlantı protokol bilgisi (ör. "TCP:15200", "UDP:6000") */
  protocol?: string
  /** Bağlantı durumu rozeti */
  statusLabel?: string
  /** Seri için vurgu rengi (CSS değişken veya hex) */
  accentColor?: string
  /** Ek CSS sınıfı */
  className?: string
  /** Sağ üst köşe aksiyon/buton alanı */
  rightElement?: React.ReactNode
}

/**
 * DeviceImageBanner
 *
 * Cihaz sayfalarının (HDevicePage, VXProDevicePage vb.) üst bölümünde
 * kullanılan görsel + bilgi satırı komponenti.
 *
 * Tüm görseller merkezi `deviceImageMap`'ten alınır —
 * görsel değiştirmek için yalnızca `deviceImageMap.ts` düzenlemek yeterlidir.
 */
export const DeviceImageBanner: React.FC<DeviceImageBannerProps> = ({
  series,
  deviceName,
  ipAddress,
  protocol,
  statusLabel = 'Bağlı',
  accentColor,
  className = '',
  rightElement,
}) => {
  const imgSrc     = getDeviceImage(series)
  const fallback   = getDeviceFallbackIcon(series)
  const resolvedAccent = accentColor ?? 'var(--accent-primary)'

  return (
    <div
      className={`device-banner ${className}`}
      style={{ '--banner-accent': resolvedAccent } as React.CSSProperties}
    >
      {/* Glow decoration */}
      <div className="device-banner-glow" />

      {/* Device image */}
      <div className="device-banner-image-wrap">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={`${series} device`}
            className="device-banner-image"
            draggable={false}
          />
        ) : (
          <div className="device-banner-image-fallback">{fallback}</div>
        )}
      </div>

      {/* Info */}
      <div className="device-banner-info">
        <div className="device-banner-series">{series}</div>
        <div className="device-banner-name">
          {deviceName || `${series} Cihazı`}
        </div>
        <div className="device-banner-meta">
          {ipAddress && <span className="device-banner-ip">{ipAddress}</span>}
          {protocol  && <span className="device-banner-sep">·</span>}
          {protocol  && <span className="device-banner-protocol">{protocol}</span>}
        </div>
        <div className="device-banner-status">
          <span className="device-banner-dot" />
          {statusLabel}
        </div>
      </div>

      {/* Right Element Slot (e.g. Refresh Button) */}
      {rightElement && (
        <div className="device-banner-right">
          {rightElement}
        </div>
      )}
    </div>
  )
}
