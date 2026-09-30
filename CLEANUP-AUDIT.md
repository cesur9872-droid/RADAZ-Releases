# RADAZ 0.2.2 — fayl və davranış yoxlaması

2026-10-01 tarixində proqramın 226 mənbə və paylama faylı SHA-256 ilə müqayisə edildi. Eyni məzmunlu fayl qrupu tapılmadı. `node_modules`, yığılmış `dist`, keşlər, yerli çıxışlar və pasiyent arxivləri mənbə yoxlamasına daxil edilmədi.

## Təmizlənənlər

- Başlatma üçün yalnız `START-RADAZ.cmd` saxlanılır. Mənbə qovluğunda dev serveri, yalnız yığılmış tətbiq olan buraxılışda release serveri başladır. Köhnə `START-RADAZ-RELEASE.cmd` çıxarıldı və sənədlər yeniləndi.
- Köhnə `radaz-pacs-bridge-v3.zip` çıxarıldı; yükləmə keçidləri v4 paketinə yönəldildi.
- Lokal arxivdə təkrarlanan CD düyməsi və istifadə edilməyən alternativ CD paketləmə handler-i çıxarıldı. CD/DVD girişləri yalnız arxiv və PACS iş axınlarında saxlanıldı.
- İstifadə edilməyən API açarı saxlama modulu çıxarıldı. Hesabat mövcud ChatGPT brauzer əlavəsi vasitəsilə işləyir; `/api/report-ai` əvvəlki müştərilər üçün aydın 410 cavabını saxlayır.
- Python/TypeScript keşləri, təftiş qovluğu və yerli SQLite faylları Git-dən kənarda saxlanılır.
- UI-də illik və çoxpilləli paketlər çıxarıldı, yalnız aylıq ödəniş qaldı. Əvvəldən verilmiş lisenziyaların yoxlanması qorundu; yeni açarlar aylıq yaradılır.

## Qəsdən saxlanılanlar

- `extensions/chatgpt` redaktə edilən mənbədir, `public/radaz-chatgpt-extension.zip` isə istifadəçinin yüklədiyi 0.3.3 paketidir. JSZip əlavədə lokal saxlanılır; kənar CDN kodu işləmir.
- `bridge` yerli xidmətin mənbəyidir; v4 ZIP və wheels oflayn PACS quraşdırması üçün lazımdır.
- `favicon.svg` brauzer nişanıdır, `radaz-logo.svg` tətbiq loqosudur; fərqli istifadə yerləri var.
- Demo DICOM faylları `scripts/generate-demo.py` ilə yaradılmış sintetik nümunələrdir. Pasiyent arxivi GitHub-a daxil edilmir.

## Yoxlama

- TypeScript və production build keçdi.
- Node: 43 test; Python: 30 test keçdi.
- Brauzerdə kompakt seçim qutusu görüntünü çap siyahısına əlavə etdi.
- Viewer-dən hesabatda yalnız ötürülmüş müayinə açıldı; 10 demo görüntünün hamısı bir ZIP paketinə hazırlandı.
- Arxivdən müayinə mövcud viewer tabına ötürüldü. PACS-in Viewer düyməsi əlavə viewer tabı yaratmadı.
- ZIP testləri 25 görüntünü və bir neçə hissəyə bölünmüş böyük ötürməni yoxlayır; yanlış mənbə, natamam paket, vaxtı bitmiş sessiya və başqa ChatGPT tabından cavab rədd olunur.

Canlı PACS serverinə endirmə və ChatGPT hesabında ZIP təhlili bu yoxlamanın tərkibində təsdiqlənməyib. ChatGPT əlavəsi 0.3.3-ə yenilənməlidir; onun DOM adapteri ChatGPT interfeysi və hesabın fayl limitlərindən asılıdır. ZIP hazırlanması yararsız kəsiti səssizcə buraxmır: xəta göstərilir və tam paket göndərilmir.

## 0.2.2: hazırkı davranış

