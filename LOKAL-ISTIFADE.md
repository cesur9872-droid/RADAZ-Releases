# RADAZ — lokal istifadə

Proqramın tam mənbə kodu və işləməsi üçün lazım olan paketlər bu qovluqdadır.

## Başlatmaq

1. `START-RADAZ.cmd` faylına iki dəfə klikləyin.
2. Bir neçə saniyədən sonra proqram brauzerdə `http://localhost:5173` ünvanında açılacaq.
3. Server işlədiyi müddətdə açılan qara pəncərəni bağlamayın. Proqramı dayandırmaq üçün həmin pəncərədə `Ctrl+C` basın.

Node.js tapılmasa, əvvəlcə Node.js 22.13 və ya daha yeni versiyanı quraşdırın.

## AI hesabatı

AI analizi üçün **Hesabat → Ayarlar** bölməsində şəxsi OpenAI API açarınızı bir dəfə daxil edin. Açar yalnız istifadə etdiyiniz brauzerin yerli yaddaşında saxlanılır.

## Məlumatların saxlanması

Daimi DICOM arxivi `Documents\RADAZ-Archive` qovluğundadır: `archive.sqlite3` indeks bazası, `instances` orijinal DICOM faylları, `config.json` isə qəbul ayarlarıdır. Bu qovluğu birlikdə ehtiyat nüsxələyin. Brauzer məlumatlarını təmizləmək disk arxivini silmir.

Köhnə brauzer arxivi saxlanılır və siyahıda “Brauzer” kimi göstərilir. Onu daimi arxivə köçürmək üçün müayinəni seçib **Diskə saxla** basın. Yeni idxallar arxiv xidməti işləyirsə həm brauzerə, həm diskə yazılır. Xidmət işləmirsə brauzer arxivi qalır. Hesabat qaralamaları, klinika ayarları və açarlar hələ də həmin brauzerin yerli yaddaşındadır.

## Cihazdan görüntü göndərmək

`START-RADAZ.cmd` və ya `corepack pnpm dev` Windows-da daimi qəbuledicini avtomatik başladır. Python 3.10+ lazımdır; DICOM kitabxanaları layihədə mövcuddur, internetdən paket yüklənmir. Brauzeri bağlamaq qəbuledicini dayandırmır. Kompüter yenidən açıldıqdan sonra RADAZ-ı başladın.

**Local arxiv → Qəbul ayarları** bölməsində cari IP, AE Title, port və faktiki baza yolu görünür. İlkin ayarlar:

- AE Title: `RADAZ_ARCHIVE`
- DICOM TCP port: `11113` (müvəqqəti PACS körpüsünün 11112 portundan ayrıdır)
- Dəstəklənən qəbul: C-ECHO və C-STORE. C-FIND/C-MOVE serveri deyil.

Rentgen/KT/PACS cihazında yeni DICOM destination yaradın, AE/IP/portu daxil edin və C-ECHO edin. Göndərilən görüntülər 5 saniyə ərzində arxiv siyahısında görünür. Eyni SOP Instance UID təkrar göndəriləndə eyni məlumat ikinci dəfə əlavə edilmir; fərqli məlumat orijinalı əvəz etmir. Uğurlu C-STORE cavabı yalnız disk və baza yazıldıqdan sonra verilir.

Qəbul ayarlarından AE və portu dəyişə, qəbulu dayandıra və başlada bilərsiniz. SQLite saxlanan müayinələrin brauzer düyməsi ilə təsadüfən silinməsi bağlıdır.

## Telefon və planşet

Eyni etibarlı lokal şəbəkədə brauzerdə `http://KOMPUTERIN-IP-UNVANI:5173/` açın. Hazırkı ünvan arxiv ayarlarında göstərilir. Windows Firewall həmin şəbəkədə Node.js viewer portuna (5173) və Python DICOM portuna (ilkin 11113) icazə verməlidir. HTTP idarəetmə xidməti 8766-da yalnız bu kompüterin loopback ünvanını dinləyir; viewer onu eyni origin daxilində proxy edir. LAN viewer yalnız etibarlı şəbəkə üçündür; internetə yönləndirməyin.

- **Listələ (↕)**: barmağı yuxarı/aşağı sürüşdürün. Aşağıdakı görüntü zolağı çıxarılıb; mouse çarxı da işləyir. Son görüntüdən sonra ilk görüntüyə qayıdır.
- **Yazılar (göz)**: pasiyent və texniki yazıları, ölçmə etiketlərini gizlədir. DICOM pikselinə əvvəlcədən yazılmış mətn dəyişmir.
- **İxrac**: cari görüntü, cari seriya və ya bütün açıq seriyaları seçin. JPEG, PNG, BMP və orijinal DICOM var; lokal FFmpeg olduqda MP4/WMV də açılır. Əlavə seçimlərdə fayl adı, ölçü, JPEG keyfiyyəti, hər N-ci görüntü və video FPS seçilir. Bir neçə şəkil seriya qovluqları ilə ZIP-də saxlanır. Tam görüntü ixracında yazı/ölçmə yoxdur; cari ekran ixracında görünən yazı və ölçmələr seçilə bilər. DICOM ixracı orijinal məlumatı dəyişmir.
- **Ölçmə → Ox / Qələm**: sürükləyib işarələyin. İşarələr həmin kəsitə bağlıdır, pozan və “Cari kəsitdə hamısını sil” ilə silinir.
- **Ölçmə → 3D kursor**: məkan koordinatlı CT/MR/MPR görüntüsündə nöqtə seçin. Uyğun koordinat sistemli açıq panellər ən yaxın kəsitə keçir, LPS millimetr koordinatı göstərilir. Məkan koordinatı olmayan rentgen görüntüsündə bu funksiya mövqe uydurmur.

