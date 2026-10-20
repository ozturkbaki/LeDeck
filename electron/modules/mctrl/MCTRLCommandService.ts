import { MCTRLConnection } from './MCTRLConnection'
import { MCTRLProtocolBuilder } from './MCTRLProtocolBuilder'
import { MCTRLParser } from './MCTRLParser'
import { MCTRLException, MCTRL_ERROR_CODES } from './MCTRLException'

export class MCTRLCommandService {
  private queue: Promise<any> = Promise.resolve()
  private serialCounter = 0x01

  constructor(
    private readonly connection: MCTRLConnection,
    private readonly builder: MCTRLProtocolBuilder,
    private readonly parser: MCTRLParser,
  ) {}

  private nextSerial(): number {
    this.serialCounter = (this.serialCounter + 1) & 0xFF || 0x01
    return this.serialCounter
  }

  async sendCommand(commandName: string, params?: Record<string, any>): Promise<{ success: boolean; message?: string; data?: unknown }> {
    const execute = async () => {
      if (!this.connection.isConnected()) {
        throw new MCTRLException('Not connected', MCTRL_ERROR_CODES.CONNECTION_FAILED)
      }

      let packet: Buffer

      switch (commandName) {
        case 'getModelId':
          packet = MCTRLProtocolBuilder.buildModelIdRequest(this.nextSerial())
          break
        case 'getFirmwareVersion':
          packet = MCTRLProtocolBuilder.buildFirmwareVersionRequest(this.nextSerial())
          break
        case 'getDviSignalStatus':
          packet = MCTRLProtocolBuilder.buildDviStatusRequest(this.nextSerial())
          break
        case 'getBrightness':
          packet = MCTRLProtocolBuilder.buildGetBrightnessRequest(this.nextSerial())
          break
        case 'setBrightness':
          if (params?.value === undefined) throw new MCTRLException('setBrightness: value required', MCTRL_ERROR_CODES.INVALID_COMMAND)
          packet = MCTRLProtocolBuilder.buildSetBrightnessRequest(params.value as number, this.nextSerial())
          break
        case 'checkInputSourceStatus':
          packet = MCTRLProtocolBuilder.buildCheckInputSourceStatusRequest(this.nextSerial())
          break
        case 'setInputSourceMode':
          if (params?.manual === undefined) throw new MCTRLException('setInputSourceMode: manual required', MCTRL_ERROR_CODES.INVALID_COMMAND)
          packet = MCTRLProtocolBuilder.buildSetInputSourceModeRequest(params.manual as boolean, this.nextSerial())
          break
        case 'getInputSource':
          packet = MCTRLProtocolBuilder.buildGetInputSourceRequest(this.nextSerial())
          break
        case 'setInputSource':
          if (params?.sourceCode === undefined) throw new MCTRLException('setInputSource: sourceCode required', MCTRL_ERROR_CODES.INVALID_COMMAND)
          packet = MCTRLProtocolBuilder.buildSetInputSourceRequest(params.sourceCode as number, this.nextSerial())
          break
        default:
          throw new MCTRLException(`Unsupported command: ${commandName}`, MCTRL_ERROR_CODES.INVALID_COMMAND)
      }

      console.log(`[MCTRL OUT] ${commandName}: ${packet.toString('hex')}`)
      const raw = await this.connection.send(packet)
      console.log(`[MCTRL IN] ${raw.toString('hex')} (${raw.length} bytes)`)

      const parsed = this.parser.parse(raw)

      if (parsed.success) {
        console.log(`[MCTRL RESULT] OK. Data:`, parsed.data)
      } else {
        console.log(`[MCTRL RESULT] Failed: ${parsed.ackMessage}`)
      }

      return {
        success: parsed.success,
        message: parsed.ackMessage,
        data: parsed.data
      }
    }

    const resultPromise = this.queue.then(execute).catch(execute)
    this.queue = resultPromise.catch(() => {})
    return resultPromise
  }
}
