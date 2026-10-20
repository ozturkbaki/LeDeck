import dgram from 'dgram'
import { HSeriesException, H_ERROR_CODES } from './HSeriesException'

/**
 * HSeriesConnection
 *
 * H Series cihazları ile UDP iletişimini yönetir.
 *
 * Protokol referansı: Section 1.1 — UDP Communication
 *   "The PC sends a UDP message to port 6000 on the video wall splicer."
 *   "Each command is sent in a UDP packet."
 *
 * Port: Sabit olarak 6000 kullanılır. Kullanıcıdan alınmaz.
 * Timeout: Her komut için maksimum 1000ms beklenir.
 */

/** UDP port — protokolden alınan sabit değer */
export const H_SERIES_UDP_PORT = 6000

/** Komut timeout süresi (ms) */
const COMMAND_TIMEOUT_MS = 1000

export interface HConnectionConfig {
  ipAddress: string
  /** Port kullanıcı tarafından girilmez; sabit H_SERIES_UDP_PORT kullanılır */
  timeoutMs?: number
}

export interface HConnectionResult {
  success: boolean
  message: string
  deviceInfo?: Record<string, unknown>
}

export class HSeriesConnection {
  /** Aktif UDP soketi */
  private socket: dgram.Socket | null = null
  private config: HConnectionConfig | null = null
  private _connected = false

  /**
   * UDP soketi oluşturur ve R0100 göndererek bağlantıyı doğrular.
   * UDP'de gerçek bağlantı kavramı yoktur; cihazın cevap verip vermediği
   * test edilerek "bağlı" kabul edilir.
   */
  async connect(config: HConnectionConfig): Promise<HConnectionResult> {
    this.config = config

    // Önceki soketi temizle
    this._cleanupSocket()

    return new Promise((resolve) => {
      const socket = dgram.createSocket('udp4')
      let resolved = false

      /**
       * Her komut için aynı soketi yeniden kullanırız.
       * Bu nedenle message listener'ı komut bazında eklenir/kaldırılır.
       * Burada bağlantı doğrulama amacıyla R0100 gönderiyoruz.
       */
      const timeoutHandle = setTimeout(() => {
        if (!resolved) {
          resolved = true
          // Soketi kapat, bağlantı başarısız
          socket.close()
          resolve({
            success: false,
            message: `Bağlantı zaman aşımı: ${config.ipAddress}:${H_SERIES_UDP_PORT} cevap vermedi (${COMMAND_TIMEOUT_MS}ms)`,
          })
        }
      }, COMMAND_TIMEOUT_MS)

      // R0100 — Get Device Details (bağlantı doğrulama için)
      const pingCommand = JSON.stringify([{ cmd: 'R0100', param0: 0 }])
      const pingBuffer = Buffer.from(pingCommand, 'utf-8')

      socket.on('message', (msg) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeoutHandle)

          // Cihaz cevap verdi → bağlantı başarılı
          this.socket = socket
          this._connected = true

          // Raw cevabı parse et
          let deviceInfo: Record<string, unknown> | undefined
          try {
            const parsed = JSON.parse(msg.toString('utf-8'))
            if (Array.isArray(parsed) && parsed.length > 0) {
              deviceInfo = parsed[0] as Record<string, unknown>
            }
          } catch { /* parse hatası bağlantıyı etkilemiyor */ }

          console.log(`[H Series] Bağlantı başarılı: ${config.ipAddress}:${H_SERIES_UDP_PORT}`)

          resolve({
            success: true,
            message: 'Bağlantı başarılı',
            deviceInfo,
          })
        }
      })