## Yoxlamalar

`python tests\archive_receiver_test.py` real lokal DIMSE/HTTP sınaqlarını müvəqqəti bazada icra edir. `node --experimental-strip-types --test tests\dicom-file.test.mjs` DICOM oxuyucusunu yoxlayır. Canlı cihazın IP/AE qeydiyyatı və fiziki telefonun toxunma davranışı ayrıca həmin cihazda yoxlanmalıdır.

## Texniki komandalar

PowerShell-də bu qovluğu açaraq:

```powershell
corepack pnpm dev
corepack pnpm run build
```

İlk komanda proqramı işə salır, ikinci komanda isə layihənin tam yığıldığını yoxlayır.

## Fırlatma, pozitiv / neqativ

Fırlat menyusu: 90° sola/sağa, 180°, üfüqi/şaquli çevir və sıfırla. Qısayollar: Ctrl+[ / Ctrl+], Ctrl+Shift+[ / Ctrl+Shift+], Ctrl+Shift+\. Neqativ / pozitiv F11 ilə dəyişir. Window menyusunda DICOM standartı, tam dinamik diapazon, WL/WW cütləri və xüsusi pəncərə (Ctrl+F11) var. Əməliyyatlar aktiv panelə tətbiq edilir. Məkan koordinatı varsa sağ/sol istiqamət yazıları çevirməyə uyğun yenilənir.

## Viewer-dən seçilmiş görüntülərin çapı

1. İstədiyiniz görüntünü açın, kontrastı və çevirməni qurun, **Çapa seç** işarəsinə basın. İkinci basış həmin görüntünü siyahıdan çıxarır.
2. Digər görüntüləri də əlavə edin; printer işarəsində seçilmiş say görünür.
3. **Çap → Seçilmiş görüntülər → Çap önbaxışı** açın. Viewer vərəqəsi saxlanılır.
4. Bölgü, istiqamət və bütün/cari plyonka seçin. Adi printer / PDF brauzerin çap dialoqunu açır. DICOM çap ayrıca lokal Print Management xidməti ilə gedir.

**Çap → Printer ayarları** ayrıca səhifədir: `/printer-settings`. Printer IP/port/AE Title, RADAZ AE Title, media, nüsxə, plyonka ölçüsü və bölgü burada saxlanır. Ayarlar `Documents\RADAZ-Archive\printers.json` faylında bütün LAN istifadəçiləri üçün ortaqdır. Adi printer cihazın öz çap dialoqundan seçilir. DICOM bağlantı testi printer statusunu oxuyur, çap etmir. Fiziki printer üçün onun real şəbəkə məlumatlarını daxil edin.

Çap görüntüləri seçildiyi andakı ekran görünüşünü saxlayır; sonra edilən dəyişiklikləri daxil etmək üçün görüntünü seçimdən çıxarıb yenidən seçin. Ön baxışda əlavə parlaqlıq/kontrast həm adi, həm DICOM çapa tətbiq olunur. DICOM cavabı itərsə təkrar göndərmədən əvvəl printer növbəsini yoxlayın.

## CD / DVD

Viewer-də **Çap → Cari seriyanı CD/DVD-yə yaz**, arxivdə isə **CD / Lite viewer** açın. DICOMDIR, DICOM faylları və offline START.html hazırlanır. **ISO yarat** və **ZIP paketi hazırla** yazıcı olmadan da işləyir. Mənbədə Study ID boşdursa yalnız DICOMDIR-də texniki kataloq ID-si yaranır, görüntünün özündəki ID və piksellər dəyişmir. Paketlər `Documents\RADAZ-Archive\MediaJobs` daxilində saxlanır.

Birbaşa yazma Windows IMAPI2 ilə yalnız yazma qabiliyyətli qurğu və uyğun boş disk olduqda açılır. Mövcud disk silinmir, yazılmış disk bağlanır. Hazırkı TEAC DV-28S-W yalnız oxuyur; birbaşa yazmaq üçün CD/DVD writer qoşulmalıdır.

`python tests\output_service_test.py` sınaq printeri ilə real N-GET/N-CREATE/N-SET/N-ACTION, DICOMDIR, ISO, MP4/WMV və disk qoruma yoxlamalarını icra edir. Bu test fiziki printer çapını və fiziki diskin yazılmasını əvəz etmir.
