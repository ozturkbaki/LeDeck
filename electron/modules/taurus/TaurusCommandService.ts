/**
 * TaurusCommandService — API Command Queue
 *
 * TB/TCC serisi için HTTPS API komut kuyruğu.
 * Tüm komutlar sıralı olarak çalışır (paralel gönderim yok).
 */

import { TaurusConnection } from './TaurusConnection'
import { TaurusException, TAURUS_ERROR_CODES } from './TaurusException'

export interface CommandResult<T = unknown> {
  success:  boolean
  message?: string
  data?:    T
  code?:    number
}

export class TaurusCommandService {
  private queue: Promise<any> = Promise.resolve()

  constructor(private readonly connection: TaurusConnection) {}

  // ─── Queue wrapper ────────────────────────────────────────────────────────

  private enqueue<T>(task: () => Promise<CommandResult<T>>): Promise<CommandResult<T>> {
    const next = this.queue.then(task).catch(async (err) => {
      if (err instanceof TaurusException) {
        return { success: false, message: err.message, code: err.code }
      }
      return { success: false, message: String(err) }
    })
    this.queue = next.catch(() => {})
    return next
  }

  // ─── Device Base Info ─────────────────────────────────────────────────────

  async getBaseInfo(): Promise<CommandResult> {
    return this.enqueue(async () => {
      const data = await this.connection.getBaseInfo()
      return { success: true, data }
    })
  }

  // ─── Sender Card Info ─────────────────────────────────────────────────────

  async getSenderCardInfo(): Promise<CommandResult> {
    return this.enqueue(async () => {
      try {
        // 1. Dokümantasyon: Gönderici kart temel bilgileri
        const senderResp = await this.connection.request<{
          status?: boolean; signalSource?: string; networkPortsNum?: string;
          version?: string; sn?: string; mac?: string; timeZone?: string; reportTime?: string;
        }>('GET', '/terminal/core/v1/sendercard/base-info').catch(() => ({ code: -1, data: {} }))

        // 2. Sistem Versiyon Bilgileri (Public)
        const verResp = await this.connection.request<{
          aliasName?: string; productName?: string; androidVersion?: string;
          osVersion?: string; platform?: string; mainVersion?: string;
          model?: string; mac?: string; wlanMac?: string;
        }>('GET', '/terminal/core/v1/version').catch(() => null)

        // 3. Donanım ve Çalışma Bilgileri (TCC Serisi için kritik)
        const hwInfoResp = await this.connection.request<{
          configInfo?: { displayDevice?: string; portConfig?: any[] };
          productInfo?: { productName?: string; modelId?: number };
          runningInfo?: { runningTime?: number };
        }>('GET', '/terminal/core/v1/support/function/product/device/info').catch(() => null)

        const sData = senderResp.data || {}
        const vData = verResp?.data || {}
        const hData = hwInfoResp?.data || {}

        const formattedData = {
          // Temel Tanımlama
          sn:              sData.sn || vData.sn || '',
          productName:     vData.productName || hData.productInfo?.productName || '',
          aliasName:       vData.aliasName || '',
          model:           vData.model || '',
          mac:             sData.mac || vData.mac || '',
          
          // Durum ve Versiyon
          status:          sData.status ?? true,
          version:         sData.version || vData.mainVersion || vData.osVersion || '',
          osVersion:       vData.osVersion || '',
          platform:        vData.platform || '',
          
          // Donanım Detayları (hwInfo'dan gelenler)
          displayDevice:   hData.configInfo?.displayDevice || '—',
          runningTime:     hData.runningInfo?.runningTime ? Math.floor(hData.runningInfo.runningTime / 1000) : 0, // saniye cinsinden
          networkPortsNum: sData.networkPortsNum || (hData.configInfo?.portConfig ? String(hData.configInfo.portConfig.length) : '—'),
          
          // Sinyal ve Zaman (sendercard/base-info'dan gelenler - gelmeyebilir)
          signalSource:    sData.signalSource || null, 
          timeZone:        sData.timeZone || null,
          reportTime:      sData.reportTime || null,
        }

        return { success: true, data: formattedData }
      } catch (err: any) {
        throw new TaurusException(`getSenderCardInfo: ${err.msg || err.message || 'Hata'}`, TAURUS_ERROR_CODES.COMMAND_FAILED)
      }
    })
  }

