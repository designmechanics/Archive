import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

/**
 * Ghostscript module. It is used for exactly one job: drawing EPS files that carry no preview
 * picture of their own. Nothing else in the app calls it.
 *
 * Ghostscript is an external program and is never bundled (its licence is AGPL). It is found on
 * its own: the GHOSTSCRIPT_PATH environment variable, the usual install folders, then PATH. When it
 * is not installed every function here reports that cleanly and the EPS viewer falls back to the
 * file's header details and source.
 */

let gsPath;

/** Path to the Ghostscript console executable, or null when it is not installed. */
export function findGhostscript() {
  if (gsPath !== undefined) return gsPath;
  const candidates = [process.env.GHOSTSCRIPT_PATH].filter(Boolean);
  for (const base of ['C:\\Program Files\\gs', 'C:\\Program Files (x86)\\gs']) {
    try {
      for (const dir of fs.readdirSync(base).sort().reverse()) {
        candidates.push(path.join(base, dir, 'bin', 'gswin64c.exe'));
        candidates.push(path.join(base, dir, 'bin', 'gswin32c.exe'));
      }
    } catch {
      // folder not present
    }
  }
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      gsPath = c;
      return gsPath;
    }
  }
  gsPath = null;
  return null;
}

export function isEpsPath(filePath) {
  return /\.eps$/i.test(filePath || '');
}

/**
 * Renders page 1 of an EPS file to PNG, cropped to its bounding box.
 * Resolves to a Buffer. Rejects when the file is not an .eps, Ghostscript is missing, or it fails.
 */
export function renderEpsToPng(filePath, { dpi = 144, timeoutMs = 30000 } = {}) {
  if (!isEpsPath(filePath)) return Promise.reject(new Error('Ghostscript is only used for EPS files'));
  const exe = findGhostscript();
  if (!exe) return Promise.reject(new Error('Ghostscript is not installed'));

  return new Promise((resolve, reject) => {
    const args = [
      '-dSAFER', // no file writes or shell access from inside the PostScript
      '-dBATCH',
      '-dNOPAUSE',
      '-dQUIET',
      '-dEPSCrop',
      '-dTextAlphaBits=4',
      '-dGraphicsAlphaBits=4',
      '-sDEVICE=png16m',
      `-r${dpi}`,
      '-dFirstPage=1',
      '-dLastPage=1',
      '-sOutputFile=-',
      filePath
    ];
    const child = spawn(exe, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const out = [];
    let size = 0;
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on('data', (d) => {
      size += d.length;
      if (size > 64 * 1024 * 1024) child.kill();
      else out.push(d);
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', () => {
      clearTimeout(timer);
      const buf = Buffer.concat(out);
      if (buf.length > 8) resolve(buf);
      else reject(new Error('Ghostscript produced no image'));
    });
  });
}
