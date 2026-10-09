import * as pdfjsLib from 'pdfjs-dist';
import { api } from './api';
import { getPackBlob } from './db';
import { AssetEntry } from '../types';

// Configure PDF.js worker using static worker script in public folder
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerPort = null;
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  } catch (e) {
    console.warn('PDF.js worker initialization notice:', e);
  }
}

/**
 * Generates a high-quality JPEG snapshot (data URL) of the first page of a PDF.
 * @param data File, Blob, or ArrayBuffer containing the PDF binary
 * @param targetWidth Desired thumbnail width in pixels (default 420px)
 */
export async function generatePdfThumbnail(
  data: Blob | File | ArrayBuffer,
  targetWidth = 420
): Promise<string | null> {
  let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
  try {
    let arrayBuffer: ArrayBuffer;
    if (data instanceof Blob) {
      arrayBuffer = await data.arrayBuffer();
    } else {
      arrayBuffer = data;
    }

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      console.warn('PDF thumbnail generation: empty buffer received');
      return null;
    }

    if (typeof window !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerPort = null;
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }

    loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
      stopAtErrors: false
    });

    const pdfDoc = await loadingTask.promise;
    if (!pdfDoc || pdfDoc.numPages < 1) {
      console.warn('PDF thumbnail generation: zero pages in document');
      return null;
    }

    const page = await pdfDoc.getPage(1);
    const unscaledViewport = page.getViewport({ scale: 1.0 });

    const scale = Math.max(0.2, Math.min(3.0, targetWidth / (unscaledViewport.width || targetWidth)));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Fill clean white background (PDF pages can have transparent background)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const renderTask = page.render({
      canvasContext: ctx,
      canvas: canvas,
      viewport: viewport
    });
    await renderTask.promise;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    try {
      page.cleanup();
      await loadingTask.destroy();
    } catch {}

    return dataUrl;
  } catch (err) {
    console.error('Failed to generate PDF thumbnail:', err);
    if (loadingTask) {
      try {
        await loadingTask.destroy();
      } catch {}
    }
    return null;
  }
}

/**
 * Captures a video frame snapshot (JPEG data URL) from an MP4, WebM, or MOV video file.
 * Attaches temporarily to DOM to ensure hardware frame decode on Chromium/Firefox/Safari.
 */
export function generateVideoThumbnail(
  source: Blob | File | string,
  targetWidth = 420
): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      const isStringUrl = typeof source === 'string';
      const url = isStringUrl ? source : URL.createObjectURL(source);
      video.src = url;
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';

      // Keep hidden in DOM to ensure browser decodes frames properly
      video.style.position = 'fixed';
      video.style.left = '-9999px';
      video.style.top = '-9999px';
      video.style.width = '1px';
      video.style.height = '1px';
      video.style.opacity = '0';
      video.style.pointerEvents = 'none';

      if (typeof document !== 'undefined' && document.body) {
        document.body.appendChild(video);
      }

      let captured = false;

      const cleanup = () => {
        try {
          video.pause();
          video.src = '';
          video.load();
          if (video.parentNode) {
            video.parentNode.removeChild(video);
          }
          if (!isStringUrl) {
            URL.revokeObjectURL(url);
          }
        } catch {}
      };

      const captureFrame = () => {
        if (captured) return;
        try {
          const vw = video.videoWidth || 640;
          const vh = video.videoHeight || 360;
          if (vw <= 0 || vh <= 0) return;
          captured = true;
          const canvas = document.createElement('canvas');
          const scale = targetWidth / vw;
          canvas.width = targetWidth;
          canvas.height = Math.max(1, Math.round(vh * scale));
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
            cleanup();
            resolve(dataUrl);
            return;
          }
        } catch (e) {
          console.warn('Video frame capture to canvas failed:', e);
        }
        cleanup();
        resolve(null);
      };

      video.onloadeddata = () => {
        const duration = (video.duration && !isNaN(video.duration) && isFinite(video.duration)) ? video.duration : 1;
        const seekTime = Math.min(1.5, Math.max(0.05, duration * 0.15));
        try {
          video.currentTime = seekTime;
        } catch {}
        // Prompt decoder initialization
        video.play().then(() => video.pause()).catch(() => {});
      };

      video.onseeked = () => {
        captureFrame();
      };

      video.onerror = (e) => {
        console.warn('Video thumbnail generator error:', e);
        cleanup();
        resolve(null);
      };

      // Fallback: If seeked does not fire within 1.5s but data is ready, capture
      setTimeout(() => {
        if (!captured && video.readyState >= 2) {
          captureFrame();
        }
      }, 1500);

      // Hard timeout safety
      setTimeout(() => {
        if (!captured) {
          cleanup();
          resolve(null);
        }
      }, 4500);
    } catch (err) {
      console.warn('Video thumbnail generator exception:', err);
      resolve(null);
    }
  });
}

/**
 * Resizes an image file/blob to a standard thumbnail JPEG data URL
 */
