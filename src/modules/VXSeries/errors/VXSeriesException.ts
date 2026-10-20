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
  CONNECTION_FAILED:  'VX_CONNECTION_FAILED',
  COMMAND_FAILED:     'VX_COMMAND_FAILED',
  TIMEOUT:            'VX_TIMEOUT',
  SEARCH_FAILED:      'VX_SEARCH_FAILED',
  PARSE_ERROR:        'VX_PARSE_ERROR',
  UNKNOWN:            'VX_UNKNOWN',
} as const
