# video-kurgu

"Claude'la video kurgulamak için gereken her şey" kitine göre kuruldu.

- `ham-cekimler/` – telefondan gelen ham videolar (git'e girmez)
- `referanslar/` – beğendiğin videolar / ekran görüntüleri (git'e girmez)
- `ciktilar/` – render edilen videolar (git'e girmez)
- `kural-dosyasi.md` – tarzın; Claude her videoda buna bakar
- `kurulum.sh` – FFmpeg, Whisper, HyperFrames, yt-dlp kurulumu + kontrol

## Kullanım
1. Videoyu `ham-cekimler/` içine koy.
2. Claude'a yaz: **"Ham çekimi kurgula: boşlukları kes, sahne sahne planı göster."**
3. Planı onayla, revizeleri kurgucuya söyler gibi ver ("0:12'deki grafik yüzümü kapatıyor, sağa al").

## Elle motion (kitin 2. kısmı)
```bash
npx hyperframes init motion-projem --video video.mp4 --model large-v3 --language tr
cd motion-projem
npx hyperframes check
npx hyperframes preview
npx hyperframes render --fps 60 --output motion.mp4
```
