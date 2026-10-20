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
  CONNECTION_FAILED:  'TU_CONNECTION_FAILED',
  COMMAND_FAILED:     'TU_COMMAND_FAILED',
  TIMEOUT:            'TU_TIMEOUT',
  PARSE_ERROR:        'TU_PARSE_ERROR',
  UNKNOWN:            'TU_UNKNOWN',
} as const
