import { HSeriesConnection } from './HSeriesConnection'
import { HSeriesProtocolBuilder } from './HSeriesProtocolBuilder'
import { HSeriesParser, HParsedResponse, HDeviceDetails, HScreenDetails, HPresetList, HLayerEnum, HLayerDetails } from './HSeriesParser'
import { HSeriesException, H_ERROR_CODES } from './HSeriesException'

/**
 * HSeriesCommandService
 *
 * H Series cihazına yönelik tüm yüksek seviyeli komutları yönetir.
 *
 * ÖNEMLİ — COMMAND QUEUE:
 *   H Series cihazı aynı anda yalnızca tek komut işleyebilir.
 *   Bu nedenle tüm komutlar bir Promise zinciri üzerinden sırayla çalıştırılır.
 *   Yeni komut, önceki komut tamamlanmadan gönderilmez.
 *
 * Her komut için:
 *   - Maksimum 1 saniye timeout uygulanır (HSeriesConnection katmanında)
 *   - Bu fazda retry yapılmaz
 *   - Başarı / hata / timeout net olarak döndürülür
 */

/** Komut sonucu — UI'a iletilen net durum */
export interface HCommandResult {
  /** 'ok' | 'error' | 'timeout' | 'invalid' */
  status: 'ok' | 'error' | 'timeout' | 'invalid'
  /** Kullanıcıya gösterilecek mesaj */
  message: string
  /** Parse edilmiş veri (varsa) */
  data?: unknown
  /** Gönderilen ham JSON komutu (debug için) */
  sentCommand?: string
  /** Cihazdan gelen ham yanıt (debug için) */
  rawResponse?: string
  /** Parse sonucu (debug için) */
  parsedResult?: HParsedResponse
}

export class HSeriesCommandService {
  /**
   * Command queue — Promise zinciri olarak tutulur.
   * Her yeni komut, mevcut zincirin sonuna eklenir.
   */
  private commandQueue: Promise<void> = Promise.resolve()

  constructor(
    private readonly connection: HSeriesConnection,
    private readonly builder: HSeriesProtocolBuilder,
    private readonly parser: HSeriesParser,
  ) {}

  // ─── Dahili queue mekanizması ─────────────────────────────────────────────

