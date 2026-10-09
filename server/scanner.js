import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import {
  upsertAssetsBulk,
  addWatchedFolder,
  getAllAssetPaths,
  getPendingZips,
  applyZipInspections
} from './db.js';
import { listArchive } from './archiveReader.js';

export const scannerState = {
  status: 'idle', // 'idle' | 'scanning' | 'indexing' | 'complete' | 'error'
  currentFolder: '',
  currentFile: 'Index ready · No background jobs',
  processedCount: 0,
  totalCount: 0,
  percentage: 100,
  message: 'Ready',
  startTime: 0,
  elapsed: '0s',
  // Stage two: zip contents are read in the background after indexing completes
  zips: { running: false, total: 0, done: 0, current: '' }
};

const IGNORED_NAMES = new Set([
  'node_modules',
  '.git',
  '.gemini',
  '.vscode',
  'dist',
  'build',
  '.next',
  '.cache',
  '__MACOSX',
  '$RECYCLE.BIN',
  'System Volume Information'
]);

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function detectAssetType(ext) {
  const e = ext.toLowerCase().replace('.', '');
  if (['js', 'jsx', 'ts', 'tsx', 'html', 'htm', 'css', 'scss', 'json', 'py', 'sh', 'php', 'cpp', 'c', 'rs', 'go', 'vue', 'svelte', 'rb', 'java', 'sql', 'md'].includes(e)) {
    return 'code';
  }
  if (['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'tbz', 'tbz2', 'txz', 'bz2', 'xz', 'iso', 'cab', 'dmg', 'epub', 'idml', 'key', 'ods', 'fla', 'z'].includes(e)) {
    return 'zip';
  }
  if (['svg'].includes(e)) {
    return 'svg';
  }
  if (['otf', 'ttf', 'ttc', 'woff', 'woff2', 'eot', 'dfont', 'pfb', 'pfm', 'afm'].includes(e)) {
    return 'font';
  }
  if (['glb', 'gltf', 'stl', 'dae', 'ply', '3mf', 'obj', 'fbx', 'blend', 'vrm', 'vrma'].includes(e)) {
    return '3d';
  }
  if (['cr2', 'nef', 'dng', 'arw'].includes(e)) {
    return 'raw';
  }
  if (['docx', 'xlsx', 'xls', 'csv', 'indd', 'doc', 'ppt', 'qxp'].includes(e)) {
    return 'doc';
  }
  if (e === 'swf') {
    return 'swf';
  }
  if (['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v', 'wmv'].includes(e)) {
    return 'video';
  }
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'tiff', 'tif'].includes(e)) {
    return 'photo';
  }
  if (['psd', 'psb'].includes(e)) {
    return 'psd';
  }
  if (['ai', 'eps'].includes(e)) {
    return 'ai';
  }
  if (['prproj', 'aep', 'drp'].includes(e)) {
    return 'prproj';
  }
  if (['ico', 'icns'].includes(e)) {
    return 'icon';
  }
  return 'file';
}

function detectPool(ext, filePath, assetType) {
  const p = filePath.toLowerCase();
  const e = ext.toLowerCase().replace('.', '');

  if (['svg', 'ai', 'eps'].includes(e)) return 'vectors';
  if (['otf', 'ttf', 'ttc', 'eot', 'woff', 'woff2', 'pfb', 'pfm', 'afm', 'dfont'].includes(e)) return 'type';
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'aif', 'aiff'].includes(e)) return 'audio';
  if (['obj', 'fbx', 'blend', 'gltf', 'glb', 'stl', 'dae', 'ply', '3mf', 'c4d', 'max', 'vrm', 'vrma'].includes(e)) return '3d';
  if (['mp4', 'mov', 'webm', 'prproj', 'aep', 'swf'].includes(e)) return 'video';
  if (['psd', 'psb', 'jpg', 'jpeg', 'png', 'tiff', 'dng', 'cr2', 'nef', 'arw'].includes(e)) return 'photo';

  if (p.includes('brand') || p.includes('logo') || p.includes('identity') || p.includes('guidelines') || p.includes('pitch')) {
    return 'brand';
  }
  if (p.includes('retro') || p.includes('synth') || p.includes('80s') || p.includes('90s') || p.includes('vintage') || p.includes('pixel')) {
    return 'retro';
  }
  if (p.includes('ui') || p.includes('wireframe') || p.includes('design-system') || p.includes('component')) {
    return 'ui';
  }
  if (assetType === 'zip' || p.includes('backup') || p.includes('archive') || p.includes('client')) {
    return 'archive';
  }
  if (assetType === 'code') return 'code';

  return 'misc';
}