  // ─── Brightness ───────────────────────────────────────────────────────────

  /** Parlaklık oku (0-100 arası ratio) */
  async getBrightness(): Promise<CommandResult<{ ratio: number; brightness: number }>> {
    return this.enqueue(async () => {
      const resp = await this.connection.request<{ ratio: number; brightness: number }>(
        'GET', '/terminal/core/v1/brightness'
      )
      if (resp.code !== 0) throw new TaurusException(`getBrightness: ${resp.msg || resp.message}`, TAURUS_ERROR_CODES.COMMAND_FAILED)
      return { success: true, data: resp.data }
    })
  }

  /** Parlaklık ayarla (ratio: 0.0–100.0) */
  async setBrightness(ratio: number): Promise<CommandResult> {
    return this.enqueue(async () => {
      const brightness = Math.round((ratio / 100) * 255)
      const resp = await this.connection.request('POST', '/terminal/core/v1/brightness', {
        ratio, brightness, solidity: true
      })
      if (resp.code !== 0) throw new TaurusException(`setBrightness: ${resp.msg || resp.message}`, TAURUS_ERROR_CODES.COMMAND_FAILED)
      return { success: true }
    })
  }

  // ─── Volume ───────────────────────────────────────────────────────────────

  async getVolume(): Promise<CommandResult<{ ratio: number; volume: number }>> {
    return this.enqueue(async () => {
      const resp = await this.connection.request<{ ratio: number; volume: number }>(
        'GET', '/terminal/core/v1/audio/volume'
      )
      if (resp.code !== 0) throw new TaurusException(`getVolume: ${resp.msg || resp.message}`, TAURUS_ERROR_CODES.COMMAND_FAILED)
      return { success: true, data: resp.data }
    })
  }

  async setVolume(ratio: number): Promise<CommandResult> {
    return this.enqueue(async () => {
      const volume = Math.round(ratio)
      const resp = await this.connection.request('POST', '/terminal/core/v1/audio/volume', {
        ratio, volume
      })
      if (resp.code !== 0) throw new TaurusException(`setVolume: ${resp.msg || resp.message}`, TAURUS_ERROR_CODES.COMMAND_FAILED)
      return { success: true }
    })
  }

  // ─── Screen Power ─────────────────────────────────────────────────────────

  async setScreenPower(on: boolean): Promise<CommandResult> {
    return this.enqueue(async () => {
      const resp = await this.connection.request('POST', '/terminal/core/v1/screen/power/status', {
        state: on ? 'OPEN' : 'CLOSE'
      })
      if (resp.code !== 0) throw new TaurusException(`setScreenPower: ${resp.msg || resp.message}`, TAURUS_ERROR_CODES.COMMAND_FAILED)
      return { success: true }
    })
  }

  async getScreenPower(): Promise<CommandResult<{ state: string }>> {
    return this.enqueue(async () => {
      const resp = await this.connection.request<{ state: string }>(
        'GET', '/terminal/core/v1/screen/power/status'
      )
      if (resp.code !== 0) throw new TaurusException(`getScreenPower: ${resp.msg || resp.message}`, TAURUS_ERROR_CODES.COMMAND_FAILED)
      return { success: true, data: resp.data }
    })
  }

  // ─── Screenshot ───────────────────────────────────────────────────────────

  async getScreenshot(width = 256, height = 256): Promise<CommandResult<{ path: string }>> {
    return this.enqueue(async () => {
      const resp = await this.connection.request<{ path: string }>(
        'GET',
        `/terminal/core/v1/device/screenshot?width=${width}&height=${height}&type=JPG`,
      )
      if (resp.code !== 0) throw new TaurusException(`screenshot: ${resp.msg || resp.message}`, TAURUS_ERROR_CODES.COMMAND_FAILED)
      return { success: true, data: resp.data }
    })
  }

