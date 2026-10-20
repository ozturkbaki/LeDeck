import { SerialPort } from 'serialport'
import { MCTRLException, MCTRL_ERROR_CODES } from './MCTRLException'
import { MCTRLProtocolBuilder } from './MCTRLProtocolBuilder'
import { MCTRLParser } from './MCTRLParser'

export interface MCTRLConnectionConfig {
  comPort: string
  baudRate: number
  timeoutMs?: number
}

export interface MCTRLConnectionResult {
  success: boolean
  message: string
  deviceInfo?: {
    model?: string
    firmware?: string
  }
}

export interface MCTRLPortInfo {
  path: string
  manufacturer?: string
  serialNumber?: string
  pnpId?: string
  locationId?: string
  vendorId?: string
  productId?: string
}

export interface MCTRLDiscoveredDevice {
  comPort: string
  baudRate: number
  modelIdLow: number
  modelIdHigh: number
  modelName: string
  displayName: string
}

/** Baud rates to probe during scan (Phase 1) */
const SCAN_BAUD_RATES = [115200, 1048576]

/** Timeout per port+baud combination during scan (ms) */
const SCAN_TIMEOUT_MS = 2000

export class MCTRLConnection {
  private port: SerialPort | null = null
  private config: MCTRLConnectionConfig | null = null
  private connected = false

  static async listPorts(): Promise<MCTRLPortInfo[]> {
    try {
      const ports = await SerialPort.list()
      return ports.map((p) => ({
        path: p.path,
        manufacturer: p.manufacturer,
        serialNumber: p.serialNumber,
        pnpId: p.pnpId,
        locationId: p.locationId,
        vendorId: p.vendorId,
        productId: p.productId
      }))
    } catch (err) {
      throw new MCTRLException(
        `Failed to list COM ports: ${String(err)}`,
        MCTRL_ERROR_CODES.PORT_NOT_FOUND,
        err
      )
    }
  }

  /**
   * Scans all available COM ports with Phase 1 baud rates.
   * Returns a list of confirmed MCTRL devices.
   * Does NOT keep ports open after discovery.
   */
  async scanAndDiscover(
    onProgress?: (msg: string) => void
  ): Promise<MCTRLDiscoveredDevice[]> {
    const discovered: MCTRLDiscoveredDevice[] = []

    let ports: MCTRLPortInfo[]
    try {
      ports = await MCTRLConnection.listPorts()
    } catch (err) {
      console.error('[MCTRL Scan] Failed to list ports:', err)
      return []
    }

    console.log(`[MCTRL Scan] Found ${ports.length} COM port(s): ${ports.map(p => p.path).join(', ')}`)
    onProgress?.(`${ports.length} COM port bulundu. Taranıyor...`)

    for (const portInfo of ports) {
      for (const baudRate of SCAN_BAUD_RATES) {
        console.log(`[MCTRL Scan] Trying ${portInfo.path} @ ${baudRate} baud...`)
        onProgress?.(`${portInfo.path} → ${baudRate} baud deneniyor...`)

        const result = await this._probePort(portInfo.path, baudRate)
        if (result) {
          console.log(`[MCTRL Scan] FOUND: ${portInfo.path} @ ${baudRate} → ${result.modelName}`)
          onProgress?.(`✓ Bulundu: ${result.modelName} (${portInfo.path})`)
          discovered.push(result)
          break // Found on this port, no need to try other baud rates
        }
      }
    }

    console.log(`[MCTRL Scan] Scan complete. ${discovered.length} device(s) found.`)
    return discovered
  }

  /**
   * Safely closes a SerialPort only if it is currently open.
   * Returns a promise so callers can await the close.
   */
  private _safeClose(port: SerialPort): Promise<void> {
    return new Promise((resolve) => {
      if (!port.isOpen) {
        resolve()
        return
      }
      port.close((err) => {
        if (err) console.warn(`[MCTRL Scan] close() error (ignored): ${err.message}`)
        resolve()
      })
    })
  }

