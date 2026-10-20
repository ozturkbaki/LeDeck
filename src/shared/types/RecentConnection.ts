import type { DeviceSeries } from './DeviceSeries'

/**
 * RecentConnection — shared model for stored connection profiles.
 * Stored via electron-store in the main process, fetched via IPC.
 */
export interface RecentConnection {
  id: string
  displayName: string
  deviceName?: string   // opsiyonel cihaz adı (VX Pro vb.)
  deviceSeries: DeviceSeries
  // IP-based (H, TU, VX, VXPro)
  ipAddress?: string
  port?: number
  // Serial-based (MCTRL)
  comPort?: string
  baudRate?: number
  // Timestamps
  lastConnectedAt: string
  createdAt: string
}
