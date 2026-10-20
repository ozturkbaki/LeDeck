import net from 'net'
import { EventEmitter } from 'events'

// ─── Error Codes ──────────────────────────────────────────────────────────────
export type VXProErrorCode =
  | 'ERR_TCP_CONNECT'
  | 'ERR_NO_RESPONSE'
  | 'ERR_INVALID_FRAME'
  | 'ERR_PARSE_FAILED'
  | 'ERR_ALREADY_CONNECTED'
  | 'ERR_NOT_CONNECTED'
  | 'ERR_CMD_TIMEOUT'
  | 'ERR_CMD_RESPONSE'

export interface VXProConnectionState {
  status: 'disconnected' | 'connecting' | 'connected_unverified' | 'connected_verified' | 'error'
  ipAddress?: string
  lastError?: string
  errorCode?: VXProErrorCode
}

export interface VXProConnectResult {
  success: boolean
  message: string
  code?: VXProErrorCode
  sentHex?: string
  receivedHex?: string
  parsedModelId?: number | null
}

export interface VXProCommandResult {
  success: boolean
  message: string
  code?: VXProErrorCode
  sentHex?: string
  receivedHex?: string
}

// ─── Debug Logger ─────────────────────────────────────────────────────────────
function dbg(phase: string, ...args: unknown[]) {
  console.log(`[VXPro][${phase}]`, ...args)
}

function toHex(buf: Buffer): string {
  return [...buf].map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
}

// ─── Protocol Helpers ─────────────────────────────────────────────────────────

/**
 * Converts a 0–100 percentage to a 0–255 device value.
 * Uses Math.floor to match the protocol reference table exactly.
 * e.g. 50% → floor(127.5) = 127 = 0x7F  ✓
 *      70% → floor(178.5) = 178 = 0xB2  ✓
 */
function percentToDeviceValue(percent: number): number {
  const clamped = Math.max(0, Math.min(100, percent))
  return Math.floor((clamped / 100) * 255)
}

/**
 * Builds the Control Screen Brightness command frame.
 *
 * Frame: 55 AA 00 00 FE FF 01 FF FF FF 01 00 01 00 00 02 01 00 XX SUM_L SUM_H
 * Checksum: sum of bytes[2..18] + 0x5555, little-endian at [19..20]
 */
function buildBrightnessCommand(deviceValue: number): Buffer {
  const cmd = Buffer.from([
    0x55, 0xaa, 0x00, 0x00, 0xfe, 0xff, 0x01, 0xff,
    0xff, 0xff, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02,
    0x01, 0x00, deviceValue & 0xff, 0x00, 0x00,  // [19] [20] = checksum placeholders
  ])

  // Checksum: sum of bytes[2] through bytes[18] + 0x5555
  let sum = 0x5555
  for (let i = 2; i <= 18; i++) sum += cmd[i]

  cmd[19] = sum & 0xff           // SUM_L
  cmd[20] = (sum >> 8) & 0xff    // SUM_H

  return cmd
}

/**
 * Checks whether the given buffer is a valid NovaStar brightness ACK.
 * Expected: AA 55 00 00 FF FE 01 FF FF FF 01 00 01 00 00 02 00 00 54 5A
 * - Starts with AA 55 (or 55 AA)
 * - Byte[16] == 0x00 → success
 */
function parseBrightnessResponse(data: Buffer): { ok: boolean; statusByte: number | null } {
  if (data.length < 2) return { ok: false, statusByte: null }

  const validHeader =
    (data[0] === 0xaa && data[1] === 0x55) ||
    (data[0] === 0x55 && data[1] === 0xaa)

  if (!validHeader) return { ok: false, statusByte: null }

  const statusByte = data.length >= 17 ? data[16] : null
  return { ok: statusByte === 0x00, statusByte }
}

/**
 * Generic command response parser.
 * All VX Pro responses share the same success criteria:
 *   - First 2 bytes = AA 55 or 55 AA (valid NovaStar header)
 *   - byte[16] == 0x00 → success
 */
