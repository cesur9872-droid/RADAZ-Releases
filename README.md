# RADAZ — alıcı üçün yükləmə və quraşdırma

Azərbaycan dilində radiologiya iş sahəsi: DICOM viewer, lokal arxiv, PACS, MPR/3D, hesabat, çap və CD/DVD çıxışı. Cari buraxılış 0.2.5, qiymət 10 AZN/aydır. Satıcı üçün [geniş ödəniş və paylaşma təlimatı](DISTRIBUTION.md) ayrıca yazılıb.

## Alıcı hansı faylı endirməlidir?

Satıcının verdiyi GitHub Release keçidində **Assets → RADAZ-0.2.5-Windows-preview.zip** endirilir. **Source code (zip)** və **Code → Download ZIP** hazır quraşdırma paketi deyil.

[Mənbə deposu](https://github.com/drnaghiyev/RADAZ-D-COM) və [Releases səhifəsi](https://github.com/drnaghiyev/RADAZ-D-COM/releases/latest) açıqdır. Yeni versiyalar GitHub yoxlamaları və paket yığımı uğurla tamamlandıqdan sonra avtomatik yayımlanır.

## Windows-da başlatma

Node.js 22.13+ və Python 3.10+ tələb olunur. İlk dəfə `SETUP-RADAZ.cmd`, sonra yalnız **`START-RADAZ.cmd`** başladın. Brauzer ünvanı: `http://localhost:5173`.

1. Windows 10/11 64-bit kompüterdə [Node.js](https://nodejs.org/en/download) və [Python](https://www.python.org/downloads/windows/) quraşdırın. Python quraşdırıcısında **Add Python to PATH** seçin. Chrome və ya Edge istifadə edin.
2. Endirilmiş ZIP-ə sağ klik → **Extract All / Hamısını çıxar**. Məsələn, `C:\RADAZ` qovluğu seçin. ZIP-in içindən işə salmayın.
3. `SETUP-RADAZ.cmd` faylını iki dəfə klikləyin. İlk quraşdırma internetdən asılılıq yükləyir; **Setup complete** görünməlidir.
4. `START-RADAZ.cmd` açın. Server pəncərəsini işlədiyiniz müddətdə açıq saxlayın. Sonrakı açılışlarda setup təkrar lazım deyil.
5. `node`, `python` və ya `corepack` tapılmırsa quraşdırma/PATH problemi var; xətanın mətnini satıcıya göndərin. Corepack olmayan Node buraxılışında Corepack ayrıca quraşdırılmalıdır.

Bu ZIP müstəqil EXE installer deyil; Node/Python ayrıca tələb olunur. Böyük müayinələr üçün RAM və boş disk ehtiyacı artır. Video ixracında FFmpeg ayrıca lazımdır.

Mənbə qovluğunda launcher ən son mənbəni yığıb hazır Node.js serverini açır; bu mərhələdə yığımın bitməsini gözləyin. Paylama ZIP-ində fayllar artıq yığılıb. Normal açılış Cloudflare/Miniflare və Vite inkişaf serverindən istifadə etmir. Brauzer yalnız uyğun versiya hazır olduqdan sonra açılır. Lokal DICOM arxivi proqram qovluğundan ayrıca saxlanılır. Eyni kompüterdə köhnə və yeni RADAZ serverlərini paralel açmayın.

## 7 günlük pulsuz demo

Proqram yeni kompüterdə ilk dəfə açıldıqda **7 gün bütün funksiyalar pulsuz işləyir**. Kart və lisenziya açarı lazım deyil. Müddət ZIP-in endirilməsindən deyil, RADAZ-ın ilk istifadəsindən başlayır. Viewer-in alt status sətrində qalan günlər, Yardım → Lisenziya bölməsində dəqiq bitmə vaxtı görünür.

Demo müddəti proqram qovluğundan kənarda saxlanır; proqramı yeniləmək, yenidən quraşdırmaq və arxiv qovluğunu dəyişmək yeni 7 gün vermir. Müddət bitəndə PACS və Local arxiv işləyir, Viewer yalnız görüntüləri listələyir. Digər funksiyalar üçün aylıq lisenziyanı aktivləşdirin. Arxiv faylları silinmir.

## Ödənişdən sonra lisenziya açarı

Satıcı hesabı və HTTPS lisenziya serveri hələ qoşulma mərhələsindədir. **Ödəniş sistemi qoşulmayıb** göstərilirsə kart ödənişi açıq deyil. Aşağıdakı axın provayder qoşulduqdan sonra işləyir:

1. Viewer-də **Yardım → Aylıq ödəniş** açın, ay sayını seçin. 1 ay = 10 AZN, 3 ay = 30 AZN, 6 ay = 60 AZN. Ayrıca illik paket və kartdan avtomatik yenidən pul çəkmə yoxdur.
2. **Ödəniş sisteminə keç** düyməsi Epoint/bank səhifəsini açır. Kart məlumatlarını yalnız orada daxil edin.
3. Ödənişdən sonra RADAZ-a qayıdın. Bank təsdiqi serverə çatdıqda həmin bölmədə **RADAZ-ACT-…** açarı görünür. Proqram nəticəni hər 5 saniyədə yoxlayır.
4. **Açarı kopyala** və ya **Açarı TXT faylı kimi saxla** basın. Açarı paylaşmayın; şəxsi ehtiyat nüsxə saxlayın.
5. **Bu açarı aktivləşdirməyə hazırla**, sonra **Aktivləşdir** basın. İlk aktivləşdirmə üçün internet lazımdır.

Müddət alış tarixindən deyil, **ilk uğurlu aktivləşdirmədən** hesablanır. Məsələn, 3 aylıq açar 5 oktyabrda alınıb 12 oktyabrda aktivləşdirilsə, müddət 12 oktyabrdan başlayır. Eyni açarı təkrar yazmaq müddəti uzatmır. Bir açar bir server kompüterinə bağlanır; həmin serverə qoşulan telefon/planşet ayrıca aktivləşdirilmir.

Açar e-poçta/SMS-ə avtomatik göndərilmir. RADAZ-ı bağlasanız, həmin kompüterdə Aylıq ödəniş bölməsini yenidən açın: saxlanmış sifarişə görə açar yenidən alınır. Ödəniş olunub, açar görünmürsə ikinci dəfə ödəməyin; sifariş nömrəsi və qəbzlə satıcıya müraciət edin. Sifariş faylları və açar TXT-si birlikdə itərsə satıcının yoxlaması tələb olunur.

Müddət bitdikdə **PACS və Local arxiv işləyir**. Viewer-də seriya seçimi və görüntü listələmə qalır. Ölçmə, window/zoom, çap, ixrac, MPR/3D və hesabat aktiv lisenziya tələb edir. Lisenziyasız tam hazırlama rejimi yoxdur.

## Viewer və hesabat

- Arxiv/PACS sətrində iki klik mövcud Viewer-ə müayinəni ötürür; vərəqənin önə gəlməsi brauzerin davranışından asılı ola bilər.
- Cədvəl başlığına klik artan, təkrar klik azalan sıralama verir. Müayinə sayı alt status sətrindədir. Local arxivdə yuxarıdakı Qəbul ayarları düyməsi modal açır.
- Ctrl + siçan çarxı Viewer/MPR görüntüsünü böyüdür və kiçildir; adi çarx kəsitləri dəyişir. Yardım menyusu Viewer, Local arxiv və PACS başlıqlarında var.
- Local arxiv və PACS “Bu gün” seçimi ilə açılır. Başqa tarixlər üçün checkbox-u söndürün; PACS sorğusunu “Axtar” ilə yeniləyin.
- Cədvəldə “Hamısını seç” yalnız görünən müayinələri seçir. Filtri dəyişəndə gizlənən müayinələr seçimdən çıxır. “Sil” təsdiqdən sonra diskdəki və brauzerdəki lokal nüsxələri silir; PACS-də serverin orijinalları saxlanılır.
- Görüntünün solundakı kiçik checkbox cari görünüşü çap siyahısına əlavə edir.
- CD/DVD yalnız lokal arxiv və PACS-dan açılır.
- Hesabat viewer-də uğurla açılmış DICOM dəstini qəbul edir; digər arxiv müayinələri avtomatik daxil edilmir.
- Hesabatdakı seçilmiş seriyaların bütün görüntüləri bir ZIP-ə yığılır. 10 görüntü məhdudiyyəti yoxdur; yerli ZIP həddi 480 MB-dır.
- `public/radaz-chatgpt-extension.zip` əlavəsinin **0.3.3** versiyasını quraşdırın/yeniləyin. Yalnız **RADAZ-ChatGPT.zip** ChatGPT mesaj sahəsinə əlavə edilir; ayrıca JPEG ötürülmür. Tapşırıq: **Dərindən, tək-tək analiz et və rapor yaz.** Arxivdəki bütün görüntülərə manifest sırası ilə baxmaq tələb olunur. Mesajı istifadəçi göndərir. Cavab hazır olduqda **RADAZ-a qaytar** analizi hesabat səhifəsində göstərir. Yoxlanmış mətn ayrıca hesabata əlavə olunur.
- ChatGPT hesabının yükləmə limitləri ayrıca tətbiq olunur. Əlavə işləmədikdə ZIP-i və tapşırığı əl ilə əlavə etmək mümkündür.

Əlavəni quraşdırmaq üçün proqramda Hesabat → Əlavənin quraşdırılması keçidini açın. Köhnə əlavə varsa onun fayllarını yeniləyib Chrome/Edge extensions səhifəsində **Reload** basın, RADAZ və ChatGPT-ni yeniləyin. ZIP-i yükləmək onun həqiqətən oxunduğu demək deyil. “Fayl əlçatan deyil” cavabı radioloji analiz sayılmır; nəticə radioloq tərəfindən yoxlanmalıdır.

## Arxiv və yeniləmə

Disk arxivi standart olaraq `Documents\RADAZ-Archive` içindədir. SQLite bazası və DICOM `instances` qovluğunu birlikdə ehtiyat nüsxələyin. Brauzer arxivi həmin brauzer profilindədir və brauzer məlumatlarını təmizləyəndə itə bilər; önəmli müayinələri disk arxivinə saxlayın.

Yeniləmədən əvvəl çalışan RADAZ xidmətlərini bağlayın, arxiv ehtiyat nüsxəsini alın, yeni ZIP-i ayrıca proqram qovluğuna çıxarıb setup/start edin. Arxiv qovluğunu silməyin. Köhnə xidmət açıq qalsa köhnə versiya görünə bilər. Dəstək: [drnaghiyev@gmail.com](mailto:drnaghiyev@gmail.com).

0.2.6-da diskdən silmə üçün yeni arxiv xidməti lazımdır. Köhnə xidmət arxa planda qalıbsa kompüteri yenidən başladın, sonra yeni qovluğun START-RADAZ.cmd faylını açın. Kilidli fayl dərhal silinə bilməzsə proqram bunu bildirir və xidmət növbəti dəfə açıldıqda silməni tamamlayır.

## İnkişaf və yoxlama

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm dev
corepack pnpm build
node node_modules/typescript/bin/tsc --noEmit --incremental false
node --experimental-strip-types --test tests/*.test.mjs
python -m unittest discover -s tests -p '*_test.py'
```

Python testləri üçün `pydicom`, `pynetdicom` və Pillow lazımdır. PACS kitabxanaları `bridge/wheels` qovluğunda var. Video ixracı üçün FFmpeg ayrıca tələb olunur.

Texniki quraşdırma: [LOKAL-ISTIFADE.md](LOKAL-ISTIFADE.md). Paylama və aylıq lisenziya: [DISTRIBUTION.md](DISTRIBUTION.md). Təmizləmə və yoxlama nəticələri: [CLEANUP-AUDIT.md](CLEANUP-AUDIT.md).
