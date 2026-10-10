import fs from 'fs';
import { createRequire } from 'module';

/**
 * One Ghostscript render, in its own child process (started by `ghostscript.js` with fork).
 * The engine installs process-wide error handlers, can call process.exit, and crashed the whole
 * dev server natively (0xC0000409) when run in a worker thread, so it never shares a process with
 * the server. Receives { filePath, dpi } over IPC, replies { png } or { error }, then exits.
 */

const require = createRequire(import.meta.url);

async function render(filePath, dpi) {
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
