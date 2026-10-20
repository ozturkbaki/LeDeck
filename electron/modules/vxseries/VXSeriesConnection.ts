import net from 'net'
import dgram from 'dgram'
import { VXSeriesException, VX_ERROR_CODES } from './VXSeriesException'

/**
 * VXSeriesConnection
 * 
 * Manages TCP connection lifecycle for VX Series devices.
 * Also supports UDP broadcast for device discovery (searchDevices).
 * Protocol implementation placeholder — will be filled when spec is provided.
 */

export interface VXConnectionConfig {
  ipAddress: string
  port: number
  timeoutMs?: number
}

export interface VXConnectionResult {
  success: boolean
  message: string
  deviceInfo?: {
    model?: string
    firmware?: string
    ipAddress?: string
  }
}

export interface VXDiscoveredDevice {
  ipAddress: string
  port: number
  model?: string
  macAddress?: string
}

export class VXSeriesConnection {
  private socket: net.Socket | null = null
  private config: VXConnectionConfig | null = null
  private connected = false

  async connect(config: VXConnectionConfig): Promise<VXConnectionResult> {
    this.config = config
    const timeout = config.timeoutMs ?? 5000

    return new Promise((resolve) => {
      try {
        const socket = new net.Socket()
        let resolved = false

        const timer = setTimeout(() => {
          if (!resolved) {
            resolved = true
            socket.destroy()
            resolve({ success: false, message: `Connection timed out after ${timeout}ms` })
          }
        }, timeout)

        socket.connect(config.port, config.ipAddress, () => {
          if (!resolved) {
            resolved = true
            clearTimeout(timer)
            this.socket = socket
            this.connected = true
            resolve({ success: true, message: 'Connected successfully', deviceInfo: { model: 'VX Series (Mock)', ipAddress: config.ipAddress } })
          }
        })

        socket.on('error', (err) => {
          if (!resolved) {
            resolved = true
            clearTimeout(timer)
            resolve({ success: false, message: `Connection error: ${err.message}` })
          }
        })

        socket.on('close', () => {
          this.connected = false
          this.socket = null
        })
      } catch (err) {
        throw new VXSeriesException(
          `Failed to initiate connection: ${String(err)}`,
          VX_ERROR_CODES.CONNECTION_FAILED,
          err
        )
      }
    })
  }

  /**
   * UDP broadcast device discovery.
   * TODO: Implement actual discovery packet when protocol spec is provided.
   */
  async searchDevices(timeoutMs = 3000): Promise<VXDiscoveredDevice[]> {
    return new Promise((resolve) => {
      const discovered: VXDiscoveredDevice[] = []
      try {
        const udp = dgram.createSocket('udp4')
        udp.bind(() => {
          udp.setBroadcast(true)
          // TODO: Replace with actual discovery broadcast packet
          const msg = Buffer.from('LEDECA_VX_DISCOVER')
          udp.send(msg, 0, msg.length, 5555, '255.255.255.255')
        })

        udp.on('message', (msg, rinfo) => {
          // TODO: Parse actual discovery response
          discovered.push({ ipAddress: rinfo.address, port: rinfo.port })
        })

        setTimeout(() => {
          udp.close()
          resolve(discovered)
        }, timeoutMs)

        udp.on('error', () => { udp.close(); resolve(discovered) })
      } catch {
        resolve(discovered)
      }
    })
  }

  async testConnection(config: VXConnectionConfig): Promise<VXConnectionResult> {
    const result = await this.connect(config)
    if (result.success) this.disconnect()
    return result
  }

  disconnect(): void {
    if (this.socket) { this.socket.destroy(); this.socket = null }
    this.connected = false
  }

  isConnected(): boolean { return this.connected }
  getConfig(): VXConnectionConfig | null { return this.config }

  async send(packet: Buffer): Promise<Buffer> {
    if (!this.socket || !this.connected) {
      throw new VXSeriesException('Socket not connected', VX_ERROR_CODES.CONNECTION_FAILED)
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new VXSeriesException('Command timed out', VX_ERROR_CODES.COMMAND_TIMEOUT))
      }, 5000)
      const onData = (data: Buffer) => {
        clearTimeout(timer)
        this.socket?.removeListener('data', onData)
        resolve(data)
      }
      this.socket!.on('data', onData)
      this.socket!.write(packet, (err) => {
        if (err) {
          clearTimeout(timer)
          this.socket?.removeListener('data', onData)
          reject(new VXSeriesException(`Write failed: ${err.message}`, VX_ERROR_CODES.SEND_FAILED, err))
        }
      })
    })
  }
}

