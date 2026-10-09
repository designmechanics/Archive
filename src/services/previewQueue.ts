import { AssetEntry } from '../types';
import { api } from './api';
import { ensureThumbnailForEntry } from './thumbnailService';

/**
 * Stage two of ingestion (client side): generates previews for indexed assets in the background.
 *
 *  - Raster images, fonts and PSD files are thumbnailed by the server in batches (nothing heavy
 *    runs in the page, nothing large is downloaded).
 *  - Everything else (PDF, video, EPS/AI, RAW, TIFF, BMP, programs, 3D...) is rendered in the
 *    browser, ONE at a time, and only while the user is not interacting, so scrolling and clicking
 *    stay smooth. This is what used to pin the page at about 1 frame per second.
 *  - Finished thumbnails are handed back in batches (FLUSH_MS), never one state update each.
 *  - Previews that fail are remembered on the server (thumb_failed) so they are not retried.
 *  - Can be paused / resumed, and reports total / done / failed for the sidebar meter.
 */

export interface PreviewQueueStatus {
  total: number;
  done: number;
  failed: number;
  running: boolean;
  paused: boolean;
  current: string;
}

type StatusListener = (s: PreviewQueueStatus) => void;
type Applier = (thumbs: Map<string, string>) => void;

const SERVER_TASKS = 3; // server batches in flight
const BATCH = 32; // images per server request
const FLUSH_MS = 1000;
const FAILED_FLUSH_COUNT = 100;
const IDLE_AFTER_INPUT_MS = 1500; // browser-side work waits this long after the last mouse/key/scroll
const BROWSER_GAP_MS = 150; // breathing room between browser-side previews

const PREVIEWABLE_RE =
  /\.(jpe?g|png|gif|webp|avif|bmp|pdf|mp4|webm|mov|m4v|ttf|otf|ttc|woff2?|pfb|psd|psb|eps|ai|indd|tiff?|cr2|nef|dng|arw|exe|dll|blend|glb|gltf|vrm|obj|stl|ply|fbx|dae|3mf)$|(^|[\\/])thumbs\.db$/i;
const PREVIEWABLE_EXTS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'pdf', 'mp4', 'webm', 'mov', 'm4v',
  'ttf', 'otf', 'ttc', 'woff', 'woff2', 'pfb', 'psd', 'psb', 'eps', 'ai', 'indd', 'tif', 'tiff', 'cr2', 'nef', 'dng', 'arw', 'exe', 'dll',
  'blend', 'glb', 'gltf', 'vrm', 'obj', 'stl', 'ply', 'fbx', 'dae', '3mf'
]);
// Types the server can make itself (see server/thumbMaker.js)
const SERVER_THUMB_RE = /\.(jpe?g|png|gif|webp|avif|tiff?|ttf|otf|ttc|woff2?|psd|psb)$/i;

/** True when the browser can render a preview for this asset (image, pdf or playable video). */
export function isPreviewable(e: AssetEntry): boolean {
  if (e.isZipInnerFile) return false;
  if (e.filePath) return PREVIEWABLE_RE.test(e.filePath);
  return Array.isArray(e.exts) && e.exts.some((x) => PREVIEWABLE_EXTS.has(x));
}

const serverThumbable = (e: AssetEntry): boolean => Boolean(e.filePath && SERVER_THUMB_RE.test(e.filePath));

