/**
 * TaurusConnection — HTTPS Session Manager
 * Node.js built-in `https` modülü kullanır (node-fetch yok).
 * Self-signed TLS bypass dahil.
 */

import https from 'https'
import { TaurusException, TAURUS_ERROR_CODES } from './TaurusException'
import type { TaurusDeviceInfo } from './TaurusDiscovery'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaurusCredentials {
  ip:         string
  port:       number
  username:   string
  password:   string
  sn:         string
  deviceName: string
}

export interface TaurusApiResponse<T = unknown> {
  code:  number
  msg?:  string
  data?: T
}

export interface TaurusLoginData {
  token:    string
  sn:       string
  username: string
  logined:  boolean
}

export interface TaurusDeviceBaseInfo {
  sn:          string
  productName: string
  modelId:     number
  aliasName:   string
  osVersion:   string
  ip:          string
  width:       number
  height:      number
  platform:    string
}

// ─── SSL bypass agent ─────────────────────────────────────────────────────────

const UNSAFE_AGENT = new https.Agent({ rejectUnauthorized: false })

// ─── Native HTTPS request ─────────────────────────────────────────────────────

function doRequest<T>(
  method:  'GET' | 'POST' | 'DELETE',
  url:     string,
  body?:   Record<string, unknown>,
  token?:  string,
  timeout = 10000,
): Promise<TaurusApiResponse<T>> {
  return new Promise<TaurusApiResponse<T>>((resolve, reject) => {
    const parsed  = new URL(url)
    const payload = body ? JSON.stringify(body) : undefined

    const options: https.RequestOptions = {
      hostname: parsed.hostname,
      port:     parsed.port ? parseInt(parsed.port, 10) : 443,
      path:     parsed.pathname + parsed.search,
      method,
      agent:    UNSAFE_AGENT,
      headers: {
        'Content-Type': 'application/json',
        Accept:         'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(token  ? { Authorization: token } : {}),
      },
    }

    const req = https.request(options, (res) => {
      let raw = ''
      res.on('data', (chunk) => { raw += chunk })
      res.on('end',  () => {
        if ((res.statusCode ?? 0) >= 400) {
          reject(new TaurusException(`HTTP ${res.statusCode}`, TAURUS_ERROR_CODES.CONNECTION_FAILED, res.statusCode))
          return
        }
        try { resolve(JSON.parse(raw) as TaurusApiResponse<T>) }
        catch { reject(new TaurusException('JSON parse hatası', TAURUS_ERROR_CODES.COMMAND_FAILED)) }
      })
    })

    req.on('error', (err) => reject(new TaurusException(err.message, TAURUS_ERROR_CODES.CONNECTION_FAILED)))
    req.setTimeout(timeout, () => { req.destroy(); reject(new TaurusException('Zaman aşımı', TAURUS_ERROR_CODES.CONNECTION_FAILED)) })
    if (payload) req.write(payload)
    req.end()
  })
}

/** Binary veri (resim vb.) çekmek için kullanılan düşük seviyeli istek fonksiyonu */
function doRequestRaw(
  method:  'GET' | 'POST',
  url:     string,
  token?:  string,
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const parsed  = new URL(url)
    const options: https.RequestOptions = {
      hostname: parsed.hostname,
      port:     parsed.port ? parseInt(parsed.port, 10) : 443,
      path:     parsed.pathname + parsed.search,
      method,
      agent:    UNSAFE_AGENT,
      headers: {
        ...(token  ? { Authorization: token } : {}),
      },
    }

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end',  () => {
        if ((res.statusCode ?? 0) >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }
        resolve(Buffer.concat(chunks))
      })
    })

    req.on('error', (err) => reject(err))
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Zaman aşımı')) })
    req.end()
  })
}

// ─── TaurusConnection ─────────────────────────────────────────────────────────

export class TaurusConnection {
  private token:       string | null = null
  private credentials: TaurusCredentials | null = null
  private _connected   = false
  private loginPromise: Promise<string> | null = null