function parseCommandResponse(data: Buffer): { ok: boolean; statusByte: number | null } {
  if (data.length < 2) return { ok: false, statusByte: null }
  const validHeader =
    (data[0] === 0xaa && data[1] === 0x55) ||
    (data[0] === 0x55 && data[1] === 0xaa)
  if (!validHeader) return { ok: false, statusByte: null }
  const statusByte = data.length >= 17 ? data[16] : null
  return { ok: statusByte === 0x00, statusByte }
}

/**
 * FTB / Freeze / Disable command builder.
 * Frame: 55 AA 00 00 FE FF 00 00 00 00 01 00 50 00 20 02 01 00 MODE SUM_L SUM_H
 * mode: 0x00 = Disable Freeze/FTB, 0x01 = FTB Enable, 0x02 = Freeze Enable
 */
function buildFTBFreezeCommand(mode: 0x00 | 0x01 | 0x02): Buffer {
  const cmd = Buffer.from([
    0x55, 0xaa, 0x00, 0x00, 0xfe, 0xff, 0x00, 0x00,
    0x00, 0x00, 0x01, 0x00, 0x50, 0x00, 0x20, 0x02,
    0x01, 0x00, mode, 0x00, 0x00,
  ])
  let sum = 0x5555
  for (let i = 2; i <= 18; i++) sum += cmd[i]
  cmd[19] = sum & 0xff
  cmd[20] = (sum >> 8) & 0xff
  return cmd
}

/**
 * Load Preset command builder.
 * Frame: 55 AA 00 00 FE 00 00 00 00 00 01 00 00 01 51 13 01 00 IDX SUM_L SUM_H
 * presetIndex: 0x00–0x09 (Preset 1–10)
 */
function buildLoadPresetCommand(presetIndex: number): Buffer {
  const idx = Math.max(0, Math.min(9, presetIndex)) & 0xff
  const cmd = Buffer.from([
    0x55, 0xaa, 0x00, 0x00, 0xfe, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x01, 0x00, 0x00, 0x01, 0x51, 0x13,
    0x01, 0x00, idx, 0x00, 0x00,
  ])
  let sum = 0x5555
  for (let i = 2; i <= 18; i++) sum += cmd[i]
  cmd[19] = sum & 0xff
  cmd[20] = (sum >> 8) & 0xff
  return cmd
}

// ─── Service ──────────────────────────────────────────────────────────────────
export class VXProConnectionService extends EventEmitter {
  private socket: net.Socket | null = null
  private state: VXProConnectionState = { status: 'disconnected' }
  private verificationTimeout: NodeJS.Timeout | null = null

  /**
   * Pending command handler — set by setBrightness() (and future commands).
   * When data arrives on a connected socket, this handler is called once.
   */
  private pendingCommandHandler: ((data: Buffer) => void) | null = null

  /**
   * VX Pro ModeID Read Command
   * 55 AA 00 00 FE 00 00 00 00 00 00 00 02 00 00 00 02 00 57 56
   */
  private readonly MODE_ID_CMD = Buffer.from([
    0x55, 0xaa, 0x00, 0x00, 0xfe, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00,
    0x02, 0x00, 0x57, 0x56,
  ])

  public getState(): VXProConnectionState {
    return this.state
  }

  private updateState(newState: Partial<VXProConnectionState>) {
    this.state = { ...this.state, ...newState }
    this.emit('state_changed', this.state)
  }