// Last time the user did something; browser-side previews wait while the user is busy
let lastInput = 0;
if (typeof window !== 'undefined') {
  const mark = () => {
    lastInput = performance.now();
  };
  for (const ev of ['pointermove', 'pointerdown', 'wheel', 'keydown', 'scroll', 'touchstart']) {
    window.addEventListener(ev, mark, { passive: true, capture: true });
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function waitForQuiet() {
  while (performance.now() - lastInput < IDLE_AFTER_INPUT_MS) await sleep(250);
  await new Promise<void>((r) => {
    const ric = (window as any).requestIdleCallback;
    if (ric) ric(() => r(), { timeout: 600 });
    else setTimeout(r, 60);
  });
}

class PreviewQueue {
  private serverQueue: AssetEntry[] = [];
  private serverCursor = 0;
  private browserQueue: AssetEntry[] = [];
  private browserCursor = 0;
  private known = new Set<string>();
  private serverActive = 0;
  private browserActive = false;
  private status: PreviewQueueStatus = {
    total: 0,
    done: 0,
    failed: 0,
    running: false,
    paused: false,
    current: ''
  };
  private listeners = new Set<StatusListener>();
  private applier: Applier | null = null;
  private pendingThumbs = new Map<string, string>();
  private pendingFailed: string[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private notifyTimer: ReturnType<typeof setTimeout> | null = null;

  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  /** Receives batches of finished thumbnails (id -> url). */
  setApplier(fn: Applier) {
    this.applier = fn;
  }

  getStatus() {
    return this.status;
  }

  /** Adds assets that still need a preview. Safe to call with the whole library. */
  enqueue(entries: AssetEntry[]) {
    let added = 0;
    for (const e of entries) {
      if (e.thumb || e.thumbFailed || this.known.has(e.id) || !isPreviewable(e)) continue;
      this.known.add(e.id);
      (serverThumbable(e) ? this.serverQueue : this.browserQueue).push(e);
      added++;
    }
    if (added === 0) return;

    if (!this.status.running) {
      // Starting a fresh batch: reset the counters so the meter reads 0 / N
      this.serverQueue = this.serverQueue.slice(this.serverCursor);
      this.browserQueue = this.browserQueue.slice(this.browserCursor);
      this.serverCursor = 0;
      this.browserCursor = 0;
      this.status = { ...this.status, total: this.serverQueue.length + this.browserQueue.length, done: 0, failed: 0 };
    } else {
      this.status = { ...this.status, total: this.status.total + added };
    }
    this.notifySoon();
    this.pump();
  }

  pause() {
    this.status = { ...this.status, paused: true };
    this.notifySoon();
  }

  resume() {
    this.status = { ...this.status, paused: false };
    this.notifySoon();
    this.pump();
  }

  private pump() {
    if (this.status.paused) return;

    while (this.serverActive < SERVER_TASKS && this.serverCursor < this.serverQueue.length) {
      this.markRunning();
      const batch = this.serverQueue.slice(this.serverCursor, this.serverCursor + BATCH);
      this.serverCursor += batch.length;
      this.serverActive++;
      void this.runServerBatch(batch);
    }

    if (!this.browserActive && this.browserCursor < this.browserQueue.length) {
      this.markRunning();
      this.browserActive = true;
      void this.runBrowserLoop();
    }
  }

  private markRunning() {
    if (!this.status.running) this.status = { ...this.status, running: true };
  }

  /** One request makes a whole batch of thumbnails on the server. */
  private async runServerBatch(batch: AssetEntry[]) {
    this.status.current = batch[0].title;
    let made: Record<string, string | null> = {};
    try {
      made = await api.makeThumbnails(batch.map((e) => e.id));
    } catch {
      made = {};
    }
    const leftovers: AssetEntry[] = [];
    for (const e of batch) {
      const url = made[e.id];
      if (url) this.record(e.id, url);
      else leftovers.push(e);
    }
    // The server could not read these (corrupt, odd formats): the browser gets one try, politely
    for (const e of leftovers) this.browserQueue.push(e);

    this.serverActive--;
    this.afterWork();
    this.pump();
  }

  /** Browser-side previews, strictly one at a time and only while the user is not busy. */
  private async runBrowserLoop() {
    while (this.browserCursor < this.browserQueue.length && !this.status.paused) {
      await waitForQuiet();
      if (this.status.paused) break;
      const item = this.browserQueue[this.browserCursor++];
      this.status.current = item.title;
      let url: string | null = null;
      try {
        url = await ensureThumbnailForEntry(item, { skipServer: serverThumbable(item) });
      } catch {
        url = null;
      }
      this.record(item.id, url);
      this.scheduleFlush();
      this.notifySoon();
      await sleep(BROWSER_GAP_MS);
    }
    this.browserActive = false;
    this.afterWork();
    this.pump();
  }

  private record(id: string, url: string | null) {
    if (url) {
      this.pendingThumbs.set(id, url);
      this.status = { ...this.status, done: this.status.done + 1 };
    } else {
      this.pendingFailed.push(id);
      this.status = { ...this.status, done: this.status.done + 1, failed: this.status.failed + 1 };
    }
  }

  private afterWork() {
    this.scheduleFlush();
    this.notifySoon();
    const finished =
      this.serverCursor >= this.serverQueue.length &&
      this.browserCursor >= this.browserQueue.length &&
      this.serverActive === 0 &&
      !this.browserActive;
    if (finished) {
      this.serverQueue = [];
      this.browserQueue = [];
      this.serverCursor = 0;
      this.browserCursor = 0;
      this.status = { ...this.status, running: false, current: '' };
      this.flush();
      this.notifySoon();
    }
  }

  private scheduleFlush() {
    if (this.pendingFailed.length >= FAILED_FLUSH_COUNT) {
      this.flushFailed();
    }
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, FLUSH_MS);
  }

  private flush() {
    if (this.pendingThumbs.size > 0 && this.applier) {
      const batch = this.pendingThumbs;
      this.pendingThumbs = new Map();
      this.applier(batch);
    }
    this.flushFailed();
  }

  private flushFailed() {
    if (this.pendingFailed.length === 0) return;
    const ids = this.pendingFailed;
    this.pendingFailed = [];
    void api.markThumbsFailed(ids);
  }

  private notifySoon() {
    if (this.notifyTimer) return;
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null;
      this.listeners.forEach((fn) => fn(this.status));
    }, 400);
  }
}

export const previewQueue = new PreviewQueue();
