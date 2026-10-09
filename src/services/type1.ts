/**
 * Adobe Type 1 fonts: PFB (outlines), AFM (text metrics), PFM (Windows metrics).
 * Works on raw bytes only, so it can be tested in Node.
 *
 * The PFB reader decrypts the font program and runs the Type 1 charstring interpreter to turn
 * glyphs into SVG paths (hints are ignored; flex, subroutines, seac accents and hint replacement
 * are handled).
 */

export interface Type1Info {
  fontName: string;
  fullName: string;
  familyName: string;
  weight: string;
  version: string;
  notice: string;
  italicAngle: number;
  isFixedPitch: boolean;
  underlinePosition?: number;
  underlineThickness?: number;
  bbox?: [number, number, number, number];
  unitsPerEm: number;
}

export interface Type1Glyph {
  name: string;
  width: number;
  /** SVG path data in font units, y pointing up */
  path: string;
}

export interface Type1Font {
  info: Type1Info;
  glyphNames: string[];
  /** character code -> glyph name from the font's own encoding */
  encoding: (string | null)[];
  glyph(name: string): Type1Glyph | null;
}

// ---------------------------------------------------------------------------------------------
// Standard encoding (character code -> glyph name), needed for seac accents and the default encoding
// ---------------------------------------------------------------------------------------------

const ASCII_NAMES =
  'space exclam quotedbl numbersign dollar percent ampersand quoteright parenleft parenright asterisk plus comma hyphen period slash ' +
  'zero one two three four five six seven eight nine colon semicolon less equal greater question at ' +
  'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z bracketleft backslash bracketright asciicircum underscore quoteleft ' +
  'a b c d e f g h i j k l m n o p q r s t u v w x y z braceleft bar braceright asciitilde';

const HIGH_NAMES: Record<number, string> = {
  161: 'exclamdown', 162: 'cent', 163: 'sterling', 164: 'fraction', 165: 'yen', 166: 'florin', 167: 'section',
  168: 'currency', 169: 'quotesingle', 170: 'quotedblleft', 171: 'guillemotleft', 172: 'guilsinglleft',
  173: 'guilsinglright', 174: 'fi', 175: 'fl', 177: 'endash', 178: 'dagger', 179: 'daggerdbl',
  180: 'periodcentered', 182: 'paragraph', 183: 'bullet', 184: 'quotesinglbase', 185: 'quotedblbase',
  186: 'quotedblright', 187: 'guillemotright', 188: 'ellipsis', 189: 'perthousand', 191: 'questiondown',
  193: 'grave', 194: 'acute', 195: 'circumflex', 196: 'tilde', 197: 'macron', 198: 'breve', 199: 'dotaccent',
  200: 'dieresis', 202: 'ring', 203: 'cedilla', 205: 'hungarumlaut', 206: 'ogonek', 207: 'caron',
  208: 'emdash', 225: 'AE', 227: 'ordfeminine', 232: 'Lslash', 233: 'Oslash', 234: 'OE', 235: 'ordmasculine',
  241: 'ae', 245: 'dotlessi', 248: 'lslash', 249: 'oslash', 250: 'oe', 251: 'germandbls'
};

export const STANDARD_ENCODING: (string | null)[] = (() => {
  const t: (string | null)[] = new Array(256).fill(null);
  ASCII_NAMES.split(' ').forEach((n, i) => (t[32 + i] = n));
  for (const [code, name] of Object.entries(HIGH_NAMES)) t[Number(code)] = name;
  return t;
})();

