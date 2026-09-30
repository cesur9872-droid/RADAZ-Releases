# RADAZ ödəniş və aktivləşdirmə xidməti

Bu xidmət satıcının serverində işləyir. Müştəri paketinə gizli açar, ödəniş provayderinin sirri və SQLite bazası daxil edilmir. Hazır satıcı hesabı olmadığı üçün canlı kart ödənişi aktiv deyil.

Tam satıcı təlimatı: [DISTRIBUTION.md](../DISTRIBUTION.md). Şəxsi ayar paneli üçün `billing/OPEN-SELLER-SETTINGS.cmd` açın. Rekvizitlər, Epoint açarları və HTTPS domeni standart olaraq `Documents/RADAZ-License-Admin/merchant.json` içində saxlanır. Satıcı paneli müştəri ZIP-inə daxil edilmir. Bank/IBAN sahələri şəxsi qeyddir; faktiki köçürmə hesabı Epoint kabinetində təsdiqlənməlidir.

Qiymət serverdə 10 AZN × 1–120 ay hesablanır. Müştəridən gələn qiymət qəbul edilmir. Provayderin təsdiqlənmiş webhook-u sifariş, əməliyyat ID-si, məbləğ və valyutanı uyğunlaşdırır. Brauzerin “ödəniş uğurludur” keçidi açar yaratmır.

Ödənişdən sonra verilən `RADAZ-ACT-…` açarı hələ müddəti başlatmır. `/v1/activate` ilk dəfə açarı kompüterə bağlayır, server vaxtı ilə başlanğıcı yazır və alınmış təqvim ayları qədər RSA imzalı aktivləşdirmə verir. Yenidən aktivləşdirmə, təkrar webhook və müştərinin yerli məlumatları silməsi serverdəki müddəti sıfırlamır. Eyni açar ikinci kompüterə bağlanmır. Aktivləşdirmə üçün internet lazımdır; imzalı aktivləşdirmə sonradan lokal yoxlanır.

Əvvəlki `scripts/license-admin.mjs` əl ilə sabit bitmə tarixli `RADAZ1` açarı verir və geriyə uyğunluq üçün saxlanılır. Alışdan sonra ilk aktivləşdirmə tarixinə əsaslanan yeni ödəniş axını üçün həmin skript əvəzinə bu xidmətin `RADAZ-ACT` açarları istifadə olunur.

## Qoşulma

1. Satıcı hesabı açın; provayderin test və istehsal açarlarını serverdə saxlayın.
2. Hazır `epoint.mjs` adapteri rəsmi checkout/callback imzasını yoxlayır. Ayar panelinə merchant açarlarını və Epoint-in verdiyi dəqiq API ünvanını yazın. Canlı sınaqdan əvvəl istehsal ödənişini açmayın. Başqa provayder üçün `RADAZ_PAYMENT_ADAPTER` modulu əvvəlki `createCheckout` və `verifyWebhook` müqaviləsini icra etməlidir; imzasız callback qəbul etməyin.
3. Node.js 22.13+ ilə `node billing/server.mjs` başladın. Standart sahib qovluğu `Documents/RADAZ-License-Admin`, bazası onun `billing-data` alt qovluğudur. `RADAZ_OWNER_DIR`, `RADAZ_ISSUER_PRIVATE_KEY`, `RADAZ_BILLING_DATA`, `PORT` ilə yollar dəyişir. Mövcud satıcı imza açarı və müştərilərdəki `license-public.json` uyğun olmalıdır.
4. HTTPS reverse proxy, sorğu limitləri, server vaxtının sinxronluğu və bazanın ehtiyat nüsxəsini qurun. Webhook ünvanı `/v1/webhooks/provider`-dır. Provayderin callback URL-ləri adapterdə müəyyənləşdirilir.
5. `public/product.json` daxilində `billingUrl`-ı HTTPS xidmət ünvanına təyin edin. Lokal sınaqda localhost HTTP dəstəklənir. Buraxılış paketində `licenseRequired=true` olur.
6. Test ödənişi, səhv məbləğ, təkrar callback, gec aktivləşdirmə, eyni açarın təkrar istifadəsi və müddət bitməsi yoxlanmadan canlı ödənişi açmayın.

Sifariş izləmə tokeni yerli məhsul qovluğunda saxlanır; yalnız həmin token açarı göstərir. Bank kartı məlumatı RADAZ-dan keçmir. Bazanı itirmək aktivləşdirmə tarixçəsini də itirir; ehtiyat nüsxə mütləqdir. Tam offline proqram yerli sistem administratorunun vaxtı və faylları dəyişməsinə qarşı mütləq müdafiə vermir.

Private key panelə/API cavabına geri verilmir. Ayarlar dəyişdikdə billing serveri yenidən başladılmalıdır. Açar e-poçt/SMS ilə avtomatik göndərilmir; alıcı onu RADAZ-da görür, kopyalayır və TXT kimi saxlayır. İstehsal merchant hesabı və HTTPS hosting olmadığı üçün real ödəniş hələ sınaqdan keçirilməyib.

Rəsmi protokol: [Epoint başlanğıc](https://developer.epoint.az/az), [ödəniş yaratma](https://developer.epoint.az/ru/checkout/request), [callback](https://developer.epoint.az/en/callbacks).
