/**
 * TUSeriesException
 * 
 * Custom exception class for TU Series module errors.
 * Completely isolated from other module exceptions.
 */
export class TUSeriesException extends Error {
  public readonly code: string
  public readonly details?: unknown

  constructor(message: string, code: string, details?: unknown) {
    super(message)
    this.name = 'TUSeriesException'
    this.code = code
    this.details = details
    Object.setPrototypeOf(this, TUSeriesException.prototype)
  }
}

export const TU_ERROR_CODES = {
  CONNECTION_FAILED:    'TU_CONNECTION_FAILED',
  CONNECTION_TIMEOUT:   'TU_CONNECTION_TIMEOUT',
  SEND_FAILED:          'TU_SEND_FAILED',
  INVALID_RESPONSE:     'TU_INVALID_RESPONSE',
  PARSE_ERROR:          'TU_PARSE_ERROR',
  COMMAND_TIMEOUT:      'TU_COMMAND_TIMEOUT',
  DEVICE_BUSY:          'TU_DEVICE_BUSY',
  UNSUPPORTED_COMMAND:  'TU_UNSUPPORTED_COMMAND',
  UNKNOWN:              'TU_UNKNOWN',
} as const
