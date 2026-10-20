import Store from 'electron-store'
import { randomUUID } from 'crypto'

/**
 * RecentConnection - stored per-device-series connection profile.
 * COM port fields are only used for MCTRL; IP fields for H/TU/VX.
 */
export interface RecentConnection {
  id: string
  displayName: string
  deviceName?: string      // opsiyonel cihaz adı (VX Pro vb.)
  deviceSeries: 'H' | 'TU' | 'VX' | 'VXPro' | 'MCTRL'
  // IP-based (H, TU, VX, VXPro)
  ipAddress?: string
  port?: number
  // Serial-based (MCTRL)
  comPort?: string
  baudRate?: number
  // Timestamps
  lastConnectedAt: string  // ISO date string
  createdAt: string
}

interface StoreSchema {
  connections: RecentConnection[]
}

// Singleton store instance
const store = new Store<StoreSchema>({
  name: 'ledeca-connections',
  defaults: {
    connections: []
  }
})

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns all stored connection profiles.
 * Sorted by lastConnectedAt descending (most recent first).
 */
export function getConnections(): RecentConnection[] {
  const all = store.get('connections', [])
  return [...all].sort(
    (a, b) => new Date(b.lastConnectedAt).getTime() - new Date(a.lastConnectedAt).getTime()
  )
}

/**
 * Saves a new connection profile. Returns the created record with a generated id.
 */
export function saveConnection(
  data: Omit<RecentConnection, 'id' | 'createdAt' | 'lastConnectedAt'>
): RecentConnection {
  const now = new Date().toISOString()
  const record: RecentConnection = {
    ...data,
    id: randomUUID(),
    createdAt: now,
    lastConnectedAt: now
  }
  const current = store.get('connections', [])
  store.set('connections', [...current, record])
  return record
}

/**
 * Updates an existing connection profile by id.
 */
export function updateConnection(
  id: string,
  updates: Partial<Omit<RecentConnection, 'id' | 'createdAt'>>
): RecentConnection | null {
  const connections = store.get('connections', [])
  const idx = connections.findIndex((c) => c.id === id)
  if (idx === -1) return null

  const updated = { ...connections[idx], ...updates }
  connections[idx] = updated
  store.set('connections', connections)
  return updated
}

/**
 * Deletes a connection profile by id.
 */
export function deleteConnection(id: string): boolean {
  const connections = store.get('connections', [])
  const filtered = connections.filter((c) => c.id !== id)
  if (filtered.length === connections.length) return false
  store.set('connections', filtered)
  return true
}

/**
 * Updates only the lastConnectedAt timestamp for an existing connection.
 */
export function touchConnection(id: string): boolean {
  const connections = store.get('connections', [])
  const idx = connections.findIndex((c) => c.id === id)
  if (idx === -1) return false
  connections[idx] = { ...connections[idx], lastConnectedAt: new Date().toISOString() }
  store.set('connections', connections)
  return true
}
