/**
 * TUSeriesProtocolBuilder
 * Hardcoded hex payloads for Phase 1 read commands and Builder logic for Phase 2 writes.
 */
export class TUSeriesProtocolBuilder {
  static getSourceCommand(): Buffer { return Buffer.from('55AA0001FC000600000000000400000001005D56', 'hex') }
  static getVolumeCommand(): Buffer { return Buffer.from('55AA0001FC000600000000000500000002005F56', 'hex') }
  static getNetworkCommand(): Buffer { return Buffer.from('55AA0001FC000600000000000700000001006056', 'hex') }
  static getStatusCommand(): Buffer { return Buffer.from('55AA0001FC000600000000000D00000001006656', 'hex') }
  static getHdmiStatusCommand(): Buffer { return Buffer.from('55AA0001FC000600000000000200000004005E56', 'hex') }
  static getBrightnessCommand(): Buffer { return Buffer.from('55AA0001FC000100000000000100000201005756', 'hex') }

  /** ──────── Phase 2: Write Commands ──────── */

  private static buildWriteCommand(commandType: number, paramVal: number): Buffer {
    const cmd = Buffer.alloc(21)
    
    // Header
    cmd[0] = 0x55
    cmd[1] = 0xAA

    // Base Frame
    const base = [0x00, 0x01, 0xFC, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, commandType, 0x00, 0x00, 0x00, 0x01, 0x00, paramVal]
    for(let i=0; i<base.length; i++) {
        cmd[i+2] = base[i]
    }

    // Checksum: sum of bytes[2..18] + 0x5555, then little endian
    let sum = 0x5555
    for(let i=2; i<=18; i++) sum += cmd[i]

    cmd[19] = sum & 0xFF
    cmd[20] = (sum >> 8) & 0xFF

    return cmd
  }

  // 0=Android, 1=HDMI1, 2=HDMI2, 3=HDMI3 in UI mapping matches device map (03, 01, 02, 04 in hex bytes respectively? No, Wait!)
  // User's spec: HDMI1 -> 0x01, HDMI2 -> 0x02, Android -> 0x03, HDMI3 -> 0x04
  static setSourceCommand(sourceIndex: number): Buffer {
    let devIndex = 0x01 // Default to HDMI1 fallback
    if (sourceIndex === 0) devIndex = 0x03 // Android
    if (sourceIndex === 1) devIndex = 0x01 // HDMI1
    if (sourceIndex === 2) devIndex = 0x02 // HDMI2
    if (sourceIndex === 3) devIndex = 0x04 // HDMI3
    return this.buildWriteCommand(0x04, devIndex)
  }

  // System Volume (0-100 decimal)
  static setVolumeCommand(volume: number): Buffer {
    const clamped = Math.max(0, Math.min(100, Math.round(volume)))
    return this.buildWriteCommand(0x06, clamped) // 0-100 directly mapped as per user note
  }

  // System Brightness (0-100 mapped to 0-255 for device payload)
  static setBrightnessCommand(brightness: number): Buffer {
    const clampedInput = Math.max(0, Math.min(100, Math.round(brightness)))
    const mappedTo255 = Math.round((clampedInput / 100) * 255)
    const cmd = Buffer.alloc(21)
    
    // Header
    cmd[0] = 0x55
    cmd[1] = 0xAA

    // Base Frame for setBrightness (Specific destination frame for brightness: 01 FF FF FF payload header)
    const base = [0x00, 0x01, 0xFC, 0x00, 0x01, 0xFF, 0xFF, 0xFF, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x01, 0x00, mappedTo255]
    for(let i=0; i<base.length; i++) {
        cmd[i+2] = base[i]
    }

    // Checksum
    let sum = 0x5555
    for(let i=2; i<=18; i++) sum += cmd[i]

    cmd[19] = sum & 0xFF
    cmd[20] = (sum >> 8) & 0xFF

    return cmd
  }

  // Phase 3: Power Control
  static setStandbyCommand(): Buffer { return this.buildWriteCommand(0x01, 0x00) }
  static setWakeUpCommand(): Buffer { return this.buildWriteCommand(0x02, 0x00) }
  static setPowerOffCommand(): Buffer { return this.buildWriteCommand(0x03, 0x00) }

  // Phase 4: Remote Control
  static setRemoteCommand(actionByte: number): Buffer {
    const cmd = Buffer.alloc(21)
    
    cmd[0] = 0x55
    cmd[1] = 0xAA

    const base = [0x00, 0x01, 0xFC, 0x00, 0x07, 0x00, 0x00, 0x00, 0x01, 0x00, actionByte, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00]
    for(let i=0; i<base.length; i++) {
        cmd[i+2] = base[i]
    }

    let sum = 0x5555
    for(let i=2; i<=18; i++) sum += cmd[i]

    cmd[19] = sum & 0xFF
    cmd[20] = (sum >> 8) & 0xFF

    return cmd
  }

  // Phase 5: Playback Control & Screen Power
  static initProgramListCommand(): Buffer {
    const cmd = Buffer.alloc(20)
    cmd[0] = 0x55; cmd[1] = 0xAA
    const base = [0x00, 0x01, 0xFC, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0C, 0x00, 0x00, 0x00, 0x01, 0x00]
    for(let i=0; i<base.length; i++) cmd[i+2] = base[i]
    let sum = 0x5555
    for(let i=2; i<=17; i++) sum += cmd[i]
    cmd[18] = sum & 0xFF
    cmd[19] = (sum >> 8) & 0xFF
    return cmd
  }

  static setPlayProgramCommand(index: number): Buffer {
    const cmd = Buffer.alloc(22)
    cmd[0] = 0x55; cmd[1] = 0xAA
    const base = [0x00, 0x01, 0xFC, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x0C, 0x00, 0x00, 0x00, 0x02, 0x00, 0x02, index]
    for(let i=0; i<base.length; i++) cmd[i+2] = base[i]
    let sum = 0x5555
    for(let i=2; i<=19; i++) sum += cmd[i]
    cmd[20] = sum & 0xFF
    cmd[21] = (sum >> 8) & 0xFF
    return cmd
  }

  static setPlaybackActionCommand(actionByte: number): Buffer {
    const cmd = Buffer.alloc(21)
    cmd[0] = 0x55; cmd[1] = 0xAA
    const base = [0x00, 0x01, 0xFC, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x0C, 0x00, 0x00, 0x00, 0x01, 0x00, actionByte]
    for(let i=0; i<base.length; i++) cmd[i+2] = base[i]
    let sum = 0x5555
    for(let i=2; i<=18; i++) sum += cmd[i]
    cmd[19] = sum & 0xFF
    cmd[20] = (sum >> 8) & 0xFF
    return cmd
  }

  static setScreenPowerCommand(isOn: boolean): Buffer {
    const cmd = Buffer.alloc(21)
    cmd[0] = 0x55; cmd[1] = 0xAA
    const base = [0x00, 0x01, 0xFC, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x0D, 0x00, 0x00, 0x00, 0x01, 0x00, isOn ? 0x01 : 0x00]
    for(let i=0; i<base.length; i++) cmd[i+2] = base[i]
    let sum = 0x5555
    for(let i=2; i<=18; i++) sum += cmd[i]
    cmd[19] = sum & 0xFF
    cmd[20] = (sum >> 8) & 0xFF
    return cmd
  }
}
