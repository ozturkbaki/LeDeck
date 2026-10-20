/**
 * HSeriesException — Renderer tarafı H Series hata sınıfı.
 * Main process'teki HSeriesException ile tamamen izole.
 */
export class HSeriesException extends Error {
  public readonly code: string
  public readonly details?: unknown

  constructor(message: string, code: string, details?: unknown) {
    super(message)
    this.name = 'HSeriesException'
    this.code = code
    this.details = details
    Object.setPrototypeOf(this, HSeriesException.prototype)
  }
}

export const H_ERROR_CODES = {
  CONNECTION_FAILED:  'H_CONNECTION_FAILED',
  COMMAND_FAILED:     'H_COMMAND_FAILED',
  TIMEOUT:            'H_TIMEOUT',
  PARSE_ERROR:        'H_PARSE_ERROR',
  UNKNOWN:            'H_UNKNOWN',
} as const
