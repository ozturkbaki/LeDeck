/**
 * deviceImageMap.ts
 * -----------------
 * Cihaz serisi → görsel eşlemesi (merkezi yönetim).
 *
 * Görseller Vite import'u ile dahil edildiğinden build ve setup
 * sonrasında da sorunsuz çalışır. Absolute path kullanılmaz.
 *
 * Yeni görsel eklemek için:
 *   1. src/assets/devices/ altına .png dosyasını bırak
 *   2. Buraya import et ve map'e ekle
 *
 * VX ve VX Pro şu anda aynı görseli paylaşıyor.
 * İleride VX Pro için farklı bir görsel atamak için yalnızca
 * bu dosyadaki VXPro satırını değiştirmek yeterlidir.
 */

import type { DeviceSeries } from './types/DeviceSeries'

import hSeriesImg  from '../assets/devices/h-series.png'
import tuSeriesImg from '../assets/devices/tu-series.png'
import vxSeriesImg from '../assets/devices/vx-series.png'
import mctrlImg    from '../assets/devices/mctrl-series.png'

// ─── Merkezi eşleme tablosu ───────────────────────────────────────────────────
// Her DeviceSeries değeri için bir görsel URL'si.
// VXPro şu an vxSeriesImg kullanıyor; ileride ayrı bir dosyayla değiştirilebilir.
const deviceImageMap: Record<DeviceSeries, string> = {
  H:     hSeriesImg,
  TU:    tuSeriesImg,
  VX:    vxSeriesImg,
  VXPro: vxSeriesImg,  // paylaşımlı — ileride ayrı görsel atanabilir
  MCTRL: mctrlImg,
}

// ─── Accessor ─────────────────────────────────────────────────────────────────

/**
 * Verilen seri için görsel URL'sini döner.
 * Bilinmeyen bir seri gelirse boş string döner → component fallback gösterir.
 */
export function getDeviceImage(series: DeviceSeries | string): string {
  return deviceImageMap[series as DeviceSeries] ?? ''
}

/**
 * Fallback emoji — görsel yüklenemediğinde gösterilir.
 */
export const DEVICE_FALLBACK_ICON: Record<DeviceSeries | string, string> = {
  H:     '🖥',
  TU:    '📺',
  VX:    '⚡',
  VXPro: '⚡',
  MCTRL: '🔌',
}

export function getDeviceFallbackIcon(series: DeviceSeries | string): string {
  return DEVICE_FALLBACK_ICON[series] ?? '🖥'
}

export default deviceImageMap