  /**
   * Opens port, sends Model ID request, reads response, then safely closes port.
   * Returns a DiscoveredDevice if a valid model is found, null otherwise.
   *
   * Rules:
   *  - port.close() is ONLY called when port.isOpen === true
   *  - If port.open() fails, close is never called
   *  - Timeout and errors also go through _safeClose()
   */
  private async _probePort(comPort: string, baudRate: number): Promise<MCTRLDiscoveredDevice | null> {
    const port = new SerialPort({ path: comPort, baudRate, autoOpen: false })
    let portOpened = false

    // Promise-based port.open()
    const openResult: { ok: boolean; err?: Error } = await new Promise((resolve) => {
      port.open((err) => {
        if (err) resolve({ ok: false, err })
        else resolve({ ok: true })
      })
    })

    if (!openResult.ok) {
      console.warn(`[MCTRL Scan] Cannot open ${comPort} @ ${baudRate}: ${openResult.err?.message}`)
      // Port never opened — do NOT call close()
      return null
    }

    portOpened = true
    console.log(`[MCTRL Scan] Opened ${comPort} @ ${baudRate}`)

    try {
      const result = await new Promise<MCTRLDiscoveredDevice | null>((resolve) => {
        let settled = false
        const chunks: Buffer[] = []

        const settle = (val: MCTRLDiscoveredDevice | null) => {
          if (settled) return
          settled = true
          port.removeAllListeners('data')
          resolve(val)
        }

        const timer = setTimeout(() => {
          console.warn(`[MCTRL Scan] Timeout on ${comPort} @ ${baudRate}`)
          settle(null)
        }, SCAN_TIMEOUT_MS)

        port.on('data', (chunk: Buffer) => {
          chunks.push(chunk)
          const full = Buffer.concat(chunks)
          console.log(`[MCTRL Scan] ${comPort}: received ${full.toString('hex')} (${full.length} bytes)`)

          if (full.length < 22) return  // Wait for full response

          clearTimeout(timer)

          const parsed = MCTRLParser.parseModelId(full)
          if (parsed) {
            settle({
              comPort,
              baudRate,
              modelIdLow:  parsed.modelIdLow,
              modelIdHigh: parsed.modelIdHigh,
              modelName:   parsed.modelName,
              displayName: parsed.modelName,
            })
          } else {
            settle(null)
          }
        })

        const packet = MCTRLProtocolBuilder.buildModelIdRequest(0x01)
        console.log(`[MCTRL Scan] ${comPort}: sending ${packet.toString('hex')}`)

        port.write(packet, (writeErr) => {
          if (writeErr) {
            console.warn(`[MCTRL Scan] Write failed on ${comPort}: ${writeErr.message}`)
            clearTimeout(timer)
            settle(null)
          }
        })
      })

      return result

    } finally {
      // Always close the port if it was successfully opened — guarded by isOpen check
      if (portOpened) {
        await this._safeClose(port)
        console.log(`[MCTRL Scan] Closed ${comPort} @ ${baudRate}`)
      }
    }
  }

  async connect(config: MCTRLConnectionConfig): Promise<MCTRLConnectionResult> {
    this.config = config

    return new Promise((resolve) => {
      try {
        const port = new SerialPort({
          path: config.comPort,
          baudRate: config.baudRate,
          autoOpen: false
        })

        port.open((err) => {
          if (err) {
            resolve({ success: false, message: `Failed to open ${config.comPort}: ${err.message}` })
            return
          }
          this.port = port
          this.connected = true

          port.on('close', () => {
            this.connected = false
            this.port = null
          })

          console.log(`[MCTRL] Connected to ${config.comPort} @ ${config.baudRate} baud`)
          resolve({
            success: true,
            message: `Connected to ${config.comPort} at ${config.baudRate} baud`,
            deviceInfo: { model: config.comPort }
          })
        })
      } catch (err) {
        throw new MCTRLException(
          `Failed to open serial port: ${String(err)}`,
          MCTRL_ERROR_CODES.PORT_OPEN_FAILED,
          err
        )
      }
    })
  }

  async testConnection(config: MCTRLConnectionConfig): Promise<MCTRLConnectionResult> {
    const result = await this.connect(config)
    if (result.success) this.disconnect()
    return result
  }

  disconnect(): void {
    if (this.port && this.port.isOpen) {
      this.port.close()
      this.port = null
    }
    this.connected = false
  }

  isConnected(): boolean { return this.connected }
  getConfig(): MCTRLConnectionConfig | null { return this.config }
  getPort(): SerialPort | null { return this.port }

  async send(packet: Buffer): Promise<Buffer> {
    if (!this.port || !this.connected) {
      throw new MCTRLException('Port not connected', MCTRL_ERROR_CODES.CONNECTION_FAILED)
    }
    return new Promise((resolve, reject) => {
      const timeoutMs = this.config?.timeoutMs ?? 5000
      const timer = setTimeout(() => {
        this.port?.removeListener('data', onData)
        reject(new MCTRLException('Command timed out', MCTRL_ERROR_CODES.COMMAND_TIMEOUT))
      }, timeoutMs)

      const chunks: Buffer[] = []

      const onData = (data: Buffer) => {
        chunks.push(data)
        const full = Buffer.concat(chunks)

        // Need at least 18 bytes to read the data-length field ([16-17])
        if (full.length < 18) return

        // Response frame total = 18 header bytes + dataLen + 2 checksum
        const dataLen     = full[16] | (full[17] << 8)
        const expectedLen = 20 + dataLen   // 18 + dataLen + 2

        if (full.length >= expectedLen) {
          clearTimeout(timer)
          this.port?.removeListener('data', onData)
          resolve(full)
        }
      }

      this.port!.on('data', onData)
      this.port!.write(packet, (err) => {
        if (err) {
          clearTimeout(timer)
          this.port?.removeListener('data', onData)
          reject(new MCTRLException(`Write failed: ${err.message}`, MCTRL_ERROR_CODES.SEND_FAILED, err))
        }
      })
    })
  }
}
