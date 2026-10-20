import { ipcMain } from 'electron'
import { IPC_CHANNELS } from './ipc-channels'
import { HSeriesConnection } from '../modules/hseries/HSeriesConnection'
import { HSeriesCommandService } from '../modules/hseries/HSeriesCommandService'
import { HSeriesProtocolBuilder } from '../modules/hseries/HSeriesProtocolBuilder'
import { HSeriesParser } from '../modules/hseries/HSeriesParser'
import { HSeriesException } from '../modules/hseries/HSeriesException'

/**
 * H Series IPC Handlers
 *
 * Renderer (React) ile H Series backend arasındaki iletişimi yönetir.
 * Her aktif bağlantı, sessionId ile Map'te saklanır.
 *
 * Yeni kanallar:
 *   HSERIES_GET_DEVICE_DETAILS  → R0100
 *   HSERIES_GET_SCREEN_DETAILS  → R0401
 *   HSERIES_GET_PRESET_LIST     → R0600
 *   HSERIES_LOAD_PRESET         → W0605
 *
 * Port: Kullanıcıdan alınmaz. HSeriesConnection içinde H_SERIES_UDP_PORT (6000) sabit kullanılır.
 */

interface HSession {
  connection: HSeriesConnection
  commandService: HSeriesCommandService
}

const sessions = new Map<string, HSession>()

