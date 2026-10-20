import net from 'net'
import { TUSeriesException, TU_ERROR_CODES } from './TUSeriesException'

/**
 * TUSeriesConnection
 * TCP connection for TU Series Devices (Fixed port 5201)
 */

export interface TUConnectionConfig {
  ipAddress: string
  timeoutMs?: number
}

export interface TUConnectionResult {
  success: boolean
  message: string
  deviceInfo?: {
    model?: string
  }
}

export class TUSeriesConnection {
  private socket: net.Socket | null = null
  private config: TUConnectionConfig | null = null
  private connected = false

  async connect(config: TUConnectionConfig): Promise<TUConnectionResult> {
    this.config = config
    const timeout = config.timeoutMs ?? 5000
    const FIXED_PORT = 5201

    return new Promise((resolve) => {
      try {
        const socket = new net.Socket()
        let resolved = false

        const timer = setTimeout(() => {
          if (!resolved) {
            resolved = true
            socket.destroy()
            resolve({ success: false, message: `TU Connection timed out after ${timeout}ms` })
          }
        }, timeout)

        socket.connect(FIXED_PORT, config.ipAddress, () => {
          if (!resolved) {
            resolved = true
            clearTimeout(timer)
            this.socket = socket
            this.connected = true
            resolve({ success: true, message: 'Connected successfully', deviceInfo: { model: 'TU Series' } })
          }
        })

        socket.on('error', (err) => {
          if (!resolved) {
            resolved = true
            clearTimeout(timer)
            resolve({ success: false, message: `Connection error: ${err.message}` })
          } else {
            console.error('[TU Connection] Async Socket Error:', err.message)
          }
        })

        socket.on('close', () => {
          this.connected = false
          this.socket = null
        })
      } catch (err) {
        throw new TUSeriesException(
          `Failed to initiate connection: ${String(err)}`,
          TU_ERROR_CODES.CONNECTION_FAILED,
          err
        )
      }
    })
  }

  async testConnection(config: TUConnectionConfig): Promise<TUConnectionResult> {
    const result = await this.connect(config)
    if (result.success) this.disconnect()
    return result
  }

  disconnect(): void {
    if (this.socket) { this.socket.destroy(); this.socket = null }
    this.connected = false
  }

  isConnected(): boolean { return this.connected }
  getConfig(): TUConnectionConfig | null { return this.config }

  async send(packet: Buffer): Promise<Buffer> {
    if (!this.socket || !this.connected) {
      throw new TUSeriesException('Socket not connected', TU_ERROR_CODES.CONNECTION_FAILED)
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new TUSeriesException('Command timed out', TU_ERROR_CODES.COMMAND_TIMEOUT))
      }, 5000)
      
      const onData = (data: Buffer) => {
        clearTimeout(timer)
        this.socket?.removeListener('data', onData)
        this.socket?.removeListener('error', onError)
        resolve(data)
      }
      
      const onError = (err: Error) => {
        clearTimeout(timer)
        this.socket?.removeListener('data', onData)
        this.socket?.removeListener('error', onError)
        reject(new TUSeriesException(`Write/Read failed: ${err.message}`, TU_ERROR_CODES.SEND_FAILED, err))
      }

      this.socket!.on('data', onData)
      this.socket!.on('error', onError)
      
      this.socket!.write(packet, (err) => {
        if (err) {
          clearTimeout(timer)
          this.socket?.removeListener('data', onData)
          this.socket?.removeListener('error', onError)
          reject(new TUSeriesException(`Write failed: ${err.message}`, TU_ERROR_CODES.SEND_FAILED, err))
        }
      })
    })
  }
}
