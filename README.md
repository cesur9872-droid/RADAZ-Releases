# RADAZ — alıcı üçün yükləmə və quraşdırma

Azərbaycan dilində radiologiya iş sahəsi: DICOM viewer, lokal arxiv, PACS, MPR/3D, hesabat, çap və CD/DVD. Bu mənbə 0.2.13 paketini hazırlayır; qiymət 10 AZN/aydır. Satıcı üçün [geniş ödəniş və paylaşma təlimatı](DISTRIBUTION.md) ayrıca yazılıb.

## Alıcı hansı faylı endirməlidir?

Satıcının verdiyi GitHub Release keçidində **Assets → RADAZ-0.2.13-Setup.exe** endirilir. **Source code (zip)** və **Code → Download ZIP** hazır quraşdırma paketi deyil.

[Quraşdırıcılar və avtomatik yenilənmələr](https://github.com/cesur9872-droid/RADAZ-Releases/releases/latest) ayrıca açıq depoda yayımlanır. 0.2.9 və daha köhnə versiyalar köhnə ünvana bağlıdır: onlarda yeni Setup-ı bir dəfə açmaq lazımdır; sonrakı yenilənmələr yeni kanaldan avtomatik gələcək.

## Windows-da başlatma

Windows 10/11 64-bit üçün **Setup.exe** açın, sonra iş masasındakı **RADAZ** qısayolundan istifadə edin. Node.js, Python, DICOM paketləri, Pillow və FFmpeg quraşdırıcıya daxildir; ilkin quraşdırmada internet və ayrıca paket quraşdırmaq lazım deyil. Brauzer ünvanı: `http://localhost:5173`.

Alternativ **Windows-x64.zip** də tam oflayndır: ayrıca qovluğa çıxarın və `SETUP-RADAZ.cmd` açın. **Windows-preview.zip** yüngül texniki paketdir; yalnız bu variant sistemdə Node.js 22.13+, Python 3.10+ və video üçün FFmpeg tələb edir. Böyük müayinələr üçün RAM ehtiyacı artır.

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

- Local Archive-də müayinə sətrinə klik ayrıca Viewer vərəqəsi açır. PACS-dən açılan müayinə də ayrıca Viewer-də göstərilir; digər pasiyentlərin WL/WW, ölçüləri və görüntü vəziyyəti qorunur.
- Cədvəl başlığına klik artan, təkrar klik azalan sıralama verir. Müayinə sayı alt status sətrindədir. Local arxivdə yuxarıdakı Qəbul ayarları düyməsi modal açır.
- Sütun başlığının sağ sərhədini sürükləməklə eni dəyişin; enlər həmin brauzerdə saxlanılır. Sərhədə iki klik standart enləri bərpa edir. Fokuslanmış sərhəddə sol/sağ ox 5 px, Shift+ox 25 px dəyişir.
- Ctrl + siçan çarxı Viewer/MPR görüntüsünü böyüdür və kiçildir; adi çarx kəsitləri dəyişir. Yardım menyusu Viewer, Local arxiv və PACS başlıqlarında var.
- Local arxiv və PACS “Bu gün” seçimi ilə açılır. Başqa tarixlər üçün checkbox-u söndürün; PACS sorğusunu “Axtar” ilə yeniləyin.
- Cədvəldə “Hamısını seç” yalnız görünən müayinələri seçir. Filtri dəyişəndə gizlənən müayinələr seçimdən çıxır. “Sil” təsdiqdən sonra diskdəki və brauzerdəki lokal nüsxələri silir; PACS-də serverin orijinalları saxlanılır.
- Görüntünün solundakı kiçik checkbox cari görünüşü çap siyahısına əlavə edir.
- Viewer-də ayrıca **CD/DVD import** düyməsini aktiv edin. Kompüterə taxılmış və sonradan taxılan optik disk avtomatik açılır; fayl/qovluq seçimi və təsdiq yoxdur. DICOMDIR oxunur, alt qovluqlardakı uzantısız və raw DICOM faylları da aşkar edilir.
- Seriyalar və ilk thumbnail dərhal görünür, qalan kəsitlər arxa planda yüklənir. 3D ilk kəsitlərdən tədricən göstərilir; MPR aksial görüntünü dərhal, digər müstəviləri seriya tamamlandıqda açır.
- CD/DVD görüntüləri Local Archive-a yazılmır. Disk çıxarılanda həmin sessiyanın görüntüləri, thumbnail, MPR/3D və hesabatın müvəqqəti mənbələri açıq pəncərələrdən təmizlənir. Əl ilə fayl/qovluq importu əvvəlki arxiv davranışını saxlayır.
- Hesabat viewer-də uğurla açılmış DICOM dəstini qəbul edir; digər arxiv müayinələri avtomatik daxil edilmir.
- Hesabatdakı seçilmiş seriyaların bütün görüntüləri bir ZIP-ə yığılır. 10 görüntü məhdudiyyəti yoxdur; yerli ZIP həddi 480 MB-dır.
- `public/radaz-chatgpt-extension.zip` əlavəsinin **0.3.3** versiyasını quraşdırın/yeniləyin. Yalnız **RADAZ-ChatGPT.zip** ChatGPT mesaj sahəsinə əlavə edilir; ayrıca JPEG ötürülmür. Tapşırıq: **Dərindən, tək-tək analiz et və rapor yaz.** Arxivdəki bütün görüntülərə manifest sırası ilə baxmaq tələb olunur. Mesajı istifadəçi göndərir. Cavab hazır olduqda **RADAZ-a qaytar** analizi hesabat səhifəsində göstərir. Yoxlanmış mətn ayrıca hesabata əlavə olunur.
- ChatGPT hesabının yükləmə limitləri ayrıca tətbiq olunur. Əlavə işləmədikdə ZIP-i və tapşırığı əl ilə əlavə etmək mümkündür.

Əlavəni quraşdırmaq üçün proqramda Hesabat → Əlavənin quraşdırılması keçidini açın. Köhnə əlavə varsa onun fayllarını yeniləyib Chrome/Edge extensions səhifəsində **Reload** basın, RADAZ və ChatGPT-ni yeniləyin. ZIP-i yükləmək onun həqiqətən oxunduğu demək deyil. “Fayl əlçatan deyil” cavabı radioloji analiz sayılmır; nəticə radioloq tərəfindən yoxlanmalıdır.

## Arxiv və yeniləmə

Disk arxivi standart olaraq `Documents\RADAZ-Archive` içindədir. SQLite bazası və DICOM `instances` qovluğunu birlikdə ehtiyat nüsxələyin. Brauzer arxivi həmin brauzer profilindədir və brauzer məlumatlarını təmizləyəndə itə bilər; önəmli müayinələri disk arxivinə saxlayın.

Setup ilə quraşdırılan versiya əlçatan GitHub buraxılışını arxa planda endirir, SHA-256 yoxlayır və növbəti açılışda tətbiq edir. Müayinə zamanı proqram bağlanmır; açılış alınmasa əvvəlki versiya bərpa edilir. Arxiv ayrıca saxlanılır; arxiv qovluğunu silməyin. Dəstək: [drnaghiyev@gmail.com](mailto:drnaghiyev@gmail.com).

0.2.7-dən başlayaraq yeni qovluğun START-RADAZ.cmd faylı köhnə RADAZ veb-serverini avtomatik əvəz edir və lazım olan paketlər yoxdursa ilkin quraşdırmanı başladır. İşləyən versiyanı Yardım → RADAZ haqqında bölməsində yoxlayın. Brauzer başqa kompüterin IP ünvanını açırsa, həmin server kompüter də yenilənməlidir.

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
# Windows-da quraşdırma və avtomatik yeniləmə

[Son GitHub buraxılışından](https://github.com/cesur9872-droid/RADAZ-Releases/releases/latest) **RADAZ-…-Setup.exe** endirin və açın. Windows 10/11 64 bit üçün per-user quraşdırıcıdır. Node.js, Python, Pillow, DICOM paketləri və FFmpeg daxildir; ayrıca paket quraşdırılması tələb olunmur. İş masası və Başlat menyusunda RADAZ qısayolu yaradılır. Qısayol serveri və arxiv xidmətini arxa planda başladıb brauzerdə RADAZ-ı açır.

Yeniləmələr GitHub-dan avtomatik endirilir və SHA-256/file manifest ilə yoxlanılır. Hazır yeniləmə RADAZ qısayolundan növbəti açılışda tətbiq olunur. Aktiv müayinə qəfil yenidən yüklənmir. Server açıla bilməsə əvvəlki versiyaya qayıdılır. DICOM qəbulu və çıxış işi davam edirsə arxiv yeniləməsi təxirə salınır. İnternet olmayanda quraşdırılmış versiya işləyir. Yoxlama açılışda başlayır, açıq qaldıqda hər 6 saat təkrarlanır.

Proqram `%LOCALAPPDATA%\Programs\RADAZ` altında, klinik arxiv isə ayrıca `Documents\RADAZ-Archive` altında qalır. Köhnə ZIP-dən ilk keçiddə köhnə qəbuledici işləyirsə Windows-u bir dəfə yenidən başladın. `Windows-x64.zip` tam oflayn alternativdir: çıxarıb `SETUP-RADAZ.cmd` açın. `Windows-preview.zip` yüngül köhnə paylama formatıdır və sistemdə Node/Python tələb edir.

Quraşdırıcı [Inno Setup](https://jrsoftware.org/) ilə yaradılır. [Node.js](https://nodejs.org/), [Python embedded distribution](https://docs.python.org/3/using/windows.html#the-embeddable-package), [Pillow](https://pillow.readthedocs.io/) və [imageio-ffmpeg](https://github.com/imageio/imageio-ffmpeg) mənbələri və SHA-256 identifikatorları paketdə `runtime/sources.json`, onların lisenziyaları isə müvafiq runtime qovluqlarındadır.

Quraşdırma və CD/DVD yeniləmə üçün [çap edilə bilən addım-addım təlimat](public/RADAZ-Qurasdirma.html).

## Viewer və 3D (0.2.12)

Arxiv/PACS-də checkbox-la seçilmiş müayinələr bir Viewer-də açılır. CD/DVD izləməsi yalnız həmin Viewer-də düymə ilə başladılır. MPR və 3D ayrıca vərəqələrdə açılır; 2D Viewer yerində qalır. Təkrar klik mövcud vərəqəni önə gətirir. Vərəqələr eyni decode edilmiş piksel buferlərini kopyalamadan istifadə edir. Hər səhifənin öz Cornerstone volume obyekti var; tam 3D texture yalnız 3D səhifəsində GPU-ya ötürülür. Mənbə seriyanın dəyişməsi və CD çıxarılması açıq vərəqələrə ötürülür. Böyük həcm GPU limitini aşanda yalnız 3D üçün azaldılmış həcm hazırlanır; MPR orijinal kəsitləri saxlayır.

CT Bone rejimi dolğun fil sümüyü rəngi, üç işıq mənbəyi və xətti interpolasiya istifadə edir. High/Ultra rejimlərində səth kölgələri aktivdir; Balanced təmiz və daha sürətli səth göstərir. MRT üçün ayrıca siqnal intensivliyi rejimi var, CT presetləri və HU yazısı göstərilmir. Qalın kəsitlərdən yaranan səth pillələnməsini rəngləmə aradan qaldırmır.

Balanced standart keyfiyyətdir; Performance, High, Ultra və Auto ayrıca seçilir. Fırlatma/zoom zamanı nümunələmə azaldılır, mouse buraxıldıqda son keyfiyyət qaytarılır. Presetlər `lib/volume-presets.ts` daxilindədir. CT intensiteti `pixel × RescaleSlope + RescaleIntercept` ilə saxlanır. Physical slice mövqeləri və istiqamətləri sıralamanı müəyyən edir; uyğunsuz frame, təkrarlanan/natamam aralıqlar və shear təhlükəsiz xəta ilə bildirilir.

3D-də **Performans** decode, volume qurulması, ilk görüntü, GPU upload, fırlatma FPS və yaddaş göstəricilərini açır. WebGL tam GPU yaddaşını vermir: göstərilən MB yalnız scalar texture üçün təxmindir, framebuffer/driver xərclərini əhatə etmir. GPU timer və JS heap brauzer dəstəyi olduqda ölçülür. Sintetik benchmark üçün `python tests/volume-fixture.py --output outputs/volume-fixture`, sonra işləyən test serverinə qarşı `RADAZ_TEST_URL`, `PLAYWRIGHT_MODULE` ilə `node tests/volume-benchmark.mjs` işlədin. Nəticələr `outputs/performance` daxilindədir; bu sınaqlar klinik preset validasiyası deyil.

**Yardım → Yeniləmələri yoxla → Yenilə** quraşdırılmış updater-i dərhal oyadır. Progress yüklənən baytları və açılan faylları göstərir; tamamlananda növbəti açılış üçün təsdiq çıxır. Hər versiyanın ayrıca Setup ilə quraşdırılması tələb olunmur.

Yeni versiya hazırlanarkən bildiriş görünür; **Yenilənməyə bax** eyni prosesin gedişini açır. Hazır olduqda ayrıca təsdiq göstərilir.

2D/MPR-də ilkin sol düymə WW/WL, orta düyməni basıb sürükləmək move, sağ düyməni basıb sürükləmək zoom edir. Qısa sağ klik ölçmə menyusunu açır: xətt üzərində **Sil**, ox üçün **Şərhi dəyiş**, həmçinin **Cari kəsitdə hamısını sil**. **Ctrl+D** yalnız aktiv kəsitdəki ölçüləri və çəkilmiş xətləri silir. Brauzerin standart sağ klik menyusu söndürülüb. 3D-də sol düymə fırlatma, orta düymə move, sağ düymə zoom üçündür.

Ölçü və çəkilmiş xətlər incəldilib, məlumat yazıları böyüdülüb; xəttə yaxınlaşanda əl kursoru görünür. Ox çəkiləndə şərh əlavə etmək olur; sonradan iki kliklə və ya sağ klik menyusundan dəyişilir. Deviasiya iki nöqtə ilə ölçülür: bucaq görüntünün üfüqi oxuna görə, **H** isə kalibrə edilmiş şaquli məsafədir. Ayaq tağında hündürlük **H**, bucaq **°** ilə göstərilir.
