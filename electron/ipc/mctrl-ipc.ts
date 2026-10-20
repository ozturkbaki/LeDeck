import { ipcMain } from 'electron'
import { IPC_CHANNELS } from './ipc-channels'
import { MCTRLConnection } from '../modules/mctrl/MCTRLConnection'
import { MCTRLCommandService } from '../modules/mctrl/MCTRLCommandService'
import { MCTRLProtocolBuilder } from '../modules/mctrl/MCTRLProtocolBuilder'
import { MCTRLParser } from '../modules/mctrl/MCTRLParser'
import { MCTRLException } from '../modules/mctrl/MCTRLException'

interface MCTRLSession {
  connection: MCTRLConnection
  commandService: MCTRLCommandService
}

const sessions = new Map<string, MCTRLSession>()

export function registerMCTRLIpc(): void {

  ipcMain.handle(IPC_CHANNELS.MCTRL_LIST_PORTS, async () => {
    try {
      return { success: true, ports: await MCTRLConnection.listPorts() }
    } catch (err) {
      return { success: false, ports: [], message: String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.MCTRL_SCAN, async () => {
    try {
      const scanner = new MCTRLConnection()
      const devices = await scanner.scanAndDiscover()
      console.log(`[MCTRL IPC] Scan complete. Found ${devices.length} device(s).`)
      return { success: true, devices }
    } catch (err) {
      console.error('[MCTRL IPC] Scan error:', err)
      return { success: false, devices: [], message: String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.MCTRL_CONNECT, async (_event, args) => {
    const { sessionId, comPort, baudRate, timeoutMs } = args
    try {
      const conn = new MCTRLConnection()
      const result = await conn.connect({ comPort, baudRate, timeoutMs })
      if (result.success) {
        const service = new MCTRLCommandService(conn, new MCTRLProtocolBuilder(), new MCTRLParser())
        sessions.set(sessionId, { connection: conn, commandService: service })
      }
      return result
    } catch (err) {
      if (err instanceof MCTRLException) return { success: false, message: err.message, code: err.code }
      return { success: false, message: String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.MCTRL_TEST_CONNECTION, async (_event, args) => {
    try {
      const conn = new MCTRLConnection()
      return await conn.testConnection({ comPort: args.comPort, baudRate: args.baudRate })
    } catch (err) { return { success: false, message: String(err) } }
  })

  ipcMain.handle(IPC_CHANNELS.MCTRL_DISCONNECT, (_event, args) => {
    const session = sessions.get(args.sessionId)
    if (session) { session.connection.disconnect(); sessions.delete(args.sessionId) }
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.MCTRL_SEND_COMMAND, async (_event, args) => {
    const { sessionId, command, params } = args
    const session = sessions.get(sessionId)
    if (!session || !session.connection.isConnected()) return { success: false, message: 'No active MCTRL connection' }
    try {
      return await session.commandService.sendCommand(command, params)
    } catch (err) {
      if (err instanceof MCTRLException) return { success: false, message: err.message, code: err.code }
      return { success: false, message: String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.MCTRL_GET_STATUS, (_event, args) => ({
    connected: sessions.get(args.sessionId)?.connection.isConnected() ?? false
  }))
}