  // ─── connect ──────────────────────────────────────────────────────────────
  public async connect(ipAddress: string, timeoutMs = 5000): Promise<VXProConnectResult> {
    if (this.socket && this.state.status !== 'disconnected' && this.state.status !== 'error') {
      return { success: false, message: 'Zaten bir bağlantı mevcut veya bağlanıyor.', code: 'ERR_ALREADY_CONNECTED' }
    }

    dbg('INIT', `Bağlantı başlatılıyor → ${ipAddress}:15200, timeout=${timeoutMs}ms`)
    this.updateState({ status: 'connecting', ipAddress, lastError: undefined, errorCode: undefined })

    return new Promise((resolve) => {
      const sentHex = toHex(this.MODE_ID_CMD)
      let receivedHex: string | undefined
      let tcpConnected = false

      this.socket = new net.Socket()
      this.socket.setTimeout(timeoutMs)

      const cleanup = () => {
        if (this.verificationTimeout) {
          clearTimeout(this.verificationTimeout)
          this.verificationTimeout = null
        }
        if (this.socket) {
          this.socket.removeAllListeners()
        }
      }

      // ── TCP CONNECT ────────────────────────────────────────────────────────
      this.socket.on('connect', () => {
        tcpConnected = true
        dbg('TCP', `Socket CONNECTED → ${ipAddress}:15200`)
        this.updateState({ status: 'connected_unverified' })

        dbg('CMD', `ModeID komutu gönderiliyor (${this.MODE_ID_CMD.length} bytes)`)
        dbg('CMD', `→ HEX: ${sentHex}`)
        this.socket!.write(this.MODE_ID_CMD)

        this.verificationTimeout = setTimeout(() => {
          dbg('TIMEOUT', `ModeID yanıtı alınamadı (${timeoutMs}ms içinde cevap yok)`)
          cleanup()
          if (this.socket) this.socket.destroy()
          this.socket = null

          const errMsg = 'Cihaz bağlantıyı kabul etti ancak ModeID komutuna cevap vermedi.'
          this.updateState({ status: 'error', lastError: errMsg, errorCode: 'ERR_NO_RESPONSE' })
          resolve({ success: false, message: 'ERR_NO_RESPONSE', code: 'ERR_NO_RESPONSE', sentHex })
        }, timeoutMs)
      })

      // ── DATA ───────────────────────────────────────────────────────────────
      this.socket.on('data', (data: Buffer) => {
        // ── Verification phase ──────────────────────────────────────────────
        if (this.state.status === 'connected_unverified') {
          receivedHex = toHex(data)
          dbg('DATA', `Response alındı: ${data.length} bytes`)
          dbg('DATA', `← HEX: ${receivedHex}`)

          if (this.verificationTimeout) {
            clearTimeout(this.verificationTimeout)
            this.verificationTimeout = null
          }

          if (data.length === 0) {
            dbg('PARSE', 'Boş buffer — bekleniyor')
            return
          }

          if (data.length < 2) {
            dbg('PARSE', `Frame çok kısa: ${data.length} byte`)
            cleanup()
            if (this.socket) this.socket.destroy()
            this.socket = null
            const errMsg = 'Cihazdan veri geldi ancak frame çok kısa (< 2 byte).'
            this.updateState({ status: 'error', lastError: errMsg, errorCode: 'ERR_INVALID_FRAME' })
            resolve({ success: false, message: 'ERR_INVALID_FRAME', code: 'ERR_INVALID_FRAME', sentHex, receivedHex })
            return
          }

          const header55AA = (data[0] === 0x55 && data[1] === 0xaa)
          const headerAA55 = (data[0] === 0xaa && data[1] === 0x55)

          if (!header55AA && !headerAA55) {
            dbg('PARSE', `Frame başlığı geçersiz: 0x${data[0].toString(16).toUpperCase()} 0x${data[1].toString(16).toUpperCase()} (beklenen: 55 AA veya AA 55)`)
            cleanup()
            if (this.socket) this.socket.destroy()
            this.socket = null
            const errMsg = `Cihazdan beklenmeyen formatta cevap geldi (frame başlığı: ${data[0].toString(16)} ${data[1].toString(16)}).`
            this.updateState({ status: 'error', lastError: errMsg, errorCode: 'ERR_INVALID_FRAME' })
            resolve({ success: false, message: 'ERR_INVALID_FRAME', code: 'ERR_INVALID_FRAME', sentHex, receivedHex })
            return
          }

          dbg('PARSE', `Frame başlığı geçerli: ${header55AA ? '55 AA' : 'AA 55'}`)

          let parsedModelId: number | null = null
          try {
            if (data.length >= 14) {
              parsedModelId = data.readUInt16LE(12)
              dbg('PARSE', `ModelID: ${parsedModelId} (0x${parsedModelId.toString(16).toUpperCase()}) [bilgi amaçlı]`)
            } else {
              dbg('PARSE', `Frame ModelID okumak için çok kısa (${data.length} byte) — verification yine de başarılı`)
            }
          } catch (e) {
            dbg('PARSE', `ModelID parse hatası: ${e} — verification başarılı`)
          }

          dbg('VERIFY', '✓ Verification BAŞARILI — cihaz VX Pro protokolüne yanıt verdi')
          this.updateState({ status: 'connected_verified', errorCode: undefined })

          // Verification tamamlandı — socket idle timeout'u kapat.
          // Bağlantı açık kalsın; timeout yalnızca bağlantı kurma fazında geçerliydi.
          if (this.socket) {
            this.socket.setTimeout(0)
            dbg('TCP', 'Idle timeout devre dışı bırakıldı — socket kalıcı oturum modunda')
          }

          resolve({ success: true, message: 'Bağlantı doğrulandı', sentHex, receivedHex, parsedModelId })

        // ── Post-verification command response ────────────────────────────
        } else if (this.pendingCommandHandler) {
          const handler = this.pendingCommandHandler
          this.pendingCommandHandler = null
          handler(data)
        }
      })

      // ── SOCKET ERROR ───────────────────────────────────────────────────────
      this.socket.on('error', (err) => {
        const phase = tcpConnected ? 'POST-CONNECT' : 'PRE-CONNECT'
        dbg('ERROR', `[${phase}] Socket hatası: ${err.message} (code: ${(err as NodeJS.ErrnoException).code ?? 'N/A'})`)
        cleanup()
        this.socket = null
        const errMsg = `TCP bağlantısı kurulamadı: ${err.message}`
        this.updateState({ status: 'error', lastError: errMsg, errorCode: 'ERR_TCP_CONNECT' })
        resolve({ success: false, message: 'ERR_TCP_CONNECT', code: 'ERR_TCP_CONNECT' })
      })

      // ── SOCKET TIMEOUT ─────────────────────────────────────────────────────
      // Bu event yalnızca bağlantı kurma fazında (connecting / connected_unverified)
      // anlamlıdır. Verification'dan sonra socket.setTimeout(0) çağrıldığı için
      // bu event normalde hiç tetiklenmez. Savunma amaçlı faz kontrolü eklendi.
      this.socket.on('timeout', () => {
        const currentStatus = this.state.status

        if (currentStatus === 'connected_verified') {
          // Verification sonrası stale timeout — yoksay, bağlantıyı düşürme
          dbg('TIMEOUT', 'Idle timeout event alındı ama bağlantı zaten verified — yoksayılıyor')
          if (this.socket) this.socket.setTimeout(0)  // güvenlik: tekrar kapat
          return
        }

        // Bağlantı kurma fazında timeout — gerçek hata
        dbg('TIMEOUT', `Socket timeout (${timeoutMs}ms) — TCP bağlantısı kurulamadı (status: ${currentStatus})`)
        cleanup()
        if (this.socket) this.socket.destroy()
        this.socket = null
        const errMsg = 'TCP bağlantısı zaman aşımına uğradı. Cihaz kapalı veya IP hatalı olabilir.'
        this.updateState({ status: 'error', lastError: errMsg, errorCode: 'ERR_TCP_CONNECT' })
        resolve({ success: false, message: 'ERR_TCP_CONNECT', code: 'ERR_TCP_CONNECT' })
      })

      // ── CLOSE ──────────────────────────────────────────────────────────────
      this.socket.on('close', (hadError) => {
        dbg('CLOSE', `Socket kapatıldı (hadError=${hadError})`)
        cleanup()
        this.socket = null
        this.pendingCommandHandler = null
        if (this.state.status !== 'error' && this.state.status !== 'connected_verified') {
          this.updateState({ status: 'disconnected' })
        }
      })

      dbg('TCP', `connect() çağrılıyor → ${ipAddress}:15200`)
      this.socket.connect({ host: ipAddress, port: 15200 })
    })
  }

