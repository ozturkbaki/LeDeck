/**
 * HSeriesProtocolBuilder
 *
 * H Series cihazları için JSON formatında komut paketleri üretir.
 * Tüm komutlar protokol dokümantasyonuna birebir uygun olarak tanımlanmıştır.
 *
 * KURAL: Yalnızca paylaşılan protokol bölümlerine göre komut üret.
 *        Eksik komutları tahmin etme. Gezinilmemiş alanları uydurma.
 *
 * Sabit Parametreler (bu faz için):
 *   deviceId = 0
 *   screenId = 0
 */

/** Her komutun ürettiği JSON string */
export type HCommandPayload = string

export class HSeriesProtocolBuilder {

  // ─── Sabit parametreler (bu faz için hardcoded) ──────────────────────────
  private static readonly DEVICE_ID = 0
  private static readonly SCREEN_ID = 0

  /**
   * Get Device Details
   * Cmd: R0100
   * Cihazın temel bilgilerini (model, MAC, kart listesi, fan, güç...) döndürür.
   *
   * Protocol ref: Section 4 — Get Device Details
   */
  static buildGetDeviceDetails(): HCommandPayload {
    const cmd = [
      {
        cmd: 'R0100',
        param0: HSeriesProtocolBuilder.DEVICE_ID,
      },
    ]
    return JSON.stringify(cmd)
  }

  /**
   * Get Screen Details
   * Cmd: R0401
   * Belirtilen ekranın tüm bilgilerini (parlaklık, kontrast, preset...) döndürür.
   *
   * Protocol ref: Section 5 — Get Screen Details
   */
  static buildGetScreenDetails(): HCommandPayload {
    const cmd = [
      {
        cmd: 'R0401',
        param0: HSeriesProtocolBuilder.DEVICE_ID,
        param1: HSeriesProtocolBuilder.SCREEN_ID,
      },
    ]
    return JSON.stringify(cmd)
  }

  /**
   * Get Preset List (Enum)
   * Cmd: R0600
   * Belirtilen ekranın preset listesini (id + name) döndürür.
   *
   * Protocol ref: Section 6 — Get Preset Enum
   */
  static buildGetPresetList(): HCommandPayload {
    const cmd = [
      {
        cmd: 'R0600',
        param0: HSeriesProtocolBuilder.DEVICE_ID,
        param1: HSeriesProtocolBuilder.SCREEN_ID,
      },
    ]
    return JSON.stringify(cmd)
  }

  /**
   * Load Preset
   * Cmd: W0605
   * Belirtilen preset'i aktif ekranda yükler.
   *
   * @param presetId - Yüklenecek preset'in ID'si (0'dan başlar)
   * Protocol ref: Section 7 — Load Presets
   */
  static buildLoadPreset(presetId: number): HCommandPayload {
    const cmd = [
      {
        cmd: 'W0605',
        deviceId: HSeriesProtocolBuilder.DEVICE_ID,
        screenId: HSeriesProtocolBuilder.SCREEN_ID,
        presetId,
      },
    ]
    return JSON.stringify(cmd)
  }

  /**
   * Get Screen Layer Enum
   * Cmd: R0500
   * Ekrandaki tüm layer'ların listesini (id + isim) döndürür.
   *
   * Protocol ref: Get Screen Layer Enum
   */
  static buildGetLayerEnum(): HCommandPayload {
    const cmd = [
      {
        cmd: 'R0500',
        deviceId: HSeriesProtocolBuilder.DEVICE_ID,
        screenId: HSeriesProtocolBuilder.SCREEN_ID,
      },
    ]
    return JSON.stringify(cmd)
  }

  /**
   * Get Screen Layer Details
   * Cmd: R0501
   * Belirtilen layer'a ait detay bilgilerini döndürür.
   *
   * KURAL: Bu metod yalnızca şu akış sonucunda çağrılmalıdır:
   *   1. buildGetLayerEnum() (R0500) çalıştırılır
   *   2. Kullanıcı dönen listeden bir layer seçer
   *   3. Seçilen layerId bu metoda aktarılır
   *   Sabit veya hardcoded bir layerId kabul edilmez.
   *
   * @param layerId - R0500 yanıtındaki layer listesinden kullanıcının seçtiği ID
   * Protocol ref: Get Screen Layer Details
   */
  static buildGetLayerDetails(layerId: number): HCommandPayload {
    const cmd = [
      {
        cmd: 'R0501',
        param0: HSeriesProtocolBuilder.DEVICE_ID,   // deviceId
        param1: HSeriesProtocolBuilder.SCREEN_ID,   // screenId
        param2: layerId,                             // layerId (R0500'dan gelen)
      },
    ]
    return JSON.stringify(cmd)
  }

  /**
   * Adjust Screen Brightness
   * Cmd: W0410
   * Ekran par laklığını 0–100 arasında ayarlar.
   *
   * @param brightness - 0–100 par laklık değeri
   * Protocol ref: Adjust Screen Brightness
   */
  static buildSetBrightness(brightness: number): HCommandPayload {
    const cmd = [
      {
        cmd: 'W0410',
        deviceId: HSeriesProtocolBuilder.DEVICE_ID,
        screenId: HSeriesProtocolBuilder.SCREEN_ID,
        brightness,
      },
    ]
    return JSON.stringify(cmd)
  }

  /**
   * Freeze the Screen
   * Cmd: W040A
   * Ekranı dondurur veya çözer.
   *
   * @param enable - 0: Unfreeze (normal), 1: Freeze (donmuş)
   * Protocol ref: Freeze the Screen
   */
  static buildSetFreeze(enable: 0 | 1): HCommandPayload {
    const cmd = [
      {
        cmd: 'W040A',
        deviceId: HSeriesProtocolBuilder.DEVICE_ID,
        screenId: HSeriesProtocolBuilder.SCREEN_ID,
        enable,
      },
    ]
    return JSON.stringify(cmd)
  }

  /**
   * Set Screen FTB (Fade to Black)
   * Cmd: W0409
   * Ekranı siyaha düşürür veya normal görüntüye döndürür.
   *
   * @param type - 0: Siyah ekran (FTB aktif), 1: Normal görüntü
   * Protocol ref: Set Screen FTB
   * NOT: Freeze'den farklıdır — FTB siyaha göçidi, Freeze görüntüyü dondurur.
   */
  static buildSetFTB(type: 0 | 1): HCommandPayload {
    const cmd = [
      {
        cmd: 'W0409',
        deviceId: HSeriesProtocolBuilder.DEVICE_ID,
        screenId: HSeriesProtocolBuilder.SCREEN_ID,
        type,
      },
    ]
    return JSON.stringify(cmd)
  }
}
