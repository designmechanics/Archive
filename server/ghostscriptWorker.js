import fs from 'fs';
import { createRequire } from 'module';

/**
 * One Ghostscript render, in its own child process (started by `ghostscript.js` with fork).
 * The engine installs process-wide error handlers, can call process.exit, and crashed the whole
 * dev server natively (0xC0000409) when run in a worker thread, so it never shares a process with
 * the server. Receives { filePath, dpi } over IPC, replies { png } or { error }, then exits.
 */

const require = createRequire(import.meta.url);

// When the normal run gives nothing, two more tries on a page the size of the file's bounding box:
//  1. with a `showpage` appended: some generators (QR-code tools, for one) never call it;
//  2. also skipping instructions that fail: old Illustrator files can stop on a gradient the file
//     uses before defining it (`/undefined in /_gradNames`) or one Ghostscript's maths rejects
//     (`undefinedresult in shfill`); skipping one error leads to the next, so every error handler
//     (except the ones that stop a runaway job) becomes "drop it and carry on". The rest of the
//     picture is still worth showing; the 30 s+ limit stops anything that loops.
// These handlers cannot be installed for the normal run: Ghostscript's own EPS setup relies on them.
const LENIENT =
  '[ errordict { pop } forall ] { dup /handleerror eq 1 index /interrupt eq or 1 index /timeout eq or ' +
  '{ pop } { errordict exch {pop} put } ifelse } forall';

async function render(filePath, dpi) {
  const out = await renderOnce(filePath, dpi, null);
  if (out) return out;
  const box = boundingBox(filePath);
  if (!box) return null;
  return (await renderOnce(filePath, dpi, { box })) || renderOnce(filePath, dpi, { box, lenient: true });
}

/** [llx, lly, urx, ury] from %%BoundingBox (plain or DOS-binary EPS), or null. */
function boundingBox(filePath) {
  const b = fs.readFileSync(filePath);
  const start = b.length > 30 && b.readUInt32LE(0) === 0xc6d3d0c5 ? b.readUInt32LE(4) : 0; // DOS EPS header
  const m = /%%BoundingBox:\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/.exec(b.subarray(start, start + 65536).toString('latin1'));
  const box = m ? m.slice(1).map(Number) : null;
  return box && box[2] > box[0] && box[3] > box[1] ? box : null;
}

async function renderOnce(filePath, dpi, retry) {
  const showpageBox = retry?.box;
  const factory = require('@jspawn/ghostscript-wasm');
  const wasm = fs.readFileSync(require.resolve('@jspawn/ghostscript-wasm/gs.wasm'));
  const gs = await factory({
    noInitialRun: true,
    print: () => {},
    printErr: () => {},
    // The package's own loader fetches gs.wasm over the network; hand it the bytes instead
    instantiateWasm(imports, done) {
      WebAssembly.instantiate(wasm, imports).then((r) => done(r.instance));
      return {};
    }
  });
  gs.FS.writeFile('/in.eps', fs.readFileSync(filePath));
  const [llx, lly, urx, ury] = showpageBox || [];
  try {
    gs.callMain([
      '-dSAFER', // no file writes or shell access from inside the PostScript
      '-dBATCH',
      '-dNOPAUSE',
      '-dQUIET',
      ...(showpageBox ? [] : ['-dEPSCrop']),
      '-dTextAlphaBits=4',
      '-dGraphicsAlphaBits=4',
      '-sDEVICE=png16m',
      `-r${dpi}`,
      '-dFirstPage=1',
      '-dLastPage=1',
      '-sOutputFile=/out.png',
      ...(showpageBox
        ? [
            '-c',
            `<< /PageSize [${urx - llx} ${ury - lly}] >> setpagedevice ${-llx} ${-lly} translate ${retry.lenient ? LENIENT : ''}`,
            '-f',
            '/in.eps',
            '-c',
            'showpage'
          ]
        : ['/in.eps'])
    ]);
  } catch {
    // Emscripten throws on exit; the output file tells us whether it worked
  }
  try {
    return gs.FS.readFile('/out.png');
  } catch {
    return null;
  }
}

process.once('message', async ({ filePath, dpi }) => {
  let reply;
  try {
    const out = await render(filePath, dpi);
    reply = out && out.length > 8 ? { png: Buffer.from(out) } : { error: 'Ghostscript produced no image' };
  } catch (err) {
    reply = { error: err?.message || String(err) };
  }
  process.send(reply, () => process.exit(0));
});
