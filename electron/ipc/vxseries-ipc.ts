import { ipcMain } from 'electron'
import { IPC_CHANNELS } from './ipc-channels'
import { VXSeriesConnection } from '../modules/vxseries/VXSeriesConnection'
import { VXSeriesCommandService } from '../modules/vxseries/VXSeriesCommandService'
import { VXSeriesProtocolBuilder } from '../modules/vxseries/VXSeriesProtocolBuilder'
import { VXSeriesParser } from '../modules/vxseries/VXSeriesParser'
import { VXSeriesException } from '../modules/vxseries/VXSeriesException'

interface VXSession {
  connection: VXSeriesConnection
  commandService: VXSeriesCommandService
}

const sessions = new Map<string, VXSession>()

export function registerVXSeriesIpc(): void {

  ipcMain.handle(IPC_CHANNELS.VXSERIES_CONNECT, async (_event, args) => {
    const { sessionId, ipAddress, port, timeoutMs } = args
    try {
      const conn = new VXSeriesConnection()
      const result = await conn.connect({ ipAddress, port, timeoutMs })
      if (result.success) {
        const service = new VXSeriesCommandService(conn, new VXSeriesProtocolBuilder(), new VXSeriesParser())
        sessions.set(sessionId, { connection: conn, commandService: service })
      }
      return result
    } catch (err) {
      if (err instanceof VXSeriesException) return { success: false, message: err.message, code: err.code }
      return { success: false, message: String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.VXSERIES_SEARCH_DEVICES, async (_event, args) => {
    try {
      const conn = new VXSeriesConnection()
      const devices = await conn.searchDevices(args?.timeoutMs ?? 3000)
      return { success: true, devices }
    } catch (err) { return { success: false, devices: [], message: String(err) } }
  })

  ipcMain.handle(IPC_CHANNELS.VXSERIES_DISCONNECT, (_event, args) => {
    const session = sessions.get(args.sessionId)
    if (session) { session.connection.disconnect(); sessions.delete(args.sessionId) }
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.VXSERIES_SEND_COMMAND, async (_event, args) => {
    const { sessionId, command, params } = args
    const session = sessions.get(sessionId)
    if (!session || !session.connection.isConnected()) return { success: false, message: 'No active VX Series connection' }
    try {
      return await session.commandService.sendCommand(command, params)
    } catch (err) {
      if (err instanceof VXSeriesException) return { success: false, message: err.message, code: err.code }
      return { success: false, message: String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.VXSERIES_GET_STATUS, (_event, args) => ({
    connected: sessions.get(args.sessionId)?.connection.isConnected() ?? false
  }))
}