const CREATIVE_FILE_RE =
  /\.(zip|tar|gz|tgz|tbz2?|txz|bz2|xz|7z|rar|iso|cab|dmg|html?|css|scss|m?jsx?|tsx?|json|svg|png|jpe?g|gif|webp|avif|bmp|tiff?|mp4|webm|mov|mkv|mp3|wav|flac|aac|ogg|otf|ttf|ttc|eot|woff2?|psd|psb|ai|eps|prproj|aep|blend|obj|fbx|glb|gltf|stl|dae|ply|3mf|vrma?|ico|pdf|md|cr2|nef|dng|arw|swf|indd|docx|xlsx|xls|csv|epub|idml|key|ods|fla|z|dfont|pfb|pfm|afm|doc|ppt|qxp|exe|dll|db)$/i;

const WALK_CONCURRENCY = 16; // directories read in parallel
const STAT_CONCURRENCY = 48; // files stat'd in parallel
const BATCH_SIZE = 1000; // rows per SQLite transaction
const ZIP_CONCURRENCY = 4; // zip directories read in parallel (stage two)
const ZIP_WRITE_BATCH = 50;

/**
 * Walks the tree with several readdir calls in flight. Reports files found so far through
 * scannerState so the meter moves during discovery instead of sitting at 5%.
 */
async function discoverFiles(rootDir, maxDepth) {
  const files = [];
  const queue = [[rootDir, 0]];
  let active = 0;

  await new Promise((resolve) => {
    const pump = () => {
      while (active < WALK_CONCURRENCY && queue.length) {
        const [dir, depth] = queue.pop();
        if (depth > maxDepth) continue;
        active++;
        fs.promises
          .readdir(dir, { withFileTypes: true })
          .then((entries) => {
            for (const ent of entries) {
              if (IGNORED_NAMES.has(ent.name) || ent.name.startsWith('.')) continue;
              if (ent.isDirectory()) {
                queue.push([path.join(dir, ent.name), depth + 1]);
              } else if (ent.isFile() && CREATIVE_FILE_RE.test(ent.name)) {
                files.push(path.join(dir, ent.name));
              }
            }
          })
          .catch(() => {}) // skip folders without read permission
          .finally(() => {
            active--;
            scannerState.totalCount = files.length;
            scannerState.currentFile = dir;
            scannerState.message = `Discovering files… ${files.length.toLocaleString()} found`;
            pump();
          });
      }
      if (active === 0 && queue.length === 0) resolve();
    };
    pump();
  });

  return files;
}

/**
 * Stage one: walk the folder, stat every file and write rows to SQLite in big batches.
 * Zips are inserted immediately with inspected = 0; their contents are read afterwards
 * by the stage-two queue (startZipStage), so the library is usable as soon as this returns.
 * Files already in the database (same path and modified time) are skipped.
 */
