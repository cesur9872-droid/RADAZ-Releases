# RADAZ ödəniş serverini Render-də qurmaq

Razılaşdırılmış hosting büdcəsi: maksimum 20 AZN/ay. 2026-10-01 tarixində [Render qiyməti](https://render.com/pricing) üzrə `0.5c-512mb` web service $7/ay, 1 GB daimi disk $0.25/aydır. Baza cəmi $7.25 ≈ 12.33 AZN (1 USD = 1.70 AZN). Vergi, bank konvertasiyası, artıq trafik/build istifadəsi ayrıca ola bilər; son checkout məbləğini 20 AZN həddi ilə müqayisə edin. Ödənişli workspace planı, autoscaling və əlavə servis seçməyin. Bu hesablama Epoint komissiyasını əhatə etmir.

Render hər web service-ə HTTPS `onrender.com` ünvanı verir. Ayrıca domen almaq lazım deyil. Ünvan yalnız servis yaradıldıqdan sonra məlum olur; əvvəlcədən təxmin edilən domen ayarlara yazılmamalıdır.

## 1. Hesaba giriş və konkret konfiqurasiya

1. [Render](https://dashboard.render.com/) hesabına daxil olun / qeydiyyatı tamamlayın.
2. New → Blueprint seçin. GitHub-dan yalnız `drnaghiyev/RADAZ-D-COM` reposuna giriş verin. Mənbə private qala bilər.
3. Branch `main`, Blueprint path `render.yaml`. Fayl aşağıdakıları hazır verir:
   - Web service: `radaz-license`, region Frankfurt.
   - Plan: `0.5c-512mb` ($7), bir instance.
   - Node 22, root directory `billing`; build `node --check server.mjs`, start `node server.mjs`.
   - 1 GB persistent disk: `/var/data/radaz`.
   - Health check: `/healthz`; automatic deploy söndürülüb.
4. Son qiyməti yoxlayıb hesab/kart təsdiqini tamamlayın. Service URL-ni götürün.

İlk yerləşdirmə `paymentsEnabled:false` ilə işə düşür. Bu uğurlu server yerləşdirməsidir, hazır kart ödənişi deyil. `GET /healthz` → `{ "ok": true, "paymentsEnabled": false }`; `/v1/catalog` → ayda 10 AZN və `enabled:false`. Mövcud pasiyent arxivi və satıcı paneli internetə çıxarılmır.

## 2. İmza açarı və Epoint məlumatları

Render → Service → Environment bölməsində bunları əlavə edin:

| Ad | Dəyər |
|---|---|
| `RADAZ_ISSUER_PRIVATE_KEY_PEM` | Öz kompüterinizdəki `Documents/RADAZ-License-Admin/issuer-private.pem` faylının tam mövcud məzmunu — gizli dəyər kimi |
| `EPOINT_PUBLIC_KEY` | Epoint-in merchant public açarı |
| `EPOINT_PRIVATE_KEY` | Epoint-in merchant private açarı — gizli dəyər kimi |
| `EPOINT_REQUEST_URL` | `https://epoint.az/api/1/request`, yaxud Epoint-in həmin hesab üçün verdiyi ünvan |
| `RADAZ_PAYMENTS_ENABLED` | Sınaq məlumatları hazır olana qədər `false`; düzgün açarlar və callback qurulduqdan sonra `true` |

`RENDER_EXTERNAL_URL` Render tərəfindən avtomatik verilir; sistem callback bazası kimi götürür. İstəyə görə `RADAZ_PUBLIC_BASE_URL` ilə öz təsdiqlənmiş HTTPS domeninizi təyin edə bilərsiniz.

Mövcud imza açarını GitHub-a, söhbətə və alıcıya göndərməyin. Server private açarın `public/license-public.json` ilə uyğunluğunu yoxlayır; fərqli açarla işə düşmür. Yeni açar yaratmaq əvvəlki müştəri paketlərinə uyğun gəlməz.

## 3. Yerli panel və Epoint kabineti

1. `billing/OPEN-SELLER-SETTINGS.cmd` açın. HTML faylını birbaşa açmayın. Terminal pəncərəsi işlək qalmalıdır. Paneli yeniləmək artıq girişi itirmir; köhnə server dayanıbsa launcher-i yenidən açın.
2. HTTPS domeni sahəsinə Render-in həqiqi Service URL-sini yazın. Public/private açarları Epoint kabinetindən götürün. Bank rekvizitlərini bank tətbiqindən dəqiq köçürün: IBAN 28 simvoldur, hesab sahibinin adı valyuta deyil.
3. Panelin verdiyi `/v1/webhooks/provider` ünvanını Epoint result URL-yə, `/payment/return` ünvanını success/error URL-yə daxil edin.
4. Yerli paneldə saxlamaq Render-in məxfi dəyişənlərini avtomatik dəyişmir. Serverdəki açarları da Environment bölməsində yeniləyib deployment başladın.
5. `public/product.json` → `billingUrl` sahəsinə həmin real HTTPS Service URL-sini yazın; müştəri build/ZIP-ni yeniləyin.

## 4. Satışdan əvvəl sınaq

Epoint-in sınaq rejimi/məlumatları ilə ödəniş → imzalı callback → açarın göstərilməsi → ilk aktivləşdirmə ardıcıllığını yoxlayın. Səhv məbləğ, uğursuz ödəniş və təkrar callback açar/müddət yaratmamalıdır. Real kartdan sınaq ödənişi ayrıca maliyyə əməliyyatıdır. İmza açarı və Epoint qoşulmadan `enabled:false` qalması düzgündür.

SQLite sifariş bazası daimi diskdədir. Sadəcə tətbiqi yenidən yerləşdirmək bazanı silmir. Diski silmək isə sifariş və aktivləşdirmə tarixçəsini itirər. Ehtiyat nüsxəni SQLite backup üsulu ilə və ya xidmət dayanarkən götürün. Diskin silinməsi və xidmətin başqa regiona yenidən yaradılması adi yeniləmə deyil.

## Cari mərhələ

Kod, konfiqurasiya və lokal testlər hazırdır. Render hesabına giriş, hesab/kart təsdiqi və Epoint merchant qeydiyyatı insan tərəfindən tamamlanmalıdır. Bu faylın mövcudluğu həmin hesabların yaradıldığını və serverin yerləşdirildiyini göstərmir.