export function generateImageThumbnail(
  fileOrBlob: Blob | File,
  targetWidth = 420
): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      const url = URL.createObjectURL(fileOrBlob);
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const scale = targetWidth / (img.width || targetWidth);
          canvas.width = targetWidth;
          canvas.height = Math.max(1, Math.round((img.height || targetWidth) * scale));
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
            URL.revokeObjectURL(url);
            resolve(dataUrl);
            return;
          }
        } catch {}
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Persists a generated thumbnail snapshot to the server's .thumbnails/ folder on disk
 * and updates SQLite archive.db so the thumbnail is referenced and cached permanently.
 */
export async function persistThumbnailToDisk(id: string, dataUrl: string): Promise<string | null> {
  try {
    return await api.saveThumbnail(id, dataUrl);
  } catch (err) {
    console.warn('Could not persist thumbnail to disk folder:', err);
    return null;
  }
}

const SERVER_THUMB_RE = /\.(jpe?g|png|gif|webp|avif|tiff?|ttf|otf|ttc|woff2?|psd|psb)$/i;

/**
 * Checks if an asset has a missing thumbnail and generates + persists one if possible.
 * Works with IndexedDB pack blobs and server disk files (/api/file).
 */
export async function ensureThumbnailForEntry(
  entry: AssetEntry,
  options: { skipServer?: boolean } = {}
): Promise<string | null> {
  if (entry.thumb && (entry.thumb.startsWith('/api/thumbnail/') || entry.thumb.startsWith('data:image/'))) {
    return entry.thumb;
  }

  try {
    // Fast path: the server thumbnails raster images itself, so the browser never downloads the
    // full-size file. Anything it cannot read falls through to the browser methods below.
    if (!options.skipServer && !entry.isZipInnerFile && entry.filePath && SERVER_THUMB_RE.test(entry.filePath)) {
      const serverUrl = await api.makeThumbnail(entry.id);
      if (serverUrl) return serverUrl;
    }

    // Formats with their own cheap preview readers: fonts, PSD, EPS/AI/INDD, camera RAW, TIFF.
    // Loaded on demand so their libraries stay out of the main bundle.
    const special = await import('./specialThumbnails');
    if (special.hasSpecialThumbnail(entry)) {
      const url = await special.specialThumbnail(entry);
      if (url) {
        const persistedUrl = await persistThumbnailToDisk(entry.id, url);
        return persistedUrl || url;
      }
      return null;
    }

    // 0. Inner ZIP file on disk via server streaming
    if (entry.isZipInnerFile && entry.filePath && entry.zipInnerPath) {
      const isVideo = /\.(mp4|webm|mov|mkv|m4v)$/i.test(entry.title || '') || entry.type === 'video' || (entry.exts && ['mp4', 'webm', 'mov'].some((x) => entry.exts.includes(x)));
      if (isVideo) {
        const streamUrl = `/api/file?path=${encodeURIComponent(entry.filePath)}&entry=${encodeURIComponent(entry.zipInnerPath)}`;
        const snapshotDataUrl = await generateVideoThumbnail(streamUrl);
        if (snapshotDataUrl) {
          const persistedUrl = await persistThumbnailToDisk(entry.id, snapshotDataUrl);
          return persistedUrl || snapshotDataUrl;
        }
      }
    }

    // 1. Obtain binary blob from IndexedDB packs or server /api/file
    let blob: Blob | null = null;
    const lookupId = entry.packId || entry.id;

    if (lookupId) {
      const stored = await getPackBlob(lookupId);
      if (stored?.blob) {
        blob = stored.blob;
      }
    }

    if (!blob) {
      try {
        const res = await fetch(`/api/file?id=${encodeURIComponent(entry.id)}`);
        if (res.ok) {
          blob = await res.blob();
        }
      } catch {}
    }

    if (!blob) return null;

    // 2. Identify file kind and generate snapshot
    const filename = (entry.title || '').toLowerCase();
    const isPdf = /\.pdf$/i.test(filename) || (entry.exts && entry.exts.includes('pdf')) || entry.type === 'file';
    const isVideo = /\.(mp4|webm|mov|mkv|m4v)$/i.test(filename) || entry.type === 'video' || (entry.exts && ['mp4', 'webm', 'mov'].some(x => entry.exts.includes(x)));
    const isImage = /\.(jpg|jpeg|png|webp|gif|avif|bmp)$/i.test(filename) || entry.type === 'photo';

    let snapshotDataUrl: string | null = null;

    if (isPdf && (filename.endsWith('.pdf') || (entry.exts && entry.exts.includes('pdf')))) {
      snapshotDataUrl = await generatePdfThumbnail(blob);
    } else if (isVideo) {
      snapshotDataUrl = await generateVideoThumbnail(blob);
    } else if (isImage) {
      snapshotDataUrl = await generateImageThumbnail(blob);
    }

    if (snapshotDataUrl) {
      const persistedUrl = await persistThumbnailToDisk(entry.id, snapshotDataUrl);
      return persistedUrl || snapshotDataUrl;
    }
  } catch (err) {
    console.warn(`Failed to generate thumbnail for asset ${entry.id}:`, err);
  }

  return null;
}
