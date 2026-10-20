/**
 * DeviceSeries — shared enum used across renderer modules.
 * This is the ONLY shared type between modules.
 * Each module must NOT import each other's types directly.
 */
export type DeviceSeries = 'H' | 'TU' | 'VX' | 'VXPro' | 'MCTRL'

export const DEVICE_SERIES_LABELS: Record<DeviceSeries, string> = {
  H:     'H Series',
  TU:    'TU Series',
  VX:    'VX Series',
  VXPro: 'VX Pro',
  MCTRL: 'MCTRL Series',
}

export const DEVICE_SERIES_LIST: DeviceSeries[] = ['H', 'TU', 'VX', 'VXPro', 'MCTRL']
