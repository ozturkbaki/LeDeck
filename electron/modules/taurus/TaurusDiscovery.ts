/**
 * TaurusDiscovery — Device Search Service
 *
 * NovaStar resmi demo referansına sadık kalınarak yazılmıştır.
 * Arama öncelik sırası:
 *
 * 1. DLL (Taurus_kit.dll)  — NovaStar resmi SDK, birincil yöntem
 * 2. HTTPS Probe            — DLL yüklenemezse fallback; IP taraması
 */

import https from 'https'
import path  from 'path'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaurusDeviceInfo {
  ip:                        string
  sn:                        string
  productName:               string
  modelId:                   number
  aliasName:                 string
  terminalEntrancePortHttps: number
  ftpPort:                   number
  tcpPort:                   number
  logined:                   boolean
  osVersion:                 string
  platform:                  string
  width:                     number
  height:                    number
  // Demo referans ek alanlar
  rotation?:                 number
  privacy?:                  boolean
  key?:                      string
  encodeType?:               number
  syssetFtpPort?:            number
  syssetTcpPort?:            number
  terminalEntrancePortWebSocket?: number
}

export interface DiscoveryOptions {
  targets?:    string[]
  timeoutMs?:  number
  deduplicate?: boolean
  dllPath?:    string
}

export interface DiscoveryResult {
  success:  boolean
  devices:  TaurusDeviceInfo[]
  errors:   { target: string; message: string }[]
  elapsed:  number
  method:   'dll' | 'https-probe' | 'none'
}

// ─── DLL Bridge (Taurus_kit.dll — NovaStar resmi SDK) ─────────────────────────
//
// Demo referans (Search.java):
//   Toolkit instance = Native.loadLibrary("Taurus_kit", Toolkit.class);
//   instance.searchDeviceAsync('["192.168.1.1"]', callback);
//
// Toolkit interface (Toolkit.java):
//   SearchResult.ByValue searchDevice(String ipList);          // senkron
//   void searchDeviceAsync(String ipList, CallBack callBack);  // asenkron
//
// SearchResult struct: { int code, String data }
// CallBack: void dataCallBack(int code, String data)
//
// code değerleri:
//   0  → Başarılı, data = JSON DeviceInfo
//   3  → IP format hatası
//   4  → 2 saniye içinde cihaz bulunamadı
//   16 → JSON parse hatası

let koffiLib: any = null
let dllLoaded = false
let dllLoadError: string | null = null

function getDllPath(customPath?: string): string {
  if (customPath) return customPath

  // Electron packaged app: resources/Taurus_kit.dll
  // Dev mode: project root/resources/Taurus_kit.dll
  const candidates = [
    path.resolve(process.resourcesPath || '', 'Taurus_kit.dll'),
    path.resolve(__dirname, '../../../resources/Taurus_kit.dll'),
    path.resolve(__dirname, '../../resources/Taurus_kit.dll'),
    path.resolve(process.cwd(), 'resources/Taurus_kit.dll'),
  ]

  for (const p of candidates) {
    try {
      require('fs').accessSync(p)
      return p
    } catch { /* devam */ }
  }

  return candidates[1] // varsayılan
}

function loadDll(dllPath?: string): boolean {
  if (dllLoaded) return true
  if (dllLoadError) return false

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const koffi = require('koffi')

    const resolvedPath = getDllPath(dllPath)
    console.log(`[TaurusDiscovery] DLL yükleniyor: ${resolvedPath}`)

    const lib = koffi.load(resolvedPath)

    // Demo referans — Toolkit.java:
    // SearchResult.ByValue searchDevice(String ipList);
    // struct SearchResult { int code; String data; }
    const SearchResult = koffi.struct('SearchResult', {
      code: 'int',
      data: 'str',
    })

    // Senkron arama fonksiyonu
    const searchDevice = lib.func('searchDevice', SearchResult, ['str'])

    koffiLib = { koffi, lib, searchDevice }
    dllLoaded = true
    console.log('[TaurusDiscovery] DLL başarıyla yüklendi ✓')
    return true
  } catch (err: any) {
    dllLoadError = err?.message ?? String(err)
    console.warn('[TaurusDiscovery] DLL yüklenemedi:', dllLoadError)
    return false
  }
}