  /**
   * Komutu sıraya ekler ve önceki komut bitene kadar bekler.
   * Tüm public metodlar bu fonksiyon üzerinden çalışır.
   */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.commandQueue.then(() => task())
    // Hata olsa bile queue devam etsin
    this.commandQueue = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  /**
   * Bağlantı kontrolü yapar, ardından komutu gönderir ve parse eder.
   */
  private async executeCommand(jsonCommand: string): Promise<HCommandResult> {
    if (!this.connection.isConnected()) {
      return {
        status: 'error',
        message: 'Cihaz bağlı değil',
        sentCommand: jsonCommand,
      }
    }

    let rawResponse: string | undefined
    let parsedResult: HParsedResponse | undefined

    try {
      // Komutu gönder
      rawResponse = await this.connection.send(jsonCommand)

      // Parse et
      parsedResult = HSeriesParser.parse(rawResponse)

      // Parsed log
      console.log(`[H Series] Parse sonucu: status=${parsedResult.status}`, parsedResult)

      if (parsedResult.status === 'ok') {
        return {
          status: 'ok',
          message: 'Komut başarılı',
          data: parsedResult.raw,
          sentCommand: jsonCommand,
          rawResponse,
          parsedResult,
        }
      } else {
        return {
          status: parsedResult.status,
          message: parsedResult.errorMessage ?? 'Bilinmeyen hata',
          sentCommand: jsonCommand,
          rawResponse,
          parsedResult,
        }
      }
    } catch (err) {
      // Timeout veya soket hatası
      const isTimeout = err instanceof HSeriesException && err.code === H_ERROR_CODES.COMMAND_TIMEOUT

      const status: HCommandResult['status'] = isTimeout ? 'timeout' : 'error'
      const message = err instanceof Error ? err.message : String(err)

      console.error(`[H Series] Komut hatası (${status}): ${message}`)

      return {
        status,
        message,
        sentCommand: jsonCommand,
        rawResponse,
        parsedResult,
      }
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Get Device Details — R0100
   * Cihazın model, MAC, fan, güç, kart bilgilerini döndürür.
   */
  async getDeviceDetails(): Promise<HCommandResult & { deviceDetails?: HDeviceDetails }> {
    const cmd = HSeriesProtocolBuilder.buildGetDeviceDetails()
    return this.enqueue(async () => {
      const result = await this.executeCommand(cmd)
      if (result.status === 'ok' && result.parsedResult) {
        const deviceDetails = HSeriesParser.extractDeviceDetails(result.parsedResult)
        return { ...result, deviceDetails: deviceDetails ?? undefined }
      }
      return result
    })
  }

  /**
   * Get Screen Details — R0401
   * Ekranın parlaklık, kontrast ve genel ayarlarını döndürür.
   */
  async getScreenDetails(): Promise<HCommandResult & { screenDetails?: HScreenDetails }> {
    const cmd = HSeriesProtocolBuilder.buildGetScreenDetails()
    return this.enqueue(async () => {
      const result = await this.executeCommand(cmd)
      if (result.status === 'ok' && result.parsedResult) {
        const screenDetails = HSeriesParser.extractScreenDetails(result.parsedResult)
        return { ...result, screenDetails: screenDetails ?? undefined }
      }
      return result
    })
  }

  /**
   * Get Preset List — R0600
   * Ekranın mevcut preset listesini (id + isim) döndürür.
   */
  async getPresetList(): Promise<HCommandResult & { presetList?: HPresetList }> {
    const cmd = HSeriesProtocolBuilder.buildGetPresetList()
    return this.enqueue(async () => {
      const result = await this.executeCommand(cmd)
      if (result.status === 'ok' && result.parsedResult) {
        const presetList = HSeriesParser.extractPresetList(result.parsedResult)
        return { ...result, presetList: presetList ?? undefined }
      }
      return result
    })
  }

  /**
   * Load Preset — W0605
   * Belirtilen preset'i aktif ekrana yükler.
   *
   * @param presetId - Preset ID (0-indexed, R0600 yanıtından alınır)
   */
  async loadPreset(presetId: number): Promise<HCommandResult> {
    const cmd = HSeriesProtocolBuilder.buildLoadPreset(presetId)
    return this.enqueue(() => this.executeCommand(cmd))
  }

  /**
   * Genel komut gönderici (legacy IPC uyumluluğu için korundu)
   * Yeni kodlarda spesifik metodları kullan.
   */
  async sendCommand(command: string, params?: Record<string, unknown>): Promise<{ success: boolean; message?: string; data?: unknown }> {
    // Legacy uyumluluk: komut string'ini doğrudan JSON olarak gönder
    const jsonCommand = JSON.stringify([{ cmd: command, ...params }])
    const result = await this.enqueue(() => this.executeCommand(jsonCommand))
    return {
      success: result.status === 'ok',
      message: result.message,
      data: result.data,
    }
  }

  // ─── Control Komutları ──────────────────────────────────────────────────────────────

  /**
   * Get Screen Layer Enum — R0500
   * Ekrandaki tüm layer'ların listesini döndürür.
   */
  async getLayerEnum(): Promise<HCommandResult & { layerEnum?: HLayerEnum }> {
    const cmd = HSeriesProtocolBuilder.buildGetLayerEnum()
    return this.enqueue(async () => {
      const result = await this.executeCommand(cmd)
      if (result.status === 'ok' && result.parsedResult) {
        const layerEnum = HSeriesParser.extractLayerEnum(result.parsedResult)
        return { ...result, layerEnum: layerEnum ?? undefined }
      }
      return result
    })
  }

  /**
   * Get Screen Layer Details — R0501
   * Belirtilen layer'a ait detay bilgilerini döndürür.
   *
   * @param layerId - Layer ID (R0500 yanıtından alınır)
   */
  async getLayerDetails(layerId: number): Promise<HCommandResult & { layerDetails?: HLayerDetails }> {
    const cmd = HSeriesProtocolBuilder.buildGetLayerDetails(layerId)
    return this.enqueue(async () => {
      const result = await this.executeCommand(cmd)
      if (result.status === 'ok' && result.parsedResult) {
        const layerDetails = HSeriesParser.extractLayerDetails(result.parsedResult)
        return { ...result, layerDetails: layerDetails ?? undefined }
      }
      return result
    })
  }

  /**
   * Adjust Screen Brightness — W0410
   * Ekran par laklığını 0–100 arasında ayarlar.
   *
   * @param brightness - 0–100 değer
   */
  async setBrightness(brightness: number): Promise<HCommandResult> {
    const clamped = Math.max(0, Math.min(100, Math.round(brightness)))
    const cmd = HSeriesProtocolBuilder.buildSetBrightness(clamped)
    return this.enqueue(() => this.executeCommand(cmd))
  }

  /**
   * Freeze the Screen — W040A
   * Ekranı dondurur veya çözer.
   *
   * @param enable - 0: Unfreeze, 1: Freeze
   */
  async setFreeze(enable: 0 | 1): Promise<HCommandResult> {
    const cmd = HSeriesProtocolBuilder.buildSetFreeze(enable)
    return this.enqueue(() => this.executeCommand(cmd))
  }

  /**
   * Set Screen FTB (Fade to Black) — W0409
   * Ekranı siyaha düşürür veya normal görüntüye döndürür.
   *
   * NOT: Freeze'den farklıdır. FTB ekranı siyaha götürür,
   *      Freeze görüntüyü dondurur ama siyahlatmaz.
   *
   * @param type - 0: Siyah ekran (FTB aktif), 1: Normal görüntü
   */
  async setFTB(type: 0 | 1): Promise<HCommandResult> {
    const cmd = HSeriesProtocolBuilder.buildSetFTB(type)
    return this.enqueue(() => this.executeCommand(cmd))
  }
}
