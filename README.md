# WINGLAB — Proje Galerisi

31 Ekim ve 1 Kasım 2026'da üretilen 14 öğrenci oyununu tek sitede bir araya getirir. Ana sayfada oyunlar listelenir; her oyunun detay sayfasındaki **Projeye git** bağlantısı, oyunu yeni sekmede açar.

Oyunlar pakete dahildir. Eski proje klasörlerinin açık olması, eski portlar veya ayrı oyun sunucuları gerekmez. Üçüncü taraf kütüphaneler, kamera modelleri, sesler ve lisans dosyaları oyunlarla birlikte korunmuştur. İlk Docker imajı indirildikten sonra çalışma sırasında internet gerekmez.

## Docker Compose ile çalıştırma

Docker Desktop veya Docker Engine ve Compose kurulu olmalıdır. Bu klasörde:

```sh
docker compose up -d --build
```

Sunucu panellerinde çalışma dizini depo kökü, Compose dosyası yolu `./docker-compose.yml` olmalıdır. Dosyayı açıkça seçmek için `docker compose -f ./docker-compose.yml up -d --build` kullanabilirsin.

Site: **http://localhost:8080/**

```sh
docker compose ps
docker compose logs --tail=50
docker compose down
```

Varsayılan portu değiştirmek için `.env.example` dosyasını `.env` adıyla kopyalayıp `PORT=8080` değerini düzenle. `BIND_ADDRESS=0.0.0.0`, aynı ağdaki cihazlardan erişime izin verir. Yalnız bu bilgisayardan erişim için `BIND_ADDRESS=127.0.0.1` kullanabilirsin.

Uzak bir sunucuda da aynı klasörü taşıyıp aynı Compose komutunu çalıştırabilirsin. Kamera ile oyun için alan adında HTTPS kullan; `localhost` kamera erişimini doğrudan destekler. Ağ üzerinden HTTP ile erişimde oyunların klavye modu kullanılabilir.

## Dokploy üzerinde HTTPS

`docker-compose.dokploy.yml`, mevcut Dokploy Traefik servisini kullanır. Alan adı yönlendirmesi, HTTP → HTTPS geçişi ve Let's Encrypt sertifika isteği bu dosyada tanımlıdır. Uygulamanın iç portu `8080` olarak kalır.

1. Dokploy uygulamasında Compose dosyası yolunu `./docker-compose.dokploy.yml` yap.
2. Environment bölümüne `.env.dokploy.example` içeriğini ekle. `APP_DOMAIN` yalnızca host adı olmalı; `https://`, port veya yol ekleme.
3. Aynı alan adına ait Domains sekmesindeki otomatik kaydı kaldır; bu alan adının yönlendirmesini Compose dosyası yönetecek.
4. Kaydet ve **Deploy** çalıştır. Başarılı dağıtımdan sonra `https://<APP_DOMAIN>/` adresini aç.

Bu dosya, standart Dokploy kurulumundaki `dokploy-network` ağını, `web` / `websecure` girişlerini ve `letsencrypt` sertifika çözücüsünü bekler. Ağ veya çözücü adı özelleştirildiyse ilgili `TRAEFIK_NETWORK` / `TRAEFIK_CERT_RESOLVER` değişkenini güncelle. Gelen TCP `80` ve `443` trafiği Traefik'e ulaşmalıdır; HTTP-01 doğrulamasını ve sertifika yenilemeyi Traefik yapar. Compose dosyası bu mevcut sunucu bileşenlerini kurmaz veya değiştirmez.

Yapılandırmayı dağıtımdan önce denetlemek için:

```sh
docker compose --env-file .env.dokploy.example -f docker-compose.dokploy.yml config --quiet
```

Sertifika alınamazsa sunucuda `docker logs dokploy-traefik --since 10m --tail 100` çıktısını kontrol et. `nonexistent certificate resolver` mevcut Traefik çözücüsünün adını/yapılandırmasını, `rateLimited` sertifika sağlayıcısının belirttiği bekleme süresini kontrol etmeyi gerektirir. `sslip.io` ortak bir DNS hizmetidir; bu adrese de host adına özel TLS sertifikası alınabilir, ancak ortak sertifika kotaları uygulanabilir.

