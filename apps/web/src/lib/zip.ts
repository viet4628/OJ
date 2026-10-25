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

const dec = new TextDecoder('utf-8');

/**
 * Native in-browser ZIP extractor supporting STORE and DEFLATE without dependencies.
 */
export async function parseZip(buffer: ArrayBuffer): Promise<{ name: string; text: string }[]> {
  const limit = 1024 * 1024;
  if (buffer.byteLength > 32 * limit) throw new Error('ZIP vượt giới hạn 32 MiB.');
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const entries: { name: string; text: string }[] = [];
  const invalid = () => new Error('File ZIP không hợp lệ hoặc bị hỏng.');
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw invalid();
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  if (totalEntries > 2200) throw new Error('ZIP vượt giới hạn số lượng file (2200).');
  let cdOffset = view.getUint32(eocdOffset + 16, true);
  let totalSize = 0;
  for (let i = 0; i < totalEntries; i++) {
    if (cdOffset + 46 > eocdOffset || view.getUint32(cdOffset, true) !== 0x02014b50) throw invalid();
    const method = view.getUint16(cdOffset + 10, true);
    if ((view.getUint16(cdOffset + 8, true) & 1) || ![0, 8].includes(method)) throw invalid();
    const compSize = view.getUint32(cdOffset + 20, true);
    const size = view.getUint32(cdOffset + 24, true);
    if (size > limit) throw new Error('Testcase vượt giới hạn 1 MiB mỗi file.');
    totalSize += size;
    if (totalSize > 32 * limit) throw new Error('Dữ liệu giải nén vượt giới hạn 32 MiB.');
    const nameLen = view.getUint16(cdOffset + 28, true);
    const extraLen = view.getUint16(cdOffset + 30, true);
    const commentLen = view.getUint16(cdOffset + 32, true);
    const localOffset = view.getUint32(cdOffset + 42, true);
    if (cdOffset + 46 + nameLen + extraLen + commentLen > eocdOffset || localOffset + 30 > cdOffset) throw invalid();
    const name = dec.decode(bytes.subarray(cdOffset + 46, cdOffset + 46 + nameLen));
    if (view.getUint32(localOffset, true) !== 0x04034b50) throw invalid();
    const dataOffset = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
    if (dataOffset + compSize > cdOffset) throw invalid();
    const compData = bytes.slice(dataOffset, dataOffset + compSize);
    let data = compData;
    if (method === 8) {
      const reader = new Blob([compData]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.length;
          if (length > limit) throw new Error('Testcase vượt giới hạn 1 MiB mỗi file.');
          chunks.push(value);
        }
      } finally { await reader.cancel(); }
      data = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
    }
    if (data.length !== size || crc32(data) !== view.getUint32(cdOffset + 16, true)) throw invalid();
    if (!name.endsWith('/') && !name.startsWith('__MACOSX')) entries.push({ name, text: dec.decode(data) });
    cdOffset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

export interface PairedTestcase {
  name: string;
  input: string;
  output: string;
}

/**
 * Pairs extracted text files according to HackerRank and competitive programming standards.
 * Supports: input00.txt / output00.txt, 1.in / 1.out, test1.in / test1.out, etc.
 */
export function pairTestcases(entries: { name: string; text: string }[]): PairedTestcase[] {
  const map = new Map<string, string>();
  for (const e of entries) {
    const base = e.name.split('/').pop() || e.name;
    if (map.has(base.toLowerCase())) throw new Error(`Trùng tên file testcase: ${base.slice(0, 100)}. Chưa nhập testcase nào.`);
    map.set(base.toLowerCase(), e.text);
  }

  const pairs: PairedTestcase[] = [];
  const handled = new Set<string>();

  for (const [key, text] of map.entries()) {
    if (handled.has(key)) continue;

    // Pattern 1: input00.txt -> output00.txt
    const m1 = key.match(/^(?:input|in)[-_]?(\d+)\.(?:txt|in|data)$/);
    if (m1) {
      const num = m1[1];
      const outCandidates = [
        `output${num}.txt`,
        `output_${num}.txt`,
        `output-${num}.txt`,
        `out${num}.txt`,
        `out_${num}.txt`,
        `out-${num}.txt`,
        `output${num}.out`,
        `input${num}.out`,
        `output${num}.ans`,
        `${num}.out`,
        `${num}.ans`,
      ];
      for (const cand of outCandidates) {
        if (map.has(cand)) {
          pairs.push({ name: `Test #${num}`, input: text, output: map.get(cand) || '' });
          handled.add(key);
          handled.add(cand);
          break;
        }
      }
      continue;
    }

    // Pattern 2: XX.in -> XX.out / XX.ans
    const m2 = key.match(/^(.+)\.in$/);
    if (m2) {
      const base = m2[1];
      const candOut = `${base}.out`;
      const candAns = `${base}.ans`;
      const match = map.has(candOut) ? candOut : map.has(candAns) ? candAns : null;
      if (match) {
        pairs.push({ name: `Test #${base}`, input: text, output: map.get(match) || '' });
        handled.add(key);
        handled.add(match);
      }
    }
  }

  for (const key of map.keys()) {
    if (!handled.has(key) && (/\.(?:in|out|ans)$/.test(key) || /^(?:input|in|output|out)[-_]?\d+\.(?:txt|data)$/.test(key))) {
      throw new Error(`Thiếu cặp input/output cho ${key.slice(0, 100)}. Chưa nhập testcase nào.`);
    }
  }

  // Sort pairs numerically if possible
  pairs.sort((a, b) => {
    const na = parseInt(a.name.replace(/\D/g, ''), 10);
    const nb = parseInt(b.name.replace(/\D/g, ''), 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.name.localeCompare(b.name);
  });

  return pairs;
}

