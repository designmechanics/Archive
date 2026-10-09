/**
 * Old binary Office files (Word .doc, PowerPoint .ppt) are OLE compound files. This pulls out the
 * document properties and the text. It works on a parsed container (`CFB` from SheetJS), so it is
 * testable in Node.
 */

export interface OleStream {
  name: string;
  content: Uint8Array | number[];
}

export interface OleContainer {
  FullPaths: string[];
  FileIndex: OleStream[];
}

export interface LegacyOfficeResult {
  kind: 'word' | 'powerpoint' | 'unknown';
  properties: [string, string][];
  /** For Word: paragraphs. For PowerPoint: one entry per slide. */
  text: string[];
  encrypted?: boolean;
  note?: string;
}

function bytesOf(e: OleStream | undefined): Uint8Array | null {
  if (!e || !e.content) return null;
  return e.content instanceof Uint8Array ? e.content : Uint8Array.from(e.content as number[]);
}

export function findStream(cfb: OleContainer, name: string): Uint8Array | null {
  const lower = name.toLowerCase();
  for (let i = 0; i < cfb.FullPaths.length; i++) {
    const p = cfb.FullPaths[i].toLowerCase();
    const leaf = p.replace(/\/+$/, '').split('/').pop() || '';
    if (leaf === lower) return bytesOf(cfb.FileIndex[i]);
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Summary information (title, author, dates...)
// ---------------------------------------------------------------------------------------------

const filetimeToDate = (lo: number, hi: number): string => {
  const ms = (hi * 4294967296 + lo) / 10000 - 11644473600000;
  if (!isFinite(ms) || ms < 0) return '';
  const d = new Date(ms);
  return isNaN(d.getTime()) ? '' : d.toLocaleString();
};

export const SUMMARY_STREAM_NAME = String.fromCharCode(5) + 'SummaryInformation';

export function readSummaryInformation(stream: Uint8Array | null): [string, string][] {
  if (!stream || stream.length < 48) return [];
  const dv = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  const out: [string, string][] = [];
  try {
    const numSets = dv.getUint32(24, true);
    if (numSets < 1) return [];
    const sectionOffset = dv.getUint32(44, true);
    const count = dv.getUint32(sectionOffset + 4, true);

    const labels: Record<number, string> = {
      2: 'Title', 3: 'Subject', 4: 'Author', 5: 'Keywords', 6: 'Comments', 8: 'Last saved by', 9: 'Revision',
      12: 'Created', 13: 'Last saved', 14: 'Pages', 15: 'Words', 16: 'Characters', 18: 'Application'
    };
    let codepage = 1252;
    const props: { id: number; off: number }[] = [];
    for (let i = 0; i < count && i < 64; i++) {
      props.push({
        id: dv.getUint32(sectionOffset + 8 + i * 8, true),
        off: sectionOffset + dv.getUint32(sectionOffset + 12 + i * 8, true)
      });
    }
    const cp = props.find((p) => p.id === 1);
    if (cp && cp.off + 6 <= stream.length) codepage = dv.getUint16(cp.off + 4, true);

    for (const p of props) {
      const label = labels[p.id];
      if (!label || p.off + 8 > stream.length) continue;
      const type = dv.getUint16(p.off, true);
      let value = '';
      if (type === 30) {
        const len = dv.getUint32(p.off + 4, true);
        const bytes = stream.subarray(p.off + 8, p.off + 8 + Math.max(0, len - 1));
        value = new TextDecoder(codepage === 65001 ? 'utf-8' : 'windows-1252').decode(bytes);
      } else if (type === 31) {
        const len = dv.getUint32(p.off + 4, true);
        value = new TextDecoder('utf-16le').decode(stream.subarray(p.off + 8, p.off + 8 + Math.max(0, (len - 1) * 2)));
      } else if (type === 64) {
        value = filetimeToDate(dv.getUint32(p.off + 4, true), dv.getUint32(p.off + 8, true));
      } else if (type === 3) {
        value = String(dv.getInt32(p.off + 4, true));
      }
      value = value.split(String.fromCharCode(0)).join('').trim();
      if (value && value !== '0') out.push([label, value]);
    }
  } catch {
    // properties are optional
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Word (.doc)
// ---------------------------------------------------------------------------------------------

function cleanWordText(raw: string): string[] {
  let t = raw;
  // field codes: keep the result, drop the instruction (0x13 code 0x14 result 0x15)
  t = t.replace(/\x13[^\x13\x14\x15]*\x14/g, '').replace(/\x13[^\x13\x15]*\x15/g, '');
  t = t
    .replace(/\x07/g, '\t')
    .replace(/\x0b/g, '\n')
    .replace(/\x0c/g, '\n\n')
    .replace(/[\x00-\x06\x08\x0e-\x1f\x13-\x15]/g, '')
    .split(String.fromCharCode(0x2028))
    .join('\n');
  return t.split(/\r/).map((s) => s.replace(/[ \t]+$/g, ''));
}

export function extractWordText(cfb: OleContainer): LegacyOfficeResult {
  const word = findStream(cfb, 'WordDocument');
  const props = readSummaryInformation(findStream(cfb, SUMMARY_STREAM_NAME));
  if (!word || word.length < 0x200) return { kind: 'word', properties: props, text: [], note: 'No Word document stream found.' };

  const dv = new DataView(word.buffer, word.byteOffset, word.byteLength);
  const ident = dv.getUint16(0, true);
  const flags = dv.getUint16(10, true);
  if (flags & 0x0100) return { kind: 'word', properties: props, text: [], encrypted: true };

  // Word 6 / 95: text is one plain run between fcMin and fcMac
  if (ident !== 0xa5ec) {
    const fcMin = dv.getUint32(0x18, true);
    const fcMac = dv.getUint32(0x1c, true);
    const text = new TextDecoder('windows-1252').decode(word.subarray(fcMin, Math.min(word.length, fcMac)));
    return { kind: 'word', properties: props, text: cleanWordText(text), note: 'Older Word format: plain text only.' };
  }

  const useTable1 = (flags & 0x0200) !== 0;
  const table = findStream(cfb, useTable1 ? '1Table' : '0Table');
  if (!table) return { kind: 'word', properties: props, text: [], note: 'Text table not found.' };

  const ccpText = dv.getUint32(76, true);
  const fcClx = dv.getUint32(154 + 33 * 8, true);
  const lcbClx = dv.getUint32(154 + 33 * 8 + 4, true);
  const tdv = new DataView(table.buffer, table.byteOffset, table.byteLength);

  // Walk the CLX: skip Prc blocks (0x01), then read the piece table (0x02)
  let p = fcClx;
  const end = Math.min(table.length, fcClx + lcbClx);
  while (p < end && table[p] === 0x01) p += 3 + tdv.getUint16(p + 1, true);
  if (p >= end || table[p] !== 0x02) return { kind: 'word', properties: props, text: [], note: 'Piece table not found.' };

  const plcLen = tdv.getUint32(p + 1, true);
  const plcStart = p + 5;
  const pieceCount = Math.floor((plcLen - 4) / 12);
  let raw = '';
  for (let i = 0; i < pieceCount; i++) {
    const cpStart = tdv.getUint32(plcStart + i * 4, true);
    const cpEnd = tdv.getUint32(plcStart + (i + 1) * 4, true);
    const pcd = plcStart + (pieceCount + 1) * 4 + i * 8;
    const fc = tdv.getUint32(pcd + 2, true);
    const compressed = (fc & 0x40000000) !== 0;
    const len = Math.min(cpEnd, ccpText) - cpStart;
    if (len <= 0) continue;
    if (compressed) {
      const off = (fc & 0x3fffffff) >> 1;
      raw += new TextDecoder('windows-1252').decode(word.subarray(off, off + len));
    } else {
      const off = fc & 0x3fffffff;
      raw += new TextDecoder('utf-16le').decode(word.subarray(off, off + len * 2));
    }
  }
  return { kind: 'word', properties: props, text: cleanWordText(raw) };
}

// ---------------------------------------------------------------------------------------------
// PowerPoint (.ppt)
// ---------------------------------------------------------------------------------------------

export function extractPptText(cfb: OleContainer): LegacyOfficeResult {
  const props = readSummaryInformation(findStream(cfb, SUMMARY_STREAM_NAME));
  const doc = findStream(cfb, 'PowerPoint Document');
  if (!doc) return { kind: 'powerpoint', properties: props, text: [], note: 'No PowerPoint stream found.' };

  const dv = new DataView(doc.buffer, doc.byteOffset, doc.byteLength);
  const slides: string[][] = [];
  const loose: string[] = [];
  // Which kind of container the walker is inside: slide text is collected per slide, notes and
  // masters are kept apart so their text does not pollute the slides.
  let area: 'slide' | 'other' | 'none' = 'none';

  const walk = (start: number, end: number, depth: number) => {
    let pos = start;
    while (pos + 8 <= end && depth < 14) {
      const verInst = dv.getUint16(pos, true);
      const type = dv.getUint16(pos + 2, true);
      const len = dv.getUint32(pos + 4, true);
      const body = pos + 8;
      const bodyEnd = Math.min(end, body + len);
      if ((verInst & 0x0f) === 0x0f) {
        const prev = area;
        if (type === 0x03ee) {
          area = 'slide';
          slides.push([]);
        } else if (type === 0x03f0 || type === 0x03f8) {
          area = 'other'; // notes page, main master
        }
        walk(body, bodyEnd, depth + 1);
        area = prev;
      } else if (type === 0x0fa0 || type === 0x0fa8) {
        const text =
          type === 0x0fa0
            ? new TextDecoder('utf-16le').decode(doc.subarray(body, bodyEnd))
            : new TextDecoder('windows-1252').decode(doc.subarray(body, bodyEnd));
        const cleaned = text.replace(/\r/g, '\n').replace(/\x0b/g, '\n').split(String.fromCharCode(0)).join('').trim();
        if (cleaned) {
          if (area === 'slide' && slides.length) slides[slides.length - 1].push(cleaned);
          else loose.push(cleaned);
        }
      }
      if (len === 0 && (verInst & 0x0f) !== 0x0f && type === 0) break;
      pos = body + len;
    }
  };
  try {
    walk(0, doc.length, 0);
  } catch {
    // keep whatever was read
  }

  const slideText = slides.map((s) => s.join('\n')).filter((s) => s.trim());
  const text = slideText.length ? slideText : loose.length ? [loose.join('\n')] : [];
  return { kind: 'powerpoint', properties: props, text };
}

// ---------------------------------------------------------------------------------------------
// RTF (many ".doc" files are really Rich Text Format)
// ---------------------------------------------------------------------------------------------

export function isRtf(bytes: Uint8Array): boolean {
  return bytes.length > 5 && bytes[0] === 0x7b && bytes[1] === 0x5c && bytes[2] === 0x72 && bytes[3] === 0x74 && bytes[4] === 0x66;
}

/** Plain text from an RTF document: control words dropped, \par becomes a paragraph break. */
export function rtfToText(bytes: Uint8Array): string[] {
  const src = new TextDecoder('windows-1252').decode(bytes);
  const out: string[] = [];
  const skipGroups = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'object', 'header', 'footer', 'footnote', 'themedata', 'datastore', 'latentstyles']);
  let i = 0;
  let depth = 0;
  let skipDepth = -1;
  let cur = '';
  const flush = () => {
    out.push(cur);
    cur = '';
  };
  while (i < src.length) {
    const ch = src[i];
    if (ch === '{') {
      depth++;
      i++;
      // {\*\destination ...} or a known binary-ish group: skip the whole group
      if (skipDepth < 0) {
        const m = /^\\\*?\\?([a-z]+)/.exec(src.slice(i, i + 24));
        if ((src[i] === '\\' && src[i + 1] === '*') || (m && skipGroups.has(m[1]))) skipDepth = depth;
      }
    } else if (ch === '}') {
      if (depth === skipDepth) skipDepth = -1;
      depth--;
      i++;
    } else if (ch === '\\') {
      const next = src[i + 1];
      if (next === '\\' || next === '{' || next === '}') {
        if (skipDepth < 0) cur += next;
        i += 2;
      } else if (next === "'") {
        const code = parseInt(src.slice(i + 2, i + 4), 16);
        if (skipDepth < 0 && !isNaN(code)) cur += new TextDecoder('windows-1252').decode(Uint8Array.of(code));
        i += 4;
      } else {
        const m = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(src.slice(i, i + 40));
        if (!m) {
          i += 2;
          continue;
        }
        const word = m[1];
        if (skipDepth < 0) {
          if (word === 'par' || word === 'sect' || word === 'page') flush();
          else if (word === 'line') cur += '\n';
          else if (word === 'tab') cur += '\t';
          else if (word === 'u' && m[2]) cur += String.fromCharCode(parseInt(m[2], 10) & 0xffff);
          else if (word === 'emdash') cur += '—';
          else if (word === 'endash') cur += '–';
          else if (word === 'bullet') cur += '•';
        }
        i += m[0].length;
        if (word === 'u') i++; // skip the fallback character after \uN
      }
    } else {
      if (skipDepth < 0 && ch !== '\r' && ch !== '\n') cur += ch;
      i++;
    }
  }
  if (cur) flush();
  return out;
}