  // ─── setBrightness ────────────────────────────────────────────────────────
  /**
   * Sends a Control Screen Brightness command on the existing TCP connection.
   *
   * @param percent  0–100 (user-facing value)
   * @param timeoutMs  Command response timeout in ms
   */
  public async setBrightness(percent: number, timeoutMs = 3000): Promise<VXProCommandResult> {
    if (!this.socket || this.state.status !== 'connected_verified') {
      dbg('BRIGHTNESS', `setBrightness çağrıldı ama bağlantı yok (status: ${this.state.status})`)
      return { success: false, message: 'Cihaz bağlı değil.', code: 'ERR_NOT_CONNECTED' }
    }

    const deviceValue = percentToDeviceValue(percent)
    const cmd = buildBrightnessCommand(deviceValue)
    const sentHex = toHex(cmd)

    dbg('BRIGHTNESS', `Parlaklık ayarlanıyor: %${percent} → device value: ${deviceValue} (0x${deviceValue.toString(16).toUpperCase()})`)
    dbg('BRIGHTNESS', `→ HEX: ${sentHex}`)

    return new Promise((resolve) => {
      let settled = false

      const settle = (result: VXProCommandResult) => {
        if (settled) return
        settled = true
        resolve(result)
      }

      // Timeout: cihaz cevap vermezse
      const timer = setTimeout(() => {
        this.pendingCommandHandler = null
        dbg('BRIGHTNESS', `Timeout (${timeoutMs}ms) — cihaz parlaklık komutuna cevap vermedi`)
        settle({ success: false, message: 'Cihaz parlaklık komutuna cevap vermedi (timeout).', code: 'ERR_CMD_TIMEOUT', sentHex })
      }, timeoutMs)

      // One-shot response handler
      this.pendingCommandHandler = (data: Buffer) => {
        clearTimeout(timer)
        const receivedHex = toHex(data)
        dbg('BRIGHTNESS', `← HEX: ${receivedHex} (${data.length} bytes)`)

        const { ok, statusByte } = parseBrightnessResponse(data)

        if (ok) {
          dbg('BRIGHTNESS', `✓ Parlaklık başarıyla %${percent} olarak ayarlandı`)
          settle({ success: true, message: `Parlaklık %${percent} olarak ayarlandı.`, sentHex, receivedHex })
        } else {
          const detail = statusByte !== null
            ? `status byte: 0x${statusByte.toString(16).toUpperCase()}`
            : 'geçersiz response formatı'
          dbg('BRIGHTNESS', `✗ Parlaklık hatası — ${detail}`)
          settle({ success: false, message: `Parlaklık ayarlanamadı (${detail}).`, code: 'ERR_CMD_RESPONSE', sentHex, receivedHex })
        }
      }

      // Send the command
      this.socket!.write(cmd)
    })
  }

