/**
 * Taurus IPC Handler — TB/TCC Series
 *
 * Tüm Taurus IPC kanalları burada register edilir.
 * Diğer modüllere (MCTRL, VX, H, TU) kesinlikle dokunulmaz.
 */

import { ipcMain }            from 'electron'
import { IPC_CHANNELS }       from './ipc-channels'
import { TaurusDiscovery }    from '../modules/taurus/TaurusDiscovery'
import { TaurusConnection }   from '../modules/taurus/TaurusConnection'
import { TaurusCommandService } from '../modules/taurus/TaurusCommandService'
import { TaurusException }    from '../modules/taurus/TaurusException'
import { TaurusWatcher }      from '../modules/taurus/TaurusWatcher'

interface TaurusSession {
  connection:     TaurusConnection
  commandService: TaurusCommandService
  watcher?:       TaurusWatcher
}

const sessions    = new Map<string, TaurusSession>()
let activeDiscovery: TaurusDiscovery | null = null

export function registerTaurusIpc(): void {

  // ── Discovery ─────────────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.TAURUS_GET_LOCAL_SUBNETS, () => {
    try {
      const subnets = TaurusDiscovery.getLocalSubnets()
      return { success: true, subnets }
    } catch (err) {
      return { success: false, subnets: [], message: String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.TAURUS_DISCOVER, async (_event, args) => {
    try {
      // Önceki discovery varsa iptal et
      activeDiscovery?.cancel()

      const discovery = new TaurusDiscovery(args?.dllPath)
      activeDiscovery = discovery

      const result = await discovery.discover({
        targets:     args?.targets ?? TaurusDiscovery.getLocalSubnets(),
        timeoutMs:   args?.timeoutMs ?? 3000,
        deduplicate: true,
      })

      console.log(`[Taurus IPC] Discovery: ${result.devices.length} device(s) in ${result.elapsed}ms`)
      return result
    } catch (err) {
      return { success: false, devices: [], errors: [{ target: 'general', message: String(err) }], elapsed: 0 }
    } finally {
      activeDiscovery = null
    }
  })

  ipcMain.handle(IPC_CHANNELS.TAURUS_CANCEL_DISCOVER, () => {
    activeDiscovery?.cancel()
    activeDiscovery = null
    return { success: true }
  })

  // ── Anonymous base-info (Manuel IP fallback için) ─────────────────────────

  ipcMain.handle(IPC_CHANNELS.TAURUS_FETCH_BASE_INFO_ANON, async (_event, args) => {
    try {
      const info = await TaurusConnection.fetchBaseInfoAnonymous(args.ip, args.port ?? 16674)
      if (info) return { success: true, data: info }
      return { success: false, message: 'Cihaz bilgisi alınamadı' }
    } catch (err) {
      return { success: false, message: String(err) }
    }
  })

  // ── Connect (Discovery veya Manuel) ──────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.TAURUS_CONNECT, async (_event, args) => {
    const { sessionId, ip, port, username, password, sn, deviceName, snHint } = args
    try {
      // 1. Mevcut oturumları temizle (Aynı IP için mükerrer watcher/session olmasın)
      for (const [sid, sess] of sessions.entries()) {
        if (sess.connection.ip === ip) {
          console.log(`[Taurus IPC] Eski oturum temizleniyor: ${sid} (@${ip})`)
          sess.watcher?.stop()
          sessions.delete(sid)
        }
      }

      let conn: TaurusConnection

      if (sn) {
        // Discovery yolundan — SN kesinlikle biliniyor
        conn = await TaurusConnection.connectFromDiscovery(
          {
            ip, terminalEntrancePortHttps: port ?? 16674, sn,
            productName: deviceName ?? '', aliasName: '', modelId: 0,
            ftpPort: 0, tcpPort: 0, logined: false, osVersion: '', platform: '', width: 0, height: 0,
          },
          username, password, snHint,
        )
      } else {
        // Discovery'den gelen SN'siz cihaz veya tam manuel IP
        // snHint: kullanıcı form'da SN yazmışsa iletilir
        conn = await TaurusConnection.connectManual(ip, port ?? 16674, username, password, snHint)
      }

      const service = new TaurusCommandService(conn)
      
      // İzleyiciyi (Watcher) kur
      const watcher = new TaurusWatcher(sessionId, conn.ip, conn.port)
      watcher.on('disconnected', (data) => {
        _event.sender.send(IPC_CHANNELS.TAURUS_EVENT_DISCONNECTED, data)
      })
      watcher.on('reconnected', (data) => {
        _event.sender.send(IPC_CHANNELS.TAURUS_EVENT_RECONNECTED, data)
      })
      watcher.start()

      sessions.set(sessionId, { 
        connection: conn, 
        commandService: service,
        watcher: watcher 
      })

      console.log(`[Taurus IPC] Session ${sessionId} connected. Device: ${conn.deviceName} @ ${conn.ip}`)
      return {
        success:    true,
        deviceName: conn.deviceName,
        ip:         conn.ip,
        port:       conn.port,
        sn:         conn.sn,
      }
    } catch (err) {
      if (err instanceof TaurusException) {
        return { success: false, message: err.message, code: err.code, apiCode: err.apiCode }
      }
      return { success: false, message: String(err) }
    }
  })

  // ── Disconnect ────────────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.TAURUS_DISCONNECT, async (_event, args) => {
    const session = sessions.get(args.sessionId)
    if (session) {
      session.watcher?.stop()
      await session.connection.logout().catch(() => {})
      sessions.delete(args.sessionId)
      console.log(`[Taurus IPC] Session ${args.sessionId} disconnected.`)
    }
    return { success: true }
  })

  // ── Send Command ──────────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.TAURUS_SEND_COMMAND, async (_event, args) => {
    const { sessionId, command, params } = args
    const session = sessions.get(sessionId)
    if (!session || !session.connection.isConnected) {
      return { success: false, message: 'Aktif Taurus bağlantısı yok' }
    }
    try {
      return await session.commandService.sendCommand(command, params)
    } catch (err) {
      if (err instanceof TaurusException) return { success: false, message: err.message, code: err.code }
      return { success: false, message: String(err) }
    }
  })

  // ── Get Status ────────────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.TAURUS_GET_STATUS, (_event, args) => ({
    connected: sessions.get(args.sessionId)?.connection.isConnected ?? false
  }))
}
