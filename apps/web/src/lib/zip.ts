// Minimal ZIP creator (STORE method, no compression) — no external dependency.
// Produces a valid .zip archive usable by standard unzip tools (incl. HackerRank export flows).

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const enc = new TextEncoder();

export interface ZipEntry {
  name: string;
  data: string | Uint8Array;
}

export function createZip(entries: ZipEntry[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  const records: { name: string; crc: number; size: number; offset: number }[] = [];

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name);
    const dataBytes = typeof entry.data === 'string' ? enc.encode(entry.data) : entry.data;
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    // local file header
    const local = new Uint8Array(30 + nameBytes.length + size);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true); // version needed
    dv.setUint16(6, 0, true); // flags
    dv.setUint16(8, 0, true); // method STORE
    // DOS timestamp (fixed)
    dv.setUint16(10, 0, true);
    dv.setUint16(12, 0x21, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, size, true);
    dv.setUint32(22, size, true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true); // extra
    local.set(nameBytes, 30);
    local.set(dataBytes, 30 + nameBytes.length);

    records.push({ name: entry.name, crc, size, offset });
    locals.push(local);
    offset += local.length;
  }

  // central directory
  let centralSize = 0;
  for (const r of records) {
    const nameBytes = enc.encode(r.name);
    const cd = new Uint8Array(46 + nameBytes.length);
    const dv = new DataView(cd.buffer);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(4, 20, true); // version made by
    dv.setUint16(6, 20, true); // version needed
    dv.setUint16(8, 0, true); // flags
    dv.setUint16(10, 0, true); // method
    dv.setUint16(12, 0, true); // mod time
    dv.setUint16(14, 0x21, true); // mod date
    dv.setUint32(16, r.crc, true);
    dv.setUint32(20, r.size, true);
    dv.setUint32(24, r.size, true);
    dv.setUint16(28, nameBytes.length, true);
    dv.setUint16(30, 0, true); // extra
    dv.setUint16(32, 0, true); // comment
    dv.setUint16(34, 0, true); // disk
    dv.setUint16(36, 0, true); // internal attr
    dv.setUint32(38, 0, true); // external attr
    dv.setUint32(42, r.offset, true);
    cd.set(nameBytes, 46);
    centrals.push(cd);
    centralSize += cd.length;
  }

  // end of central directory
  const eocd = new Uint8Array(22);
  const edv = new DataView(eocd.buffer);
  edv.setUint32(0, 0x06054b50, true);
  edv.setUint16(4, 0, true); // disk
  edv.setUint16(6, 0, true); // cd disk
  edv.setUint16(8, records.length, true);
  edv.setUint16(10, records.length, true);
  edv.setUint32(12, centralSize, true);
  edv.setUint32(16, offset, true);
  edv.setUint16(20, 0, true); // comment

  // concatenate
  const total = offset + centralSize + 22;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const l of locals) { out.set(l, pos); pos += l.length; }
  for (const c of centrals) { out.set(c, pos); pos += c.length; }
  out.set(eocd, pos);
  return out;
}

export function downloadBlob(data: Uint8Array | string, filename: string, mime = 'application/octet-stream') {
  const bytes = typeof data === 'string' ? enc.encode(data) : data;
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
