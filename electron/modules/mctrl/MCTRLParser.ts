/**
 * MCTRLParser
 * Parses RS232 response frames from Nova M3 Control System devices.
 *
 * Response Frame Layout:
 *   [0-1]  Head:     0xAA 0x55  (Response — differs from Request 0x55 0xAA)
 *   [2]    ACK byte: result code
 *            0x00 = Success
 *            0x01 = Timeout / Command failed
 *            0x02 = Request check error
 *            0x03 = ACK check error
 *            0x04 = Invalid command
 *   [3]    Serial No
 *   [4]    Dest Addr (original source)
 *   [5]    Source Addr (device address)
 *   [6]    Device Type
 *   [7]    Port Addr
 *   [8-9]  Board Addr
 *   [10]   Code (0x00=Read response)
 *   [11]   Reserved
 *   [12-15] Reg Addr
 *   [16-17] Data Len
 *   [18..] Data payload
 *   [-2,-1] Checksum
 */

export interface MCTRLParsedResponse {
  valid: boolean
  success: boolean
  ackCode: number
  ackMessage: string
  commandName?: string
  data?: Record<string, unknown>
  raw: Buffer
}

const ACK_MESSAGES: Record<number, string> = {
  0x00: 'Success',
  0x01: 'Timeout / Command failed',
  0x02: 'Request check error',
  0x03: 'ACK check error',
  0x04: 'Invalid command',
}

/**
 * MODEL_ID_MAP
 * Key format: "{low_hex}-{high_hex}" (both bytes as 2-digit lowercase hex)
 * Example: modelIdLow=0x01 modelIdHigh=0x00 → key "01-00"
 *
 * To add a new model, simply add a new entry here.
 * No other code changes are needed.
 */
const MODEL_ID_MAP: Record<string, string> = {
  '01-00': 'MSD300 / MCTRL300',
  '01-01': 'MCTRL500',
  '01-11': 'MSD600 / MCTRL600 / MCTRL610',
  '01-91': 'MCTRL700',
  // Add new models below — format: 'low_hex-high_hex': 'Model Name'
  // '01-02': 'MCTRL660',
}

function buildModelKey(low: number, high: number): string {
  return `${low.toString(16).padStart(2, '0')}-${high.toString(16).padStart(2, '0')}`
}

function lookupModelName(low: number, high: number): string {
  const key = buildModelKey(low, high)
  return MODEL_ID_MAP[key] ?? `Unknown Controller (${key})`
}

export class MCTRLParser {
  static parse(buffer: Buffer): MCTRLParsedResponse {
    // Minimum viable frame: 20 bytes
    if (!buffer || buffer.length < 20) {
      console.error(`[MCTRL Parser] Frame too short: ${buffer?.toString('hex') ?? 'null'} (${buffer?.length ?? 0} bytes)`)
      return { valid: false, success: false, ackCode: -1, ackMessage: 'Frame too short', raw: buffer ?? Buffer.alloc(0) }
    }

    // Response header must be AA 55 (Request is 55 AA — must not be confused)
    if (buffer[0] !== 0xAA || buffer[1] !== 0x55) {
      console.error(`[MCTRL Parser] Invalid response header: ${buffer.slice(0, 2).toString('hex')} (expected AA 55)`)
      return { valid: false, success: false, ackCode: -1, ackMessage: 'Invalid response header (expected AA 55)', raw: buffer }
    }

    const ackCode = buffer[2]
    const ackMessage = ACK_MESSAGES[ackCode] ?? `Unknown ACK code: 0x${ackCode.toString(16).padStart(2, '0')}`
    const isSuccess = ackCode === 0x00

    console.log(`[MCTRL Parser] ACK=0x${ackCode.toString(16).padStart(2, '0')} => ${ackMessage}`)

    if (!isSuccess) {
      return { valid: true, success: false, ackCode, ackMessage, raw: buffer }
    }

    // Extract data payload
    const dataLen = buffer[16] | (buffer[17] << 8)
    const dataStart = 18
    const dataEnd = dataStart + dataLen

    if (buffer.length < dataEnd) {
      console.warn(`[MCTRL Parser] Data payload shorter than declared length (expected ${dataLen}, got ${buffer.length - dataStart})`)
      return { valid: false, success: false, ackCode, ackMessage: 'Incomplete data payload', raw: buffer }
    }

    const dataBytes = buffer.slice(dataStart, dataEnd)
    console.log(`[MCTRL Parser] Data payload (${dataLen} bytes): ${dataBytes.toString('hex')}`)

    return { valid: true, success: true, ackCode, ackMessage, raw: buffer, data: { rawHex: dataBytes.toString('hex') } }
  }

