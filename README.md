# YouTube → Gemini Summary

Status: Production ready (v0.1.0)

## Ne yapar
- YouTube video/shorts kartlarına “🤖 Gemini ile özetle” butonu ekler.
- Başlık, kanal ve URL ile prompt oluşturur.
- Gemini’de promptu doldurur ve ayarlara göre otomatik gönderir.

## Kurulum (Load unpacked)
1. Chrome’da `chrome://extensions` sayfasını açın.
2. Sağ üstten “Developer mode”u açın.
3. “Load unpacked” ile proje kök klasörünü seçin.

## Kullanım
- YouTube’da kartın üstüne gelince buton görünür.
- Butona tıklayınca Gemini sekmesi açılır.
- Giriş yapılmadıysa önce Gemini hesabınızla giriş yapın.
- Auto-send kapalıysa prompt doldurulur, gönderim manuel yapılır.

## Options ayarları
- Language: Prompt dilini seçer.
- Auto-send: Gemini’de otomatik gönderimi aç/kapatır.
- Open in new tab: Gemini’yi yeni sekmede açar.
- Hover-only button: Butonu sadece hover’da gösterir.
- Send delay ms: Gönder butonu için bekleme süresi.
- Prompt template: `{title}`, `{channel}`, `{url}` değişkenlerini kullanır.

## Bilinen kısıtlar
- Gemini DOM yapısı değişebilir; otomasyon etkilenebilir.
- Gemini sign-in gereklidir.
- YouTube arayüz varyantlarında başlık/kanal bilgisi her zaman bulunamayabilir.

## Test checklist
Bkz: [TEST_CHECKLIST.md](TEST_CHECKLIST.md)
