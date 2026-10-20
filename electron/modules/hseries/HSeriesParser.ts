/**
 * HSeriesParser
 *
 * H Series cihazlarından gelen UDP yanıtlarını parse eder.
 *
 * Protokole göre üç olası durum vardır:
 *   1. ack == "Ok"    → Başarılı
 *   2. ack == "Error" → Hata (komut desteklenmiyor veya format hatalı)
 *   3. Yanıt yok      → Timeout (üst katman tarafından tespit edilir)
 *
 * Bu parser yalnızca (1) ve (2) durumlarını işler.
 * Timeout durumu CommandService katmanında yönetilir.
 *
 * KURAL: Yalnızca paylaşılan protokol bölümlerine göre parse et.
 */

// ─── Temel parse sonucu ───────────────────────────────────────────────────────

export type HResponseStatus = 'ok' | 'error' | 'timeout' | 'invalid'

export interface HParsedResponse {
  /** İşlem sonucu: ok | error | timeout | invalid */
  status: HResponseStatus
  /** Cihazdan dönen cmd değeri */
  cmd?: string
  /** Ham JSON nesnesi (tüm alanlar) */
  raw?: Record<string, unknown>
  /** Hata veya timeout açıklaması */
  errorMessage?: string
}

// ─── Spesifik response tipleri ────────────────────────────────────────────────

export interface HDeviceDetails {
  deviceId: number
  modelId?: number
  name?: string
  status?: number           // 0: busy, 1: ready
  protoVersion?: string
  MAC?: string
  volt?: number             // 0: normal, 1: abnormal
  temp?: number             // 0: normal, 1: abnormal
  extSignal?: number
  dataVersion?: number
  slotList?: unknown[]
  powerList?: unknown[]
  fanList?: unknown[]
  network?: unknown
  usbStatus?: unknown[]
}

export interface HScreenDetails {
  deviceId: number
  screenId: number
  brightness?: number
  gamma?: number
  general?: { name?: string; createTime?: string }
}

export interface HPreset {
  presetId: number
  name: string
}

export interface HPresetList {
  deviceId: number
  screenId: number
  presets: HPreset[]
}

/** R0500 — Layer listesi öğesi */
export interface HLayerItem {
  layerId: number
  name: string
}

/** R0500 yanıtı */
export interface HLayerEnum {
  deviceId: number
  screenId: number
  layers: HLayerItem[]
}

/** R0501 — Layer detayları */
export interface HLayerDetails {
  deviceId: number
  screenId: number
  layerId: number
  name?: string
  /** Kaynak girişi bilgisi */
  inputId?: number
  /** Arayüz tipi */
  interfaceType?: number
  /** Pencere konumu ve boyutu */
  window?: {
    x?: number
    y?: number
    width?: number
    height?: number
  }
  /** Tüm ham veri (ileri analiz için) */
  raw?: Record<string, unknown>
}

// ─── Parser Sınıfı ────────────────────────────────────────────────────────────

export class HSeriesParser {

  /**
   * Ham UDP yanıt string'ini parse eder.
   * Tüm H Series yanıtları JSON array formatındadır: [{...}]
   *
   * @param rawResponse - Cihazdan gelen ham string
   * @returns HParsedResponse
   */
  static parse(rawResponse: string): HParsedResponse {
    // Boş yanıt
    if (!rawResponse || rawResponse.trim() === '') {
      return {
        status: 'invalid',
        errorMessage: 'Boş yanıt alındı',
      }
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(rawResponse)
    } catch (e) {
      return {
        status: 'invalid',
        errorMessage: `JSON parse hatası: ${String(e)}`,
      }
    }

    // Protokol: yanıt bir array, ilk eleman komut objesini içerir
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return {
        status: 'invalid',
        errorMessage: 'Yanıt beklenen array formatında değil',
      }
    }

    const responseObj = parsed[0] as Record<string, unknown>

