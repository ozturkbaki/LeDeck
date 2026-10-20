# LeDeck — Proje Hafızası, Mimari ve Kesin Kurallar

Bu çalışma alanı (**`C:\Users\m\Desktop\LeDeck`**), NovaStar LED kontrol cihazlarını yönetmek için geliştirilen **LeDeck** ekosistemini barındırır.

## 1. Dizin ve GitHub Depo Yapısı

1. **Masaüstü Uygulaması (`ledeck/`):**
   - **Konum:** `C:\Users\m\Desktop\LeDeck\ledeck`
   - **GitHub Repo:** `https://github.com/ozturkbaki/LeDeck`
   - **Teknoloji:** Electron + React 18 + TypeScript + Vite (`electron-vite`)
   - **Kapsanan Cihaz Serileri:**
     - **H Series** (TCP/IP Video Wall Splicer)
     - **TU Series** (TCP/IP Playback & Remote Control)
     - **VX Series & VX Pro** (TCP/IP Port 5200 / 15200 Video Processor)
     - **MCTRL Series** (RS232 Serial COM Port Sending Controller)
     - **Taurus Series (TB / TCC / T60)** (HTTPS Port 16674 Open Platform API + UDP Discovery)

2. **Mobil Uygulama (`ledeck-mobile/`):**
   - **Konum:** `C:\Users\m\Desktop\LeDeck\ledeck-mobile`
   - **GitHub Repo:** `https://github.com/ozturkbaki/LeDeck-Mobile`
   - **Teknoloji:** Capacitor 6 + Android (Gradle) + Vanilla JS / HTML / CSS (`capacitor-tcp-socket`, `capacitor-udp-socket`)

3. **Protokol Dökümanları ve SDK'lar (`source/`):**
   - **Konum:** `C:\Users\m\Desktop\LeDeck\source`
   - Resmi NovaStar kontrol protokolü PDF dökümanları (H Series, TU Series, VX400/600/16s/Pro, MCTRL RS232, Multimedia Playback) ve Open Platform SDK dosyaları burada yer alır.

4. **Görseller (`assets/`):**
   - **Konum:** `C:\Users\m\Desktop\LeDeck\assets`

---

## 2. Mimari İzolasyon Kuralları (Masaüstü - `ledeck`)

- **Tam Modüler İzolasyon:** Her cihaz serisi (`hseries`, `tuseries`, `vxseries`, `vxpro`, `mctrl`, `taurus`) kendi bağlantı servisine (`*Connection.ts`), komut servisine (`*CommandService.ts`), protokol oluşturucu/ayrıştırıcısına, IPC kanalına (`electron/ipc/*-ipc.ts`) ve React oturum durumuna (`src/modules/*/state/*SessionState.tsx`) sahiptir.
- **Hata İzolasyonu:** Bir cihaz modülünde oluşan bağlantı veya protokol hatası diğer modülleri kesinlikle etkilememelidir.
- **Güvenlik:** Electron `contextIsolation: true` ve `nodeIntegration: false` kuralları esastır. Tüm donanım/soket iletişimi Main Process üzerinde yürütülür ve `electron/preload.ts` + `src/shared/api/bridge.ts` üzerinden Renderer'a aktarılır.

---

## 3. Taurus (T60 / TB Serisi) API Test ve Geliştirme Kuralları

- **Kesin Kural (İnternet Araştırması Yasağı):** Kullanıcı bir API endpoint'i test edilmesini istediğinde **kesinlikle internet üzerinde veya dış kaynaklarda araştırma yapılmaz**. Yalnızca kullanıcının ilettiği endpoint, HTTP metodu ve gövde (body) verisi doğrudan test cihazı üzerinde çalıştırılır.
- **API Test Günlüğü:** Doğrulanan ve hata dönen tüm Taurus API uç noktaları `C:\Users\m\Desktop\LeDeck\ledeck\taurus_api_test_results.md` dosyasında kayıt altında tutulur.
- **Taurus Bağlantı Detayları:**
  - Port: `16674` (HTTPS, `rejectUnauthorized: false`)
  - Kimlik Doğrulama: `POST /terminal/core/v1/user/login` (`token` alınır ve sonraki isteklerde `Authorization` header'ında doğrudan kullanılır).
  - Kritik Donanım Bulgusu: `POST /terminal/core/v1/brightness` komutu fiziksel alıcı kart (Receiving Card) bağlı değilse `code: 1 (set brightness failed)` döner; bu yazılımsal değil donanımsal bir durumdur.
  - Gönderici kart (FPGA / PCB) sürüm bilgileri `/terminal/core/v1/sendercard/base-info` (Kod 12 döner) yerine `/terminal/core/v1/version` uç noktasından alınır.

---

## 4. Versiyonlama ve GitHub Akışı

- Yapılan önemli güncellemeler ve yeni özellikler ilgili projenin (`ledeck` veya `ledeck-mobile`) Git deposuna commit edilmeli ve `origin/main` dalına (`git push`) gönderilmelidir.
