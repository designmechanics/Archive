import os from 'os';
import { fork } from 'child_process';
import { fileURLToPath } from 'url';

/**
 * Runs server-side thumbnails (`thumbMaker.js`) in a few child processes (`thumbWorker.js`).
 * The image engine is synchronous WebAssembly and must not hold up the server.
 *
 *  - A process that dies or hangs only affects its own jobs: they are retried once in a fresh
 *    process, then reported as failed.
 *  - Each process is retired after RECYCLE_AFTER jobs. A wasm-vips instance runs out of memory
 *    after a few thousand images ("failed to allocate … Aborted()") and is useless afterwards.
 *  - Idle processes exit after a minute.
 */

const CHILD = fileURLToPath(new URL('./thumbWorker.js', import.meta.url));
const PROCESSES = Math.max(1, Math.min(4, Math.floor(os.cpus().length / 2)));
const RECYCLE_AFTER = 500;
const JOB_TIMEOUT_MS = 60000;
const IDLE_MS = 60000;

const procs = new Set();
let nextJob = 1;

function start() {
  const proc = {
    child: fork(CHILD, [], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], execArgv: [], windowsHide: true }),
    jobs: new Map(),
    sent: 0,
    retiring: false,
    idleTimer: null
  };
  procs.add(proc);
  proc.child.on('message', (msg) => {
    const j = proc.jobs.get(msg.job);
    if (!j) return;
    proc.jobs.delete(msg.job);
    clearTimeout(j.timer);
    if (msg.error) j.reject(Object.assign(new Error(msg.error), { note: msg.note }));
    else j.resolve(msg.result);
    if (!proc.jobs.size) {
      if (proc.retiring) proc.child.disconnect(); // the child exits on disconnect
      else armIdle(proc);
    }
  });
  proc.child.on('error', () => {}); // 'exit' follows
  proc.child.on('exit', () => {
    procs.delete(proc);
    clearTimeout(proc.idleTimer);
    const lost = [...proc.jobs.values()];
    proc.jobs.clear();
    for (const j of lost) {
      clearTimeout(j.timer);
      if (j.tries < 2) send(j);
      else j.reject(new Error('the thumbnail process stopped on this file'));
    }
  });
  return proc;
}

function armIdle(proc) {
  clearTimeout(proc.idleTimer);
  proc.idleTimer = setTimeout(() => {
    if (!proc.jobs.size && proc.child.connected) proc.child.disconnect();
  }, IDLE_MS);
  proc.idleTimer.unref();
}

/** Least busy working process; a new one while there is room and all are busy. */
function pick() {
  const working = [...procs].filter((p) => !p.retiring && p.child.connected);
  const best = working.reduce((a, b) => (!a || b.jobs.size < a.jobs.size ? b : a), null);
  if (!best || (best.jobs.size > 0 && working.length < PROCESSES)) return start();
  return best;
}

function send(j) {
  const proc = pick();
  clearTimeout(proc.idleTimer);
  j.tries++;
  const job = nextJob++;
  proc.jobs.set(job, j);
  if (++proc.sent >= RECYCLE_AFTER) proc.retiring = true; // finishes what it has, then exits
  j.timer = setTimeout(() => proc.child.kill(), JOB_TIMEOUT_MS); // its other jobs are retried
  proc.child.send({ job, task: j.task, input: j.input, output: j.output, maxSide: j.maxSide });
}

/**
 * Writes a JPEG thumbnail of `input` to `output` in a thumbnail process. Rejects if it cannot be
 * made; the error's `note` (when set) is a short reason for the grid, e.g. "Empty file".
 */
export function makeThumbnailInProcess(input, output) {
  return new Promise((resolve, reject) => send({ input, output, resolve, reject, tries: 0, timer: null }));
}

/**
 * Writes a large JPEG preview of a PSD (longest side `maxSide`) for the viewer. Resolves to
 * 'merged' (the full merged image) or 'stored' (only Photoshop's small stored preview).
 */
export function renderPsdPreviewInProcess(input, output, maxSide) {
  return new Promise((resolve, reject) =>
    send({ task: 'psd-preview', input, output, maxSide, resolve, reject, tries: 0, timer: null })
  );
}