Kaynaklar: [Dokploy manuel Compose yönlendirmesi](https://docs.dokploy.com/docs/core/docker-compose/domains), [Traefik ACME / HTTP-01](https://doc.traefik.io/traefik/v3.3/https/acme/), [sslip.io TLS açıklaması](https://nip.io/).

## İçerik

- 14 oyun, 14 detay sayfası ve gerçek oyun görselleri.
- Katalogla aynı açık arka planda dönen proje kartları; seçili oyun için yeni sekmede “Projeye git” bağlantısı.
- Kart seçimi, sürükleme, ok tuşları ve otomatik dönüşü duraklatma.
- Proje/takım arama, uçak/kuş filtresi ve gün filtresi.
- Arama ve filtreler URL'de tutulur; filtrelenmiş görünüm paylaşılabilir.
- Görev, araç, dünya, vücut kontrolü ve klavye bilgileri.
- Telefon ve masaüstü için uyarlanmış arayüz.
- Oyunların tamamı `/oyunlar/<proje>/` altında sunulur.

24 Ekim'deki Nitrojen ve ana Hidrojen uygulaması bu 14 oyunluk koleksiyona dahil değildir.

## Geliştirme

Node.js 22 veya sonrası yeterlidir; ek npm paketi kurulmaz.

```sh
npm run dev
```

`src/projects.mjs`: proje metinleri ve sıralama.

`src/styles.css`, `src/app.js`: katalog tasarımı, arama ve filtreler.

`src/showcase.css`, `src/showcase.js`: dönen kartlar ve seçili proje bağlantıları.

`scripts/build.mjs`: ana sayfa ve detay sayfalarını üretir.

```sh
npm run build
npm run check
npm test
```

`public/oyunlar/` içindeki oyun kopyaları bağımsızdır; asıl öğrenci projeleri değiştirilmedi. Orijinal klasörlerden yeniden toplamak için bu bilgisayarda `npm run collect`, ardından `npm run build` çalıştır. Kaynak eşlemesi `scripts/collect-games.mjs` dosyasındadır; başka bilgisayarda bu adım gerekmez. Derlenmiş `public/` klasörü Docker imajına doğrudan kopyalanır.

Amazon Tukan'ın galeri kopyasında iki çırpışta kalkış, çırpış başına 100 metre yükseliş ve 240 çikolatanın üç boyutlu dağılımı bulunur. Kalkışın iki çırpışı 200 metre yükseliş sağlar; sonraki çırpışlar 100 metre ekler ve kısa aralıklarla yapılan çırpışlar birikir. Yükseliş 1200 metre tavanında durur. `collect`, galeri kopyalarını özgün klasörlerden yeniden oluşturduğu için bu değişiklikleri üzerine yazar; normal geliştirme ve dağıtımda yalnızca `build` kullanılır. Oyun dosyalarını değiştirirken `data/game-manifest.json` içindeki ilgili dosyaların boyut ve SHA-256 kayıtları da güncellenmelidir.

## Doğrulama

Testler koleksiyonun 7+7 dağılımını, 14 detay ve oyun bağlantısını, her oyun dosyasının HTTP erişimini ve MIME türünü, alt dizinlerden modül/varlık yüklemeyi, dosya bütünlüğünü, ses için Range desteğini ve hata sayfalarını denetler. Amazon Tukan testleri, 15/30/60 FPS'de kalkışı, kamera/klavye çırpışı başına 100 metre yükselişi, yükseliş birikimini ve tavanını, tek kol/jitter filtrelerini, takip kaybını, süzülüşü, arazi çarpışmasını ve çikolataların üç boyutlu dağılım/toplanmasını doğrular.

Kamera görüntüsü cihazda işlenir. Galeri hesap, kayıt veya görüntü aktarımı eklemez.