  /**
   * Parses the Model ID response.
   * Data = 2 bytes: [Low, High]
   * Returns the matched model name or 'Unknown Controller (low-high)'.
   */
  static parseModelId(buffer: Buffer): { modelIdLow: number; modelIdHigh: number; modelName: string } | null {
    const base = MCTRLParser.parse(buffer)
    if (!base.valid || !base.success) {
      console.warn(`[MCTRL Parser] parseModelId: base parse failed - ${base.ackMessage}`)
      return null
    }

    const dataLen = buffer[16] | (buffer[17] << 8)
    if (dataLen < 2) {
      console.warn(`[MCTRL Parser] parseModelId: data length too short (${dataLen})`)
      return null
    }

    const modelIdLow  = buffer[18]
    const modelIdHigh = buffer[19]
    const key         = buildModelKey(modelIdLow, modelIdHigh)
    const modelName   = lookupModelName(modelIdLow, modelIdHigh)

    console.log(
      `[MCTRL Parser] Model ID` +
      ` Low=0x${modelIdLow.toString(16).padStart(2, '0')} (${modelIdLow})` +
      ` High=0x${modelIdHigh.toString(16).padStart(2, '0')} (${modelIdHigh})` +
      ` key="${key}" => "${modelName}"`
    )

    return { modelIdLow, modelIdHigh, modelName }
  }

  /**
   * Parses the Firmware Version response.
   * Data = 4 bytes: [major, minor, patch, build]
   * Returns a version string like "4.1.0.4" or null on failure.
   */
  static parseFirmwareVersion(buffer: Buffer): string | null {
    const base = MCTRLParser.parse(buffer)
    if (!base.valid || !base.success) {
      console.warn(`[MCTRL Parser] parseFirmwareVersion: failed - ${base.ackMessage}`)
      return null
    }

    const dataLen = buffer[16] | (buffer[17] << 8)
    if (dataLen < 4) {
      console.warn(`[MCTRL Parser] parseFirmwareVersion: data too short (${dataLen} bytes)`)
      return null
    }

    const major = buffer[18]
    const minor = buffer[19]
    const patch = buffer[20]
    const build = buffer[21]
    const version = `${major}.${minor}.${patch}.${build}`

    console.log(`[MCTRL Parser] Firmware Version: ${version} (raw: ${buffer.slice(18, 22).toString('hex')})`)
    return version
  }

  /**
   * Parses the DVI/HDMI Signal Status response.
   * Data = 1 byte: 0x00 = no signal, 0x01+ = signal active.
   * Returns { active: boolean, raw: number } or null on failure.
   */
  static parseDviStatus(buffer: Buffer): { active: boolean; raw: number } | null {
    const base = MCTRLParser.parse(buffer)
    if (!base.valid || !base.success) {
      console.warn(`[MCTRL Parser] parseDviStatus: failed - ${base.ackMessage}`)
      return null
    }

    const dataLen = buffer[16] | (buffer[17] << 8)
    if (dataLen < 1) {
      console.warn(`[MCTRL Parser] parseDviStatus: data too short (${dataLen} bytes)`)
      return null
    }

    const raw = buffer[18]
    const active = raw !== 0x00

    console.log(`[MCTRL Parser] DVI Signal: raw=0x${raw.toString(16).padStart(2, '0')} => ${active ? 'ACTIVE' : 'NO SIGNAL'}`)
    return { active, raw }
  }

  // ─── Brightness (Receiving Card context) ───────────────────────────────────

  /**
   * Parses a getBrightness response.
   * Data = 5 bytes: [global, R, G, B, VR] each 0-255.
   * Returns null on parse failure.
   * IMPORTANT: This method is ONLY for Receiving Card brightness reads (register 0x02000001).
   */
  static parseBrightnessRead(buffer: Buffer): {
    global: number; r: number; g: number; b: number; vr: number
  } | null {
    const base = MCTRLParser.parse(buffer)
    if (!base.valid || !base.success) {
      console.warn(`[MCTRL Parser] parseBrightnessRead: failed - ${base.ackMessage}`)
      return null
    }

    const dataLen = buffer[16] | (buffer[17] << 8)
    if (dataLen < 5) {
      console.warn(`[MCTRL Parser] parseBrightnessRead: data too short (${dataLen} bytes, expected 5)`)
      return null
    }

    const result = {
      global: buffer[18],
      r:      buffer[19],
      g:      buffer[20],
      b:      buffer[21],
      vr:     buffer[22],
    }
    console.log(`[MCTRL Parser] Brightness => Global=${result.global} R=${result.r} G=${result.g} B=${result.b} VR=${result.vr}`)
    return result
  }