  get isConnected(): boolean { return this._connected }
  get currentToken(): string | null { return this.token }
  get deviceName(): string { return this.credentials?.deviceName ?? '' }
  get ip():   string { return this.credentials?.ip  ?? '' }
  get port(): number { return this.credentials?.port ?? 16674 }
  get sn():   string { return this.credentials?.sn   ?? '' }

  private baseUrl(): string { return `https://${this.ip}:${this.port}` }

  // ─── Anonymous base-info (SN almak için, pre-login) ────────────────────────

  static async fetchBaseInfoAnonymous(ip: string, port = 16674): Promise<TaurusDeviceBaseInfo | null> {
    try {
      const url  = `https://${ip}:${port}/terminal/core/v1/device/base-info`
      const resp = await doRequest<TaurusDeviceBaseInfo>('GET', url)
      if (resp.code === 0 && resp.data) return resp.data
      return null
    } catch { return null }
  }

  // ─── Login ─────────────────────────────────────────────────────────────────

  async login(creds: TaurusCredentials): Promise<string> {
    if (this.loginPromise) return this.loginPromise

    this.loginPromise = (async () => {
      try {
        this.credentials = creds
        const url = `${this.baseUrl()}/terminal/core/v1/user/login`
        console.log(`[TaurusConnection] Login → ${url}`)
        console.log(`[TaurusConnection] Body: sn=${creds.sn ? creds.sn : '(omitted)'}, user=${creds.username}`)

        const body: Record<string, unknown> = {
          sn:         creds.sn || '',
          clientName: 'ledeca',
          username:   creds.username,
          password:   creds.password,
          loginType:  '2',
          clientId:   '1',
        }

        const resp = await doRequest<TaurusLoginData>('POST', url, body)
        console.log(`[TaurusConnection] Login response: code=${resp.code} msg=${resp.msg ?? ''}`)

        if (resp.code === TAURUS_ERROR_CODES.API_FORBIDDEN) {
          throw new TaurusException('Çok fazla hatalı giriş denemesi. Lütfen 60 saniye bekleyin.', TAURUS_ERROR_CODES.API_FORBIDDEN, resp.code)
        }
        if (resp.code === TAURUS_ERROR_CODES.API_VERIFY_FAILED) {
          throw new TaurusException('Yanlış kullanıcı adı veya şifre (code 24).', TAURUS_ERROR_CODES.API_VERIFY_FAILED, resp.code)
        }
        if (resp.code !== 0 || !resp.data?.token) {
          throw new TaurusException(`Login başarısız: code ${resp.code}`, TAURUS_ERROR_CODES.INVALID_CREDENTIALS, resp.code)
        }

        this.token      = resp.data.token
        this._connected = true
        console.log(`[TaurusConnection] Login OK. Token=${this.token.substring(0, 12)}...`)
        return this.token
      } finally {
        this.loginPromise = null
      }
    })()

    return this.loginPromise
  }

  // ─── Request (with auto re-login on code 39) ───────────────────────────────

