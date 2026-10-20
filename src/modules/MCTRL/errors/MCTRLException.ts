export class MCTRLException extends Error {
  public readonly code: string
  public readonly details?: unknown

  constructor(message: string, code: string, details?: unknown) {
    super(message)
    this.name = 'MCTRLException'
    this.code = code
    this.details = details
    Object.setPrototypeOf(this, MCTRLException.prototype)
  }
}

export const MCTRL_ERROR_CODES = {
  PORT_NOT_FOUND:     'MCTRL_PORT_NOT_FOUND',
  CONNECTION_FAILED:  'MCTRL_CONNECTION_FAILED',
  COMMAND_FAILED:     'MCTRL_COMMAND_FAILED',
  TIMEOUT:            'MCTRL_TIMEOUT',
  PARSE_ERROR:        'MCTRL_PARSE_ERROR',
  UNKNOWN:            'MCTRL_UNKNOWN',
} as const
