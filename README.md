# RADAZ DICOM

Azərbaycan dilində radiologiya iş sahəsi: DICOM viewer, lokal arxiv, PACS, MPR/3D, hesabat, çap və CD/DVD çıxışı.

## Windows-da başlatma

Node.js 22.13+ və Python 3.10+ tələb olunur. İlk dəfə `SETUP-RADAZ.cmd`, sonra yalnız **`START-RADAZ.cmd`** başladın. Brauzer ünvanı: `http://localhost:5173`.

Mənbə qovluğunda launcher ən son mənbəni işlədir. Yalnız yığılmış faylları olan paylama paketində release serveri başladır. Lokal DICOM arxivi proqram qovluğundan ayrıca saxlanılır.

## Viewer və hesabat

- Arxiv/PACS-dan Aç düyməsi mövcud viewer-ə müayinəni ötürür və həmin tabı önə gətirir.
- Görüntünün solundakı kiçik checkbox cari görünüşü çap siyahısına əlavə edir.
- CD/DVD yalnız lokal arxiv və PACS-dan açılır.
- Hesabat viewer-də uğurla açılmış DICOM dəstini qəbul edir; digər arxiv müayinələri avtomatik daxil edilmir.
- Hesabatdakı seçilmiş seriyaların bütün görüntüləri bir ZIP-ə yığılır. 10 görüntü məhdudiyyəti yoxdur; yerli ZIP həddi 480 MB-dır.
- `public/radaz-chatgpt-extension.zip` əlavəsinin 0.3.2 versiyasını quraşdırın/yeniləyin. ZIP ChatGPT mesaj sahəsinə əlavə edilir; mesajı istifadəçi göndərir. Cavab hazır olduqda **RADAZ-a qaytar** analizi hesabat səhifəsində göstərir. Yoxlanmış mətn ayrıca hesabata əlavə olunur.
- ChatGPT hesabının yükləmə limitləri ayrıca tətbiq olunur. Əlavə işləmədikdə ZIP-i və tapşırığı əl ilə əlavə etmək mümkündür.

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
