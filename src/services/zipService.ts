import { BlobReader, ZipReader, TextWriter, Data64URIWriter, BlobWriter } from '@zip.js/zip.js';
import JSZip from 'jszip';
import { AssetEntry, ZipFileInfo, ZipPack } from '../types';
import { extOf, fmtSize, isIn, MIME, typeFromExt, EXT } from '../data/seedData';
import { savePackBlob, getPackBlob } from './db';
import { generatePdfThumbnail, generateVideoThumbnail, persistThumbnailToDisk } from './thumbnailService';
import { api } from './api';

// Archives other than zip that open in the browser (archivePack.ts, loaded only when needed)
const BROWSER_ARCHIVE_RE = /\.(rar|7z|tar|tgz|tbz2?|txz|gz|bz2|xz|iso|cab)$/i;

// Cache for active pack objects in memory
const packRegistry: Record<string, ZipPack> = {};

export function registerPack(id: string, pack: ZipPack) {
  packRegistry[id] = pack;
}

export function getPack(id: string): ZipPack | null {
  return packRegistry[id] || null;
}

export async function restorePackFromDB(id: string): Promise<ZipPack | null> {
  if (packRegistry[id]) return packRegistry[id];
  const stored = await getPackBlob(id);
  if (!stored) return null;
  const { pack } = await packFromFile(new File([stored.blob], stored.name));
  packRegistry[id] = pack;
  return pack;
}

/**
 * A pack for a file loaded in the browser: zip (zip.js), other archives (libarchive.js, loaded on
 * demand), anything else as a single file. `isArchive` is false when an archive could not be read,
 * so it is still kept, as one item.
 */
export async function packFromFile(file: File): Promise<{ pack: ZipPack; isArchive: boolean }> {
  if (/\.zip$/i.test(file.name) || /zip/.test(file.type || '')) {
    return { pack: await createPackFromBlob(file.name, file), isArchive: true };
  }
  if (BROWSER_ARCHIVE_RE.test(file.name)) {
    try {
      const { createPackFromArchive } = await import('./archivePack');
      return { pack: await createPackFromArchive(file.name, file), isArchive: true };
    } catch (err) {
      console.warn('Archive could not be opened, kept as one file:', file.name, err);
    }
  }
  return { pack: createPackFromSingleFile(file), isArchive: false };
}

/**
 * Creates a ZipPack from a File or Blob using @zip.js/zip.js
 * utilizing BlobReader for true byte-range / central directory reading.
 */
export async function createPackFromBlob(name: string, blob: Blob): Promise<ZipPack> {
  try {
    const reader = new ZipReader(new BlobReader(blob));
    const entries = await reader.getEntries();
    
    // Map entries, filtering out metadata and directories
    const fileEntries = entries.filter(
      (e) => !e.directory && !/(^|\/)__MACOSX\/|(^|\/)\.DS_Store$/i.test(e.filename)
    );

    const list: ZipFileInfo[] = fileEntries.map((e) => ({
      path: e.filename,
      size: e.uncompressedSize || 0
    }));

    const entryMap = new Map<string, any>();
    fileEntries.forEach((e) => {
      entryMap.set(e.filename, e);
    });

    const pack: ZipPack = {
      name,
      size: blob.size,
      list,
      rawBlob: blob,
      has(p: string) {
        return entryMap.has(p);
      },
      async text(p: string) {
        const ent = entryMap.get(p);
        if (!ent || !ent.getData) return '';
        return await ent.getData(new TextWriter());
      },
      async b64(p: string) {
        const ent = entryMap.get(p);
        if (!ent || !ent.getData) return '';
        const dataUri = await ent.getData(new Data64URIWriter());
        return dataUri.split(',')[1] || '';
      },
      async blob(p: string) {
        const ent = entryMap.get(p);
        if (!ent || !ent.getData) return new Blob();
        return await ent.getData(new BlobWriter());
      }
    };

    return pack;
  } catch (err) {
    console.warn('ZipReader with @zip.js failed, trying JSZip fallback:', err);
    // Fallback to JSZip
    const z = await JSZip.loadAsync(blob);
    const list: ZipFileInfo[] = [];
    z.forEach((p, f) => {
      if (f.dir || /(^|\/)__MACOSX\/|(^|\/)\.DS_Store$/i.test(p)) return;
      // @ts-ignore
      list.push({ path: p, size: (f._data && f._data.uncompressedSize) || 0 });
    });

    return {
      name,
      size: blob.size,
      list,
      rawBlob: blob,
      has(p: string) {
        return !!z.file(p);
      },
      async text(p: string) {
        const f = z.file(p);
        return f ? await f.async('string') : '';
      },
      async b64(p: string) {
        const f = z.file(p);
        return f ? await f.async('base64') : '';
      },
      async blob(p: string) {
        const f = z.file(p);
        return f ? await f.async('blob') : new Blob();
      }
    };
  }
}