    // ack alanını case-insensitive kontrol et (protokol: "All characters are case insensitive")
    const ack = typeof responseObj['ack'] === 'string'
      ? (responseObj['ack'] as string).toLowerCase()
      : undefined

    const cmd = typeof responseObj['cmd'] === 'string'
      ? (responseObj['cmd'] as string)
      : undefined

    if (ack === 'ok') {
      return {
        status: 'ok',
        cmd,
        raw: responseObj,
      }
    }

    if (ack === 'error') {
      return {
        status: 'error',
        cmd,
        raw: responseObj,
        errorMessage: `Cihaz hata döndürdü (cmd: ${cmd ?? 'bilinmiyor'})`,
      }
    }

    // ack alanı yoksa veri yanıtı olarak değerlendir (R0100, R0600 gibi)
    // Protokol: data okuma komutlarında ack alanı bazen ilk değil son konumda olabilir
    // Tüm alanları tara
    const ackAny = Object.entries(responseObj).find(
      ([k]) => k.toLowerCase() === 'ack'
    )
    if (ackAny) {
      const ackVal = String(ackAny[1]).toLowerCase()
      if (ackVal === 'ok') {
        return { status: 'ok', cmd, raw: responseObj }
      }
      if (ackVal === 'error') {
        return {
          status: 'error',
          cmd,
          raw: responseObj,
          errorMessage: `Cihaz hata döndürdü (cmd: ${cmd ?? 'bilinmiyor'})`,
        }
      }
    }

