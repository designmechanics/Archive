import fs from 'fs';

/**
 * What a file really is, judged from its first bytes rather than its name. In a real archive many
 * ".png"/".gif"/".jpg" files are not pictures at all: copies whose bytes are all zeros, empty
 * files, FrontPage `_vti_cnf` housekeeping text, a Photoshop file saved as .jpg, a Mac plist named
 * .tiff. The thumbnail maker and the viewer use this so each gets the right handling or a plain
 * reason on its tile.
 */

const HEAD_BYTES = 4096;

/** Kinds that are not pictures, with the reason shown on the grid tile. */
export const NOT_A_PICTURE_NOTE = {
  empty: 'Empty file',
  zeros: 'Damaged — file is blank',
  mangled: 'Damaged — saved as text, bytes replaced',
  frontpage: 'FrontPage metadata',
  bplist: 'Not an image (Mac property list)',
  html: 'Not an image (web page)',
  text: 'Not an image (text)',
  unknown: 'Not an image'
};

/**
 * A binary file that once went through a text conversion (FTP in ASCII mode, a CMS re-encoding it as
 * UTF-8): every byte that was not valid text became EF BF BD, the "unknown character" mark. It has
 * NUL bytes like any binary file, plus many of those marks; real text and real binaries do not.
 */
function isMangled(b) {
  if (!b.includes(0)) return false;
  let marks = 0;
  for (let i = b.indexOf(0xef); i >= 0 && i < b.length - 2; i = b.indexOf(0xef, i + 1)) {
    if (b[i + 1] === 0xbf && b[i + 2] === 0xbd && ++marks >= 8) return true;
  }
  return false;
}

/** Classifies the first bytes of a file. */
export function sniffBytes(b) {
  if (!b || b.length === 0) return 'empty';
  if (isMangled(b)) return 'mangled';
  const hex = b.toString('hex', 0, 12);
  const asc = b.toString('latin1', 0, 16);
  if (hex.startsWith('ffd8ff')) return 'jpeg';
  if (hex.startsWith('89504e470d0a1a0a')) return 'png';
  if (asc.startsWith('GIF87a') || asc.startsWith('GIF89a')) return 'gif';
  if (asc.startsWith('RIFF') && asc.slice(8, 12) === 'WEBP') return 'webp';
  if (hex.startsWith('49492a00') || hex.startsWith('4d4d002a') || hex.startsWith('49492b00') || hex.startsWith('4d4d002b')) return 'tiff';
  if (asc.slice(4, 8) === 'ftyp' && /^(avif|avis|heic|heix|mif1|msf1)$/.test(asc.slice(8, 12))) return 'avif';
  if (asc.startsWith('8BPS')) return 'psd';
  if (hex.startsWith('00010000') || asc.startsWith('OTTO') || asc.startsWith('true') || asc.startsWith('typ1') ||
      asc.startsWith('wOFF') || asc.startsWith('wOF2') || asc.startsWith('ttcf')) return 'font';
  if (asc.startsWith('bplist')) return 'bplist';
  if (asc.startsWith('vti_')) return 'frontpage';
  if (b.every((x) => x === 0)) return 'zeros';
  const start = asc.replace(/^﻿|^\xEF\xBB\xBF/, '').trimStart().toLowerCase();
  if (start.startsWith('<!doctype html') || start.startsWith('<html') || start.startsWith('<?xml') || start.startsWith('<')) return 'html';
  // mostly printable ASCII → text
  let printable = 0;
  const n = Math.min(b.length, 512);
  for (let i = 0; i < n; i++) if ((b[i] >= 32 && b[i] < 127) || b[i] === 9 || b[i] === 10 || b[i] === 13) printable++;
  if (printable / n > 0.95) return 'text';
  return 'unknown';
}

/** Reads the first 4 KB of a file and classifies it. */
export async function sniffFile(filePath) {
  const fh = await fs.promises.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(HEAD_BYTES);
    const { bytesRead } = await fh.read(buf, 0, HEAD_BYTES, 0);
    return sniffBytes(buf.subarray(0, bytesRead));
  } finally {
    await fh.close();
  }
}