- Hesabatdan yalnız `RADAZ-ChatGPT.zip` ötürülür. Ayrı JPEG göndərmə/yükləmə seçimləri çıxarıldı. Yeni tapşırıq: “Dərindən, tək-tək analiz et və rapor yaz”; ZIP-dəki bütün görüntüləri manifest sırası ilə qiymətləndirməyi tələb edir. Faktiki görüntülər açılmadıqda nəticə uydurulmur. Köhnə açıq səhifələr üçün əlavədə əvvəlki protokolun oxunması saxlanılıb.
- Sintetik brauzer sınağında Viewer-dən gələn 10 görüntü və 2 seriya bir ZIP-də hazırlandı. Kod testi 25 görüntülü ZIP-in dəyişmədən tək əlavə kimi ötürülməsini yoxlayır. Canlı ChatGPT yükləməsi bu sınağa daxil deyil.
- Arxiv və PACS müayinə/seriya başlıqları artan və azalan sıralama verir; rəqəmli 2/10 dəyərləri brauzerdə yoxlanıldı. Saylar status sətrinə keçirildi. Qəbul ayarları yuxarı düymədən modal pəncərə kimi açılır.
- Hazırlama rejimi mətni çıxarıldı, məhsulda lisenziya tələbi aktivdir. Müddəti bitən lisenziyada əvvəlki PACS/arxiv və Viewer listələmə qaydası saxlanılır.
- Satıcı üçün ayrıca loopback paneli yaradıldı: bank rekvizitləri, Epoint açarları, endpoint və lisenziya domeni. Gizli açar brauzerə geri qaytarılmır; ayarlar Git və alıcı paketindən kənardadır. Sintetik paneldə saxlama, API-də token/origin yoxlaması test edildi.
- Epoint adapteri imzalı checkout və callback yoxlamasını həyata keçirir. Ödəniş məbləği, valyuta, əməliyyat və sifariş uyğunluğu testlərlə yoxlanıldı. Alıcı açarı kopyalaya və TXT kimi saxlaya bilər. Satıcı hesabı, açarlar və HTTPS server hələ qoşulmadığından real ödəniş işləmir.
- README alıcı quraşdırmasını, DISTRIBUTION satıcı konfiqurasiyasını və GitHub Release paylaşımını izah edir. 0.2.2 Windows preview ZIP-i yaradıldı; məxfi ayarlar və lisenziya imza açarı paketə daxil deyil.
- GitHub nüsxəsi `Documents/GitHub/mt5trader/RADAZ-D-COM` yolundan `Documents/GitHub/RADAZ-D-COM` yoluna köçürüldü və GitHub Desktop-da yenidən göstərildi.

## Əvvəlki 0.3.2 düzəlişi (tarixi qeyd)

- 0.3.0-da faylın adını bütün səhifə mətnində axtarmaq yanlış uğur verə bilirdi: tapşırıq özü ZIP adını daşıyırdı. İndi yalnız cari mesaj sahəsinin kənarındakı silinə bilən əlavə kartları yoxlanır; tapşırıq, əvvəlki söhbət və input.files yükləmə sübutu sayılmır.
- Tapşırıq bütün gözlənilən əlavələr görünəndən və yükləmə göstəricisi bitəndən sonra yazılır. Göndərmə düyməsi hazır olmayanda uğur bildirilmir. Mesaj avtomatik göndərilmir.
- Tək CR üçün faktiki JPEG və tam ZIP birlikdə əlavə olunur. Çox görüntüdə birbaşa JPEG-lər açıq göstərilən 8-lik qruplarla ötürülür; ZIP yenə bütün görüntüləri saxlayır. ZIP qəbul edilməsə yalnız JPEG seçimi var.
- Köhnə əlavəni protokol yoxlaması aşkar edir. Yeni tapşırıq baxılan faylların adını/sayını istəyir və görüntüsüz hesabat yaratmaq əvəzinə texniki xəta bildirməyi tələb edir.

## Əvvəlki 0.2.1 yeniləməsi (tarixi qeyd)

- Seriya siyahısını gizlət düyməsi başlıq səviyyəsinə keçirildi. PACS və arxivdən yuxarı Viewer/PACS/yardım naviqasiyası çıxarıldı.
- PACS sətrində birinci klik seriya sorğusu başladarkən ikinci klikin itməsi düzəldildi. Sintetik DICOMweb serverində iki klik bir görüntünü mövcud Viewer-ə yüklədi; arxivdə də mövcud Viewer yenidən istifadə edildi. Codex daxili brauzerində proqramın `window.focus()` çağırışı seçilmiş vərəqəni dəyişmədi; Edge-də önə keçid ayrıca təsdiqlənməyib.
- Əlavə 0.3.2 bağlantını əvvəlcədən yoxlayır. Əlavə olmadıqda avtomatik ötürmə bağlıdır, JPEG yükləmə və görüntünü kopyalama var. Sintetik görüntünün kopyalanması brauzerdə uğurlu status verdi. Həqiqi ChatGPT hesabına yeni ötürmə edilməyib.
- Ödəniş xidməti 10 AZN × seçilən ay sayı hesablayır. Təsdiqlənmiş ödəniş açar yaradır; müddət ilk aktivləşdirmədən başlayır. Təkrar aktivləşdirmə müddəti uzatmır. Satıcı hesabı/provayder adapteri olmadığı üçün canlı ödəniş aktiv deyil.
- Müddəti bitmiş lisenziyada PACS/arxiv və CD/DVD saxlanılır. Viewer yalnız seriya seçimi və görüntü listələmə verir; ölçmə, window, ixrac, çap, MPR/3D və hesabat bağlıdır. Brauzer sınağı və Python API testləri bunu yoxladı.
- Desktop-dakı dörd köhnə əlavə qovluğu ehtiyat nüsxədən sonra 0.3.2 mənbəyi ilə yeniləndi. Edge-də əlavənin Reload əməliyyatı hələ lazımdır.
- Əsas işləyən veb və arxiv xidmətlərinin dayandırılıb yenidən başladılması avtomatik təhlükəsizlik yoxlaması tərəfindən bloklandı; yeni mənbənin işləyən proseslərdə tətbiqi təsdiqlənməyib.