  /**
   * Parses a setBrightness write-ACK response.
   * Write responses carry no data payload — only ACK code matters.
   * IMPORTANT: This method is ONLY for Receiving Card brightness writes.
   */
  static parseBrightnessWrite(buffer: Buffer): boolean {
    const base = MCTRLParser.parse(buffer)
    if (!base.valid) {
      console.warn(`[MCTRL Parser] parseBrightnessWrite: invalid frame`)
      return false
    }
    const ok = base.success
    console.log(`[MCTRL Parser] setBrightness ACK => ${ok ? 'SUCCESS' : base.ackMessage}`)
    return ok
  }

  // ─── Input Source (Sending Card context) ───────────────────────────────────
  //  IMPORTANT: These methods are ONLY for Sending Card input source registers.
  //  Do NOT use parseBrightness* here — different device type / register space.

  /** Reverse-lookup: byte value → source name string */
  private static readonly SOURCE_BYTE_MAP: Record<number, string> = {
    0x58: 'DVI',
    0x61: 'Dual_DVI',
    0x05: 'HDMI',
    0x5A: 'HDMI1.4',
    0x01: '3G-SDI',
    0x5F: 'DP',
  }

  /**
   * Parses the Check Input Source Status response (register 0x02000022).
   * Returns { manual: boolean, raw: number } or null on failure.
   */
  static parseInputSourceStatus(buffer: Buffer): { manual: boolean; raw: number } | null {
    const base = MCTRLParser.parse(buffer)
    if (!base.valid || !base.success) {
      console.warn(`[MCTRL Parser] parseInputSourceStatus: failed - ${base.ackMessage}`)
      return null
    }
    const dataLen = buffer[16] | (buffer[17] << 8)
    if (dataLen < 1) {
      console.warn(`[MCTRL Parser] parseInputSourceStatus: data too short`)
      return null
    }
    const raw    = buffer[18]
    const manual = raw === 0x5A
    console.log(`[MCTRL Parser] InputSource status: 0x${raw.toString(16).padStart(2,'0')} => ${manual ? 'MANUAL' : 'AUTO'}`)
    return { manual, raw }
  }

  /**
   * Parses the Get Input Source response (register 0x02000023).
   * Returns { sourceCode: number, sourceName: string } or null on failure.
   */
  static parseInputSource(buffer: Buffer): { sourceCode: number; sourceName: string } | null {
    const base = MCTRLParser.parse(buffer)
    if (!base.valid || !base.success) {
      console.warn(`[MCTRL Parser] parseInputSource: failed - ${base.ackMessage}`)
      return null
    }
    const dataLen = buffer[16] | (buffer[17] << 8)
    if (dataLen < 1) {
      console.warn(`[MCTRL Parser] parseInputSource: data too short`)
      return null
    }
    const sourceCode = buffer[18]
    const sourceName = MCTRLParser.SOURCE_BYTE_MAP[sourceCode] ?? `Unknown (0x${sourceCode.toString(16).padStart(2,'0')})`
    console.log(`[MCTRL Parser] InputSource: 0x${sourceCode.toString(16).padStart(2,'0')} => "${sourceName}"`)
    return { sourceCode, sourceName }
  }

  /**
   * Parses the setInputSource write-ACK response.
   * Write ACK carries no data (dataLen = 0) — only ACK code matters.
   */
  static parseSetInputSourceAck(buffer: Buffer): boolean {
    const base = MCTRLParser.parse(buffer)
    if (!base.valid) {
      console.warn(`[MCTRL Parser] parseSetInputSourceAck: invalid frame`)
      return false
    }
    const ok = base.success
    console.log(`[MCTRL Parser] setInputSource ACK => ${ok ? 'SUCCESS' : base.ackMessage}`)
    return ok
  }

  // Instance method for compatibility
  parse(buffer: Buffer): MCTRLParsedResponse {
    return MCTRLParser.parse(buffer)
  }
}