  /** Ekran görüntüsü alır ve frontend'e base64 olarak döner */
  async captureScreenshot(width = 1024, height = 1024): Promise<CommandResult<{ base64: string }>> {
    return this.enqueue(async () => {
      // 1. Ekran görüntüsü talebi at
      const ssResp = await this.connection.request<{ path: string }>(
        'GET',
        `/terminal/core/v1/device/screenshot?width=${width}&height=${height}&type=JPG`,
      )
      if (ssResp.code !== 0 || !ssResp.data?.path) {
        throw new TaurusException(`Screenshot API hatası: ${ssResp.msg}`, TAURUS_ERROR_CODES.COMMAND_FAILED)
      }

      // 2. Cihazın dosyayı yazması için kısa bir bekleme (500ms)
      await new Promise(r => setTimeout(r, 500))

      // 3. Dosyayı indir
      try {
        const filePath = ssResp.data.path
        const buffer = await this.connection.requestRaw(`/terminal/tools/v1/file/download?filePath=${encodeURIComponent(filePath)}`)
        
        return { 
          success: true, 
          data: { base64: `data:image/jpeg;base64,${buffer.toString('base64')}` }
        }
      } catch (err: any) {
        throw new TaurusException(`Dosya indirme hatası: ${err.message}`, TAURUS_ERROR_CODES.COMMAND_FAILED)
      }
    })
  }

  // ─── Screen / Receiving Card Info ──────────────────────────────────────────

  /** Ekran ve Alıcı Kart bağlantı bilgisini getirir */
  async getScreenInfo(): Promise<CommandResult<{ receiveCardRegionInfo?: any[] }>> {
    return this.enqueue(async () => {
      const resp = await this.connection.request<{ receiveCardRegionInfo?: any[] }>(
        'GET', '/terminal/core/v1/receivecard/link-info'
      )
      if (resp.code !== 0) {
        throw new TaurusException(`getScreenInfo: ${resp.msg || resp.message}`, TAURUS_ERROR_CODES.COMMAND_FAILED)
      }
      return { success: true, data: resp.data }
    })
  }

  // ─── Reboot ───────────────────────────────────────────────────────────────
  // Doğrulanmış endpoint: POST /terminal/core/v1/device/reboot (boş body)

  async reboot(_reason = 'user request'): Promise<CommandResult> {
    return this.enqueue(async () => {
      console.log('[TaurusCommand] Reboot gönderiliyor: POST /terminal/core/v1/device/reboot')
      const resp = await this.connection.request('POST', '/terminal/core/v1/device/reboot', {})
      console.log(`[TaurusCommand] Reboot yanıt: code=${resp.code} msg=${resp.msg || resp.message || ''}`)

      if (resp.code === 0) {
        console.log('[TaurusCommand] Reboot başarılı ✓')
        return { success: true }
      }

      throw new TaurusException(
        `Reboot başarısız: ${resp.msg || resp.message || 'Bilinmeyen hata'} (code ${resp.code})`,
        TAURUS_ERROR_CODES.COMMAND_FAILED
      )
    })
  }

  // ─── Generic sendCommand dispatcher ──────────────────────────────────────

  async sendCommand(commandName: string, params?: Record<string, unknown>): Promise<CommandResult> {
    switch (commandName) {
      case 'getBaseInfo':      return this.getBaseInfo()
      case 'getSenderCardInfo':return this.getSenderCardInfo()
      case 'getScreenInfo':    return this.getScreenInfo()
      case 'getBrightness':    return this.getBrightness()
      case 'setBrightness':    return this.setBrightness((params?.ratio as number) ?? 100)
      case 'getVolume':        return this.getVolume()
      case 'setVolume':        return this.setVolume((params?.ratio as number) ?? 50)
      case 'setScreenPower':   return this.setScreenPower((params?.on as boolean) ?? true)
      case 'getScreenPower':   return this.getScreenPower()
      case 'getScreenshot':    return this.getScreenshot()
      case 'captureScreenshot':return this.captureScreenshot(params?.width as number, params?.height as number)
      case 'reboot':           return this.reboot((params?.reason as string) ?? 'User requested reboot')
      default:
        return { success: false, message: `Bilinmeyen komut: ${commandName}`, code: TAURUS_ERROR_CODES.COMMAND_FAILED }
    }
  }
}
