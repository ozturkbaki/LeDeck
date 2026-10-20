import { ipcMain } from 'electron'
import { IPC_CHANNELS } from './ipc-channels'
import { vxProConnectionService } from '../modules/vxpro/VXProConnectionService'

export function registerVXProIpc() {
  // ── connect ────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.VXPRO_CONNECT, async (_, args: { sessionId: string; ipAddress: string; timeoutMs?: number }) => {
    try {
      const result = await vxProConnectionService.connect(args.ipAddress, args.timeoutMs ?? 5000)
      return {
        success:       result.success,
        message:       result.message,
        code:          result.code,
        sentHex:       result.sentHex,
        receivedHex:   result.receivedHex,
        parsedModelId: result.parsedModelId,
      }
    } catch (err: any) {
      return { success: false, message: err.message, code: 'ERR_TCP_CONNECT' }
    }
  })

  // ── disconnect ─────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.VXPRO_DISCONNECT, async () => {
    try {
      const result = vxProConnectionService.disconnect()
      return { success: result.success }
    } catch (err: any) {
      return { success: false, message: err.message }
    }
  })

  // ── getStatus ──────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.VXPRO_GET_STATUS, async () => {
    const state = vxProConnectionService.getState()
    return {
      status:    state.status,
      ipAddress: state.ipAddress,
      lastError: state.lastError,
      errorCode: state.errorCode,
    }
  })

  // ── setBrightness ──────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.VXPRO_SET_BRIGHTNESS, async (_, args: { percent: number; timeoutMs?: number }) => {
    try {
      const result = await vxProConnectionService.setBrightness(args.percent, args.timeoutMs ?? 3000)
      return { success: result.success, message: result.message, code: result.code, sentHex: result.sentHex, receivedHex: result.receivedHex }
    } catch (err: any) {
      return { success: false, message: err.message, code: 'ERR_CMD_TIMEOUT' }
    }
  })

  // ── setFTB ────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.VXPRO_SET_FTB, async (_, args: { enable: boolean; timeoutMs?: number }) => {
    try {
      const result = await vxProConnectionService.setFTB(args.enable, args.timeoutMs ?? 3000)
      return { success: result.success, message: result.message, code: result.code, sentHex: result.sentHex, receivedHex: result.receivedHex }
    } catch (err: any) {
      return { success: false, message: err.message, code: 'ERR_CMD_TIMEOUT' }
    }
  })

  // ── setFreeze ─────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.VXPRO_SET_FREEZE, async (_, args: { enable: boolean; timeoutMs?: number }) => {
    try {
      const result = await vxProConnectionService.setFreeze(args.enable, args.timeoutMs ?? 3000)
      return { success: result.success, message: result.message, code: result.code, sentHex: result.sentHex, receivedHex: result.receivedHex }
    } catch (err: any) {
      return { success: false, message: err.message, code: 'ERR_CMD_TIMEOUT' }
    }
  })

  // ── loadPreset ────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.VXPRO_LOAD_PRESET, async (_, args: { presetIndex: number; timeoutMs?: number }) => {
    try {
      const result = await vxProConnectionService.loadPreset(args.presetIndex, args.timeoutMs ?? 3000)
      return { success: result.success, message: result.message, code: result.code, sentHex: result.sentHex, receivedHex: result.receivedHex }
    } catch (err: any) {
      return { success: false, message: err.message, code: 'ERR_CMD_TIMEOUT' }
    }
  })
}
