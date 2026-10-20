/**
 * VXSeriesProtocolBuilder — placeholder skeleton
 * TODO: Implement when VX Series protocol spec is provided.
 */
export interface VXRawCommand { name: string; payload: Buffer }

export class VXSeriesProtocolBuilder {
  static buildGetDeviceInfo(): VXRawCommand {
    return { name: 'GET_DEVICE_INFO', payload: Buffer.from([0x00]) }
  }

  build(command: string, params?: Record<string, unknown>): Buffer {
    const payload = JSON.stringify({ command, params }) + '\n'
    return Buffer.from(payload, 'utf-8')
  }
}