/**
 * DLL üzerinden cihaz arama.
 * Demo referans: Search.java → searchDevice / searchDeviceAsync
 *
 * DİKKAT: DLL yalnızca tekil IP adresleri kabul eder (CIDR formatı desteklenmez).
 * Demo referans: instance.searchDevice('["127.0.0.1"]')
 */
async function discoverViaDll(
  targets: string[],
  dllPath?: string,
): Promise<{ devices: TaurusDeviceInfo[]; error?: string }> {
  if (!loadDll(dllPath)) {
    return { devices: [], error: dllLoadError ?? 'DLL yüklenemedi' }
  }

  try {
    // CIDR formatını tekil IP'lere çevir (DLL CIDR anlamaz → code 3 verir)
    const expandedIps = expandTargets(targets)
    console.log(`[TaurusDiscovery] DLL: ${targets.length} hedef → ${expandedIps.length} IP`)

    const allDevices: TaurusDeviceInfo[] = []
    const seen = new Set<string>()

    // DLL'e IP'leri batch halinde gönder (çok fazla IP olabilir)
    const BATCH_SIZE = 64
    for (let i = 0; i < expandedIps.length; i += BATCH_SIZE) {
      const batch = expandedIps.slice(i, i + BATCH_SIZE)
      const ipListJson = JSON.stringify(batch)
      console.log(`[TaurusDiscovery] DLL searchDevice batch ${Math.floor(i/BATCH_SIZE)+1}: ${batch.length} IP`)

      const result = koffiLib.searchDevice(ipListJson)
      console.log(`[TaurusDiscovery] DLL result: code=${result.code}`)

      if (result.code === 4) {
        // code 4 = "No device found in 2 seconds" — bu batch'te bulunamadı
        continue
      }

      if (result.code === 3) {
        console.warn('[TaurusDiscovery] DLL IP format hatası (code 3), batch atlanıyor')
        continue
      }

      if (result.code === 0 && result.data) {
        const parsed = JSON.parse(result.data)
        const items = Array.isArray(parsed) ? parsed : [parsed]
        for (const d of items) {
          if (d.sn && !seen.has(d.sn)) {
            seen.add(d.sn)
            allDevices.push(d as TaurusDeviceInfo)
            console.log(`[TaurusDiscovery] DLL bulundu: ${d.productName} @ ${d.ip} (SN: ${d.sn})`)
          }
        }
      }
    }

    console.log(`[TaurusDiscovery] DLL toplam: ${allDevices.length} cihaz bulundu`)
    return { devices: allDevices }
  } catch (err: any) {
    return { devices: [], error: `DLL arama hatası: ${err?.message ?? err}` }
  }
}

// ─── HTTPS Probe (Fallback) ───────────────────────────────────────────────────

const PROBE_PORTS  = [16674, 443]
const PROBE_PATH   = '/terminal/core/v1/version'
const HTTPS_AGENT  = new https.Agent({ rejectUnauthorized: false })

function probeIp(ip: string, port: number, timeoutMs: number): Promise<TaurusDeviceInfo | null> {
  return new Promise<TaurusDeviceInfo | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs)
    const req   = https.get(
      { hostname: ip, port, path: PROBE_PATH, agent: HTTPS_AGENT },
      (res) => {
        let body = ''
        res.on('data', (c) => { body += c })
        res.on('end', () => {
          clearTimeout(timer)
          try {
            const json = JSON.parse(body)
            if (json.code === 0 && json.data) {
              console.log(`[TaurusDiscovery] Probe hit (version): ${json.data.productName} @ ${ip}:${port}`)
              resolve({
                ip,
                terminalEntrancePortHttps: port,
                sn:          json.data.sn || '',
                productName: json.data.productName || 'Taurus Device',
                aliasName:   json.data.aliasName || ip,
                osVersion:   json.data.osVersion || '',
                platform:    json.data.platform || '',
                logined:     false
              } as TaurusDeviceInfo)
              return
            }
            resolve(null)
          } catch { resolve(null) }
        })
      }
    )
    req.on('error', () => { clearTimeout(timer); resolve(null) })
    req.setTimeout(timeoutMs, () => { req.destroy(); clearTimeout(timer); resolve(null) })
  })
}