  // ─── sendCommandOnSocket (private helper) ─────────────────────────────────
  /**
   * Generic send-and-wait for all post-verification commands.
   * Writes cmd to the active socket and resolves when one response arrives.
   */
  private async sendCommandOnSocket(
    cmd: Buffer,
    cmdName: string,
    successMsg: string,
    timeoutMs: number,
  ): Promise<VXProCommandResult> {
    if (!this.socket || this.state.status !== 'connected_verified') {
      dbg(cmdName, `Komut gönderilemedi — bağlantı yok (status: ${this.state.status})`)
      return { success: false, message: 'Cihaz bağlı değil.', code: 'ERR_NOT_CONNECTED' }
    }

    const sentHex = toHex(cmd)
    dbg(cmdName, `→ HEX: ${sentHex}`)

    return new Promise((resolve) => {
      let settled = false
      const settle = (result: VXProCommandResult) => {
        if (settled) return
        settled = true
        resolve(result)
      }

      const timer = setTimeout(() => {
        this.pendingCommandHandler = null
        dbg(cmdName, `Timeout (${timeoutMs}ms) — cihaz yanıtlamadı`)
        settle({ success: false, message: `${cmdName} komutuna cihaz yanıt vermedi (timeout).`, code: 'ERR_CMD_TIMEOUT', sentHex })
      }, timeoutMs)

      this.pendingCommandHandler = (data: Buffer) => {
        clearTimeout(timer)
        const receivedHex = toHex(data)
        dbg(cmdName, `← HEX: ${receivedHex} (${data.length} bytes)`)

        const { ok, statusByte } = parseCommandResponse(data)
        if (ok) {
          dbg(cmdName, `✓ ${successMsg}`)
          settle({ success: true, message: successMsg, sentHex, receivedHex })
        } else {
          const detail = statusByte !== null
            ? `status byte: 0x${statusByte.toString(16).toUpperCase()}`
            : 'geçersiz response formatı'
          dbg(cmdName, `✗ Hata — ${detail}`)
          settle({ success: false, message: `${cmdName} başarısız (${detail}).`, code: 'ERR_CMD_RESPONSE', sentHex, receivedHex })
        }
      }

      this.socket!.write(cmd)
    })
  }

