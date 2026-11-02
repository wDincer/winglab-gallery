export const projects = [
  {
    slug: 'amazon-tukan', title: 'Amazon Tukan', team: 'WINGLAB', date: '2026-10-31', time: '09:34', mode: 'eagle', genre: 'Keşif', image: 'amazon-tukan.png', accent: '#33795e',
    summary: 'Amazon’un üzerinde süzül. Kartalları atlat, doğru çikolatayı topla.',
    description: '500 metrelik bir dağ zirvesinden başlayan bu yolculukta kontrol, kanatların yerine geçen kollarında. Amazon ormanının üzerinde uçarken hareketli kartallardan uzak dur ve havaya dağılmış çikolataları topla.',
    vehicle: 'Tukan', setting: 'Amazon ormanı', objective: 'Kartallara çarpmadan uç ve çikolata puanını artır.',
    features: ['500 metrelik zirveden kalkış', 'Puan kazandıran ve puan düşüren çikolatalar', 'Hareketli kartal engelleri'],
    keys: [['B', 'Kanat çırp'], ['← →', 'Yön değiştir'], ['↑ ↓', 'Kanat açısını ayarla'], ['R', 'Yeniden başlat']],
    gesture: 'İki kolunu kaldırıp aşağı çırparak hızlan ve yüksel. Bir kolunu indirerek o yöne dön.'
  },
  {
    slug: 'kaan-durum', title: 'KAAN Dürüm Filosu', team: 'Şampiyonlar', date: '2026-10-31', time: '11:03', mode: 'airplane', genre: 'Hava savaşı', image: 'kaan-durum.jpg', accent: '#967b34',
    summary: 'KAAN ile hedefe kilitlen. Alkışın, bir dürüm füzesine dönüşsün.',
    description: 'Bir savaş uçağı, alışılmadık bir mühimmat ve havada hareket eden hedefler. KAAN ile uçarken ekranın merkezindeki düşmana kilitlen; ellerini çırparak çiğköfte dürümünü fırlat ve imha sayacını yükselt.',
    vehicle: 'KAAN', setting: 'Açık hava sahası', objective: 'Yeşil hedef kilidini yakala ve düşman uçaklarını imha et.',
    features: ['Alkışla dürüm füzesi atışı', 'Merkezde yeşil hedef kilidi', 'İmha edilen uçak sayacı'],
    keys: [['↑ ↓', 'Yüksel / alçal'], ['← →', 'Yön değiştir'], ['G', 'Gaz ver'], ['E', 'Kilitli hedefe ateş et']],
    gesture: 'Kollarınla uçuşu kontrol et, gövdeni öne eğerek gaz ver. Yeşil kilitte ellerini çırparak ateş et.'
  },
  {
    slug: 'sarma-ucusu', title: 'Sarma Uçuşu', team: 'Yaprak Sarma', date: '2026-10-31', time: '11:54', mode: 'airplane', genre: 'Parkur', image: 'sarma-ucusu.png', accent: '#377f97',
    summary: 'Bikini Bottom’da uçan bir Batmobil, sekiz halka ve bir tabak sarma.',
    description: 'Bikini Bottom’ın renkli evleri arasında Batmobil ile uç. Robin’in yaprak sarma uzattığı sekiz tam halkanın içinden geçerken sana doğru fırlatılan kitapları manevra yaparak atlat.',
    vehicle: 'Batmobil', setting: 'Bikini Bottom', objective: '2,8 kilometrelik rotada halkalardan geç ve kitaplardan kaç.',
    features: ['Sekiz tam halka', 'Sarma tabağı uzatan Robin', 'Kaçınılacak kitaplar ve çarpışma animasyonu'],
    keys: [['↑ ↓', 'Yüksel / alçal'], ['← →', 'Yön değiştir'], ['G', 'Gaz ver'], ['Boşluk', 'Duraklat / devam et']],
    gesture: 'Kollarını yana açarak uçuşa başla. İki kolunu kaldırarak yüksel, gövdeni öne eğerek hızlan.'
  },
  {
    slug: 'ucan-inek', title: 'Uçan İnek', team: 'İnsancıl Varlıklar', date: '2026-10-31', time: '13:53', mode: 'eagle', genre: 'Toplama', image: 'ucan-inek.jpg', accent: '#7f7750',
    summary: 'Kuyruk pervane oldu. Mahallenin üzerinde saman toplama zamanı.',
    description: 'Kuş mekaniğiyle uçan bu ineğin kuyruğu bir pervane gibi dönüyor. Mahallenin üzerinde süzül, havadaki saman balyalarını topla ve şefin rastgele fırlattığı yemekli tabaklardan uzak dur.',
    vehicle: 'Pervane kuyruklu inek', setting: 'Mahalle', objective: 'Saman balyalarını topla, tabaklara çarpmadan uçuşunu sürdür.',
    features: ['Pervane gibi dönen kuyruk', 'Toplanınca parçalanan saman balyaları', 'Rastgele tabak fırlatan şef'],
    keys: [['B', 'Kanat çırp'], ['← →', 'Yön değiştir'], ['↑ ↓', 'Kanat açısını ayarla'], ['R', 'Yeniden başlat']],
    gesture: 'Kalkış için iki kolunu yana kaldır. Ardından kanat çırpar gibi hareket ederek uçuşunu sürdür.'
  },
  {
    slug: 'kizilelma-col', title: 'Kızılelma Çöl Görevi', team: 'Ekmekspor', date: '2026-10-31', time: '14:47', mode: 'airplane', genre: 'Toplama', image: 'kizilelma-col.jpg', accent: '#ac793e',
    summary: 'Çölde develer, balık atan ayılar ve havada toplanacak elmalar.',
    description: 'Kızılelma ile develerin yürüdüğü çölün üzerinde uç. Kutup ayılarının fırlattığı balıklardan kaçarken her biri 500 puan değerindeki elmaları topla. 5.000 puana ulaşınca görev tamamlanır.',
    vehicle: 'Kızılelma', setting: 'Çöl', objective: 'Elma toplayarak 5.000 puana ulaş; balık isabetleri puanını düşürür.',
    features: ['Yürüyen develer ve balık atan ayılar', 'Elma başına 500 puan', 'Kazanma ve kaybetme animasyonları'],
    keys: [['↑ ↓', 'Yüksel / alçal'], ['← →', 'Yön değiştir'], ['G', 'Gaz ver'], ['Boşluk', 'Duraklat / devam et']],
    gesture: 'Kollarını kanat gibi aç, tek kolunu indirerek dön. Gövdeni öne eğerek gazı artır.'
  },
  {
    slug: 'ocean-flight', title: 'Okyanus Macerası', team: 'Azerem', date: '2026-10-31', time: '15:30', mode: 'airplane', genre: 'Keşif', image: 'ocean-flight.jpg', accent: '#2e829c',
    summary: 'Adadan havalan. Altınları topla, uçağını gökyüzünde geliştir.',
    description: 'Bir adadan kalkıp okyanusun üzerinde uçuşa çık. Hasar veren bulutlardan ve yönünü değiştiren kuşlardan kaçın. Dört altınla A350’ye, sekiz altınla F-16’ya dönüşerek yolculuğunu sürdür.',
    vehicle: 'Gelişen uçak', setting: 'Ada ve okyanus', objective: 'Altınları toplayıp uçağını geliştir, 100 canını koru.',
    features: ['Adadan kalkış ve okyanus uçuşu', 'Dört altında A350, sekiz altında F-16', 'Bulut hasarı ve kuş çarpışmaları'],
    keys: [['↑ ↓', 'Yüksel / alçal'], ['← →', 'Yön değiştir'], ['G', 'Gaz ver'], ['C', 'Kamera görünümünü değiştir']],
    gesture: 'Kollarınla irtifanı ve yönünü kontrol et. Gövdeni öne eğerek hızlan, dik durarak normal gaza dön.'
  },
  {
    slug: 'aurora-operasyonu', title: 'Aurora Operasyonu', team: 'WINGLAB', date: '2026-10-31', time: '16:26', mode: 'airplane', genre: 'Hava savaşı', image: 'aurora-operasyonu.jpg', accent: '#6b6ea7',
    summary: 'Kuzey ışıkları altında B-2 ile uç. Başınla nişan al, alkışla ateş et.',
    description: 'Karlı dağlar ve fiyortlarla çevrili bir gökyüzünde B-2 pilotu ol. Baş hareketlerinle nişangâhı yönlendir, yeşil kilidi yakala ve alkışla füze gönder. Her imha 25 puan ve yüzde 10 kabiliyet artışı getirir.',
    vehicle: 'B-2', setting: 'Kuzey ışıklı fiyortlar', objective: 'Düşman uçaklarını imha et ve üç canını koru.',
    features: ['Baş hareketiyle nişan alma', 'İmha başına 25 puan ve %10 gelişim', 'Üç can ve kaçınılabilir düşman füzeleri'],
    keys: [['↑ ↓ / ← →', 'İrtifa ve yön'], ['G', 'Gaz ver'], ['Fare', 'Nişan al'], ['Tık / E', 'Füze fırlat']],
    gesture: 'Gövdenle uç, başını çevirerek nişan al. Ellerini açıp yeniden birleştirerek bir füze ateşle.'
  },
  {
    slug: 'nebula-wing', title: 'Nebula Wing', team: 'WINGLAB', date: '2026-11-01', time: '09:23', mode: 'airplane', genre: 'Uzay savaşı', image: 'nebula-wing.jpg', accent: '#7865a3',
    summary: 'Bulutsuların arasında çift ışınla savaş. Hedefi ortala, kilidi yakala.',
    description: 'Bulutsularla dolu bir uzayda, farklı düşman araçlarına karşı mücadele et. El çırparak aracının iki yanından ışın gönder. Her araç 100 canla başlar; her ışın isabeti 10 hasar verir.',
    vehicle: 'Uzay aracı', setting: 'Bulutsu evreni', objective: 'Hedefe kilitlenerek düşman araçlarını yok et ve canını koru.',
    features: ['İki yandan eşzamanlı ışın', '100 can ve isabet başına 10 hasar', 'Yeşil hedef kilidi ve patlamalar'],
    keys: [['↑ ↓', 'Kol açısını ayarla'], ['← →', 'Yön değiştir'], ['G', 'Gaz ver']],
    gesture: 'Gövdeyle uçuş sırasında hedefi nişangâhın ortasına getir. Ellerini açıp çırparak iki ışın ateşle.'
  },
  {
    slug: 'nyan-duello', title: 'Nyan Cat Düellosu', team: 'Miyavlayan Keçiler', date: '2026-11-01', time: '10:20', mode: 'eagle', genre: 'Düello', image: 'nyan-duello.jpg', accent: '#bd6d96',
    summary: 'Gökkuşağını peşine tak. Reçel ve Çokokrem düellosuna katıl.',
    description: 'Patilerini kanat gibi kullanan Nyan Cat ile tek çırpışta havalan. Rakip kedinin Çokokrem saldırılarından kaçarken hedefi yeşil nişangâhta yakala ve ellerini birleştirerek reçel fırlat.',
    vehicle: 'Nyan Cat', setting: 'Kozmik düello alanı', objective: 'Üç isabet aldırarak rakibini yen; kendi üç canını koru.',
    features: ['Tek çırpışla kalkış', 'Reçel ve Çokokrem saldırıları', 'Üç isabette sonuçlanan düello'],
    keys: [['B', 'Kanat çırp'], ['← →', 'Yön değiştir'], ['Boşluk', 'Reçel fırlat'], ['P', 'Duraklat / devam et']],
    gesture: 'Kollarını kaldırıp aşağı çırparak yüksel. Rakibe kilitlenince ellerini birleştirerek saldır.'
  },
  {
    slug: 'gokbey-teknofest', title: 'GÖKBEY TEKNOFEST', team: 'WINGLAB', date: '2026-11-01', time: '11:00', mode: 'airplane', genre: 'Parkur', image: 'gokbey-teknofest.jpg', accent: '#b45d4e',
    summary: 'Kuleden kalk. GÖKBEY ile çift katlı köprülerin arasından geç.',
    description: 'TEKNOFEST ortamındaki yüksek bir kuleden GÖKBEY helikopteriyle havalan. Sekiz çift katlı geçitte farklı güçlendirmeleri dene, coin topla ve havada dolaşan kartallardan kaçın.',
    vehicle: 'GÖKBEY helikopteri', setting: 'TEKNOFEST alanı', objective: 'Çift katlı geçitleri tamamla ve kartallara çarpmadan coin topla.',
    features: ['52 metrelik kuleden kalkış', 'Sekiz çift katlı geçit ve güçlendirmeler', 'Beş coinde kırmızı helikopter'],
    keys: [['↑ ↓', 'Yüksel / alçal'], ['← →', 'Yön değiştir'], ['G', 'Gaz ver'], ['R', 'Yeni tur başlat']],
    gesture: 'Helikopter, WINGLAB uçak kontrollerini kullanır. Kollarınla yön ve irtifayı, öne eğilerek gazı kontrol et.'
  },
  {
    slug: 'duckrooms', title: 'Duckrooms', team: 'Youngmaster', date: '2026-11-01', time: '11:50', mode: 'eagle', genre: 'Kaçış', image: 'duckrooms.png', accent: '#9c8d48',
    summary: 'Sarı odalarda küçük bir ördek. Arkanda ise hiç beklemediğin bir misafir.',
    description: 'Alçak tavanlı Backrooms odalarında uçan küçük bir ördeği yönet. Dört yöne uzayan sınırsız labirenti keşfederken yan koridorlardan çıkan canavardan kaç; her kovalamaca 15 saniye sürer.',
    vehicle: 'Sarı ördek', setting: 'Sonsuz Backrooms labirenti', objective: '15 saniyelik kovalamacayı atlat; canavarı bir metreden uzakta tut.',
    features: ['Dört yönde uzayan sınırsız labirent', '15 saniyelik kovalamacalar', 'Canavara bir metre yaklaşınca oyun sonu'],
    keys: [['B / Boşluk', 'Kanat çırp'], ['← →', 'Yön değiştir'], ['↑ ↓', 'Fren / dalış'], ['Esc', 'Duraklat / devam et']],
    gesture: 'İki kolunu kaldırıp aşağı indirerek kanat çırp. Bir kolunu alçaltarak labirentte o yöne dön.'
  },
  {
    slug: 'uranus-gorevi', title: 'Uranüs Görevi', team: 'Tatlıpatatesler', date: '2026-11-01', time: '13:56', mode: 'airplane', genre: 'Uzay yolculuğu', image: 'uranus-gorevi.jpg', accent: '#6a79b8',
    summary: 'Dünya’dan Uranüs’e üç dakika. İki portal, meteorlar ve UFO’lar.',
    description: 'Dünya’dan kalkıp gezegenleri görerek Uranüs’e doğru ilerle. Yön oklarını takip et, iki portaldan geç ve yoğunlaşan nebulalarda meteorlarla UFO saldırılarını lazerlerinle karşıla.',
    vehicle: 'Roket', setting: 'Dünya – Uranüs rotası', objective: 'Üç dakikalık yolculuğu tamamla; 10 hasar almadan Uranüs’e ulaş.',
    features: ['Üç dakikalık gezegen yolculuğu', 'İki portal ve üç uzay bölgesi', 'Meteor / UFO döngüsü ve lazer atışları'],
    keys: [['↑ ↓ / ← →', 'İrtifa ve yön'], ['G', 'Gaz ver'], ['Fare', 'Nişan al'], ['J / Tık', 'Lazer ateşle']],
    gesture: 'Kollarını yana açarak kalkış yap. Gövdeni öne eğerek hızlan ve kol hareketlerinle yön oklarını izle.'
  },
  {
    slug: 'hurkus-liberty', title: 'Hürkuş Özgürlük Savunması', team: 'Enderuntech', date: '2026-11-01', time: '15:28', mode: 'airplane', genre: 'Savunma', image: 'hurkus-liberty.png', accent: '#4c8d86', entry: 'mission.html',
    summary: 'New York üzerinde Hürkuş. Özgürlük Heykeli’ni koruma sırası sende.',
    description: 'Her 30 saniyede bir Özgürlük Heykeli’ne yaklaşan F-16’ları durdur. Hürkuş ile hedefe yönel, yeşil kilidi yakala ve ellerini birbirine dokundurarak güdümlü füzeni fırlat.',
    vehicle: 'Hürkuş', setting: 'New York limanı', objective: 'Heykel zarar görmeden 10 düşman uçağını imha et.',
    features: ['30 saniyede bir gelen F-16 saldırısı', 'El temasıyla güdümlü füze', '10 imhada zafer, heykele çarpmada kayıp'],
    keys: [['↑ ↓ / ← →', 'İrtifa ve yön'], ['G', 'Gaz ver'], ['X', 'Kilitli hedefe füze at'], ['Boşluk', 'Duraklat / devam et']],
    gesture: 'Gövdenle uçuşu kontrol et. Yeşil hedef kilidi oluşunca ellerini birbirine dokundurarak ateşle.'
  },
  {
    slug: 'bermuda-f35', title: 'Bermuda F-35', team: 'Minyonlar', date: '2026-11-01', time: '16:17', mode: 'airplane', genre: 'Hayatta kalma', image: 'bermuda-f35.jpg', accent: '#657b8c',
    summary: 'Şeytan Üçgeni’nde bir F-35. Fırtınanın içinden çıkmak için 15 saniyen var.',
    description: 'Dev bir girdabın üzerinde, yıldırımların arasından uç. Her 15 saniyede oluşan kırmızı bölgeyi zamanında terk et ve sudan sıçrayan köpekbalıklarını atlat. Üç temas ya da bir yıldırım uçuşu bitirir.',
    vehicle: 'F-35', setting: 'Bermuda Şeytan Üçgeni', objective: 'Kırmızı bölgelerden kaç, irtifanı koru ve hayatta kal.',
    features: ['15 saniyelik kırmızı tehlike bölgeleri', 'Dev girdap ve yıldırımlar', 'Üç temasta kaybettiren köpekbalıkları'],
    keys: [['↑ ↓', 'Yüksel / alçal'], ['← →', 'Yön değiştir'], ['G', 'Gaz ver'], ['Boşluk', 'Duraklat / devam et']],
    gesture: 'Kollarını kanat gibi açık tut. Öne eğilerek gaz ver, tek kolunu indirerek tehlikeli bölgeden uzaklaş.'
  }
];

export const modeLabel = mode => mode === 'eagle' ? 'Kuş mekaniği' : 'Uçak mekaniği';
export const dayLabel = date => date === '2026-10-31' ? '31 Ekim · Cumartesi' : '1 Kasım · Pazar';
