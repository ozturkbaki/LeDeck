import { MCTRLException } from './MCTRLException'

export class MCTRLErrorHandler {
  wrap(error: unknown, context: string): MCTRLException {
    if (error instanceof MCTRLException) return error
    const message = error instanceof Error ? error.message : String(error)
    return new MCTRLException(`[MCTRL] ${context}: ${message}`, 'MCTRL_UNKNOWN', error)
  }

  isCritical(error: MCTRLException): boolean {
    return ['MCTRL_PORT_NOT_FOUND', 'MCTRL_CONNECTION_FAILED', 'MCTRL_PORT_CLOSED'].includes(error.code)
  }
}
