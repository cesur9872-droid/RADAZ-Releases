import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import dicomParser from 'dicom-parser';
import { parseDicomFile } from '../lib/dicom-file.ts';

const implicit = '1.2.840.10008.1.2';
const explicit = `${implicit}.1`;
const bigEndian = `${implicit}.2`;
const samplePixels = [0, 1, 2047, 2048, 4094, 4095];

function element(group, tag, vr, value, syntax) {
  const le = syntax !== bigEndian;
  const write16 = (buffer, number, offset) => le ? buffer.writeUInt16LE(number, offset) : buffer.writeUInt16BE(number, offset);
  const write32 = (buffer, number, offset) => le ? buffer.writeUInt32LE(number, offset) : buffer.writeUInt32BE(number, offset);
  let data;
  if (Array.isArray(value)) {
    data = Buffer.alloc(value.length * 2);
    value.forEach((number, index) => write16(data, number, index * 2));
  } else {
    data = Buffer.from(value, 'ascii');
    if (data.length % 2) data = Buffer.concat([data, Buffer.from([vr === 'UI' ? 0 : 32])]);
  }
  const longVR = ['OB', 'OW', 'SQ', 'UN', 'UT'].includes(vr);
  const header = Buffer.alloc(syntax === implicit || !longVR ? 8 : 12);
  write16(header, group, 0); write16(header, tag, 2);
  if (syntax === implicit) write32(header, data.length, 4);
  else {
    header.write(vr, 4, 'ascii');
    if (longVR) write32(header, data.length, 8);
    else write16(header, data.length, 6);
  }
  return Buffer.concat([header, data]);
}

function dataset(syntax) {
  return Buffer.concat([
    [0x0008, 0x0005, 'CS', 'ISO_IR 100'],
    [0x0008, 0x0016, 'UI', '1.2.840.10008.5.1.4.1.1.1'],
    [0x0008, 0x0018, 'UI', '2.25.101'],
    [0x0008, 0x0060, 'CS', 'CR'],
    [0x0020, 0x000d, 'UI', '2.25.102'],
    [0x0020, 0x000e, 'UI', '2.25.103'],
    [0x0028, 0x0002, 'US', [1]],
    [0x0028, 0x0004, 'CS', 'MONOCHROME1'],
    [0x0028, 0x0010, 'US', [2]],
    [0x0028, 0x0011, 'US', [3]],
    [0x0028, 0x0030, 'DS', '0.200\\0.200'],
    [0x0028, 0x0100, 'US', [16]],
    [0x0028, 0x0101, 'US', [12]],
    [0x0028, 0x0102, 'US', [11]],
    [0x0028, 0x0103, 'US', [0]],
    [0x0028, 0x1050, 'DS', '2048'],
    [0x0028, 0x1051, 'DS', '4095'],
    [0x7fe0, 0x0010, 'OW', samplePixels],
  ].map(args => element(...args, syntax)));
}

function part10(syntax) {
  return Buffer.concat([Buffer.alloc(128), Buffer.from('DICM'),
    element(0x0002, 0x0010, 'UI', syntax, explicit), dataset(syntax)]);
}

function assertImage(bytes, syntax) {
  const ds = parseDicomFile(bytes);
  assert.equal(ds.string('x00020010'), syntax);
  assert.equal(ds.uint16('x00280010'), 2);
  assert.equal(ds.uint16('x00280011'), 3);
  assert.equal(ds.uint16('x00280101'), 12);
  assert.equal(ds.string('x00280004'), 'MONOCHROME1');
  assert.equal(ds.string('x00280030'), '0.200\\0.200');
  assert.equal(ds.string('x00281050'), '2048');
  assert.equal(ds.string('x00281051'), '4095');
  const offset = ds.elements.x7fe00010.dataOffset;
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 12);
  assert.deepEqual(samplePixels.map((_, i) => view.getUint16(i * 2, syntax !== bigEndian)), samplePixels);
}

for (const syntax of [implicit, explicit, bigEndian]) {
  test(`bare dataset preserves pixels and display metadata: ${syntax}`, () => assertImage(dataset(syntax), syntax));
  test(`Part 10 retains its declared encoding: ${syntax}`, () => assertImage(part10(syntax), syntax));
}

test('original parser rejects a headerless CR dataset; shared reader accepts it', () => {
  const bytes = dataset(implicit);
  assert.throws(() => dicomParser.parseDicom(bytes));
  assertImage(bytes, implicit);
});

test('non-DICOM inputs and truncated pixel data are rejected', () => {
  for (const bytes of [Buffer.alloc(0), Buffer.alloc(400), Buffer.from('<html>not DICOM</html>'), dataset(implicit).subarray(0, -2)]) {
    assert.throws(() => parseDicomFile(bytes), /DICOM/);
  }
});

test('a broken Part 10 header is never reinterpreted as raw data', () => {
  const bytes = Buffer.concat([Buffer.alloc(128), Buffer.from('DICM'), dataset(implicit)]);
  assert.throws(() => parseDicomFile(bytes));
});

test('existing CT demo stays readable', () => {
  const bytes = new Uint8Array(readFileSync(new URL('./fixtures/demo/thorax-1.dcm', import.meta.url)));
  const old = dicomParser.parseDicom(bytes), current = parseDicomFile(bytes);
  assert.equal(current.string('x00080060'), 'CT');
  assert.deepEqual(current.elements.x7fe00010, old.elements.x7fe00010);
  assert.equal(current.string('x00281052'), old.string('x00281052'));
});