export function createPackFromSingleFile(file: File): ZipPack {
  const n = file.name;
  return {
    name: n,
    size: file.size,
    list: [{ path: n, size: file.size }],
    rawBlob: file,
    has(q: string) {
      return q === n;
    },
    async text() {
      return await file.text();
    },
    async b64() {
      return new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => {
          resolve(String(r.result).split(',')[1] || '');
        };
        r.onerror = reject;
        r.readAsDataURL(file);
      });
    },
    async blob() {
      return file;
    }
  };
}

let uidCounter = 0;

export async function createEntryFromPack(pack: ZipPack, isZip: boolean): Promise<AssetEntry> {
  const id = 'pkg_' + Date.now() + '_' + ++uidCounter;
  registerPack(id, pack);

  if (pack.rawBlob) {
    // Persist blob to IndexedDB
    try {
      await savePackBlob(id, pack.name, pack.size, pack.rawBlob, pack.list);
    } catch (e) {
      console.warn('Failed to persist pack blob to IndexedDB', e);
    }
  }

  const list = pack.list;
  const exts: Record<string, number> = {};
  list.forEach((f) => {
    const x = extOf(f.path);
    if (x) exts[x] = (exts[x] || 0) + 1;
  });

  const topExts = Object.keys(exts).sort((a, b) => exts[b] - exts[a]);
  const has = (k: keyof typeof EXT) => list.some((f) => isIn(k, f.path));

  let cat = 'Experiments';
  if (exts.html || exts.htm) cat = 'Experiments';
  else if (has('font')) cat = 'Typography';
  else if (has('vid')) cat = 'Transitions';
  else if (exts.css || exts.js) cat = 'Routines/utils';
  else if (has('img')) cat = 'Backgrounds';
  else if (extOf(pack.name) === 'pdf' || exts.pdf) cat = 'Layouts';

  const names = list.map((f) => f.path.toLowerCase()).join(' ');
  const deps = [
    'gsap',
    'three',
    'jquery',
    'p5',
    'matter',
    'pixi',
    'anime',
    'lottie',
    'swiper',
    'splitting'
  ]
    .filter((d) => names.indexOf(d) >= 0)
    .join(' · ');

  // Extract thumbnail image if present (<3MB)
  const imgFile = list
    .filter((f) => isIn('img', f.path) && f.size < 3_000_000)
    .sort((a, b) => b.size - a.size)[0];

  let thumb: string | null = null;
  if (imgFile) {
    try {
      const b64 = await pack.b64(imgFile.path);
      thumb = dataUrl(extOf(imgFile.path), b64);
    } catch (e) {
      console.warn('Thumbnail generation failed:', e);
    }
  }

  // If no image thumbnail and this is a PDF or contains a PDF, generate 1st page snapshot
  if (!thumb) {
    const isSinglePdf = extOf(pack.name) === 'pdf';
    const pdfFile = isSinglePdf
      ? null
      : list.find((f) => extOf(f.path) === 'pdf' && f.size < 60_000_000);

    if (isSinglePdf) {
      try {
        const blob = pack.rawBlob || (typeof pack.blob === 'function' ? await pack.blob(pack.name) : null);
        if (blob) {
          thumb = await generatePdfThumbnail(blob);
        }
      } catch (e) {
        console.warn('PDF thumbnail generation failed for single file:', e);
      }
    } else if (pdfFile && typeof pack.blob === 'function') {
      try {
        const blob = await pack.blob(pdfFile.path);
        if (blob) {
          thumb = await generatePdfThumbnail(blob);
        }
      } catch (e) {
        console.warn('PDF thumbnail generation failed for pack entry:', e);
      }
    }
  }

  // If no thumbnail yet and this is a video or contains a video, generate video frame snapshot
  if (!thumb) {
    const isSingleVid = isIn('vid', pack.name);
    const vidFile = isSingleVid
      ? null
      : list.find((f) => isIn('vid', f.path) && f.size < 100_000_000);

    if (isSingleVid) {
      try {
        const blob = pack.rawBlob || (typeof pack.blob === 'function' ? await pack.blob(pack.name) : null);
        if (blob) {
          thumb = await generateVideoThumbnail(blob);
        }
      } catch (e) {
        console.warn('Video thumbnail generation failed for single file:', e);
      }
    } else if (vidFile && typeof pack.blob === 'function') {
      try {
        const blob = await pack.blob(vidFile.path);
        if (blob) {
          thumb = await generateVideoThumbnail(blob);
        }
      } catch (e) {
        console.warn('Video thumbnail generation failed for pack entry:', e);
      }
    }
  }

  // Persist thumbnail to local .thumbnails folder on disk and reference in SQLite
  if (thumb && thumb.startsWith('data:')) {
    try {
      const persistedUrl = await persistThumbnailToDisk(id, thumb);
      if (persistedUrl) {
        thumb = persistedUrl;
      }
    } catch (e) {
      console.warn('Could not persist thumbnail to disk:', e);
    }
  }

  return {
    id,
    title: pack.name.replace(/\.zip$/i, ''),
    cat,
    type: isZip ? 'zip' : typeFromExt(extOf(pack.name)),
    author: 'dropped · local',
    date: new Date().toISOString().slice(0, 10),
    deps: deps || '',
    size: fmtSize(pack.size),
    packId: id,
    fileCount: list.length,
    exts: isZip ? topExts.slice(0, 3) : [extOf(pack.name)],
    thumb,
    search: names + ' ' + pack.name,
    demo: '',
    isUserUploaded: true
  };
}

