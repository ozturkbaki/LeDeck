/**
 * MCTRLProtocolBuilder
 * Builds RS232 frames for Nova M3 Control System protocol.
 *
 * Frame Layout (all multi-byte fields Low byte first):
 *   [0-1]  Head:        0x55 0xAA  (Request)
 *   [2]    ACK:         0x00 = Request
 *   [3]    Serial No:   sequence number
 *   [4]    Source Addr: 0xFE (PC)
 *   [5]    Dest Addr:   0x00 (directly connected device)
 *   [6]    Device Type: 0x00 (Sending Card)
 *   [7]    Port Addr:   RJ45 port index
 *   [8-9]  Board Addr:  Low, High
 *   [10]   Code:        0x00 = Read, 0x01 = Write
 *   [11]   Reserved:    0x00
 *   [12-15] Reg Addr:   Low byte first
 *   [16-17] Data Len:   Low byte first
 *   [18..] Data:        payload bytes
 *   [-2,-1] Checksum:   Sum(byte[2]..byte[-3]) + 0x5555, Low byte first
 */

export class MCTRLProtocolBuilder {
  /**
   * Calculates the checksum: sum of bytes from `from` to `to` (inclusive) + 0x5555.
   */
  static calculateChecksum(frame: Buffer, from: number, to: number): number {
    let sum = 0x5555
    for (let i = from; i <= to; i++) sum += frame[i]
    return sum & 0xFFFF
  }

  /**
   * Builds a generic Read command frame.
   */
  static buildReadCommand(opts: {
    serialNo?: number
    deviceType?: number
    portAddr?: number
    boardAddr?: number
    regAddr: number
    dataLen: number
  }): Buffer {
    const {
      serialNo  = 0x01,
      deviceType = 0x00,
      portAddr  = 0x00,
      boardAddr = 0x0000,
      regAddr,
      dataLen,
    } = opts

    // Header + fixed fields (18 bytes) + checksum (2 bytes) = 20 bytes (no data payload for reads)
    const frame = Buffer.alloc(20, 0x00)

    frame[0]  = 0x55          // Head Low
    frame[1]  = 0xAA          // Head High
    frame[2]  = 0x00          // ACK = Request
    frame[3]  = serialNo & 0xFF
    frame[4]  = 0xFE          // Source: PC
    frame[5]  = 0x00          // Dest: directly connected
    frame[6]  = deviceType & 0xFF
    frame[7]  = portAddr & 0xFF
    frame[8]  = boardAddr & 0xFF         // Board Low
    frame[9]  = (boardAddr >> 8) & 0xFF  // Board High
    frame[10] = 0x00          // Code: Read
    frame[11] = 0x00          // Reserved
    frame[12] = regAddr & 0xFF
    frame[13] = (regAddr >> 8) & 0xFF
    frame[14] = (regAddr >> 16) & 0xFF
    frame[15] = (regAddr >> 24) & 0xFF
    frame[16] = dataLen & 0xFF
    frame[17] = (dataLen >> 8) & 0xFF

    const cs = MCTRLProtocolBuilder.calculateChecksum(frame, 2, 17)
    frame[18] = cs & 0xFF
    frame[19] = (cs >> 8) & 0xFF

    return frame
  }

  /**
   * Build "Get Controller Model ID" command.
   * Reads 2 bytes from register 0x00000002 of the Sending Card (Device Type 0x00).
   */
  static buildModelIdRequest(serialNo = 0x01): Buffer {
    return MCTRLProtocolBuilder.buildReadCommand({
      serialNo,
      deviceType: 0x00,
      portAddr:   0x00,
      boardAddr:  0x0000,
      regAddr:    0x00000002,
      dataLen:    2,
    })
  }

  /**
   * Build "Get Firmware Version" command.
   * Reads 4 bytes from register 0x04100004 of the Sending Card.
   * Response bytes: [major, minor, patch, build] → "major.minor.patch.build"
   */
  static buildFirmwareVersionRequest(serialNo = 0x01): Buffer {
    return MCTRLProtocolBuilder.buildReadCommand({
      serialNo,
      deviceType: 0x00,
      portAddr:   0x00,
      boardAddr:  0x0000,
      regAddr:    0x04100004,
      dataLen:    4,
    })
  }

  /**
   * Build "Get DVI/HDMI Signal Status" command.
   * Reads 1 byte from register 0x02000017 of the Sending Card.
   * 0x00 = No signal, 0x01+ = Signal active
   */
  static buildDviStatusRequest(serialNo = 0x01): Buffer {
    return MCTRLProtocolBuilder.buildReadCommand({
      serialNo,
      deviceType: 0x00,
      portAddr:   0x00,
      boardAddr:  0x0000,
      regAddr:    0x02000017,
      dataLen:    1,
    })
  }

  // ─── Write Command ──────────────────────────────────────────────────────────

