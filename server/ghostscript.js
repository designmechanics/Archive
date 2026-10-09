import fs from 'fs';
import { createRequire } from 'module';

/**
 * Ghostscript module. It is used for exactly one job: drawing EPS files that carry no preview
 * picture of their own. Nothing else in the app calls it.
 *
 * Ghostscript runs as WebAssembly (npm package @jspawn/ghostscript-wasm, AGPL-3.0). Nothing has to
 * be installed on the machine. The ~16 MB engine is loaded on the first EPS that needs it, inside
 * this server process only: it never reaches the browser bundle. Each render gets a fresh engine
 * instance so a broken file cannot poison the next one.
 */

const require = createRequire(import.meta.url);
let wasmCache;

// The package's own loader fetches gs.wasm over the network; in Node we hand it the bytes instead.
function createEngine() {
  const factory = require('@jspawn/ghostscript-wasm');
  if (!wasmCache) wasmCache = fs.readFileSync(require.resolve('@jspawn/ghostscript-wasm/gs.wasm'));
  return factory({
    noInitialRun: true,
    print: () => {},
    printErr: () => {},
    instantiateWasm(imports, done) {
      WebAssembly.instantiate(wasmCache, imports).then((r) => done(r.instance));
      return {};
    }
  });
}

/** True when the bundled engine is present (it is an ordinary npm dependency). */
export function findGhostscript() {
  try {
    require.resolve('@jspawn/ghostscript-wasm/package.json');
    return 'ghostscript-wasm';
  } catch {
    return null;
  }
}

export function isEpsPath(filePath) {
  return /\.eps$/i.test(filePath || '');
}

/**
 * Renders page 1 of an EPS file to PNG, cropped to its bounding box.
 * Resolves to a Buffer. Rejects when the file is not an .eps, the engine is missing, or it fails.
 */
export async function renderEpsToPng(filePath, { dpi = 144, maxBytes = 200 * 1024 * 1024 } = {}) {
  if (!isEpsPath(filePath)) throw new Error('Ghostscript is only used for EPS files');
  if (!findGhostscript()) throw new Error('Ghostscript engine is not installed (run npm install)');
  const stat = fs.statSync(filePath);
  if (stat.size > maxBytes) throw new Error('EPS file is too large to render');

  const gs = await createEngine();
  gs.FS.writeFile('/in.eps', fs.readFileSync(filePath));
  try {
    gs.callMain([
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
      '-sOutputFile=/out.png',
      '/in.eps'
    ]);
  } catch {
    // Emscripten throws on exit; the output file tells us whether it worked
  }
  let out;
  try {
    out = gs.FS.readFile('/out.png');
  } catch {
    out = null;
  }
  if (!out || out.length < 8) throw new Error('Ghostscript produced no image');
  return Buffer.from(out);
}