      socket.on('error', (err) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeoutHandle)
          resolve({
            success: false,
            message: `UDP soket hatası: ${err.message}`,
          })
        }
      })

      // Soketi aç ve komutu gönder
      socket.bind(() => {
        socket.send(pingBuffer, 0, pingBuffer.length, H_SERIES_UDP_PORT, config.ipAddress, (err) => {
          if (err && !resolved) {
            resolved = true
            clearTimeout(timeoutHandle)
            socket.close()
            resolve({
              success: false,
              message: `Komut gönderilemedi: ${err.message}`,
            })
          }
        })
      })
    })
  }

  /**
   * Bağlantıyı test eder (bağlantıyı kalıcı tutmaz).
   * R0100 gönderir, cevap gelirse başarılı sayar.
   */
  async testConnection(config: HConnectionConfig): Promise<HConnectionResult> {
    return new Promise((resolve) => {
      const socket = dgram.createSocket('udp4')
      let resolved = false

      const timeoutHandle = setTimeout(() => {
        if (!resolved) {
          resolved = true
          socket.close()
          resolve({
            success: false,
            message: `Test bağlantısı zaman aşımı: ${config.ipAddress}:${H_SERIES_UDP_PORT} cevap vermedi (${COMMAND_TIMEOUT_MS}ms)`,
          })
        }
      }, COMMAND_TIMEOUT_MS)

      const pingCommand = JSON.stringify([{ cmd: 'R0100', param0: 0 }])
      const pingBuffer = Buffer.from(pingCommand, 'utf-8')

      socket.on('message', (msg) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeoutHandle)
          socket.close()

          let deviceInfo: Record<string, unknown> | undefined
          try {
            const parsed = JSON.parse(msg.toString('utf-8'))
            if (Array.isArray(parsed) && parsed.length > 0) {
              deviceInfo = parsed[0] as Record<string, unknown>
            }
          } catch { /* yoksay */ }

          console.log(`[H Series] Test bağlantısı başarılı: ${config.ipAddress}`)
          resolve({ success: true, message: 'Cihaz erişilebilir', deviceInfo })
        }
      })

      socket.on('error', (err) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeoutHandle)
          resolve({ success: false, message: `UDP hata: ${err.message}` })
        }
      })

      socket.bind(() => {
        socket.send(pingBuffer, 0, pingBuffer.length, H_SERIES_UDP_PORT, config.ipAddress, (err) => {
          if (err && !resolved) {
            resolved = true
            clearTimeout(timeoutHandle)
            socket.close()
            resolve({ success: false, message: `Gönderi hatası: ${err.message}` })
          }
        })
      })
    })
  }

  /**
   * Mevcut soket üzerinden JSON komut gönderir ve yanıt string'i döndürür.
   *
   * @param jsonCommand - HSeriesProtocolBuilder tarafından üretilen JSON string
   * @returns Ham yanıt string'i
   * @throws HSeriesException — timeout veya soket hatası
   */
  async send(jsonCommand: string): Promise<string> {
    if (!this.socket || !this._connected) {
      throw new HSeriesException('UDP soketi bağlı değil', H_ERROR_CODES.CONNECTION_FAILED)
    }

    const socket = this.socket
    const ipAddress = this.config!.ipAddress

    // Outgoing log
    console.log(`[H Series] → Gönderilen komut: ${jsonCommand}`)

    return new Promise((resolve, reject) => {
      let resolved = false

      const timeoutHandle = setTimeout(() => {
        if (!resolved) {
          resolved = true
          socket.removeListener('message', onMessage)
          reject(new HSeriesException(
            `Komut zaman aşımı (${COMMAND_TIMEOUT_MS}ms): ${jsonCommand}`,
            H_ERROR_CODES.COMMAND_TIMEOUT
          ))
        }
      }, COMMAND_TIMEOUT_MS)

      const onMessage = (msg: Buffer) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeoutHandle)
          socket.removeListener('message', onMessage)
          const rawStr = msg.toString('utf-8')
          // Raw response log
          console.log(`[H Series] ← Ham yanıt: ${rawStr}`)
          resolve(rawStr)
        }
      }

      socket.on('message', onMessage)

      const buffer = Buffer.from(jsonCommand, 'utf-8')
      socket.send(buffer, 0, buffer.length, H_SERIES_UDP_PORT, ipAddress, (err) => {
        if (err && !resolved) {
          resolved = true
          clearTimeout(timeoutHandle)
          socket.removeListener('message', onMessage)
          reject(new HSeriesException(`Gönderim hatası: ${err.message}`, H_ERROR_CODES.SEND_FAILED, err))
        }
      })
    })
  }

  /** UDP soketini kapatır */
  disconnect(): void {
    this._cleanupSocket()
    this._connected = false
  }

  isConnected(): boolean {
    return this._connected && this.socket !== null
  }

  getConfig(): HConnectionConfig | null {
    return this.config
  }

  private _cleanupSocket(): void {
    if (this.socket) {
      try { this.socket.close() } catch { /* zaten kapalıysa yoksay */ }
      this.socket = null
    }
    this._connected = false
  }
}