export async function scanDirectoryOnDisk(targetDir, { maxDepth = 12 } = {}) {
  const resolvedDir = path.resolve(targetDir);

  if (!fs.existsSync(resolvedDir)) {
    throw new Error(`Directory does not exist: ${resolvedDir}`);
  }
  if (scannerState.status === 'scanning' || scannerState.status === 'indexing') {
    throw new Error('A scan is already running');
  }

  const startTime = Date.now();
  scannerState.status = 'scanning';
  scannerState.currentFolder = resolvedDir;
  scannerState.currentFile = `Discovering files in ${path.basename(resolvedDir)}…`;
  scannerState.processedCount = 0;
  scannerState.totalCount = 0;
  scannerState.percentage = 5;
  scannerState.message = 'Enumerating directory tree…';
  scannerState.startTime = startTime;

  try {
    const discoveredFiles = await discoverFiles(resolvedDir, maxDepth);

    const total = discoveredFiles.length;
    scannerState.status = 'indexing';
    scannerState.totalCount = total;
    scannerState.processedCount = 0;
    scannerState.percentage = 10;
    scannerState.message = `Found ${total.toLocaleString()} files. Writing to archive.db…`;

    const knownPaths = getAllAssetPaths(); // id -> file path
    const folderName = path.basename(resolvedDir);

    let next = 0;
    let processed = 0;
    let inserted = 0;
    let skipped = 0;
    let unreadable = 0;
    let batch = [];

    const flush = () => {
      if (batch.length === 0) return;
      upsertAssetsBulk(batch);
      inserted += batch.length;
      batch = [];
    };

    const worker = async () => {
      while (true) {
        const i = next++;
        if (i >= total) return;
        const filePath = discoveredFiles[i];

        let stats;
        try {
          stats = await fs.promises.stat(filePath);
        } catch {
          unreadable++;
          processed++;
          continue;
        }

        // The legacy id is only the tail of the path plus the mtime, so two different files
        // (e.g. copies with the same name and date) can collide. Keep the legacy id when it is
        // free or already ours, so existing rows and thumbnails stay valid; otherwise add a
        // short hash of the full path.
        let assetId =
          'disk_' + Buffer.from(filePath).toString('base64url').slice(-16) + '_' + stats.mtimeMs.toString(36);
        if (knownPaths.has(assetId) && knownPaths.get(assetId) !== filePath) {
          assetId += '_' + crypto.createHash('sha1').update(filePath).digest('hex').slice(0, 8);
        }

        if (knownPaths.get(assetId) === filePath) {
          skipped++;
        } else {
          knownPaths.set(assetId, filePath);
          const fileName = path.basename(filePath);
          const ext = path.extname(filePath).replace('.', '').toLowerCase();
          const type = detectAssetType(ext);
          const cat = detectPool(ext, filePath, type);
          const isZip = type === 'zip';

          let thumb = null;
          if (type === 'svg' && stats.size < 64000) {
            try {
              const svgContent = await fs.promises.readFile(filePath, 'utf-8');
              thumb = `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`;
            } catch {
              // ignore thumb error
            }
          }

          const cleanTitle = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();
          const exts = [ext];

          batch.push({
            id: assetId,
            title: cleanTitle || fileName,
            cat,
            type,
            author: `local · ${folderName}`,
            date: stats.mtime.toISOString().slice(0, 10),
            deps: isZip ? 'Reading contents…' : '1 items',
            size: formatBytes(stats.size),
            fileCount: 1,
            exts,
            thumb,
            packId: isZip ? assetId : null,
            filePath,
            search: `${cleanTitle} ${fileName} ${filePath} ${cat} ${type} ${exts.join(' ')}`,
            demo: type === 'code' ? 'Code Asset' : type,
            isUserUploaded: true,
            inspected: isZip ? 0 : 1
          });

          if (batch.length >= BATCH_SIZE) flush();
        }

        processed++;
        if ((processed & 63) === 0 || processed === total) {
          scannerState.processedCount = processed;
          scannerState.currentFile = filePath;
          scannerState.percentage = Math.round(10 + (85 * processed) / Math.max(1, total));
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(STAT_CONCURRENCY, Math.max(1, total)) }, worker));
    flush();

    const indexedCount = total - unreadable;
    addWatchedFolder(resolvedDir, indexedCount);

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
    scannerState.status = 'complete';
    scannerState.processedCount = total;
    scannerState.percentage = 100;
    scannerState.currentFile = `Indexed ${indexedCount} assets from ${folderName} in ${durationSec}s`;
    scannerState.message = `Complete · ${indexedCount} items (${inserted} new, ${skipped} unchanged) in ${durationSec}s`;
    scannerState.elapsed = `${durationSec}s`;

    // Stage two runs in the background; the library is already usable.
    startZipStage();

    return {
      folder: resolvedDir,
      totalDiscovered: total,
      indexedCount,
      newCount: inserted,
      skippedCount: skipped,
      durationSec
    };
  } catch (err) {
    scannerState.status = 'error';
    scannerState.message = err.message;
    throw err;
  }
}

let zipStageRunning = false;

/**
 * Stage two: read the contents of every zip that stage one inserted (inspected = 0).
 * Reads only each zip's central directory, a few at a time, and writes results in batches.
 * Safe to call repeatedly; a second call while running is a no-op. Picks up zips left over
 * from an interrupted run too, because the queue is simply "rows still marked inspected = 0".
 */
export function startZipStage() {
  if (!zipStageRunning) {
    zipStageRunning = true;
    scannerState.zips.running = true;
    scannerState.zips.total = 0;
    scannerState.zips.done = 0;
    runZipStage()
      .catch((err) => console.error('[Scanner] Zip stage error:', err))
      .finally(() => {
        zipStageRunning = false;
        scannerState.zips.running = false;
        scannerState.zips.current = '';
      });
  }
  return scannerState.zips;
}

async function runZipStage() {
  while (true) {
    const pending = getPendingZips();
    if (pending.length === 0) return;

    scannerState.zips.total += pending.length;
    let next = 0;
    let results = [];

    const writeResults = () => {
      if (results.length === 0) return;
      applyZipInspections(results);
      results = [];
    };

    const worker = async () => {
      while (true) {
        const i = next++;
        if (i >= pending.length) return;
        const zip = pending[i];
        scannerState.zips.current = zip.filePath || zip.title;

        let info;
        try {
          info = await listArchive(zip.filePath);
        } catch {
          // Unreadable (corrupt, or 7-Zip missing for a non-zip): keep it as a single item.
          const ext = path.extname(zip.filePath || '').replace('.', '').toLowerCase();
          info = { fileCount: 1, exts: [ext || 'zip'], files: [] };
        }
        results.push({
          ...zip,
          fileCount: info.fileCount,
          exts: info.exts,
          files: info.files,
          encrypted: Boolean(info.encrypted)
        });
        scannerState.zips.done++;
        if (results.length >= ZIP_WRITE_BATCH) writeResults();
      }
    };

    await Promise.all(Array.from({ length: Math.min(ZIP_CONCURRENCY, pending.length) }, worker));
    writeResults();
  }
}
