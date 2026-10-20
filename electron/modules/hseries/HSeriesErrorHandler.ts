import { HSeriesException, H_ERROR_CODES } from './HSeriesException'

/**
 * HSeriesErrorHandler
 *
 * Ham hataları yapılandırılmış HSeriesException nesnelerine dönüştürür.
 * H Series hataları asla diğer modüllere sızmaz.
 */
export class HSeriesErrorHandler {

  /**
   * Herhangi bir hatayı HSeriesException'a sarar.
   *
   * @param error - Yakalanan hata
   * @param context - Hatanın nerede oluştuğunu açıklayan kısa metin
   */
  wrap(error: unknown, context: string): HSeriesException {
    if (error instanceof HSeriesException) return error

    const message = error instanceof Error ? error.message : String(error)
    const code = this._detectCode(message)

    console.error(`[H Series] ${context}: ${message}`)
    return new HSeriesException(`[H Series] ${context}: ${message}`, code, error)
  }

  /**
   * Hatanın kritik olup olmadığını belirler.
   * Kritik hatalarda mevcut session sonlandırılmalıdır.
   */
  isCritical(error: HSeriesException): boolean {
    return [
      H_ERROR_CODES.CONNECTION_FAILED,
      H_ERROR_CODES.CONNECTION_TIMEOUT,
    ].includes(error.code as typeof H_ERROR_CODES[keyof typeof H_ERROR_CODES])
  }

  /**
   * Hata mesajından uygun hata kodunu tahmin eder.
   */
  private _detectCode(message: string): string {
    const lower = message.toLowerCase()
    if (lower.includes('timeout') || lower.includes('zaman aşımı')) return H_ERROR_CODES.COMMAND_TIMEOUT
    if (lower.includes('connect') || lower.includes('bağlan'))    return H_ERROR_CODES.CONNECTION_FAILED
    if (lower.includes('send') || lower.includes('gönder'))       return H_ERROR_CODES.SEND_FAILED
    if (lower.includes('parse') || lower.includes('json'))        return H_ERROR_CODES.PARSE_ERROR
    return H_ERROR_CODES.UNKNOWN
  }
}