  async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    apiPath: string,
    body?:   Record<string, unknown>,
    timeout?: number,
  ): Promise<TaurusApiResponse<T>> {
    if (!this._connected || !this.token) throw new TaurusException('Bağlantı yok', TAURUS_ERROR_CODES.SESSION_LOST)

    const url  = `${this.baseUrl()}${apiPath}`
    const resp = await doRequest<T>(method, url, body, this.token, timeout)

    if (resp.code === TAURUS_ERROR_CODES.API_TOKEN_EXPIRED) {
      console.warn('[TaurusConnection] Token expired (39). Re-logging...')
      if (!this.credentials) throw new TaurusException('Kimlik bilgileri yok', TAURUS_ERROR_CODES.SESSION_LOST)
      await this.login(this.credentials)
      return doRequest<T>(method, url, body, this.token!)
    }
    return resp
  }

  /** Ham veri (resim dosyası vb.) indirmek için kullanılır */
  async requestRaw(apiPath: string): Promise<Buffer> {
    if (!this._connected || !this.token) throw new TaurusException('Bağlantı yok', TAURUS_ERROR_CODES.SESSION_LOST)
    const url = `${this.baseUrl()}${apiPath}`
    return doRequestRaw('GET', url, this.token)
  }

  // ─── Logout ────────────────────────────────────────────────────────────────

  async logout(): Promise<void> {
    if (!this._connected || !this.token) return
    try { 
      // Logout için en fazla 1 saniye bekle
      await this.request('DELETE', '/terminal/core/v1/logout', undefined, 1000) 
    }
    catch (err) { console.warn('[TaurusConnection] Logout timeout/error (ignored)') }
    finally { 
      this.token = null; 
      this._connected = false; 
      this.credentials = null;
      this.loginPromise = null;
    }
  }

  // ─── Shortcuts ─────────────────────────────────────────────────────────────

  async getBaseInfo(): Promise<TaurusDeviceBaseInfo> {
    const r = await this.request<TaurusDeviceBaseInfo>('GET', '/terminal/core/v1/device/base-info')
    if (r.code !== 0 || !r.data) throw new TaurusException(`getBaseInfo: ${r.msg}`, TAURUS_ERROR_CODES.COMMAND_FAILED)
    return r.data
  }

  // ─── Static connect helpers ────────────────────────────────────────────────

  static async connectFromDiscovery(
    device:   TaurusDeviceInfo,
    username: string,
    password: string,
    snHint?:  string,
  ): Promise<TaurusConnection> {
    const conn = new TaurusConnection()
    // SN: discovery'den gelen > kullanıcı hint'i > boş (field gönderilmez)
    const sn = device.sn || snHint?.trim() || ''
    await conn.login({
      ip:         device.ip,
      port:       device.terminalEntrancePortHttps || 16674,
      username,
      password,
      sn,
      deviceName: device.productName || device.aliasName || 'Taurus Device',
    })
    // Login sonrası SN hala boşsa token ile çek
    await conn._fetchSnPostLogin()
    return conn
  }

  static async connectManual(
    ip:       string,
    port:     number,
    username: string,
    password: string,
    snHint?:  string,
  ): Promise<TaurusConnection> {
    const conn = new TaurusConnection()
    let sn         = snHint?.trim() ?? ''
    let deviceName = `${ip}:${port}`

    // 1. Anonymous base-info'dan SN almayı dene (bazı firmware'ler auth olmadan verir)
    if (!sn) {
      const baseInfo = await TaurusConnection.fetchBaseInfoAnonymous(ip, port)
      if (baseInfo) {
        sn         = baseInfo.sn
        deviceName = baseInfo.productName || baseInfo.aliasName || deviceName
        console.log(`[TaurusConnection] Anonymous base-info OK → SN: ${sn}`)
      }
    }

    // 2. Login (SN varsa body'ye konur, yoksa hiç gönderilmez — bazı cihazlar SN'siz kabul eder)
    await conn.login({ ip, port, username, password, sn, deviceName })

    // 3. Token ile base-info çek — SN ve cihaz adını tamamla
    await conn._fetchSnPostLogin()

    return conn
  }

  /** Token alındıktan sonra base-info'dan SN ve cihaz adını günceller. */
  private async _fetchSnPostLogin(): Promise<void> {
    if (this.sn) return   // zaten var
    try {
      const info = await this.getBaseInfo()
      if (this.credentials) {
        this.credentials = {
          ...this.credentials,
          sn:         info.sn,
          deviceName: info.productName || info.aliasName || this.credentials.deviceName,
        }
      }
      console.log(`[TaurusConnection] Post-login SN: ${info.sn}, Name: ${info.productName}`)
    } catch (err) {
      console.warn('[TaurusConnection] Post-login base-info failed (non-fatal):', err)
    }
  }
}
