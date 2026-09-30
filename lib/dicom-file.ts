import dicomParser from 'dicom-parser';

export type DicomDataSet = ReturnType<typeof dicomParser.parseDicom>;

const rawSyntaxes = ['1.2.840.10008.1.2', '1.2.840.10008.1.2.1', '1.2.840.10008.1.2.2'];
const uidPattern = /^\d+(?:\.\d+)+$/;

/** Read Part 10 files and bare DICOM datasets exported by older CR/DX devices. */
export function parseDicomFile(bytes: Uint8Array): DicomDataSet {
  const hasPreamble = bytes.length >= 132 && bytes[128] === 0x44 && bytes[129] === 0x49 &&
    bytes[130] === 0x43 && bytes[131] === 0x4d;
  // A declared transfer syntax is authoritative. Never reinterpret a broken
  // Part 10 file (including compressed images) as an implicit-VR dataset.
  if (hasPreamble) return dicomParser.parseDicom(bytes);

  for (const TransferSyntaxUID of rawSyntaxes) {
    try {
      const ds = dicomParser.parseDicom(bytes, { TransferSyntaxUID });
      // Without a file signature, require a coherent image dataset before
      // accepting an inferred encoding. This excludes text, ZIPs and junk.
      const uids = ['x00080016', 'x00080018', 'x0020000d', 'x0020000e'].map(tag => ds.string(tag));
      const pixel = ds.elements.x7fe00010;
      const rows = ds.uint16('x00280010') || 0, columns = ds.uint16('x00280011') || 0;
      const bits = ds.uint16('x00280100') || 0, samples = ds.uint16('x00280002') || 0;
      if (uids.some(uid => !uid || uid.length > 64 || !uidPattern.test(uid)) ||
          !rows || !columns || !samples || ![1, 8, 16, 32, 64].includes(bits) || !pixel) continue;
      // Encapsulated pixels need their actual compression UID; do not guess
      // a codec from a missing file header or reinterpret fragments as pixels.
      if (pixel.encapsulatedPixelData) continue;
      const frames = Number(ds.string('x00280008') || 1);
      const required = Math.ceil(rows * columns * samples * bits * frames / 8);
      if (!Number.isSafeInteger(frames) || frames < 1 || !Number.isSafeInteger(required) ||
          pixel.length < required || pixel.dataOffset + pixel.length > bytes.length) continue;
      return ds;
    } catch { /* Try the next native encoding, never a partially parsed dataset. */ }
  }
  throw new Error('Fayl DICOM görüntüsü kimi oxunmadı: başlıq yoxdur və ya görüntü məlumatları natamamdır');
}
