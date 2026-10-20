import { TUSeriesException } from './TUSeriesException'

export class TUSeriesErrorHandler {
  wrap(error: unknown, context: string): TUSeriesException {
    if (error instanceof TUSeriesException) return error
    const message = error instanceof Error ? error.message : String(error)
    return new TUSeriesException(`[TU Series] ${context}: ${message}`, 'TU_UNKNOWN', error)
  }

  isCritical(error: TUSeriesException): boolean {
    return ['TU_CONNECTION_FAILED', 'TU_SOCKET_CLOSED'].includes(error.code)
  }
}
