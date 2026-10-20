/**
 * Taurus Exception
 * TB/TCC serisine özgü hata sınıfı.
 */

export const TAURUS_ERROR_CODES = {
  // DLL hata kodları (Taurus_kit.dll)
  DLL_IP_FORMAT_ERROR:   3,
  DLL_NO_DEVICE:         4,
  DLL_JSON_PARSE_ERROR:  16,

  // Login API hata kodları (/terminal/core/v1/user/login)
  // Kaynak: Taurus REST API dokümantasyonu
  API_ERROR:             1,    // Genel hata
  API_INVALID_PARAM:     3,    // ERR_INVALID_PARAM — dokümandaki "sn not match"
  API_FORBIDDEN:         17,   // ERR_FORBIDDEN — brute force kilidi
  API_NOT_LOGGED_IN:     18,   // "not logged in, please login" (Yetkisiz/Hatalı Şifre)
  API_NOT_EXISTED:       19,   // ERR_NOT_EXISTED — sunucuda login config yok
  API_VERIFY_FAILED:     24,   // ERR_VERIFY_FAILED — yanlış kullanıcı adı/şifre

  // Diğer API hata kodları
  API_TOKEN_EXPIRED:     39,   // Token süresi doldu

  // Backward compat aliases (eski kodlar)
  /** @deprecated API_INVALID_PARAM (3) kullanın */
  API_INVALID_SN:        3,
  /** @deprecated API_FORBIDDEN (17) kullanın */
  API_BRUTE_FORCE_LOCK:  17,

  // Lokal hata kodları
  CONNECTION_FAILED:     1001,
  INVALID_CREDENTIALS:   1002,
  SESSION_LOST:          1003,
  DISCOVERY_FAILED:      1004,
  COMMAND_FAILED:        1005,
  SSL_ERROR:             1006,
} as const

export type TaurusErrorCode = typeof TAURUS_ERROR_CODES[keyof typeof TAURUS_ERROR_CODES]

export class TaurusException extends Error {
  /**
   * @param code    - Yerel hata kodu (TAURUS_ERROR_CODES)
   * @param apiCode - API'den dönen ham code (3, 17, 24 vb.) — UI'da spesifik tepki için
   */
  constructor(
    message:   string,
    public readonly code:      TaurusErrorCode | number,
    public readonly apiCode?:  number,   // raw API response code
    public readonly httpStatus?: number,
  ) {
    super(message)
    this.name = 'TaurusException'
  }

  get isTokenExpired():    boolean { return this.code === TAURUS_ERROR_CODES.API_TOKEN_EXPIRED || this.code === TAURUS_ERROR_CODES.API_NOT_LOGGED_IN }
  get isBruteForceLock():  boolean { return this.code === TAURUS_ERROR_CODES.API_FORBIDDEN }
  get isSnMismatch():      boolean { return this.code === TAURUS_ERROR_CODES.API_INVALID_PARAM }
  get isWrongPassword():   boolean { return this.code === TAURUS_ERROR_CODES.API_VERIFY_FAILED || this.code === TAURUS_ERROR_CODES.API_NOT_LOGGED_IN }
}
