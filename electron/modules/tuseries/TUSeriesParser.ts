import { TUSeriesException, TU_ERROR_CODES } from './TUSeriesException'

export interface TUParsedResponse {
  valid: boolean
  success: boolean
  commandName?: string
  data?: any
  raw: Buffer
}

export class TUSeriesParser {
  static parse(buffer: Buffer): TUParsedResponse {
    if (!buffer || buffer.length < 2) {
      console.error(`[TU Parser] Invalid frame: ${buffer?.toString('hex') || 'null'} (Length: ${buffer?.length || 0})`)
      throw new TUSeriesException('Invalid frame (too short)', TU_ERROR_CODES.INVALID_RESPONSE)
    }

    if (buffer[0] !== 0xAA || buffer[1] !== 0x55) {
      console.error(`[TU Parser] Invalid header: ${buffer.toString('hex')} (Length: ${buffer.length})`)
      throw new TUSeriesException('Invalid frame header', TU_ERROR_CODES.INVALID_RESPONSE)
    }

    if (buffer.length < 19) {
      console.error(`[TU Parser] Complete frame not received: ${buffer.toString('hex')} (Length: ${buffer.length})`)
      return { valid: false, success: false, raw: buffer }
    }

    const commandType = buffer[12]
    const payloadLength = buffer[6]

    let commandName = 'UNKNOWN'
    if (payloadLength === 0x07) {
       commandName = 'setRemoteCommand'
    } else if (commandType === 0x01) {
       if (payloadLength === 0x08) commandName = 'setStandby'
       else commandName = buffer[7] === 0xFF ? 'setBrightness' : 'getBrightness'
    } else if (commandType === 0x02) {
       commandName = payloadLength === 0x08 ? 'setWakeUp' : 'getHdmiStatus'
    } else if (commandType === 0x03) {
       commandName = 'setPowerOff'
    } else if (commandType === 0x04) commandName = payloadLength === 0x08 ? 'setSource' : 'getCurrentSource'
    else if (commandType === 0x05) commandName = 'getSystemVolume'
    else if (commandType === 0x06) commandName = 'setVolume'
    else if (commandType === 0x07) commandName = 'getWiredNetwork'
    else if (commandType === 0x0C) {
       if (buffer[10] === 0x00) commandName = 'initProgramList'
       else commandName = 'setPlaybackCommand'
    } else if (commandType === 0x0D) {
       if (buffer[10] === 0x00) commandName = 'getSystemStatus'
       else commandName = 'setScreenPower'
    }

    const ackByte = buffer[2]
    const isSuccess = ackByte === 0x00
    
    let ackMessage = 'Command executed successfully'
    if (ackByte === 0x01) ackMessage = 'Execution failed'
    else if (ackByte === 0x02) ackMessage = 'Request validation error'
    else if (ackByte === 0x03) ackMessage = 'Response validation error'
    else if (ackByte === 0x04) ackMessage = 'Unsupported command'
    else if (!isSuccess) ackMessage = `Unknown error (Code: 0x${ackByte.toString(16).padStart(2,'0')})`

    // IMPORTANT: If not successful, do not attempt to read data payloads!
    if (!isSuccess) {
       console.log(`[TU Parser] [${commandName}] failed with ACK=0x${ackByte.toString(16).padStart(2,'0')} (${ackMessage})`)
       return { valid: true, success: false, message: ackMessage, commandName, data: { ack: false, code: ackByte }, raw: buffer }
    }

    // Now, ONLY successful parses fall through to data extraction.
    let extractedData: any = { ack: true }
    
    if (commandName === 'getHdmiStatus') {
       extractedData = { 
         isHdmi1Connected: buffer[18] === 0x01,
         isHdmi2Connected: buffer[19] === 0x01,
         isAndroidConnected: buffer[20] === 0x01,
         isHdmi3Connected: buffer[21] === 0x01
       }
    } else if (commandName === 'getCurrentSource') {
       extractedData = { sourceIndex: buffer[18] }
    } else if (commandName === 'getSystemVolume') {
       extractedData = { isMuted: buffer[18] === 0x01, volume: buffer.length > 19 ? buffer[19] : 0 }
    } else if (commandName === 'getWiredNetwork') {
       extractedData = { isConnected: buffer[18] === 0x01 }
    } else if (commandName === 'getSystemStatus') {
       let statusStr = 'Unknown'
       if (buffer[18] === 0xFF) statusStr = 'POWER_FAILED'
       else if (buffer[18] === 0x00) statusStr = 'Standby'
       else if (buffer[18] === 0x01) statusStr = 'Normal display'
       extractedData = { status: statusStr, statusCode: buffer[18] }
    } else if (commandName === 'getBrightness') {
       // Reverse map from 0-255 to 0-100 scaling
       const percentage = Math.round((buffer[18] / 255) * 100)
       extractedData = { brightness: percentage }
    } else if (commandName === 'initProgramList') {
       console.log(`[TU Parser] initProgramList raw buffer: ${buffer.toString('hex')} (Length: ${buffer.length}), reading buffer[18] as programCount: ${buffer[18]}`)
       extractedData = { programCount: buffer[18] }
    }
    // setSource, setVolume, setBrightness, setPlaybackCommand, and setScreenPower only need success/fail status which is handled by extractedData = {ack:true}

    return { valid: true, success: true, message: ackMessage, commandName, data: extractedData, raw: buffer }
  }

  parse(buffer: Buffer): TUParsedResponse {
    return TUSeriesParser.parse(buffer)
  }
}