async function discoverViaHttpsProbe(targets: string[], timeoutMs: number): Promise<TaurusDeviceInfo[]> {
  const ips   = expandTargets(targets)
  const found: TaurusDeviceInfo[] = []
  const seenIpPort = new Set<string>()
  const BATCH = 32
  const PER   = Math.min(Math.max(timeoutMs / 2, 800), 1200)

  console.log(`[TaurusDiscovery] HTTPS probe: ${ips.length} IPs × ${PROBE_PORTS.length} ports (${PER}ms/ip)`)

  for (let i = 0; i < ips.length; i += BATCH) {
    const batch   = ips.slice(i, i + BATCH)
    const results = await Promise.all(
      batch.flatMap(ip => PROBE_PORTS.map(port => probeIp(ip, port, PER)))
    )
    for (const r of results) {
      if (!r) continue
      const key = `${r.ip}:${r.terminalEntrancePortHttps}`
      if (!seenIpPort.has(key)) { seenIpPort.add(key); found.push(r) }
    }
  }
  return found
}

// ─── Subnet expansion ─────────────────────────────────────────────────────────

function expandTargets(targets: string[]): string[] {
  const ips: string[] = []
  for (const target of targets) {
    const cidr = target.match(/^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/)
    if (!cidr) { ips.push(target); continue }
    const prefix = parseInt(cidr[2], 10)
    if (prefix < 16) continue
    const parts = cidr[1].split('.').map(Number)
    const start = (parts[0] << 24 | parts[1] << 16 | parts[2] << 8 | parts[3]) >>> 0
    const count = Math.pow(2, 32 - prefix) - 2
    for (let i = 1; i <= count; i++) {
      const n = (start + i) >>> 0
      ips.push([n >>> 24, (n >>> 16) & 0xFF, (n >>> 8) & 0xFF, n & 0xFF].join('.'))
    }
  }
  return ips
}

// ─── TaurusDiscovery ──────────────────────────────────────────────────────────

export class TaurusDiscovery {
  private readonly dllPath: string | undefined
  private cancelled = false

  constructor(dllPath?: string) {
    this.dllPath = dllPath
  }

  /**
   * NovaStar resmi demo referansına göre cihaz arama.
   * Öncelik: 1. DLL (Taurus_kit.dll) → 2. HTTPS Probe (fallback)
   */
  async discover(options: DiscoveryOptions = {}): Promise<DiscoveryResult> {
    this.cancelled = false
    const start     = Date.now()
    const timeoutMs = options.timeoutMs ?? 5000

    console.log('[TaurusDiscovery] Arama başlatılıyor...')

    // Demo referans: Search.java → IP listesini DLL'e gönder
    const targets = options.targets ?? TaurusDiscovery.getLocalSubnets()

    // 1. DLL (Birincil — NovaStar resmi SDK)
    const dll = await discoverViaDll(targets, options.dllPath ?? this.dllPath)
    if (dll.devices.length > 0) {
      console.log(`[TaurusDiscovery] DLL ile ${dll.devices.length} cihaz bulundu ✓`)
      return { success: true, devices: dll.devices, errors: [], elapsed: Date.now() - start, method: 'dll' }
    }
    if (dll.error) console.log('[TaurusDiscovery] DLL hatası:', dll.error)

    if (this.cancelled) {
      return { success: true, devices: [], errors: [], elapsed: Date.now() - start, method: 'none' }
    }

    // 2. HTTPS probe (Fallback — DLL bulamazsa veya yüklenemezse)
    console.log('[TaurusDiscovery] HTTPS probe fallback...')
    const probe = await discoverViaHttpsProbe(targets, timeoutMs)
    return {
      success: true,
      devices: probe,
      errors:  [],
      elapsed: Date.now() - start,
      method:  probe.length > 0 ? 'https-probe' : 'none',
    }
  }

  cancel(): void {
    this.cancelled = true
    console.log('[TaurusDiscovery] İptal edildi.')
  }

  static getLocalSubnets(): string[] {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const os   = require('os')
    const ifs  = os.networkInterfaces() as Record<string, any[]>
    const seen = new Set<string>()
    for (const iface of Object.values(ifs)) {
      for (const addr of iface ?? []) {
        if (addr.family !== 'IPv4' || addr.internal) continue
        const p = addr.address.split('.').map(Number)
        seen.add(`${p[0]}.${p[1]}.${p[2]}.0/24`)
      }
    }
    return [...seen]
  }
}