  // ─── setFTB ───────────────────────────────────────────────────────────────
  /**
   * FTB (Fade to Black) aç/kapat.
   * Enable  → byte[18]=0x01
   * Disable → byte[18]=0x00 (ortak Disable Freeze/FTB)
   */
  public async setFTB(enable: boolean, timeoutMs = 3000): Promise<VXProCommandResult> {
    const cmd = buildFTBFreezeCommand(enable ? 0x01 : 0x00)
    dbg('FTB', enable ? 'FTB aktif ediliyor' : 'FTB deaktif ediliyor')
    return this.sendCommandOnSocket(
      cmd, 'FTB',
      enable ? 'FTB aktif edildi (siyah ekran).' : 'FTB deaktif edildi.',
      timeoutMs,
    )
  }

  // ─── setFreeze ────────────────────────────────────────────────────────────
  /**
   * Freeze (görüntü dondurma) aç/kapat.
   * Enable  → byte[18]=0x02
   * Disable → byte[18]=0x00 (ortak Disable Freeze/FTB)
   */
  public async setFreeze(enable: boolean, timeoutMs = 3000): Promise<VXProCommandResult> {
    const cmd = buildFTBFreezeCommand(enable ? 0x02 : 0x00)
    dbg('FREEZE', enable ? 'Freeze aktif ediliyor' : 'Freeze deaktif ediliyor')
    return this.sendCommandOnSocket(
      cmd, 'FREEZE',
      enable ? 'Görüntü donduruldu.' : 'Freeze deaktif edildi.',
      timeoutMs,
    )
  }

  // ─── loadPreset ───────────────────────────────────────────────────────────
  /**
   * Preset yükle.
   * presetIndex: 0–9 (Preset 1–10 olarak gösterilir)
   */
  public async loadPreset(presetIndex: number, timeoutMs = 3000): Promise<VXProCommandResult> {
    const idx = Math.max(0, Math.min(9, presetIndex))
    const cmd = buildLoadPresetCommand(idx)
    dbg('PRESET', `Preset ${idx + 1} yükleniyor (index: 0x${idx.toString(16).toUpperCase()})`)
    return this.sendCommandOnSocket(
      cmd, 'PRESET',
      `Preset ${idx + 1} başarıyla yüklendi.`,
      timeoutMs,
    )
  }

  // ─── disconnect ───────────────────────────────────────────────────────────

  public disconnect(): { success: boolean } {
    dbg('DISCONNECT', 'Bağlantı kapatılıyor')
    if (this.verificationTimeout) {
      clearTimeout(this.verificationTimeout)
      this.verificationTimeout = null
    }
    this.pendingCommandHandler = null
    if (this.socket) {
      this.socket.destroy()
      this.socket = null
    }
    this.updateState({ status: 'disconnected', ipAddress: undefined, errorCode: undefined })
    return { success: true }
  }
}

// Singleton export
export const vxProConnectionService = new VXProConnectionService()