export function registerHSeriesIpc(): void {

  // ─── Bağlantı ─────────────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.HSERIES_CONNECT, async (_event, args) => {
    const { sessionId, ipAddress, timeoutMs } = args
    // NOT: port IPC'den alınmaz — HSeriesConnection içinde hardcoded 6000
    try {
      const conn = new HSeriesConnection()
      const result = await conn.connect({ ipAddress, timeoutMs })

      if (result.success) {
        const service = new HSeriesCommandService(
          conn,
          new HSeriesProtocolBuilder(),
          new HSeriesParser(),
        )
        sessions.set(sessionId, { connection: conn, commandService: service })
      }

      return result
    } catch (err) {
      if (err instanceof HSeriesException) return { success: false, message: err.message, code: err.code }
      return { success: false, message: String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.HSERIES_TEST_CONNECTION, async (_event, args) => {
    const { ipAddress, timeoutMs } = args
    // port alınmaz — hardcoded
    try {
      const conn = new HSeriesConnection()
      return await conn.testConnection({ ipAddress, timeoutMs })
    } catch (err) {
      return { success: false, message: String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.HSERIES_DISCONNECT, (_event, args) => {
    const { sessionId } = args
    const session = sessions.get(sessionId)
    if (session) {
      session.connection.disconnect()
      sessions.delete(sessionId)
    }
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.HSERIES_GET_STATUS, (_event, args) => {
    const { sessionId } = args
    const session = sessions.get(sessionId)
    return { connected: session?.connection.isConnected() ?? false }
  })

  // ─── Komutlar ─────────────────────────────────────────────────────────────

  /**
   * Get Device Details — R0100
   */
  ipcMain.handle(IPC_CHANNELS.HSERIES_GET_DEVICE_DETAILS, async (_event, args) => {
    const { sessionId } = args
    const session = sessions.get(sessionId)
    if (!session?.connection.isConnected()) {
      return { status: 'error', message: 'Aktif H Series bağlantısı bulunamadı' }
    }
    try {
      return await session.commandService.getDeviceDetails()
    } catch (err) {
      if (err instanceof HSeriesException) return { status: 'error', message: err.message, code: err.code }
      return { status: 'error', message: String(err) }
    }
  })

  /**
   * Get Screen Details — R0401
   */
  ipcMain.handle(IPC_CHANNELS.HSERIES_GET_SCREEN_DETAILS, async (_event, args) => {
    const { sessionId } = args
    const session = sessions.get(sessionId)
    if (!session?.connection.isConnected()) {
      return { status: 'error', message: 'Aktif H Series bağlantısı bulunamadı' }
    }
    try {
      return await session.commandService.getScreenDetails()
    } catch (err) {
      if (err instanceof HSeriesException) return { status: 'error', message: err.message, code: err.code }
      return { status: 'error', message: String(err) }
    }
  })

  /**
   * Get Preset List — R0600
   */
  ipcMain.handle(IPC_CHANNELS.HSERIES_GET_PRESET_LIST, async (_event, args) => {
    const { sessionId } = args
    const session = sessions.get(sessionId)
    if (!session?.connection.isConnected()) {
      return { status: 'error', message: 'Aktif H Series bağlantısı bulunamadı' }
    }
    try {
      return await session.commandService.getPresetList()
    } catch (err) {
      if (err instanceof HSeriesException) return { status: 'error', message: err.message, code: err.code }
      return { status: 'error', message: String(err) }
    }
  })

  /**
   * Load Preset — W0605
   */
  ipcMain.handle(IPC_CHANNELS.HSERIES_LOAD_PRESET, async (_event, args) => {
    const { sessionId, presetId } = args
    const session = sessions.get(sessionId)
    if (!session?.connection.isConnected()) {
      return { status: 'error', message: 'Aktif H Series bağlantısı bulunamadı' }
    }
    try {
      return await session.commandService.loadPreset(presetId)
    } catch (err) {
      if (err instanceof HSeriesException) return { status: 'error', message: err.message, code: err.code }
      return { status: 'error', message: String(err) }
    }
  })

  /**
   * Generic sendCommand (legacy uyumluluk)
   */
  ipcMain.handle(IPC_CHANNELS.HSERIES_SEND_COMMAND, async (_event, args) => {
    const { sessionId, command, params } = args
    const session = sessions.get(sessionId)
    if (!session?.connection.isConnected()) {
      return { success: false, message: 'Aktif H Series bağlantısı bulunamadı' }
    }
    try {
      return await session.commandService.sendCommand(command, params)
    } catch (err) {
      if (err instanceof HSeriesException) return { success: false, message: err.message, code: err.code }
      return { success: false, message: String(err) }
    }
  })

  // ─── Kontrol Komutları ──────────────────────────────────────────────────────────────

  /**
   * Get Screen Layer Enum — R0500
   */
  ipcMain.handle(IPC_CHANNELS.HSERIES_GET_LAYER_ENUM, async (_event, args) => {
    const { sessionId } = args
    const session = sessions.get(sessionId)
    if (!session?.connection.isConnected()) {
      return { status: 'error', message: 'Aktif H Series bağlantısı bulunamadı' }
    }
    try {
      return await session.commandService.getLayerEnum()
    } catch (err) {
      if (err instanceof HSeriesException) return { status: 'error', message: err.message, code: err.code }
      return { status: 'error', message: String(err) }
    }
  })

  /**
   * Get Screen Layer Details — R0501
   */
  ipcMain.handle(IPC_CHANNELS.HSERIES_GET_LAYER_DETAILS, async (_event, args) => {
    const { sessionId, layerId } = args
    const session = sessions.get(sessionId)
    if (!session?.connection.isConnected()) {
      return { status: 'error', message: 'Aktif H Series bağlantısı bulunamadı' }
    }
    try {
      return await session.commandService.getLayerDetails(layerId)
    } catch (err) {
      if (err instanceof HSeriesException) return { status: 'error', message: err.message, code: err.code }
      return { status: 'error', message: String(err) }
    }
  })

  /**
   * Adjust Screen Brightness — W0410
   */
  ipcMain.handle(IPC_CHANNELS.HSERIES_SET_BRIGHTNESS, async (_event, args) => {
    const { sessionId, brightness } = args
    const session = sessions.get(sessionId)
    if (!session?.connection.isConnected()) {
      return { status: 'error', message: 'Aktif H Series bağlantısı bulunamadı' }
    }
    try {
      return await session.commandService.setBrightness(brightness)
    } catch (err) {
      if (err instanceof HSeriesException) return { status: 'error', message: err.message, code: err.code }
      return { status: 'error', message: String(err) }
    }
  })

  /**
   * Freeze the Screen — W040A
   */
  ipcMain.handle(IPC_CHANNELS.HSERIES_SET_FREEZE, async (_event, args) => {
    const { sessionId, enable } = args
    const session = sessions.get(sessionId)
    if (!session?.connection.isConnected()) {
      return { status: 'error', message: 'Aktif H Series bağlantısı bulunamadı' }
    }
    try {
      return await session.commandService.setFreeze(enable)
    } catch (err) {
      if (err instanceof HSeriesException) return { status: 'error', message: err.message, code: err.code }
      return { status: 'error', message: String(err) }
    }
  })

  /**
   * Set Screen FTB — W0409
   */
  ipcMain.handle(IPC_CHANNELS.HSERIES_SET_FTB, async (_event, args) => {
    const { sessionId, type } = args
    const session = sessions.get(sessionId)
    if (!session?.connection.isConnected()) {
      return { status: 'error', message: 'Aktif H Series bağlantısı bulunamadı' }
    }
    try {
      return await session.commandService.setFTB(type)
    } catch (err) {
      if (err instanceof HSeriesException) return { status: 'error', message: err.message, code: err.code }
      return { status: 'error', message: String(err) }
    }
  })
}
