import { TUSeriesConnection } from './TUSeriesConnection'
import { TUSeriesProtocolBuilder } from './TUSeriesProtocolBuilder'
import { TUSeriesParser } from './TUSeriesParser'
import { TUSeriesException, TU_ERROR_CODES } from './TUSeriesException'

export class TUSeriesCommandService {
  private queue: Promise<any> = Promise.resolve()

  constructor(
    private readonly connection: TUSeriesConnection,
    private readonly builder: TUSeriesProtocolBuilder,
    private readonly parser: TUSeriesParser,
  ) {}

  async sendCommand(commandName: string, params?: Record<string, any>): Promise<{ success: boolean; message?: string; data?: unknown }> {
    const execute = async () => {
      if (!this.connection.isConnected()) {
        throw new TUSeriesException('Not connected', TU_ERROR_CODES.CONNECTION_FAILED)
      }

      let packet: Buffer
      switch (commandName) {
        case 'setSource':
          if (params?.sourceIndex === undefined) throw new Error('Missing sourceIndex')
          packet = TUSeriesProtocolBuilder.setSourceCommand(params.sourceIndex)
          break
        case 'setVolume':
          if (params?.volume === undefined) throw new Error('Missing volume')
          packet = TUSeriesProtocolBuilder.setVolumeCommand(params.volume)
          break
        case 'setBrightness':
          if (params?.percent === undefined) throw new Error('Missing brightness percent')
          packet = TUSeriesProtocolBuilder.setBrightnessCommand(params.percent)
          break
        case 'setStandby':
          packet = TUSeriesProtocolBuilder.setStandbyCommand()
          break
        case 'setWakeUp':
          packet = TUSeriesProtocolBuilder.setWakeUpCommand()
          break
        case 'setPowerOff':
          packet = TUSeriesProtocolBuilder.setPowerOffCommand()
          break
        case 'setRemoteCommand':
          if (params?.actionByte === undefined) throw new Error('Missing actionByte')
          packet = TUSeriesProtocolBuilder.setRemoteCommand(params.actionByte)
          break
        case 'initProgramList':
          packet = TUSeriesProtocolBuilder.initProgramListCommand()
          break
        case 'setPlayProgram':
          if (params?.index === undefined) throw new Error('Missing program index')
          packet = TUSeriesProtocolBuilder.setPlayProgramCommand(params.index)
          break
        case 'setPlaybackAction':
          if (params?.actionByte === undefined) throw new Error('Missing playback actionByte')
          packet = TUSeriesProtocolBuilder.setPlaybackActionCommand(params.actionByte)
          break
        case 'setScreenPower':
          if (params?.isOn === undefined) throw new Error('Missing screen isOn boolean')
          packet = TUSeriesProtocolBuilder.setScreenPowerCommand(params.isOn)
          break
        case 'getCurrentSource':
          packet = TUSeriesProtocolBuilder.getSourceCommand()
          break
        case 'getSystemVolume':
          packet = TUSeriesProtocolBuilder.getVolumeCommand()
          break
        case 'getWiredNetwork':
          packet = TUSeriesProtocolBuilder.getNetworkCommand()
          break
        case 'getSystemStatus':
          packet = TUSeriesProtocolBuilder.getStatusCommand()
          break
        case 'getHdmiStatus':
          packet = TUSeriesProtocolBuilder.getHdmiStatusCommand()
          break
        case 'getBrightness':
          packet = TUSeriesProtocolBuilder.getBrightnessCommand()
          break
        default:
          throw new TUSeriesException(`Unsupported command: ${commandName}`, TU_ERROR_CODES.INVALID_COMMAND)
      }

      console.log(`[TU OUT] Executing ${commandName}: ${packet.toString('hex')}`)
      const raw = await this.connection.send(packet)
      console.log(`[TU IN] Received: ${raw.toString('hex')} (Length: ${raw.length})`)

      const parsed = this.parser.parse(raw)
      
      if (parsed.success) {
         console.log(`[TU RESULT] Parsed OK. Data:`, parsed.data)
      } else {
         console.log(`[TU RESULT] Command Failed: ${parsed.message || 'Unknown error'}`, parsed.raw.toString('hex'))
      }

      return { success: parsed.success, message: parsed.message || (parsed.success ? 'Command executed successfully' : 'Command failed'), data: parsed.data }
    }

    const resultPromise = this.queue.then(execute).catch(execute)
    this.queue = resultPromise.catch(() => {})
    return resultPromise
  }
}
