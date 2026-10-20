/**
 * MCTRLException
 * 
 * Custom exception class for MCTRL Series module errors.
 * Completely isolated from other module exceptions.
 * Serial port errors are wrapped in this exception type.
 */
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
  PORT_NOT_FOUND:       'MCTRL_PORT_NOT_FOUND',
  PORT_OPEN_FAILED:     'MCTRL_PORT_OPEN_FAILED',
  CONNECTION_FAILED:    'MCTRL_CONNECTION_FAILED',
  CONNECTION_TIMEOUT:   'MCTRL_CONNECTION_TIMEOUT',
  SEND_FAILED:          'MCTRL_SEND_FAILED',
  INVALID_RESPONSE:     'MCTRL_INVALID_RESPONSE',
  PARSE_ERROR:          'MCTRL_PARSE_ERROR',
  COMMAND_TIMEOUT:      'MCTRL_COMMAND_TIMEOUT',
  DEVICE_BUSY:          'MCTRL_DEVICE_BUSY',
  UNSUPPORTED_COMMAND:  'MCTRL_UNSUPPORTED_COMMAND',
  UNKNOWN:              'MCTRL_UNKNOWN',
} as const