/** Glyph name for a typed character, using the common Latin names. */
export function glyphNameForChar(ch: string, encoding: (string | null)[]): string | null {
  const code = ch.charCodeAt(0);
  if (code < 128) {
    // typed ASCII: ' and ` map to the font's quote glyphs
    if (ch === "'") return encoding[39] === 'quoteright' || !encoding[39] ? 'quotesingle' : encoding[39];
    return encoding[code] || STANDARD_ENCODING[code] || null;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// PFB container + decryption
// ---------------------------------------------------------------------------------------------

const latin1 = (b: Uint8Array, start = 0, end = b.length): string => {
  let s = '';
  for (let i = start; i < end; i += 8192) {
    s += String.fromCharCode.apply(null, Array.from(b.subarray(i, Math.min(i + 8192, end))));
  }
  return s;
};

function decrypt(data: Uint8Array, key: number, skip: number): Uint8Array {
  let r = key;
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const c = data[i];
    out[i] = c ^ (r >> 8);
    r = ((c + r) * 52845 + 22719) & 0xffff;
  }
  return out.subarray(skip);
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const out = new Uint8Array(clean.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

/** Splits a PFB (0x80 segments) or PFA (plain text with hex eexec) into clear text and the encrypted part. */
function splitFontProgram(b: Uint8Array): { clear: string; encrypted: Uint8Array } | null {
  if (b[0] === 0x80) {
    let pos = 0;
    const ascii: Uint8Array[] = [];
    const binary: Uint8Array[] = [];
    while (pos + 6 <= b.length && b[pos] === 0x80) {
      const type = b[pos + 1];
      if (type === 3) break;
      const len = b[pos + 2] | (b[pos + 3] << 8) | (b[pos + 4] << 16) | (b[pos + 5] << 24);
      const seg = b.subarray(pos + 6, pos + 6 + len);
      if (type === 1) (binary.length === 0 ? ascii : []).push(seg);
      else if (type === 2) binary.push(seg);
      pos += 6 + len;
    }
    if (ascii.length === 0 || binary.length === 0) return null;
    const total = binary.reduce((n, s) => n + s.length, 0);
    const enc = new Uint8Array(total);
    let o = 0;
    for (const s of binary) {
      enc.set(s, o);
      o += s.length;
    }
    return { clear: latin1(ascii.length === 1 ? ascii[0] : concat(ascii)), encrypted: enc };
  }
  // PFA
  const text = latin1(b);
  const i = text.indexOf('eexec');
  if (i < 0) return null;
  let start = i + 5;
  while (start < text.length && /\s/.test(text[start])) start++;
  const rest = text.slice(start);
  const isHex = /^[0-9a-fA-F\s]{8}/.test(rest);
  return {
    clear: text.slice(0, i + 5),
    encrypted: isHex ? hexToBytes(rest.slice(0, rest.indexOf('0000000000000000'))) : b.subarray(start)
  };
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function num(text: string, key: string): number | undefined {
  const m = new RegExp(`/${key}\\s+(-?[0-9.]+)`).exec(text);
  return m ? parseFloat(m[1]) : undefined;
}
function str(text: string, key: string): string {
  const m = new RegExp(`/${key}\\s*\\(((?:[^()\\\\]|\\\\.|\\([^()]*\\))*)\\)`).exec(text);
  return m ? m[1].replace(/\\(.)/g, '$1') : '';
}
function nameVal(text: string, key: string): string {
  const m = new RegExp(`/${key}\\s*/([^\\s/]+)`).exec(text);
  return m ? m[1] : '';
}

// ---------------------------------------------------------------------------------------------
// Charstring interpreter
// ---------------------------------------------------------------------------------------------

interface Outline {
  path: string[];
  width: number;
  sbx: number;
}

function runCharstring(
  code: Uint8Array,
  subrs: Uint8Array[],
  charstrings: Map<string, Uint8Array>,
  out: { path: string[]; x: number; y: number; width: number; sbx: number; open: boolean },
  state: { stack: number[]; ps: number[]; inFlex: boolean; flex: number[][]; done: boolean },
  depth = 0
) {
  if (depth > 12) return;
  const st = state.stack;
  let i = 0;

  const moveTo = (dx: number, dy: number) => {
    out.x += dx;
    out.y += dy;
    if (state.inFlex) {
      state.flex.push([out.x, out.y]);
      return;
    }
    if (out.open) out.path.push('Z');
    out.path.push(`M${out.x} ${out.y}`);
    out.open = true;
  };
  const lineTo = (dx: number, dy: number) => {
    out.x += dx;
    out.y += dy;
    out.path.push(`L${out.x} ${out.y}`);
  };
  const curveTo = (a: number, b: number, c: number, d: number, e: number, f: number) => {
    const x1 = out.x + a;
    const y1 = out.y + b;
    const x2 = x1 + c;
    const y2 = y1 + d;
    out.x = x2 + e;
    out.y = y2 + f;
    out.path.push(`C${x1} ${y1} ${x2} ${y2} ${out.x} ${out.y}`);
  };

  while (i < code.length && !state.done) {
    const v = code[i++];
    if (v >= 32) {
      if (v <= 246) st.push(v - 139);
      else if (v <= 250) st.push((v - 247) * 256 + code[i++] + 108);
      else if (v <= 254) st.push(-(v - 251) * 256 - code[i++] - 108);
      else {
        st.push((code[i] << 24) | (code[i + 1] << 16) | (code[i + 2] << 8) | code[i + 3]);
        i += 4;
      }
      continue;
    }
    switch (v) {
      case 1: // hstem
      case 3: // vstem
        st.length = 0;
        break;
      case 4: // vmoveto
        moveTo(0, st[st.length - 1] || 0);
        st.length = 0;
        break;
      case 5: // rlineto
        lineTo(st[0], st[1]);
        st.length = 0;
        break;
      case 6: // hlineto
        lineTo(st[0], 0);
        st.length = 0;
        break;
      case 7: // vlineto
        lineTo(0, st[0]);
        st.length = 0;
        break;
      case 8: // rrcurveto
        curveTo(st[0], st[1], st[2], st[3], st[4], st[5]);
        st.length = 0;
        break;
      case 9: // closepath
        if (out.open) {
          out.path.push('Z');
          out.open = false;
        }
        st.length = 0;
        break;
      case 10: {
        // callsubr
        const idx = st.pop() as number;
        const sub = subrs[idx];
        if (sub) runCharstring(sub, subrs, charstrings, out, state, depth + 1);
        break;
      }
      case 11: // return
        return;
      case 13: // hsbw
        out.sbx = st[0];
        out.width = st[1];
        out.x = st[0];
        out.y = 0;
        st.length = 0;
        break;
      case 14: // endchar
        if (out.open) {
          out.path.push('Z');
          out.open = false;
        }
        state.done = true;
        return;
      case 21: // rmoveto
        moveTo(st[st.length - 2] || 0, st[st.length - 1] || 0);
        st.length = 0;
        break;
      case 22: // hmoveto
        moveTo(st[st.length - 1] || 0, 0);
        st.length = 0;
        break;
      case 30: // vhcurveto
        curveTo(0, st[0], st[1], st[2], st[3], 0);
        st.length = 0;
        break;
      case 31: // hvcurveto
        curveTo(st[0], 0, st[1], st[2], 0, st[3]);
        st.length = 0;
        break;
      case 12: {
        const e = code[i++];
        if (e === 12) {
          // div
          const b = st.pop() as number;
          const a = st.pop() as number;
          st.push(a / b);
        } else if (e === 16) {
          // callothersubr
          const n = st.pop() as number;
          const argc = st.pop() as number;
          const args = argc > 0 ? st.splice(st.length - argc, argc) : [];
          if (n === 1) {
            state.inFlex = true;
            state.flex = [];
          } else if (n === 2) {
            // flex point recorded by the rmoveto that preceded it
          } else if (n === 0) {
            state.inFlex = false;
            const p = state.flex;
            if (p.length >= 7) {
              out.path.push(`C${p[1][0]} ${p[1][1]} ${p[2][0]} ${p[2][1]} ${p[3][0]} ${p[3][1]}`);
              out.path.push(`C${p[4][0]} ${p[4][1]} ${p[5][0]} ${p[5][1]} ${p[6][0]} ${p[6][1]}`);
              out.x = p[6][0];
              out.y = p[6][1];
            }
            // results popped by "pop pop setcurrentpoint": y below x
            state.ps.push(args[2] ?? out.y, args[1] ?? out.x);
          } else {
            // 3 = hint replacement (returns the subr number); others: hand the args back
            for (let k = args.length - 1; k >= 0; k--) state.ps.push(args[k]);
          }
        } else if (e === 17) {
          // pop
          st.push(state.ps.length ? (state.ps.pop() as number) : 0);
        } else if (e === 33) {
          // setcurrentpoint
          out.x = st[0];
          out.y = st[1];
          st.length = 0;
        } else if (e === 6) {
          // seac: asb adx ady bchar achar
          const [asb, adx, ady, bchar, achar] = st.splice(0, 5);
          const bName = STANDARD_ENCODING[bchar];
          const aName = STANDARD_ENCODING[achar];
          const sbx = out.sbx;
          const width = out.width;
          const drawPart = (name: string | null, dx: number, dy: number) => {
            const cs = name ? charstrings.get(name) : undefined;
            if (!cs) return;
            const part = { path: [] as string[], x: 0, y: 0, width: 0, sbx: 0, open: false };
            runCharstring(cs, subrs, charstrings, part, { stack: [], ps: [], inFlex: false, flex: [], done: false }, depth + 1);
            const shifted = part.path
              .join(' ')
              .replace(/(-?[0-9.]+) (-?[0-9.]+)/g, (_m, px, py) => `${parseFloat(px) + dx} ${parseFloat(py) + dy}`);
            out.path.push(shifted);
          };
          drawPart(bName, 0, 0);
          drawPart(aName, sbx - asb + adx, ady);
          out.width = width;
          state.done = true;
          return;
        } else {
          // dotsection, vstem3, hstem3, sbw...: drop operands
          if (e === 7) {
            out.sbx = st[0];
            out.width = st[2];
            out.x = st[0];
            out.y = st[1];
          }
          st.length = 0;
        }
        break;
      }
      default:
        st.length = 0;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// PFB parser
// ---------------------------------------------------------------------------------------------

export function parsePfb(bytes: Uint8Array): Type1Font | null {
  const parts = splitFontProgram(bytes);
  if (!parts) return null;
  const clear = parts.clear;

  const bboxM = /\/FontBBox\s*[{[]\s*(-?[0-9.]+)\s+(-?[0-9.]+)\s+(-?[0-9.]+)\s+(-?[0-9.]+)/.exec(clear);
  const matrixM = /\/FontMatrix\s*\[\s*([0-9.eE+-]+)/.exec(clear);
  const unitsPerEm = matrixM && parseFloat(matrixM[1]) > 0 ? Math.round(1 / parseFloat(matrixM[1])) : 1000;

  const info: Type1Info = {
    fontName: nameVal(clear, 'FontName'),
    fullName: str(clear, 'FullName'),
    familyName: str(clear, 'FamilyName'),
    weight: str(clear, 'Weight'),
    version: str(clear, 'version'),
    notice: str(clear, 'Notice'),
    italicAngle: num(clear, 'ItalicAngle') ?? 0,
    isFixedPitch: /\/isFixedPitch\s+true/.test(clear),
    underlinePosition: num(clear, 'UnderlinePosition'),
    underlineThickness: num(clear, 'UnderlineThickness'),
    bbox: bboxM ? [+bboxM[1], +bboxM[2], +bboxM[3], +bboxM[4]] : undefined,
    unitsPerEm
  };

  // Encoding: StandardEncoding, or "dup 65 /A put" lines
  const encoding: (string | null)[] = new Array(256).fill(null);
  if (/\/Encoding\s+StandardEncoding/.test(clear)) {
    STANDARD_ENCODING.forEach((n, i) => (encoding[i] = n));
  } else {
    const re = /dup\s+(\d+)\s*\/([^\s/]+)\s+put/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(clear))) {
      const c = parseInt(m[1], 10);
      if (c >= 0 && c < 256) encoding[c] = m[2];
    }
  }

  // Private dictionary: Subrs and CharStrings
  const priv = decrypt(parts.encrypted, 55665, 4);
  const text = latin1(priv);
  const lenIVm = /\/lenIV\s+(\d+)/.exec(text);
  const lenIV = lenIVm ? parseInt(lenIVm[1], 10) : 4;

  const subrs: Uint8Array[] = [];
  const subrsAt = text.indexOf('/Subrs');
  const csAt = text.indexOf('/CharStrings');
  if (csAt < 0) return null;

  if (subrsAt >= 0 && subrsAt < csAt) {
    const re = /dup\s+(\d+)\s+(\d+)\s+(RD|-\|)\s/g;
    re.lastIndex = subrsAt;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) && m.index < csAt) {
      const idx = parseInt(m[1], 10);
      const len = parseInt(m[2], 10);
      const start = m.index + m[0].length;
      subrs[idx] = decrypt(priv.subarray(start, start + len), 4330, lenIV);
      re.lastIndex = start + len;
    }
  }

  const charstrings = new Map<string, Uint8Array>();
  {
    const re = /\/([^\s/]+)\s+(\d+)\s+(RD|-\|)\s/g;
    re.lastIndex = csAt + 12;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const len = parseInt(m[2], 10);
      const start = m.index + m[0].length;
      charstrings.set(m[1], decrypt(priv.subarray(start, start + len), 4330, lenIV));
      re.lastIndex = start + len;
    }
  }
  if (charstrings.size === 0) return null;

  const cache = new Map<string, Type1Glyph | null>();
  return {
    info,
    glyphNames: Array.from(charstrings.keys()),
    encoding,
    glyph(name: string): Type1Glyph | null {
      if (cache.has(name)) return cache.get(name)!;
      const cs = charstrings.get(name);
      let result: Type1Glyph | null = null;
      if (cs) {
        try {
          const out = { path: [] as string[], x: 0, y: 0, width: 0, sbx: 0, open: false };
          runCharstring(cs, subrs, charstrings, out, { stack: [], ps: [], inFlex: false, flex: [], done: false });
          result = { name, width: out.width, path: out.path.join(' ') };
        } catch {
          result = null;
        }
      }
      cache.set(name, result);
      return result;
    }
  };
}

// ---------------------------------------------------------------------------------------------
// AFM (text metrics)
// ---------------------------------------------------------------------------------------------

export interface AfmChar {
  code: number;
  width: number;
  name: string;
  bbox?: [number, number, number, number];
}

export interface AfmData {
  info: Record<string, string>;
  chars: AfmChar[];
  kernPairs: { a: string; b: string; amount: number }[];
}

export function parseAfm(text: string): AfmData | null {
  if (!/StartFontMetrics/.test(text)) return null;
  const info: Record<string, string> = {};
  const chars: AfmChar[] = [];
  const kernPairs: AfmData['kernPairs'] = [];
  let mode: 'head' | 'chars' | 'kern' | 'other' = 'head';
  for (const raw of text.split(/\r?\n|\r/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('StartCharMetrics')) mode = 'chars';
    else if (line.startsWith('EndCharMetrics')) mode = 'other';
    else if (line.startsWith('StartKernPairs')) mode = 'kern';
    else if (line.startsWith('EndKernPairs')) mode = 'other';
    else if (line.startsWith('StartComposites') || line.startsWith('StartTrackKern')) mode = 'other';
    else if (mode === 'head') {
      const sp = line.indexOf(' ');
      if (sp > 0) {
        const k = line.slice(0, sp);
        info[k] = info[k] ? info[k] + ' ' + line.slice(sp + 1) : line.slice(sp + 1);
      }
    } else if (mode === 'chars') {
      const c = /C\s+(-?\d+)\s*;\s*WX\s+(-?[\d.]+)\s*;\s*N\s+(\S+)\s*;(?:\s*B\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+))?/.exec(line);
      if (c) {
        chars.push({
          code: parseInt(c[1], 10),
          width: parseFloat(c[2]),
          name: c[3],
          bbox: c[4] ? [+c[4], +c[5], +c[6], +c[7]] : undefined
        });
      }
    } else if (mode === 'kern') {
      const k = /KPX\s+(\S+)\s+(\S+)\s+(-?[\d.]+)/.exec(line);
      if (k) kernPairs.push({ a: k[1], b: k[2], amount: parseFloat(k[3]) });
    }
  }
  return { info, chars, kernPairs };
}

// ---------------------------------------------------------------------------------------------
// PFM (Windows Printer Font Metrics)
// ---------------------------------------------------------------------------------------------

export interface PfmData {
  copyright: string;
  faceName: string;
  postscriptName: string;
  weight: number;
  italic: boolean;
  ascent: number;
  avgWidth: number;
  maxWidth: number;
  firstChar: number;
  lastChar: number;
  widths: number[];
  kernPairs: { first: number; second: number; amount: number }[];
}

export function parsePfm(b: Uint8Array): PfmData | null {
  if (b.length < 150) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const version = dv.getUint16(0, true);
  if (version !== 0x0100 && version !== 0x0200) return null;
  const cstr = (off: number, max = 128): string => {
    if (!off || off >= b.length) return '';
    let s = '';
    for (let i = off; i < Math.min(b.length, off + max) && b[i] !== 0; i++) s += String.fromCharCode(b[i]);
    return s;
  };
  const firstChar = b[95];
  const lastChar = b[96];
  const faceOffset = dv.getUint32(105, true);
  const extentTable = dv.getUint32(123, true);
  const kernTable = dv.getUint32(131, true);
  const driverInfo = dv.getUint32(139, true);

  const widths: number[] = [];
  if (extentTable && extentTable + (lastChar - firstChar + 1) * 2 <= b.length) {
    for (let c = firstChar; c <= lastChar; c++) widths.push(dv.getUint16(extentTable + (c - firstChar) * 2, true));
  }
  const kernPairs: PfmData['kernPairs'] = [];
  if (kernTable && kernTable + 2 <= b.length) {
    const count = dv.getUint16(kernTable, true);
    for (let i = 0; i < count && kernTable + 2 + i * 4 + 4 <= b.length; i++) {
      const o = kernTable + 2 + i * 4;
      kernPairs.push({ first: b[o], second: b[o + 1], amount: dv.getInt16(o + 2, true) });
    }
  }

  return {
    copyright: cstr(6, 60),
    faceName: cstr(faceOffset),
    postscriptName: cstr(driverInfo),
    weight: dv.getUint16(83, true),
    italic: b[80] !== 0,
    ascent: dv.getUint16(74, true),
    avgWidth: dv.getUint16(91, true),
    maxWidth: dv.getUint16(93, true),
    firstChar,
    lastChar,
    widths,
    kernPairs
  };
}

/** Quick sniff: what kind of Type 1 file is this? */
export function sniffType1(b: Uint8Array): 'pfb' | 'afm' | 'pfm' | null {
  if (b[0] === 0x80 && b[1] === 1) return 'pfb';
  const head = latin1(b, 0, 40);
  if (head.startsWith('%!PS-AdobeFont') || head.startsWith('%!FontType1')) return 'pfb';
  if (head.includes('StartFontMetrics')) return 'afm';
  if (b[0] === 0x00 && (b[1] === 0x01 || b[1] === 0x02)) return 'pfm';
  return null;
}

export type { Outline };
