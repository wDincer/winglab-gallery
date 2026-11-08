# Duckrooms — Okları İzle, Çıkışı Bul

İlk geçerli çırpıştan sonra ördek havada kalır. Kalkış eski yumuşak yükselişi korur; sonrasında en düşük uçuş merkezi 1 metredir. Kolları aşağıda tutmak yeniden yere indirmez. Yalnız duraklama, takip kaybı, yakalanma, kazanma veya yeniden başlatma uçuş akışını durdurur.

Normal uçuş en az 78 KT'dir; odalardaki gerçek dünya hızı 4,8 m/s ile sınırlanır. Dönüşler daha çeviktir ve yön girdisi bırakılınca dönüş hemen durur. Görünür yatış yumuşak kalır. Geçitler 8,4 metreye genişletilmiştir. Gövde ve kanat temasları aynı ortak ördek ölçülerini kullanır. Duvar teması çarpma efektiyle 180° geri döndürür; oyunu bitirmez.

Labirentin her odasının en az iki geçidi vardır. Tohumlu üretim ve karşılıklı kapı bağlantıları korunur; çıkmaz odalar oluşturulmaz. Dört yönde yeni odalar üretilebilir fakat kazanma için belirli bir çıkış vardır.

Çıkış, başlangıca göre 18 oda doğuda ve 14 oda güneydedir: dünya konumu `(324,252)`. Başlangıçta duvarların ötesinde ve görüş dışındadır; ördek çıkışa giden ilk geçide dönük başlar. Başlangıçtan geçerli en kısa yol 32 oda geçişi, yani 576 metredir. Yeşil çıkış alanına girmek kazandırır. Çıkışın 2,2 metrelik tetik alanı sahnedeki kapıyla aynı konumu kullanır.

Duvarlardaki yeşil ÇIKIŞ levhaları yalnızca açık geçitlere yönlendirir. Oda değiştikçe yönlendirme yeniden hesaplanır; aynı blok içinde duvar geometrisini yeniden üretmez. Levhalar gerçek kapı yanlarındaki duvara monte edilir. Çıkış yalnız yakın odalar çizilirken ve duvarların engellemediği görüşlerde görünür.

Canavar ilk 20 saniye ve ilk 45 metre geçilene kadar doğmaz. En az iki oda geçidi uzakta, ileride veya yanda/arkada seçilen bir odada belirir. Temel hızlar önceki %25 azaltılmış değerlerdir. Her başarılı dalgadan sonra sonraki dalganın hızı öncekinin 1,1 katı olur. Canavar sayısı `1 + floor(kurtuluş / 2)` formülüyle artar: 0–1 kurtuluşta bir, 2–3 kurtuluşta iki, 4–5 kurtuluşta üç canavar. Birden fazla canavar aynı 15 saniyelik dalgayı paylaşır; tüm dalgadan kurtulmak bir kurtuluş sayılır. Her canavarın doğuş yönü bağımsız olarak %60 önden, %40 yandan/arkadan seçilir; gerçek geçitlerden en az iki oda uzakta kalır. Kalkan yokken herhangi bir canavar bir metreye gelirse kaybedilir.


Her 5×2 oda grubunda tam bir oda havada duran bir güç kutusu içerir. Yerleşim tohumludur; başlangıç ve çıkış odaları yerine aynı grupta başka bir oda seçilir. Kutular oda merkezinde 1,3 metre yüksekte, duvar ve sütunlardan uzaktadır. Alınan kutu aynı oyun içinde geri gelmez. Kutu rastgele bir güç verir ve yeni kutu önceki gücü değiştirip 15 saniyeyi yeniden başlatır. Canavar varken dondurma, %55 yavaşlatma veya temas koruması veren kalkan; canavar yokken %35 hız artışı ya da kalkan çıkar. Etki ve kalan süre HUD üzerinde gösterilir. Duraklama veya vücut takibinin kaybı güç süresini de durdurur.

Kamera görüntüsü cihazda kalır. Vücut takibi kaybolunca hareket, kovalamaca ve süre bekler. `npm run build`, `npm run check` ve `npm test` ile doğrulanır. Galeriye özgü değişikliklerin üzerine yazmamak için `collect` çalıştırılmaz.
