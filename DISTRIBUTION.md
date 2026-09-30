# RADAZ buraxılışı və lisenziya idarəsi

Bu buraxılış 0.2.0 ilkin sınaq paketidir. Hazırkı işləyən layihə hazırlama rejimindədir (`public/product.json`: `licenseRequired=false`). Buraxılış ZIP-i hazırlananda aktivləşdirmə məcburi edilir. Onlayn ödəniş/avtomatik abunə yenilənməsi qoşulmayıb.

## Paketlər və əlaqə

`public/product.json` daxilində aylıq ödəniş üçün `monthly`, `currency`, `salesUrl`, e-poçt və Telegram dəyişdirilir. `null` qiymət “Qiymət üçün əlaqə” göstərir. Bir kompüter bir RADAZ server quraşdırmasıdır; həmin serverə qoşulan telefon/planşet ayrıca yer sayılmır.

GitHub: https://github.com/drnaghiyev/RADAZ-D-COM. Sabit buraxılışı `v0.2.0` kimi tag ilə GitHub Releases-də dərc edin. İstifadəçilər üçün yalnız yoxlanmış ZIP-i release asset kimi yerləşdirin. Versiyanı artırın və növbəti buraxılışı dərc edin; tətbiq açıldıqdan sonra yoxlama aparır və yeni versiyada yükləmə linki göstərir. Yeniləmə əl ilə quraşdırılır, özünü səssizcə dəyişmir. 404 cavabı repo/relizə giriş olmadığını göstərir, “aktualdır” sayılmır.

Hazırda bu repozitoriya private-dır. Qaralama və pre-release paketləri avtomatik sabit versiya yoxlamasına daxil edilmir. Müştərilər üçün token tələb etməyən açıq Releases repozitoriyası və ya ayrıca yayım xidməti lazımdır; şəxsi GitHub tokenini tətbiqə yerləşdirməyin. Private mənbə kodunu qorumaq üçün yalnız yığılmış ZIP-lərin olduğu ayrıca açıq yayım repozitoriyası istifadə oluna bilər. Belə repo seçildikdə `public/product.json` daxilində `repository` sahəsini dəyişib yenidən build/paket hazırlayın.

## Satıcı üçün imzalı açarlar

İmza cütü yaradılıb. Gizli açar `Documents\RADAZ-License-Admin\issuer-private.pem` daxilindədir, repoya və müştəri ZIP-inə daxil edilmir. Bu qovluğu ayrıca təhlükəsiz ehtiyat nüsxələyin. `public/license-public.json` yalnız açıq yoxlama açarıdır. Hər yeni buraxılışda eyni imza açarını saxlayın.

```powershell
# Yeni abunə; çap olunan ID-ni aşağıdakı LICENSE_ID yerinə yazın.
node scripts/license-admin.mjs create --customer "Klinika adı" --seats 3 --period monthly
node scripts/license-admin.mjs list
# Müştəri Yardım → Lisenziya bölməsindəki kompüter kodunu göndərir.
node scripts/license-admin.mjs activate --license LICENSE_ID --device DEVICE_CODE --out C:\Keys\activation.txt
# Növbəti müddət üçün yenilə və hər kompüterə açarı yenidən ver.
node scripts/license-admin.mjs renew --license LICENSE_ID
```

`--out` qovluğu əvvəlcədən mövcud olmalıdır. Açardakı müddət, məhsul, kompüter və imza serverdə yoxlanır. Yer limiti satıcının abunə reyestrində tətbiq edilir. Offline açarı uzaqdan dərhal ləğv etmək mümkün deyil; açar bitmə tarixinədək etibarlıdır. Köhnə aktivləşdirməni silib yeni kompüterə vermək yer limitini aşdıra bildiyi üçün avtomatik seat release yoxdur. Köçürmə/real vaxt ləğvi üçün gələcəkdə onlayn aktivləşdirmə xidməti lazımdır.

Bu, offline aktivləşdirmə mexanizmidir; müştərinin tam idarə etdiyi mənbə kodunu dəyişməsinə qarşı tam DRM deyil. İmzalı installer, ödəniş provayderi, onlayn aktivləşdirmə və hüquqi satış şərtləri ayrıca buraxılış işləridir.

## Buraxılış ZIP-i

```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false
python tests/license_test.py
node scripts/run-framework.mjs build
python scripts/package-release.py
```

ZIP `outputs/releases` qovluğuna yazılır. Skript yalnız ağ siyahıdakı qurulmuş tətbiqi, asılılıq manifestini, receiver və launcher-i götürür; real arxiv, `.env`, imza açarı, test çıxışları və inkişaf tarixçəsini daxil etmir. ZIP-də SHA-256 manifesti var. GitHub-a buraxılış qovluğunu və ya bütün Documents qovluğunu kor-koranə yükləməyin.

Müştəri: Windows-da Node.js 22.13+ və Python 3.10+ quraşdırın, ZIP-i çıxarın, ilk dəfə `SETUP-RADAZ.cmd`, sonra `START-RADAZ.cmd` başladın. İlk setup npm/PyPI-dan asılılıq yükləyir. FFmpeg video ixrac üçün ayrıca tələb olunur. Brauzerdə lisenziya aktivləşdirmə pəncərəsi açılır. Bu ZIP müstəqil EXE installer deyil.

Yeniləmədən əvvəl çalışan RADAZ launcher-i bağlayın, arxivin ehtiyat nüsxəsini alın, yeni ZIP-i yeni proqram qovluğuna çıxarın və setup/start edin. `Documents\RADAZ-Archive` silinmir; SQLite, DICOM faylları və aktivləşdirmə orada qalır. Eyni kompüterdə paralel köhnə/yeni receiver işlətməyin.

## ChatGPT

`public/radaz-chatgpt-extension.zip` Chrome/Edge əlavəsidir. `/chatgpt-help` quraşdırma təlimatıdır. Əlavə yalnız istifadəçinin qeyd etdiyi RADAZ origin-dən paket qəbul edir, hədəf ChatGPT tabına bağlayır, yaddaşdakı paketi iki dəqiqədən sonra silir və Send düyməsini basmır. Bir paket ən çox 10 JPEG/8 MiB-dir. ChatGPT DOM-u dəyişərsə aydın xəta və ZIP/mətn fallback-i var. Live ChatGPT hesabında əlavənin quraşdırılması və real kompozerdə yoxlama ayrıca lazımdır; avtomatik diaqnostik dəqiqlik zəmanəti verilmir.

Real pasiyent məlumatlarını sınaq, GitHub və ya release paketinə daxil etməyin.
