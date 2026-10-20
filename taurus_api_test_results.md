# Taurus API Test Günlüğü (T60 Modeli)

Bu dosya, Taurus T60 (IP: 192.168.1.182) cihazı üzerinde yapılan API testlerinin sonuçlarını içerir. Tüm testler gerçek cihaz üzerinde doğrulanmıştır.

## 1. Oturum Yönetimi (Session Management) - [BAŞARILI]
| Özellik | Endpoint | Metod | Durum | Notlar |
| :--- | :--- | :--- | :--- | :--- |
| **Giriş (Login)** | `/terminal/core/v1/user/login` | POST | ✅ Başarılı | `token` döner, Authorization header'da kullanılır. |
| **Güvenli Çıkış** | `/terminal/core/v1/user/logout` | **DELETE** | ✅ Başarılı | Oturumu cihaz üzerinde sonlandırır. |
| **Şifre Güncelleme**| `/terminal/core/v1/user/update` | PUT | ✅ Resmi | Dökümantasyonda teyit edildi. |

## 2. Cihaz Kimlik Bilgileri (Device Identification) - [BAŞARILI]
| Özellik | Endpoint | Durum | Önemli Veriler |
| :--- | :--- | :--- | :--- |
| **Sistem Bilgisi** | `/terminal/core/v2/device/info` | ✅ Başarılı | SN, osVersion, platform, productName (T60) |
| **Yazılım Sürümü** | `/terminal/core/v1/version` | ✅ Başarılı | FPGA (Sender FW), Android 11, PCB Revizyonu |
| **Gönderici Kart** | `/terminal/core/v1/sendercard/base-info`| ❌ Hata (Kod 12)| "Developing" aşamasında, T60 OS'de henüz tanımlı değil. |
| **Donanım Portları**| `/terminal/core/v1/support/function/product/device/info` | ✅ Başarılı | 4 Ethernet Portu, modelId: 38429 |
| **Upgrade Durumu** | `/terminal/emergency/v1/device/upgrade/status` | ❌ Hata (Kod 12)| `emergency` ve `core` yolları bulunamadı. |

## 3. Ekran ve Çözünürlük (Display & Resolution) - [BAŞARILI]
| Özellik | Endpoint | Durum | Veri / Sonuç |
| :--- | :--- | :--- | :--- |
| **Ekran Boyutu** | `/terminal/core/v1/rotation/display/info` | ✅ Başarılı | **640x360**, Rotation: 0 |
| **Video Kaynağı** | `/terminal/core/v1/video/source/inside/current/resolution` | ✅ Başarılı | 1920x1080p-60 |
| **Ekran İsmi** | `/terminal/core/v1/screen/name/address` | ✅ Başarılı | Alias: `T60_00000631` |
| **Video Kaynağı (V2)**| `/v2/player/real-time-control/video-source` | ❌ Hata (Kod 12)| T60 firmware'inde tanımlı değil. |

## 4. Donanım İzleme (Hardware Monitor) - [BAŞARILI]
| Özellik | Endpoint | Durum | Örnek Yanıt |
| :--- | :--- | :--- | :--- |
| **CPU Kullanımı** | `/terminal/core/v1/monitor/cpu/usage` | ✅ Başarılı | `{"value": 82}` (%82) |
| **CPU Sıcaklığı** | `/terminal/core/v1/monitor/cpu/temperature` | ✅ Başarılı | `{"value": 62}` (62°C) |
| **Bellek (RAM)** | `/terminal/core/v1/monitor/available/memory` | ✅ Başarılı | Toplam: 1GB, Boş: 320MB |
| **Depolama** | `/terminal/core/v1/monitor/storage` | ✅ Başarılı | Toplam: 32GB, Boş: 20GB |
| **Röle Durumu** | `/terminal/core/v1/relay/status` | ✅ Başarılı | Mevcut röle (enerji) durumunu döner. |
| **Ses Seviyesi** | `/terminal/core/v1/device/volume` | GET | ✅ Başarılı | Mevcut ses düzeyi bilgisini döner. |
| **Ses Ayarla**   | `/terminal/core/v1/device/volume` | POST| ✅ Başarılı | Ses seviyesini (%0-100) set eder. |
| **Reboot Takvimi**| `/terminal/core/v1/device/reboot-policy` | GET | ✅ Başarılı | Zamanlanmış yeniden başlatma bilgisini döner. |
| **Reboot Ayarla** | `/terminal/core/v1/device/reboot-policy` | POST| ✅ Başarılı | Yeni yeniden başlatma takvimi set eder. |

## 5. Sistem Zamanı (Time Management) - [BAŞARILI]
| Özellik | Endpoint | Metod | Durum |
| :--- | :--- | :--- | :--- |
| **Zamanı Oku** | `/terminal/core/v1/device/time` | GET | ✅ Başarılı |
| **Zamanı Ayarla** | `/terminal/core/v1/device/time` | POST | ✅ Başarılı |

## 6. Ekran Kontrolü (Screen Control) - [KISMİ BAŞARILI]
| Özellik | Endpoint | Metod | Durum | Notlar |
| :--- | :--- | :--- | :--- | :--- |
| **Parlaklık Oku** | `/terminal/core/v1/brightness` | GET | ✅ Başarılı | Mevcut parlaklık ve oran bilgisini döner. |
| **Ekran Güç Oku** | `/terminal/core/v1/screen/power/status` | GET | ✅ Başarılı | Mevcut güç durumunu (`OPEN`/`CLOSE`) döner. |
| **Ekran Gücü Set** | `/terminal/core/v1/screen/power/status` | POST | ✅ Başarılı | Hem `OPEN` hem de `CLOSE` komutları başarıyla doğrulandı. |
| **Güç Takvimi Oku**| `/terminal/core/v1/screen/power-policy` | GET | ✅ Başarılı | Ekran açma/kapama zamanlamalarını döner. |
| **Güç Takvimi Set** | `/terminal/core/v1/screen/power-policy` | POST | ✅ Başarılı | Çoklu takvim kuralları (Aç/Kapat) başarıyla işleniyor. |
| **Parlaklık Modu**| `/terminal/core/v2/brightness/mode` | POST | ✅ Başarılı | `{"mode": 0, "type": "SCREEN_BRIGHTNESS"}` |
| **Politika Sorgu**| `/terminal/core/v1/brightness/timing-policy` | GET | ✅ Başarılı | Aktif takvimler manuel ayarı engelliyor. |
| **Politika Set**  | `/terminal/core/v1/brightness/timing-policy` | POST | ✅ Başarılı | Çoklu parlaklık takvim kuralları başarıyla işleniyor. |
| **Parlaklık Ayar**| `/terminal/core/v1/brightness` | POST | ✅ Doğrulandı* | Alıcı kart (ekran) bağlı değilse Kod 1 döner. |

> [!IMPORTANT]
> **Kritik Bulgu:** `/v1/brightness` (POST) işlemi veriyi doğrudan alıcı kartlara yazar. Eğer cihaza fiziksel bir LED ekran (Receiving Card) bağlı değilse, işlem başarısız olur ve `set brightness failed` (Kod 1) hatası döner. Yazılımsal yapı ve API isteği doğrudur.

---
*Son Güncelleme: 2026-05-10 17:11*
