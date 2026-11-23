# Benim tarzım (kural dosyası)

Claude her videodan önce bu dosyayı okur ve buna uyar. Bir şeyi ikinci kez
düzelttiriyorsan buraya ekle. Ayrıntılı kaynak: `akici-poster-edit-dili` skill'i.

| Başlık | Kural |
|---|---|
| **Renkler** | İmza palet: #30AFFF (mavi), #92EEFF (açık camgöbeği), #D8FFC5 (soluk yeşil), #C4F7CA (mint). Yazı/gölge: koyu lacivert #0E1A2B. Turuncu ve eski kahve tonları yok. Sahne başına **tek** dolu vurgu şekli; anahtar kelime vurgusu #30AFFF. |
| **Font** | Tek font: Bricolage Grotesque. Anahtar kelime ExtraBold (ekranın %35–55'i, harf aralığı -2%); bağlaçlar Regular, ~%30 boyut. Sahne başına en fazla 1 kontrast fontu (serif ya da el yazısı). |
| **Altyazı** | Ekranda konuşulan cümlenin damıtılmış hâli: sahne başına 3–5 kelime. Kinetik başlıkla çakışırsa o anda altyazıyı gizle. Alt %18 ve üst %10 güvenli alana taşma. |
| **Hareket** | Girişler easeOutExpo / easeOutBack(1.2), çıkışlar easeInCubic; lineer yok. Kelime girişi 4–7 kare (alttan 30–60 px + 1.15→1.0 ölçek + dikey blur). Kelime, söylendiği kareden 1–2 kare önce girer. Hiç donuk kare yok (1.00→1.03 drift). |
| **Geçişler** | Sert kesim yok. Her sahne değişimi 6–10 karelik blur geçişi (zoom-blur, whip-blur veya şekil-taşıyıcı); videoda en fazla 3 tip. Jump-cut'lar blur/B-roll/büyük kelime altına saklanır. |
| **Yüz** | Konuşan kişinin yüzünü kapatma. Grafikler yüzün yanına/altına; yazı figürle bilinçli katmanlanabilir ama yüzün üstüne gelmez. |
| **Ses** | Perküsif minimal beat; konuşma altında −20…−24 dB, ducking. Kelime girişinde tık/pop (−22 dB), geçişte whoosh (−18 dB, tepe noktası blur tepe karesinde). Kapanışta 0,3 sn fade. |
| **Yasaklar** | Emoji yok. Çok renk yok (palet dışı renk yok). Yüzün üstüne yazı yok. Sert kesim yok. Lineer hareket yok. Turuncu yok. |
| **Referanslar** | 12 sn'lik "STORYTELLING / every cut is a Decision…" kinetik-poster editi. Yeni referans linklerini altına "neyini sevdiğim" notuyla ekle. |

## Doğru yazılışlar (Whisper karıştırırsa)
- Claude (Cloud değil)
- Demirkazık
- HyperFrames

## Format
- Shorts: 1080x1920, sahne başına ~1,8–2,6 sn, son 1–1,7 sn imza/kanal adı, loop'a hazır.

## Her videodan sonra eklenenler
<!-- "bunu kural dosyasına ekle, bir daha yapma" dediklerin buraya -->
