import { VXSeriesConnection } from './VXSeriesConnection'
import { VXSeriesProtocolBuilder } from './VXSeriesProtocolBuilder'
import { VXSeriesParser } from './VXSeriesParser'
import { VXSeriesException, VX_ERROR_CODES } from './VXSeriesException'

export class VXSeriesCommandService {
  constructor(
    private readonly connection: VXSeriesConnection,
    private readonly builder: VXSeriesProtocolBuilder,
    private readonly parser: VXSeriesParser,
  ) {}

  async sendCommand(command: string, params?: Record<string, unknown>): Promise<{ success: boolean; message?: string; data?: unknown }> {
    if (!this.connection.isConnected()) {
      throw new VXSeriesException('Not connected', VX_ERROR_CODES.CONNECTION_FAILED)
    }
    const packet = this.builder.build(command, params)
    const raw = await this.connection.send(packet)
    const parsed = this.parser.parse(raw)
    return { success: parsed.success, message: parsed.message, data: parsed.data }
  }
}
