/**
 * VXSeriesException
 * 
 * Custom exception class for VX Series module errors.
 * Completely isolated from other module exceptions.
 */
export class VXSeriesException extends Error {
  public readonly code: string
  public readonly details?: unknown

  constructor(message: string, code: string, details?: unknown) {
    super(message)
    this.name = 'VXSeriesException'
    this.code = code
    this.details = details
    Object.setPrototypeOf(this, VXSeriesException.prototype)
  }
}

export const VX_ERROR_CODES = {
  CONNECTION_FAILED:    'VX_CONNECTION_FAILED',
  CONNECTION_TIMEOUT:   'VX_CONNECTION_TIMEOUT',
  SEND_FAILED:          'VX_SEND_FAILED',
  INVALID_RESPONSE:     'VX_INVALID_RESPONSE',
  PARSE_ERROR:          'VX_PARSE_ERROR',
  COMMAND_TIMEOUT:      'VX_COMMAND_TIMEOUT',
  DEVICE_BUSY:          'VX_DEVICE_BUSY',
  UNSUPPORTED_COMMAND:  'VX_UNSUPPORTED_COMMAND',
  SEARCH_FAILED:        'VX_SEARCH_FAILED',
  UNKNOWN:              'VX_UNKNOWN',
} as const