export function dataUrl(ext: string, b64: string): string {
  return `data:${MIME[ext] || 'application/octet-stream'};base64,${b64}`;
}

export function resolvePath(dir: string, ref: string): string | null {
  if (/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref)) return null;
  ref = ref.split('#')[0].split('?')[0];
  if (!ref) return null;
  const parts = (ref.charAt(0) === '/' ? ref.slice(1) : dir + ref).split('/');
  const out: string[] = [];
  parts.forEach((p) => {
    if (p === '..') out.pop();
    else if (p !== '.' && p !== '') out.push(p);
  });
  return out.join('/');
}

export function findInPack(pack: ZipPack, dir: string, ref: string): string | null {
  const r = resolvePath(dir, ref);
  if (!r) return null;
  if (pack.has(r)) return r;
  try {
    const d = decodeURIComponent(r);
    if (pack.has(d)) return d;
  } catch {}
  const hit = pack.list.find((f) => f.path.slice(-r.length - 1) === '/' + r);
  return hit ? hit.path : null;
}

export async function replaceAsync(
  str: string,
  re: RegExp,
  fn: (...args: any[]) => Promise<string>
): Promise<string> {
  const parts: (string | null)[] = [];
  const jobs: Promise<string>[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  re.lastIndex = 0;

  while ((m = re.exec(str))) {
    parts.push(str.slice(last, m.index));
    jobs.push(fn(...m));
    parts.push(null);
    last = re.lastIndex;
    if (!m[0].length) re.lastIndex++;
  }
  parts.push(str.slice(last));

  const res = await Promise.all(jobs);
  let k = 0;
  return parts.map((p) => (p === null ? res[k++] : p)).join('');
}

export async function rewriteCss(pack: ZipPack, css: string, dir: string): Promise<string> {
  return replaceAsync(css, /url\(\s*(["']?)([^"')]+)\1\s*\)/gi, async (all, _q, ref) => {
    const p = findInPack(pack, dir, ref.trim());
    if (!p) return all;
    try {
      return `url("${dataUrl(extOf(p), await pack.b64(p))}")`;
    } catch {
      return all;
    }
  });
}

/**
 * Inlines all relative scripts, stylesheets, and assets so the HTML runs completely self-contained.
 */
export async function inlineHtml(pack: ZipPack, path: string): Promise<string> {
  const dir = path.replace(/[^\/]*$/, '');
  let html = await pack.text(path);

  const SO = '<script';
  const SC = '</script>';

  // Inline scripts
  html = await replaceAsync(
    html,
    /<script\b([^>]*?)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script\s*>/gi,
    async (all, a, ref, b) => {
      const p = findInPack(pack, dir, ref);
      if (!p) return all;
      const js = (await pack.text(p)).replace(/<\/script/gi, '<\\/script');
      return SO + a + b + '>' + js + SC;
    }
  );

  // Inline stylesheets
  html = await replaceAsync(html, /<link\b[^>]*>/gi, async (all) => {
    if (!/rel\s*=\s*["']?stylesheet/i.test(all)) return all;
    const m = /href\s*=\s*["']([^"']+)["']/i.exec(all);
    if (!m) return all;
    const p = findInPack(pack, dir, m[1]);
    if (!p) return all;
    const cssContent = await pack.text(p);
    const resolvedCss = await rewriteCss(pack, cssContent, p.replace(/[^\/]*$/, ''));
    return `<style>${resolvedCss}</style>`;
  });

  // Rewrite remaining CSS urls
  html = await rewriteCss(pack, html, dir);

  // Rewrite image/media sources
  html = await replaceAsync(
    html,
    /\b(src|poster|data-src|href)\s*=\s*(["'])([^"']+)\2/gi,
    async (all, attr, _q, ref) => {
      if (
        attr.toLowerCase() === 'href' &&
        !/\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|mp4|webm)$/i.test(ref)
      ) {
        return all;
      }
      const p = findInPack(pack, dir, ref);
      if (!p) return all;
      const x = extOf(p);
      if (x === 'html' || x === 'htm') return all;
      const f = pack.list.find((i) => i.path === p);
      if (f && f.size > 40_000_000) return all;
      try {
        return `${attr}="${dataUrl(x, await pack.b64(p))}"`;
      } catch {
        return all;
      }
    }
  );

  return html;
}

export function escapeHtml(t: string): string {
  return String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function generatePreviewDoc(
  pack: ZipPack,
  path: string,
  specimenText: string = 'Handgloves 1234'
): Promise<string> {
  const x = extOf(path);
  const f = pack.list.find((i) => i.path === path) || { size: 0 };
  const esc = escapeHtml;

  const shell = (body: string, bg = '#f2f2f3') =>
    `<meta charset="utf-8">
     <style>
       html,body{margin:0;height:100%}
       body{background:${bg};display:grid;place-items:center;font-family:ui-monospace,Menlo,monospace;color:var(--ink,#1d1f20);overflow:hidden}
     </style>${body}`;

  if (f.size > 40_000_000) {
    return shell(
      `<div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;opacity:.6">${fmtSize(
        f.size
      )} · too large to preview inline</div>`
    );
  }

  if (x === 'html' || x === 'htm') {
    return await inlineHtml(pack, path);
  }

  if (isIn('img', path)) {
    const d = dataUrl(x, await pack.b64(path));
    return shell(
      `<img src="${d}" alt="" style="max-width:92%;max-height:92%;object-fit:contain">`,
      'repeating-conic-gradient(#e9e9ea 0 25%,#f7f7f8 0 50%) 0 0/16px 16px'
    );
  }

  if (isIn('vid', path)) {
    const d = dataUrl(x, await pack.b64(path));
    return shell(
      `<video src="${d}" controls autoplay muted loop playsinline style="max-width:100%;max-height:100%"></video>`,
      '#1d2d3d'
    );
  }

  if (isIn('aud', path)) {
    const d = dataUrl(x, await pack.b64(path));
    return shell(
      `<audio src="${d}" controls autoplay style="width:88%"></audio>`,
      '#1d2d3d'
    );
  }

  if (isIn('font', path)) {
    const d = dataUrl(x, await pack.b64(path));
    const sp = esc(specimenText);
    return shell(
      `<style>@font-face{font-family:Spec;src:url("${d}")}</style>
       <div style="font-family:Spec;padding:20px;display:grid;gap:6px;place-self:stretch;align-content:center">
         <div style="font-size:46px;line-height:1.05">${sp}</div>
         <div style="font-size:24px;opacity:.7">${sp}</div>
         <div style="font-size:15px;opacity:.55">ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789</div>
       </div>`
    );
  }

  if (isIn('text', path)) {
    let t = await pack.text(path);
    if (t.length > 60_000) t = t.slice(0, 60_000) + '\n…';
    return `<meta charset="utf-8">
            <style>
              html,body{margin:0}
              body{background:var(--rail,#1d2d3d);color:#e9edf2}
              pre{margin:0;padding:14px 16px;font:11.5px/1.55 ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-word}
            </style><pre>${esc(t)}</pre>`;
  }

  return shell(
    `<div style="text-align:center;display:grid;gap:6px">
       <div style="font:700 30px/1 Barlow Condensed,system-ui,sans-serif;text-transform:uppercase;color:#416180">.${esc(
         x || 'file'
       )}</div>
       <div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;opacity:.55">${fmtSize(
         f.size
       )} · no live render</div>
     </div>`
  );
}

export function pickDefaultFile(pack: ZipPack): string | null {
  const sorted = pack.list
    .slice()
    .sort((a, b) => a.path.split('/').length - b.path.split('/').length);

  const hit =
    sorted.find((f) => /(^|\/)index\.html?$/i.test(f.path)) ||
    sorted.find((f) => /\.html?$/i.test(f.path)) ||
    sorted.find(
      (f) =>
        isIn('img', f.path) || isIn('vid', f.path) || isIn('font', f.path)
    ) ||
    sorted.find((f) => isIn('text', f.path)) ||
    sorted[0];

  return hit ? hit.path : null;
}

/**
 * Checks whether an asset entry represents a ZIP archive package containing multiple files
 */
export function isZipArchive(entry?: AssetEntry | null): boolean {
  if (!entry) return false;
  // a file inside an archive opens as an archive only when it is one (archives inside archives)
  if (entry.isZipInnerFile) return Boolean(entry.nestedArchive);

  // 1. Explicit zip type
  if (entry.type === 'zip') return true;

  // 2. Direct filename or disk path ending in .zip
  const t = (entry.title || '').toLowerCase().trim();
  const p = (entry.filePath || '').toLowerCase().trim();
  if (t.endsWith('.zip') || p.endsWith('.zip')) return true;

  // 3. Exts includes 'zip' and it's not a standalone video, photo, audio, font, or code file
  if (
    entry.exts &&
    entry.exts.includes('zip') &&
    !['video', 'photo', 'font', 'code'].includes(entry.type)
  ) {
    return true;
  }

  return false;
}

// In-memory cache for generated video thumbnails inside zip archives
export const zipVideoThumbCache = new Map<string, string>();

/**
 * Generates and caches a video frame thumbnail for a specific inner video inside a zip archive
 */
export async function generateInnerZipVideoThumbnail(
  entry: AssetEntry,
  parentZip?: AssetEntry | null
): Promise<string | null> {
  const cacheKey = entry.id;
  if (zipVideoThumbCache.has(cacheKey)) {
    return zipVideoThumbCache.get(cacheKey)!;
  }

  const innerPath = entry.zipInnerPath || '';
  const parentId = entry.zipParentId || entry.packId || parentZip?.id;

  // 1. Try browser in-memory or IndexedDB pack
  if (parentId) {
    const pack = getPack(parentId) || (await restorePackFromDB(parentId));
    if (pack && pack.blob && innerPath) {
      try {
        const blob = await pack.blob(innerPath);
        if (blob && blob.size > 0 && blob.size < 250_000_000) {
          const thumb = await generateVideoThumbnail(blob);
          if (thumb) {
            zipVideoThumbCache.set(cacheKey, thumb);
            return thumb;
          }
        }
      } catch (err) {
        console.warn('Failed to generate inner zip video thumbnail from blob:', err);
      }
    }
  }

  // 2. Try disk archive via server streaming
  const diskZipPath = parentZip?.filePath || (entry.filePath && entry.filePath.endsWith('.zip') ? entry.filePath : null);
  if (diskZipPath && innerPath) {
    try {
      const streamUrl = `/api/file?path=${encodeURIComponent(diskZipPath)}&entry=${encodeURIComponent(innerPath)}`;
      const thumb = await generateVideoThumbnail(streamUrl);
      if (thumb) {
        zipVideoThumbCache.set(cacheKey, thumb);
        persistThumbnailToDisk(entry.id, thumb).catch(() => {});
        return thumb;
      }
    } catch (err) {
      console.warn('Failed to generate inner zip video thumbnail from disk stream:', err);
    }
  }

  return null;
}

/**
 * Extracts and maps all individual files within a ZIP archive into first-class AssetEntry objects.
 * Supports both browser-uploaded/in-memory ZipPacks and server-indexed disk ZIP archives.
 * Generates instant thumbnails for images, SVGs, and MP4/video files inside the archive.
 */
// Inner files that open as archives themselves. On disk the server unpacks them (zip, rar, 7z, tar…);
// in the browser only zip can be opened.
const NESTED_DISK_ARCHIVE_RE = /\.(zip|rar|7z|tar|tgz|tbz2?|txz|gz|bz2|xz|iso|cab)$/i;

/** One file inside an archive on disk; `innerPath` may be a chain (`a.zip!/b.png`). */
function diskInnerEntry(parentZip: AssetEntry, zipPath: string, innerPath: string, f: { path: string; size: number }): AssetEntry {
  const ext = extOf(f.path);
  const nested = NESTED_DISK_ARCHIVE_RE.test(f.path);
  const type = nested ? 'zip' : typeFromExt(ext);
  const fileName = f.path.split('/').pop() || f.path;
  const entryId = `${parentZip.id}::${f.path}`;

  let thumbUrl: string | null = null;
  if (zipVideoThumbCache.has(entryId)) {
    thumbUrl = zipVideoThumbCache.get(entryId)!;
  } else if (isIn('img', f.path) || ext === 'svg') {
    thumbUrl = `/api/file?path=${encodeURIComponent(zipPath)}&entry=${encodeURIComponent(innerPath)}`;
  }

  return {
    id: entryId,
    title: fileName,
    cat: parentZip.cat,
    type,
    author: `${parentZip.title} › ${f.path.includes('/') ? f.path.substring(0, f.path.lastIndexOf('/')) : 'root'}`,
    date: parentZip.date,
    deps: '1 item',
    size: fmtSize(f.size),
    fileCount: nested ? 0 : 1, // 0: unknown until opened (the badge says "Multiple")
    exts: [ext],
    thumb: thumbUrl,
    packId: parentZip.packId || parentZip.id,
    filePath: zipPath,
    search: `${fileName} ${f.path} ${parentZip.title} ${type} ${ext}`,
    demo: '',
    isUserUploaded: true,
    isZipInnerFile: true,
    zipParentId: parentZip.id,
    zipParentTitle: parentZip.title,
    zipInnerPath: innerPath,
    nestedArchive: nested ? 'disk' : undefined
  };
}

export async function extractZipEntries(parentZip: AssetEntry): Promise<AssetEntry[]> {
  if (!parentZip) return [];

  // 0. An archive inside an archive on disk: the server unpacks it and lists it
  if (parentZip.nestedArchive === 'disk' && parentZip.filePath && parentZip.zipInnerPath) {
    const zipPath = parentZip.filePath;
    const chain = parentZip.zipInnerPath;
    const list = await api.getArchiveList({ path: zipPath, entry: chain });
    if (!list) return [];
    return list.files.map((f) => diskInnerEntry(parentZip, zipPath, `${chain}!/${f.path}`, f));
  }

  // 1. Try to get in-memory pack or restore from IndexedDB
  let pack: ZipPack | null = null;
  if (parentZip.nestedArchive === 'pack') {
    // a zip inside a zip loaded in the browser: open the inner one as its own pack
    pack = getPack(parentZip.id);
    const outer = parentZip.packId ? getPack(parentZip.packId) || (await restorePackFromDB(parentZip.packId)) : null;
    if (!pack && outer?.blob && parentZip.zipInnerPath) {
      const blob = await outer.blob(parentZip.zipInnerPath);
      if (blob) {
        pack = (await packFromFile(new File([blob], parentZip.title))).pack;
        registerPack(parentZip.id, pack);
      }
    }
  }
  if (!pack && parentZip.packId && parentZip.nestedArchive !== 'pack') {
    pack = getPack(parentZip.packId) || (await restorePackFromDB(parentZip.packId));
  }
  if (!pack && parentZip.id) {
    pack = getPack(parentZip.id) || (await restorePackFromDB(parentZip.id));
  }
  const packOwner = parentZip.nestedArchive === 'pack' ? parentZip.id : parentZip.packId || parentZip.id;

  // If in-memory pack available (browser upload or cached blob):
  if (pack && pack.list && pack.list.length > 0) {
    const results: AssetEntry[] = [];
    for (let i = 0; i < pack.list.length; i++) {
      const f = pack.list[i];
      const ext = extOf(f.path);
      const innerZip = (ext === 'zip' || BROWSER_ARCHIVE_RE.test(f.path)) && Boolean(pack.blob);
      const type = innerZip ? 'zip' : typeFromExt(ext);
      const fileName = f.path.split('/').pop() || f.path;
      const entryId = `${parentZip.id}::${f.path}`;

      let thumb: string | null = null;
      if (zipVideoThumbCache.has(entryId)) {
        thumb = zipVideoThumbCache.get(entryId)!;
      } else if (isIn('img', f.path) && f.size < 25_000_000 && pack.blob) {
        try {
          const b = await pack.blob(f.path);
          if (b && b.size > 0) {
            thumb = URL.createObjectURL(b);
          }
        } catch {}
      } else if (ext === 'svg') {
        try {
          const svgText = await pack.text(f.path);
          thumb = `data:image/svg+xml;utf8,${encodeURIComponent(svgText)}`;
        } catch {}
      }

      results.push({
        id: entryId,
        title: fileName,
        cat: parentZip.cat,
        type,
        author: `${parentZip.title} › ${f.path.includes('/') ? f.path.substring(0, f.path.lastIndexOf('/')) : 'root'}`,
        date: parentZip.date,
        deps: '1 item',
        size: fmtSize(f.size),
        fileCount: 1,
        exts: [ext],
        thumb,
        packId: packOwner,
        filePath: f.path,
        search: `${fileName} ${f.path} ${parentZip.title} ${type} ${ext}`,
        demo: '',
        isUserUploaded: true,
        isZipInnerFile: true,
        zipParentId: parentZip.id,
        zipParentTitle: parentZip.title,
        zipInnerPath: f.path,
        nestedArchive: innerZip ? 'pack' : undefined
      });
    }

    // Pre-generate video thumbnails for up to 6 videos concurrently
    const unthumbnailedVideos = results.filter(
      (e) => !e.thumb && (e.type === 'video' || (e.exts && ['mp4', 'webm', 'mov', 'm4v'].some((x) => e.exts.includes(x))))
    );
    if (unthumbnailedVideos.length > 0 && pack.blob) {
      const toGenerateNow = unthumbnailedVideos.slice(0, 6);
      await Promise.all(
        toGenerateNow.map(async (vEntry) => {
          try {
            const b = await pack!.blob!(vEntry.zipInnerPath!);
            if (b && b.size > 0 && b.size < 250_000_000) {
              const vThumb = await generateVideoThumbnail(b);
              if (vThumb) {
                vEntry.thumb = vThumb;
                zipVideoThumbCache.set(vEntry.id, vThumb);
              }
            }
          } catch (err) {
            console.warn('Failed inner video thumbnail for', vEntry.title, err);
          }
        })
      );
    }

    return results;
  }

  // 2. If disk-based archive on server:
  try {
    const assetData = await api.getAssetById(parentZip.id);
    if (assetData && assetData.files && assetData.files.length > 0) {
      const zipPath = parentZip.filePath || '';
      let diskFiles: any[] = assetData.files;
      // The index keeps only the first 500 files per archive; ask the server for the complete list
      if ((parentZip.fileCount || 0) > diskFiles.length) {
        const full = await api.getArchiveList(parentZip.id);
        if (full && full.files.length > diskFiles.length) diskFiles = full.files;
      }
      const results: AssetEntry[] = diskFiles.map((f: any) => diskInnerEntry(parentZip, zipPath, f.path, f));

      // Pre-generate video thumbnails for up to 6 disk videos concurrently
      const unthumbnailedDiskVideos = results.filter(
        (e) => !e.thumb && (e.type === 'video' || (e.exts && ['mp4', 'webm', 'mov', 'm4v'].some((x) => e.exts.includes(x))))
      );

      if (unthumbnailedDiskVideos.length > 0 && zipPath) {
        const toGenerateNow = unthumbnailedDiskVideos.slice(0, 6);
        await Promise.all(
          toGenerateNow.map(async (vEntry) => {
            try {
              const streamUrl = `/api/file?path=${encodeURIComponent(zipPath)}&entry=${encodeURIComponent(vEntry.zipInnerPath!)}`;
              const vThumb = await generateVideoThumbnail(streamUrl);
              if (vThumb) {
                vEntry.thumb = vThumb;
                zipVideoThumbCache.set(vEntry.id, vThumb);
                persistThumbnailToDisk(vEntry.id, vThumb).catch(() => {});
              }
            } catch (err) {
              console.warn('Failed disk inner video thumbnail for', vEntry.title, err);
            }
          })
        );
      }

      return results;
    }
  } catch (err) {
    console.warn('Could not query disk archive files from SQLite:', err);
  }

  return [];
}
