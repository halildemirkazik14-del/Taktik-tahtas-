# Latte Taktik

Süper Lig ve 5 büyük ligin 2026/27 kadrolarıyla 3D taktik tahtası. Maç önü (olası 11) ve maç sonu (gerçekleşen) anlatımları için. Ekranda yaptığın her şeyi dikey 1080×1920 MP4 olarak kaydeder.

## Telefona kurulum

1. Bu sayfada sağdaki **Releases** bölümüne gir (ya da `…/releases/latest`).
2. **LatteTaktik.apk** dosyasına dokunup indir, aç ve kur.
3. İlk kurulumda telefon "bilinmeyen kaynaklar" izni isterse tarayıcına izin ver.

Her `main` güncellemesinde ve her pazartesi sabahı yeni APK, güncel kadrolarla otomatik derlenir.

### Güncellemelerin eskisinin üstüne kurulması için (bir kerelik)

Repo → **Settings → Secrets and variables → Actions → New repository secret**
- Ad: `TAKTIK_KEY_PASS`
- Değer: Claude'un sohbette verdiği şifre

Bu sır yoksa APK yine derlenir ama geçici anahtarla imzalanır; her güncellemede eski uygulamayı silmen gerekir.

## Neler var

- **Kadrolar:** 6 lig, tam kadro + yedekler, forma numarası, mevki, oyuncu fotoğrafları ve armalar (ESPN). Uygulama içinden "Kadroları güncelle" ile tazelenir. İnternet yoksa elle derlenmiş yedek kadro kullanılır.
- **3D saha:** sürükle-bırak oyuncu ve top, 6 kamera açısı (Üstten, Taktik, Yayın, Kale arkası, Rakip kale, Yan), serbest döndürme/yakınlaştırma, kamera kilidi. 4 saha teması.
- **Çizimler:** pas oku, koşu (kesikli), top sürme (dalgalı), havadan pas (3D yay), çizgi, daire, bölge, çarpı, oyuncu vurgulama (ışık konisi), silgi, geri al. 7 renk.
- **Diziliş ve değişiklik:** 17 hazır diziliş; ilk 11 düzenleme, dakikalı oyuncu değişikliği (videoda değişiklik bandı çıkar), son maçın 11'ini yükleme, oyuncu ekleme ve ad/numara düzenleme.
- **Maç modları:** Serbest, Maç önü (fikstürden maç seçilir, tarih banda yazılır), Maç sonu (oynanmış maçın gerçek 11'i, dizilişi, skoru ve değişiklikleri gelir).
- **Adımlar:** her adım bir an; oynatınca oyuncular, top ve kamera adımlar arasında süzülür.
- **Kayıt:** istediğin an başlat/bitir; 3-2-1 geri sayım, isteğe bağlı mikrofonla anlatım, 8 veya 14 Mbps. "Kaydı başlat ve adımları oynat" ile tek dokunuşta animasyon videosu. Videolar Belgeler/LatteTaktik/Videolar klasörüne kaydedilir ve paylaşılabilir.
- **Projeler:** otomatik kayıt, birden çok proje, kopyalama, dosyaya yedekleme ve dosyadan yükleme.

## Geliştirme

`www/` klasörü düz HTML/JS (derleme adımı yok). Yerelde: `python3 -m http.server -d www`. Kadro verisi için `node scripts/fetch-squads.mjs`.

Kütüphaneler: three.js r170 (MIT), mp4-muxer 5.1.3 (MIT), Bricolage Grotesque ve Onest fontları (OFL).
