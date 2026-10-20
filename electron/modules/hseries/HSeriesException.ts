/**
 * HSeriesException
 * 
 * Custom exception class for H Series module errors.
 * All H Series errors should be wrapped in this exception to ensure
 * proper error isolation — H Series errors never propagate to other modules.
 */
export class HSeriesException extends Error {
  public readonly code: string
  public readonly details?: unknown

  constructor(message: string, code: string, details?: unknown) {
    super(message)
    this.name = 'HSeriesException'
    this.code = code
    this.details = details

    // Maintains proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, HSeriesException.prototype)
  }
}

// ─── H Series Error Codes ────────────────────────────────────────────────────
export const H_ERROR_CODES = {
  CONNECTION_FAILED:    'H_CONNECTION_FAILED',
  CONNECTION_TIMEOUT:   'H_CONNECTION_TIMEOUT',
  SEND_FAILED:          'H_SEND_FAILED',
  INVALID_RESPONSE:     'H_INVALID_RESPONSE',
  PARSE_ERROR:          'H_PARSE_ERROR',
  COMMAND_TIMEOUT:      'H_COMMAND_TIMEOUT',
  DEVICE_BUSY:          'H_DEVICE_BUSY',
  UNSUPPORTED_COMMAND:  'H_UNSUPPORTED_COMMAND',
  UNKNOWN:              'H_UNKNOWN',
} as const
