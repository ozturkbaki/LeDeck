import { VXSeriesException } from './VXSeriesException'

export class VXSeriesErrorHandler {
  wrap(error: unknown, context: string): VXSeriesException {
    if (error instanceof VXSeriesException) return error
    const message = error instanceof Error ? error.message : String(error)
    return new VXSeriesException(`[VX Series] ${context}: ${message}`, 'VX_UNKNOWN', error)
  }

  isCritical(error: VXSeriesException): boolean {
    return ['VX_CONNECTION_FAILED', 'VX_SOCKET_CLOSED'].includes(error.code)
  }
}
