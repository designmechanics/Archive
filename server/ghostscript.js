import fs from 'fs';
import { createRequire } from 'module';
import { fork } from 'child_process';
import { fileURLToPath } from 'url';

/**
 * Ghostscript module. It is used for exactly one job: drawing EPS files. Nothing else in the app
 * calls it.
 *
 * Ghostscript runs as WebAssembly (npm package @jspawn/ghostscript-wasm, AGPL-3.0). Nothing has to
 * be installed on the machine, and it never reaches the browser bundle.
 *
 * Every render runs in its own child process (`ghostscriptWorker.js`). In the server's own process
 * the engine added process-wide error handlers, leaked one engine per render, froze every request
 * while it ran and called process.exit() on bad files; in a worker thread it crashed the whole
 * dev server natively. A child that dies takes nothing with it. Max 2 at once, killed after
 * `timeoutMs`.
 */

const require = createRequire(import.meta.url);
const CHILD = fileURLToPath(new URL('./ghostscriptWorker.js', import.meta.url));
const MAX_RUNNING = 2;

let running = 0;
const waiting = [];

async function takeSlot() {
  if (running < MAX_RUNNING) {
    running++;
    return;
  }
  await new Promise((resolve) => waiting.push(resolve));
}

function giveSlot() {
  const next = waiting.shift();
  if (next) next(); // the slot passes straight to the next caller
  else running--;
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

function runChild(filePath, dpi, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = fork(CHILD, [], {
      serialization: 'advanced', // the PNG comes back as a Buffer, not JSON
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      execArgv: [],
      windowsHide: true
    });
    const timer = setTimeout(() => {
      reject(new Error('Ghostscript took too long'));
      child.kill();
    }, timeoutMs);
    child.once('message', (msg) => {
      clearTimeout(timer);
      if (msg && msg.png) resolve(Buffer.from(msg.png));
      else reject(new Error((msg && msg.error) || 'Ghostscript produced no image'));
    });
    child.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Ghostscript stopped (code ${code})`)); // no effect once settled
    });
    child.send({ filePath, dpi });
  });
}

/**
 * Renders page 1 of an EPS file to PNG, cropped to its bounding box.
 * Resolves to a Buffer. Rejects when the file is not an .eps, the engine is missing, it fails or
 * it runs longer than `timeoutMs`.
 */
export async function renderEpsToPng(
  filePath,
  { dpi = 144, maxBytes = 200 * 1024 * 1024, timeoutMs } = {}
) {
  if (!isEpsPath(filePath)) throw new Error('Ghostscript is only used for EPS files');
  if (!findGhostscript()) throw new Error('Ghostscript engine is not installed (run npm install)');
  const stat = await fs.promises.stat(filePath);
  if (stat.size > maxBytes) throw new Error('EPS file is too large to render');
  // big vector files with embedded images genuinely take a while: 30 s plus 8 s per MB, at most 2 min
  const limit = timeoutMs ?? Math.min(120000, 30000 + (stat.size / (1024 * 1024)) * 8000);

  await takeSlot();
  try {
    return await runChild(filePath, dpi, limit);
  } finally {
    giveSlot();
  }
}
