# Nyan Cat — Beş isabet ve sonuç sesleri

Shadow Cat beş reçel isabetiyle yenilir. Oyuncunun üç canı korunur. Rakibin can göstergesi, isabet sayacı, yardım ve sonuç metinleri beş isabete göre güncellenmiştir.

Oyuncu hasar alınca mevcut `assets/audio/hurt.mp3` miyavı üç ses saniyesi çalar. Kayıt kısa ise döngüye alınır; ses saati tam üç saniyede durdurur. Son can kaybındaki miyav da tamamlanır. Rakibe vurma sesi miyavdan ayrıdır.

Zaferde `assets/projectiles/jam.png` reçel görseli ve kullanıcının birinci kaydı olan Tamek müziği gösterilir/çalınır. Yenilgide `assets/projectiles/choco.png` Çokokrem görseli ve ikinci kayıt çalınır. Bu kayıt doğal olarak tamamlandığında üçüncü kayıttaki patlama sesi başlar; ses sırası sabit zamanlayıcıya dayanmaz.

Kullanıcının sesleri pakette şu adlarla saklanır:

- `assets/audio/victory-tamek.mp3`: Salça denince Tamek; Tamekse Koy Sepete!
- `assets/audio/defeat-cokokrem.mp3`: En tatlı Ramazanlar Çokokrem’le başlar!
- `assets/audio/defeat-explosion.mp3`: Patlama efekti

Ses düğmesi tüm sesleri kontrol eder. Duraklatma, takip kaybı ve gizli sekme oyun seslerini bekletir; gizli sekme sonuç müziklerini de bekletir. Yeni düello önceki sonuç müziğini, patlama sırasını ve gecikmiş ses isteklerini temizler. Kamera görüntüsü cihazda kalır.

`npm run check` ve `npm test` ile doğrulanır. Galeriye özgü düzenlemeleri korumak için dağıtımda `npm run build` kullanılır; `collect` çalıştırılmaz.
