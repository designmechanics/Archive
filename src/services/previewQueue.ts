import { AssetEntry } from '../types';
import { api } from './api';
import { ensureThumbnailForEntry } from './thumbnailService';

/**
 * Stage two of ingestion (client side): generates previews for indexed assets in the
 * background. It replaces the old one-at-a-time loops in App.tsx.
 *
 *  - raster images (jpg, png, gif, webp, avif, tiff) are thumbnailed by the server in batches,
 *    so the browser never downloads the full-size files
 *  - everything else (fonts, PSD, EPS/AI, RAW, PDF, video, BMP...) is rendered in the browser
 *  - finished thumbnails are handed back in batches (FLUSH_MS), never one state update each
 *  - previews that fail are remembered on the server (thumb_failed) so they are not retried
 *  - can be paused / resumed, and reports total / done / failed for the sidebar meter
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

const CONCURRENCY = 4; // tasks at once (a task is one browser render or one server batch)
const BATCH = 32; // images per server request
const FLUSH_MS = 1000;
const FAILED_FLUSH_COUNT = 100;
const PREVIEWABLE_RE =
  /\.(jpe?g|png|gif|webp|avif|bmp|pdf|mp4|webm|mov|m4v|ttf|otf|woff2?|pfb|psd|psb|eps|ai|indd|tiff?|cr2|nef|dng|arw|exe|dll|blend|glb|gltf|vrm|obj|stl|ply|fbx|dae|3mf)$|(^|[\\/])thumbs\.db$/i;
const PREVIEWABLE_EXTS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'pdf', 'mp4', 'webm', 'mov', 'm4v',
  'ttf', 'otf', 'woff', 'woff2', 'pfb', 'psd', 'psb', 'eps', 'ai', 'indd', 'tif', 'tiff', 'cr2', 'nef', 'dng', 'arw', 'exe', 'dll',
  'blend', 'glb', 'gltf', 'vrm', 'obj', 'stl', 'ply', 'fbx', 'dae', '3mf'
]);
const SERVER_THUMB_RE = /\.(jpe?g|png|gif|webp|avif|tiff?)$/i;

/** True when the browser can render a preview for this asset (image, pdf or playable video). */
export function isPreviewable(e: AssetEntry): boolean {
  if (e.isZipInnerFile) return false;
  if (e.filePath) return PREVIEWABLE_RE.test(e.filePath);
  return Array.isArray(e.exts) && e.exts.some((x) => PREVIEWABLE_EXTS.has(x));
}

const serverThumbable = (e: AssetEntry): boolean => Boolean(e.filePath && SERVER_THUMB_RE.test(e.filePath));

class PreviewQueue {
  private queue: AssetEntry[] = [];
  private cursor = 0;
  private known = new Set<string>();
  private active = 0;
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
      this.queue.push(e);
      added++;
    }
    if (added === 0) return;

    if (!this.status.running) {
      // Starting a fresh batch: reset the counters so the meter reads 0 / N
      this.queue = this.queue.slice(this.cursor);
      this.cursor = 0;
      this.status = { ...this.status, total: this.queue.length, done: 0, failed: 0 };
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
    while (this.active < CONCURRENCY && this.cursor < this.queue.length) {
      if (!this.status.running) this.status = { ...this.status, running: true };
      const first = this.queue[this.cursor++];
      this.active++;
      if (serverThumbable(first)) {
        const batch = [first];
        while (batch.length < BATCH && this.cursor < this.queue.length && serverThumbable(this.queue[this.cursor])) {
          batch.push(this.queue[this.cursor++]);
        }
        void this.runServerBatch(batch);
      } else {
        void this.runBrowser(first);
      }
    }
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
    // The server could not read these (BMP-like quirks, corrupt files): try the browser
    for (const e of leftovers) {
      let url: string | null = null;
      try {
        url = await ensureThumbnailForEntry(e, { skipServer: true });
      } catch {
        url = null;
      }
      this.record(e.id, url);
    }
    this.finishTask();
  }

  private async runBrowser(item: AssetEntry) {
    this.status.current = item.title;
    let url: string | null = null;
    try {
      url = await ensureThumbnailForEntry(item);
    } catch {
      url = null;
    }
    this.record(item.id, url);
    this.finishTask();
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

  private finishTask() {
    this.active--;
    this.scheduleFlush();
    this.notifySoon();

    if (this.cursor >= this.queue.length && this.active === 0) {
      this.queue = [];
      this.cursor = 0;
      this.status = { ...this.status, running: false, current: '' };
      this.flush();
      this.notifySoon();
    } else {
      this.pump();
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
    }, 250);
  }
}

export const previewQueue = new PreviewQueue();