  /**
   * Builds a generic Write command frame.
   * Frame = 20-byte header (Code=0x01) + data bytes + 2-byte checksum
   */
  static buildWriteCommand(opts: {
    serialNo?: number
    deviceType?: number
    portAddr?: number
    boardAddr?: number
    regAddr: number
    data: number[]
  }): Buffer {
    const {
      serialNo   = 0x01,
      deviceType = 0x00,
      portAddr   = 0x00,
      boardAddr  = 0x0000,
      regAddr,
      data,
    } = opts

    const dataLen  = data.length
    const frameLen = 20 + dataLen          // 18 header + 2 base checksum slot + data
    const frame    = Buffer.alloc(frameLen, 0x00)

    frame[0]  = 0x55
    frame[1]  = 0xAA
    frame[2]  = 0x00          // ACK = Request
    frame[3]  = serialNo & 0xFF
    frame[4]  = 0xFE          // Source: PC
    frame[5]  = 0x00          // Dest: directly connected
    frame[6]  = deviceType & 0xFF
    frame[7]  = portAddr & 0xFF
    frame[8]  = boardAddr & 0xFF
    frame[9]  = (boardAddr >> 8) & 0xFF
    frame[10] = 0x01          // Code: Write
    frame[11] = 0x00          // Reserved
    frame[12] = regAddr & 0xFF
    frame[13] = (regAddr >> 8) & 0xFF
    frame[14] = (regAddr >> 16) & 0xFF
    frame[15] = (regAddr >> 24) & 0xFF
    frame[16] = dataLen & 0xFF
    frame[17] = (dataLen >> 8) & 0xFF

    for (let i = 0; i < dataLen; i++) frame[18 + i] = data[i] & 0xFF

    const csEnd = 17 + dataLen
    const cs    = MCTRLProtocolBuilder.calculateChecksum(frame, 2, csEnd)
    frame[18 + dataLen]     = cs & 0xFF
    frame[18 + dataLen + 1] = (cs >> 8) & 0xFF

    return frame
  }

  // ─── Brightness (Receiving Card, Register 0x02000001) ──────────────────────

  /**
   * Read global brightness + RGBVR (5 bytes) from all receiving cards.
   * Device Type = 0x01 (Receiving Card) — distinct from Sending Card commands.
   */
  static buildGetBrightnessRequest(serialNo = 0x01): Buffer {
    return MCTRLProtocolBuilder.buildReadCommand({
      serialNo,
      deviceType: 0x01,   // Receiving Card
      portAddr:   0xFF,   // Broadcast: all ports
      boardAddr:  0xFFFF, // Broadcast: all boards
      regAddr:    0x02000001,
      dataLen:    5,
    })
  }

  /**
   * Write brightness to all receiving cards.
   * @param value  0–255 (raw); applied to all 5 channels (Global, R, G, B, VR)
   */
  static buildSetBrightnessRequest(value: number, serialNo = 0x01): Buffer {
    const v = Math.max(0, Math.min(255, Math.round(value)))
    return MCTRLProtocolBuilder.buildWriteCommand({
      serialNo,
      deviceType: 0x01,
      portAddr:   0xFF,
      boardAddr:  0xFFFF,
      regAddr:    0x02000001,
      data:       [v, v, v, v, v],  // Global, R, G, B, VR
    })
  }

  // ─── Input Source (Sending Card, Registers 0x02000022 / 0x02000023) ─────────
  //
  // Confirmed from PDF section 3.19:
  //   Device Type = 0x00 (Sending Card)  ← distinct from Brightness (0x01)
  //   0x02000022  Check Input Source Status  (R)  1 byte: 0x5A=manual, other=auto
  //   0x02000023  Select Input Source Manually (R/W) 1 byte: source code

  /**
   * Source ID → byte mapping (for buildSetInputSourceRequest and UI).
   * Exported so the UI layer can reference it without duplicating values.
   */
  static readonly INPUT_SOURCE_MAP: Record<string, number> = {
    DVI:      0x58,
    Dual_DVI: 0x61,
    HDMI:     0x05,
    'HDMI1.4':0x5A,
    '3G-SDI': 0x01,
    DP:       0x5F,
  }

  /** Read register 0x02000022 to check whether selection is manual or automatic. */
  static buildCheckInputSourceStatusRequest(serialNo = 0x01): Buffer {
    return MCTRLProtocolBuilder.buildReadCommand({
      serialNo,
      deviceType: 0x00,   // Sending Card
      portAddr:   0x00,
      boardAddr:  0x0000,
      regAddr:    0x02000022,
      dataLen:    1,
    })
  }

  /** Attempt to write to register 0x02000022 to force manual/auto mode. */
  static buildSetInputSourceModeRequest(manual: boolean, serialNo = 0x01): Buffer {
    return MCTRLProtocolBuilder.buildWriteCommand({
      serialNo,
      deviceType: 0x00,   // Sending Card
      portAddr:   0x00,
      boardAddr:  0x0000,
      regAddr:    0x02000022,
      data:       [manual ? 0x5A : 0xFF],
    })
  }

  /** Read register 0x02000023 to get the currently active input source. */
  static buildGetInputSourceRequest(serialNo = 0x01): Buffer {
    return MCTRLProtocolBuilder.buildReadCommand({
      serialNo,
      deviceType: 0x00,   // Sending Card
      portAddr:   0x00,
      boardAddr:  0x0000,
      regAddr:    0x02000023,
      dataLen:    1,
    })
  }

  /**
   * Write register 0x02000023 to change the active input source.
   * @param sourceCode  One of INPUT_SOURCE_MAP values (e.g. 0x05 for HDMI).
   */
  static buildSetInputSourceRequest(sourceCode: number, serialNo = 0x01): Buffer {
    return MCTRLProtocolBuilder.buildWriteCommand({
      serialNo,
      deviceType: 0x00,   // Sending Card
      portAddr:   0x00,
      boardAddr:  0x0000,
      regAddr:    0x02000023,
      data:       [sourceCode & 0xFF],
    })
  }
}