    // ack alanı hiç yoksa veriyi ok kabul et (bazı okuma komutları ack'siz veri döner)
    return {
      status: 'ok',
      cmd,
      raw: responseObj,
    }
  }

  // ─── Spesifik veri çıkarıcılar ─────────────────────────────────────────────

  /**
   * R0100 yanıtından cihaz detaylarını çıkarır.
   */
  static extractDeviceDetails(parsed: HParsedResponse): HDeviceDetails | null {
    if (parsed.status !== 'ok' || !parsed.raw) return null
    const r = parsed.raw
    return {
      deviceId:     typeof r['deviceId']     === 'number' ? r['deviceId']     : 0,
      modelId:      typeof r['modelId']      === 'number' ? r['modelId']      : undefined,
      name:         typeof r['name']         === 'string' ? r['name']         : undefined,
      status:       typeof r['status']       === 'number' ? r['status']       : undefined,
      protoVersion: typeof r['protoVersion'] === 'string' ? r['protoVersion'] : undefined,
      MAC:          typeof r['MAC']          === 'string' ? r['MAC']          : undefined,
      volt:         typeof r['volt']         === 'number' ? r['volt']         : undefined,
      temp:         typeof r['temp']         === 'number' ? r['temp']         : undefined,
      extSignal:    typeof r['extSignal']    === 'number' ? r['extSignal']    : undefined,
      dataVersion:  typeof r['dataVersion']  === 'number' ? r['dataVersion']  : undefined,
      slotList:     Array.isArray(r['slotList'])  ? r['slotList']  : undefined,
      powerList:    Array.isArray(r['powerList'])  ? r['powerList'] : undefined,
      fanList:      Array.isArray(r['fanList'])    ? r['fanList']   : undefined,
      network:      r['network']    !== undefined  ? r['network']   : undefined,
      usbStatus:    Array.isArray(r['usbStatus'])  ? r['usbStatus'] : undefined,
    }
  }

  /**
   * R0401 yanıtından ekran detaylarını çıkarır.
   */
  static extractScreenDetails(parsed: HParsedResponse): HScreenDetails | null {
    if (parsed.status !== 'ok' || !parsed.raw) return null
    const r = parsed.raw
    return {
      deviceId:   typeof r['deviceId']   === 'number' ? r['deviceId']   : 0,
      screenId:   typeof r['screenId']   === 'number' ? r['screenId']   : 0,
      brightness: typeof r['brightness'] === 'number' ? r['brightness'] : undefined,
      gamma:      typeof r['gamma']      === 'number' ? r['gamma']      : undefined,
      general:    r['general'] as { name?: string; createTime?: string } | undefined,
    }
  }

  /**
   * R0600 yanıtından preset listesini çıkarır.
   */
  static extractPresetList(parsed: HParsedResponse): HPresetList | null {
    if (parsed.status !== 'ok' || !parsed.raw) return null
    const r = parsed.raw

    const rawPresets = r['presets']
    if (!Array.isArray(rawPresets)) {
      return { deviceId: 0, screenId: 0, presets: [] }
    }

    const presets: HPreset[] = rawPresets
      .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
      .map((p) => ({
        presetId: typeof p['presetId'] === 'number' ? p['presetId'] : 0,
        name:     typeof p['name']     === 'string' ? p['name']     : `Preset ${p['presetId']}`,
      }))

    return {
      deviceId: typeof r['deviceId'] === 'number' ? r['deviceId'] : 0,
      screenId: typeof r['screenId'] === 'number' ? r['screenId'] : 0,
      presets,
    }
  }

  /** Instance wrapper (DI uyumluluğu için) */
  parse(rawResponse: string): HParsedResponse {
    return HSeriesParser.parse(rawResponse)
  }

  /**
   * R0500 yanıtından layer listesini çıkarır.
   */
  static extractLayerEnum(parsed: HParsedResponse): HLayerEnum | null {
    if (parsed.status !== 'ok' || !parsed.raw) return null
    const r = parsed.raw

    // Protokol: cihaz yanıtında 'screenLayers' ya da 'layers' anahtarı kullanılabilir
    const rawLayers = Array.isArray(r['screenLayers'])
      ? r['screenLayers']
      : Array.isArray(r['layers'])
        ? r['layers']
        : null

    if (!rawLayers) {
      return { deviceId: 0, screenId: 0, layers: [] }
    }

    const layers: HLayerItem[] = rawLayers
      .filter((l): l is Record<string, unknown> => typeof l === 'object' && l !== null)
      .map((l) => ({
        layerId: typeof l['layerId'] === 'number' ? l['layerId'] : 0,
        name:    typeof l['name']    === 'string' ? l['name']    : `Layer ${l['layerId']}`,
      }))

    return {
      deviceId: typeof r['deviceId'] === 'number' ? r['deviceId'] : 0,
      screenId: typeof r['screenId'] === 'number' ? r['screenId'] : 0,
      layers,
    }
  }

  /**
   * R0501 yanıtından layer detaylarını çıkarır.
   */
  static extractLayerDetails(parsed: HParsedResponse): HLayerDetails | null {
    if (parsed.status !== 'ok' || !parsed.raw) return null
    const r = parsed.raw

    // window alanını güvenli şekilde çıkar
    let window: HLayerDetails['window'] | undefined
    if (typeof r['window'] === 'object' && r['window'] !== null) {
      const w = r['window'] as Record<string, unknown>
      window = {
        x:      typeof w['x']      === 'number' ? w['x']      : undefined,
        y:      typeof w['y']      === 'number' ? w['y']      : undefined,
        width:  typeof w['width']  === 'number' ? w['width']  : undefined,
        height: typeof w['height'] === 'number' ? w['height'] : undefined,
      }
    }

    return {
      deviceId:      typeof r['deviceId']      === 'number' ? r['deviceId']      : 0,
      screenId:      typeof r['screenId']      === 'number' ? r['screenId']      : 0,
      layerId:       typeof r['layerId']       === 'number' ? r['layerId']       : 0,
      name:          typeof r['name']          === 'string' ? r['name']          : undefined,
      inputId:       typeof r['inputId']       === 'number' ? r['inputId']       : undefined,
      interfaceType: typeof r['interfaceType'] === 'number' ? r['interfaceType'] : undefined,
      window,
      raw: r,
    }
  }
}
