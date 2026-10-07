// A RAR4 "store" archive containing only synthetic test data; no external archiver.
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function header(type, flags, fields) {
  const body = Buffer.alloc(5 + fields.length);
  body[0] = type; body.writeUInt16LE(flags, 1); body.writeUInt16LE(body.length + 2, 3); fields.copy(body, 5);
  const crc = Buffer.alloc(2); crc.writeUInt16LE(crc32(body) & 0xffff);
  return Buffer.concat([crc, body]);
}
export function storedRar(entries) {
  const parts = [Buffer.from([82,97,114,33,26,7,0]), header(0x73, 0, Buffer.alloc(6))];
  for (const [filename, data] of entries) {
    const name = Buffer.from(filename), fields = Buffer.alloc(25 + name.length);
    fields.writeUInt32LE(data.length, 0); fields.writeUInt32LE(data.length, 4); fields[8] = 2;
    fields.writeUInt32LE(crc32(data), 9); fields[17] = 20; fields[18] = 0x30;
    fields.writeUInt16LE(name.length, 19); fields.writeUInt32LE(0x20, 21); name.copy(fields, 25);
    parts.push(header(0x74, 0x8000, fields), data);
  }
  parts.push(header(0x7b, 0, Buffer.alloc(0)));
  return Buffer.concat(parts);
}
