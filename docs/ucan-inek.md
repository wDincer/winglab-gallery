# Uçan İnek — Kuleden Gökyüzüne

Galeri kopyası sabit parkur yerine serbest uçuş kullanır. İnek 80 metre yüksekliğindeki kulenin tepesinden kalkar. İki el göğüs hizasının üzerinde tutulduğunda yükselir; irtifa 500 metrede sınırlanır. Göğüs hizasındaki eller irtifayı korur, aşağıdaki eller alçaltır. Yükselme el bileklerinden hesaplanır; dirsek açısı tek başına yükselme komutu değildir.

Klavye modunda ↑/↓ veya Yüksel/Süzül/Alçal düğmeleri el yüksekliğini belirler. ←/→ ile her yöne dönülür. B tek çırpışla hız kazandırır. Parkur, geçit veya mesafeye bağlı bitiş yoktur.

360 saman balyası farklı yönlere ve 40–480 metre arasındaki irtifalara dağıtılır. İlk birkaç balya kuleye yakındır. Radarda benzer irtifadaki samanlar daha belirgindir; en yakın samanın irtifası da yazılır. Toplama yarıçapı 18 metredir ve her balya bir kez sayılır.

Pilavcı havada doğar, ineğe üç boyutta yaklaşır, yakına gelince saldırı uyarısı verir ve tabak fırlatır. Tabak atıldığı anda hedeflenir; sonrasında yön değiştirmez. Yer, bina, kule veya tabak teması uçuşu bitirir. İlk kalkışta kulenin üzerinde kanatlara açıklık sağlanır.

Saman alınınca kullanıcının `dragon-studio-cow-moo-390282.mp3` kaydı çalar. Pakette `public/oyunlar/ucan-inek/assets/cow-moo.mp3` adıyla bulunur; SHA-256 değeri `ea4b094d4e465628b4eb8dd8148a234309ecaacf50cd902938968c8b4706aad0` olarak doğrulanmıştır. Ses düğmesi, duraklatma, takip kaybı ve gizli sekme tüm sesleri kontrol eder. Yeniden başlatma önceki toplama seslerini temizler.

Kule ve mahalle geometrisi, hayvan ayrıntıları, malzemeler, gökyüzü, ışık ve gölgeler güncellenmiştir. Kamera görüntüsü yalnızca cihazda işlenir.

`npm run check` ve `npm test` ile doğrulanır. Normal dağıtımda `npm run build` kullanılır; `collect` özgün kopyayı geri getirerek galeriye özgü değişiklikleri siler.
