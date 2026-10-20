import { ipcMain } from 'electron'
import { IPC_CHANNELS } from './ipc-channels'
import { TUSeriesConnection } from '../modules/tuseries/TUSeriesConnection'
import { TUSeriesCommandService } from '../modules/tuseries/TUSeriesCommandService'
import { TUSeriesProtocolBuilder } from '../modules/tuseries/TUSeriesProtocolBuilder'
import { TUSeriesParser } from '../modules/tuseries/TUSeriesParser'
import { TUSeriesException } from '../modules/tuseries/TUSeriesException'

interface TUSession {
  connection: TUSeriesConnection
  commandService: TUSeriesCommandService
}

const sessions = new Map<string, TUSession>()

export function registerTUSeriesIpc(): void {

  ipcMain.handle(IPC_CHANNELS.TUSERIES_CONNECT, async (_event, args) => {
    const { sessionId, ipAddress, timeoutMs } = args
    try {
      const conn = new TUSeriesConnection()
      const result = await conn.connect({ ipAddress, timeoutMs })
      if (!result.success) return result

      const service = new TUSeriesCommandService(conn, new TUSeriesProtocolBuilder(), new TUSeriesParser())
      
      // Verification logic: send getSystemStatus to verify valid response
      try {
        const verifyRes = await service.sendCommand('getSystemStatus')
        if (!verifyRes.success) {
          conn.disconnect()
          return { success: false, message: 'TCP Connected but did not receive valid TU frame' }
        }
        
        sessions.set(sessionId, { connection: conn, commandService: service })
        return { ...result, systemStatus: (verifyRes.data as any)?.status }
      } catch(verifyErr) {
        conn.disconnect()
        return { success: false, message: `Verification failed: ${verifyErr}` }
      }
    } catch (err) {
      if (err instanceof TUSeriesException) return { success: false, message: err.message, code: err.code }
      return { success: false, message: String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.TUSERIES_TEST_CONNECTION, async (_event, args) => {
    const { ipAddress, timeoutMs } = args
    try {
      const conn = new TUSeriesConnection()
      const result = await conn.connect({ ipAddress, timeoutMs })
      if (!result.success) return result

      const service = new TUSeriesCommandService(conn, new TUSeriesProtocolBuilder(), new TUSeriesParser())
      let testSuccess = false
      try {
        const verifyRes = await service.sendCommand('getSystemStatus')
        testSuccess = verifyRes.success
      } catch (e) {
        testSuccess = false
      }
      conn.disconnect()
      
      if (testSuccess) {
        return { success: true, message: 'Valid TU connection verified' }
      } else {
        return { success: false, message: 'Did not receive valid TU frame' }
      }
    } catch (err) { 
      return { success: false, message: String(err) } 
    }
  })

  ipcMain.handle(IPC_CHANNELS.TUSERIES_DISCONNECT, (_event, args) => {
    const session = sessions.get(args.sessionId)
    if (session) { session.connection.disconnect(); sessions.delete(args.sessionId) }
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.TUSERIES_SEND_COMMAND, async (_event, args) => {
    const { sessionId, command, params } = args
    console.log(`[IPC] Handling sendCommand for TU: ${command}`)
    const session = sessions.get(sessionId)
    if (!session || !session.connection.isConnected()) return { success: false, message: 'No active TU Series connection' }
    try {
      return await session.commandService.sendCommand(command, params)
    } catch (err) {
      if (err instanceof TUSeriesException) return { success: false, message: err.message, code: err.code }
      return { success: false, message: String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.TUSERIES_GET_STATUS, (_event, args) => ({
    connected: sessions.get(args.sessionId)?.connection.isConnected() ?? false
  }))
}
