import { EventEmitter } from 'events'
import net from 'net'

/**
 * TaurusWatcher — Hafif İstek (Polling) Servisi
 * 
 * Bu servis, cihazın TCP portunu (16674) doğrudan yoklar.
 * Avantajları:
 *  - Komut kuyruğuna (CommandService) girmez, trafikten bağımsızdır.
 *  - Cihazı yormaz, login/token gerektirmez.
 *  - Cihaz kapandığı veya ağdan düştüğü anda (timeout) anında tespit eder.
 */
export class TaurusWatcher extends EventEmitter {
  private pollIntervalMs = 5000
  private failCount = 0
  private readonly MAX_FAILS = 2
  private running = false
  private interval: NodeJS.Timeout | null = null

  constructor(
    public readonly sessionId: string,
    private readonly ip: string,
    private readonly port: number = 16674
  ) {
    super()
  }

  start() {
    if (this.running) return
    this.running = true
    this.failCount = 0
    console.log(`[TaurusWatcher] Hafif izleme başlatıldı: ${this.ip}:${this.port} (Session: ${this.sessionId})`)
    this.scheduleNext()
  }

  stop() {
    this.running = false
    if (this.interval) {
      clearTimeout(this.interval)
      this.interval = null
    }
    console.log(`[TaurusWatcher] İzleme durduruldu: ${this.sessionId}`)
  }

  private scheduleNext() {
    if (!this.running) return
    this.interval = setTimeout(() => this.check(), this.pollIntervalMs)
  }

  private async check() {
    if (!this.running) return

    const socket = new net.Socket()
    let resolved = false

    const done = (isSuccess: boolean, msg?: string) => {
      if (resolved) return
      resolved = true
      socket.destroy()
      
      if (isSuccess) {
        if (this.failCount > 0) {
          console.log(`[TaurusWatcher] Bağlantı geri geldi: ${this.sessionId}`)
          this.emit('reconnected', { sessionId: this.sessionId })
        }
        this.failCount = 0
      } else {
        console.warn(`[TaurusWatcher] Hafif kontrol BAŞARISIZ: ${msg} (${this.sessionId})`)
        this.handleFailure()
      }
      this.scheduleNext()
    }

    socket.setTimeout(2000) // 2 saniye timeout
    socket.on('connect', () => done(true))
    socket.on('error', (err) => done(false, err.message))
    socket.on('timeout', () => done(false, 'Zaman aşımı (TCP)'))

    socket.connect(this.port, this.ip)
  }

  private handleFailure() {
    this.failCount++
    if (this.failCount >= this.MAX_FAILS) {
      console.error(`[TaurusWatcher] Bağlantı koptu! (${this.failCount}/${this.MAX_FAILS})`)
      this.emit('disconnected', { 
        sessionId: this.sessionId, 
        message: 'Cihaz ile bağlantı kesildi.' 
      })
    }
  }
}
