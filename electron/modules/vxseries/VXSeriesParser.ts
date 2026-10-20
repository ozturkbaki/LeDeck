/**
 * VXSeriesParser — placeholder skeleton
 * TODO: Implement when VX Series protocol spec is provided.
 */
export interface VXParsedResponse {
  valid: boolean
  success: boolean
  message?: string
  data?: Record<string, unknown>
  raw: Buffer
  error?: string
}

export class VXSeriesParser {
  static parse(buffer: Buffer): VXParsedResponse {
    if (buffer.length === 0) return { valid: false, success: false, message: 'Empty response buffer', raw: buffer, error: 'Empty response buffer' }
    return { valid: true, success: true, message: `OK (${buffer.length} bytes)`, raw: buffer, data: { raw_hex: buffer.toString('hex') } }
  }

  parse(buffer: Buffer): VXParsedResponse {
    return VXSeriesParser.parse(buffer)
  }
}
