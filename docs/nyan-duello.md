# Nyan Cat — Beş isabet ve sonuç sesleri

Shadow Cat beş reçel isabetiyle yenilir. Oyuncunun üç canı korunur. Rakibin can göstergesi, isabet sayacı, yardım ve sonuç metinleri beş isabete göre güncellenmiştir.

Oyuncu hasar alınca mevcut `assets/audio/hurt.mp3` miyavı üç ses saniyesi çalar. Kayıt kısa ise döngüye alınır; ses saati tam üç saniyede durdurur. Son can kaybındaki miyav da tamamlanır. Rakibe vurma sesi miyavdan ayrıdır.

Zaferde `assets/projectiles/jam.png` reçel görseli ve kullanıcının Tamek müziği gösterilir/çalınır. Yenilgide `assets/projectiles/choco.png` Çokokrem görseli ve Çokokrem kaydı çalınır; doğal bitişinden sonra `playzz-fah-491090.mp3` kaydı başlar. Fah kaydının doğal bitişi tam ekran video oynatıcısını tetikler. Eski patlama MP3'ü artık çalınmaz; sıra sabit zamanlayıcıya dayanmaz.

Kullanıcının sesleri pakette şu adlarla saklanır:

- `assets/audio/victory-tamek.mp3`: Salça denince Tamek; Tamekse Koy Sepete!
- `assets/audio/defeat-cokokrem.mp3`: En tatlı Ramazanlar Çokokrem’le başlar!
- `assets/audio/defeat-fah.mp3`: playzz-fah-491090

Tam ekran video, `loss-video.js` tarafından yönetilir; otomatik oynatma engellenirse Oynat düğmesi sunulur. Yeni düello, video bitişi ve Sonuca dön düğmesi oynatıcıyı kapatır. Gizli sekme videoyu bekletir.

Video kaynağı henüz verilmedi. Kullanıcının `Patlama efekti💣 #shorts #edit.m4a` dosyası incelendi: tek `soun` izi, `mp4a` kodeği ve yaklaşık 1,765 saniye ses içeriyor; `vide` izi yok. `loss-video-config.js` içindeki `LOSS_VIDEO_SOURCE`, gerçek MP4/WebM dosyası veya doğrudan video adresi sağlanıncaya kadar `null` kalır. Ses dosyası video gibi gösterilmez. Sunucu MP4/WebM MIME türlerini ve Range isteklerini destekler.

Ses düğmesi tüm sesleri kontrol eder. Duraklatma, takip kaybı ve gizli sekme oyun seslerini bekletir; gizli sekme sonuç müziklerini de bekletir. Yeni düello önceki sonuç müziğini, patlama sırasını ve gecikmiş ses isteklerini temizler. Kamera görüntüsü cihazda kalır.

`npm run check` ve `npm test` ile doğrulanır. Galeriye özgü düzenlemeleri korumak için dağıtımda `npm run build` kullanılır; `collect` çalıştırılmaz.
