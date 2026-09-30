import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { upsertAsset, upsertAssetsBulk, addWatchedFolder, getDatabase } from './db.js';

export const scannerState = {
  status: 'idle', // 'idle' | 'scanning' | 'indexing' | 'complete' | 'error'
  currentFolder: '',
  currentFile: 'Index ready · No background jobs',
  processedCount: 0,
  totalCount: 0,
  percentage: 100,
  message: 'Ready',
  startTime: 0,
  elapsed: '0s'
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
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(e)) {
    return 'zip';
  }
  if (['svg'].includes(e)) {
    return 'svg';
  }
  if (['otf', 'ttf', 'woff', 'woff2', 'eot'].includes(e)) {
    return 'font';
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
  if (['otf', 'ttf', 'woff', 'woff2'].includes(e)) return 'type';
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'aif', 'aiff'].includes(e)) return 'audio';
  if (['obj', 'fbx', 'blend', 'gltf', 'glb', 'c4d', 'max'].includes(e)) return '3d';
  if (['mp4', 'mov', 'webm', 'prproj', 'aep'].includes(e)) return 'video';
  if (['psd', 'psb', 'jpg', 'jpeg', 'png', 'tiff', 'dng', 'cr2', 'nef'].includes(e)) return 'photo';

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

/**
 * Fast inspection of ZIP files to extract inner directory list, inner extensions, count
 */
async function inspectZip(filePath) {
  try {
    const data = await fs.promises.readFile(filePath);
    const zip = await JSZip.loadAsync(data);
    const files = [];
    const exts = new Set();
    let totalUncompressedSize = 0;

    zip.forEach((relPath, entry) => {
      if (!entry.dir && !relPath.startsWith('__MACOSX/')) {
        const ext = path.extname(relPath).replace('.', '').toLowerCase();
        if (ext) exts.add(ext);
        // Estimate size if available in _data
        const size = entry._data?.uncompressedSize || 0;
        totalUncompressedSize += size;
        files.push({
          path: relPath,
          size,
          ext
        });
      }
    });

    return {
      fileCount: files.length,
      exts: Array.from(exts).slice(0, 12),
      files: files.slice(0, 500), // Keep up to 500 inner files for index
      uncompressedSize: totalUncompressedSize
    };
  } catch (err) {
    return {
      fileCount: 1,
      exts: ['zip'],
      files: [],
      uncompressedSize: 0
    };
  }
}

/**
 * Recursively scans a directory on disk and streams to SQLite
 */
export async function scanDirectoryOnDisk(targetDir, { maxDepth = 12 } = {}) {
  const resolvedDir = path.resolve(targetDir);

  if (!fs.existsSync(resolvedDir)) {
    throw new Error(`Directory does not exist: ${resolvedDir}`);
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

  const discoveredFiles = [];

  async function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries = [];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch (e) {
      return; // Skip folders without read permissions
    }

    for (const ent of entries) {
      if (IGNORED_NAMES.has(ent.name) || ent.name.startsWith('.')) continue;

      const fullPath = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(fullPath, depth + 1);
      } else if (ent.isFile()) {
        const ext = path.extname(ent.name).toLowerCase();
        // Check creative asset extensions
        if (
          /\.(zip|tar|gz|7z|rar|html?|css|scss|m?jsx?|tsx?|json|svg|png|jpe?g|gif|webp|avif|bmp|tiff?|mp4|webm|mov|mkv|mp3|wav|flac|aac|ogg|otf|ttf|woff2?|psd|psb|ai|eps|prproj|aep|blend|obj|fbx|ico)$/i.test(
            ent.name
          )
        ) {
          discoveredFiles.push(fullPath);
        }
      }
    }
  }

  await walk(resolvedDir, 0);

  const total = discoveredFiles.length;
  scannerState.status = 'indexing';
  scannerState.totalCount = total;
  scannerState.percentage = 10;
  scannerState.message = `Discovered ${total} creative assets. Writing to SQLite archive.db…`;

  let indexedCount = 0;
  const folderName = path.basename(resolvedDir);

  for (let i = 0; i < total; i++) {
    const filePath = discoveredFiles[i];
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).replace('.', '').toLowerCase();
    const type = detectAssetType(ext);
    const cat = detectPool(ext, filePath, type);

    scannerState.processedCount = i + 1;
    scannerState.currentFile = filePath;
    scannerState.percentage = Math.round(10 + (85 * (i + 1)) / total);

    let stats;
    try {
      stats = await fs.promises.stat(filePath);
    } catch {
      continue;
    }

    const isZip = type === 'zip';
    let innerFiles = [];
    let fileCount = 1;
    let exts = [ext];
    let thumb = null;

    if (isZip) {
      const zipInfo = await inspectZip(filePath);
      fileCount = zipInfo.fileCount;
      if (zipInfo.exts.length > 0) exts = zipInfo.exts;
      innerFiles = zipInfo.files;
    } else if (type === 'svg') {
      try {
        if (stats.size < 64000) {
          const svgContent = await fs.promises.readFile(filePath, 'utf-8');
          thumb = `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`;
        }
      } catch (e) {
        // Ignore thumb error
      }
    }

    const cleanTitle = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();
    const assetId = 'disk_' + Buffer.from(filePath).toString('base64url').slice(-16) + '_' + stats.mtimeMs.toString(36);

    const assetEntry = {
      id: assetId,
      title: cleanTitle || fileName,
      cat,
      type,
      author: `local · ${folderName}`,
      date: stats.mtime.toISOString().slice(0, 10),
      deps: `${fileCount} items`,
      size: formatBytes(stats.size),
      fileCount,
      exts,
      thumb,
      packId: isZip ? assetId : null,
      filePath,
      search: `${cleanTitle} ${fileName} ${filePath} ${cat} ${type} ${exts.join(' ')}`,
      demo: type === 'code' ? 'Code Asset' : type,
      isUserUploaded: true
    };

    upsertAsset(assetEntry, innerFiles);
    indexedCount++;
  }

  // Update watched folder table
  addWatchedFolder(resolvedDir, indexedCount);

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  scannerState.status = 'complete';
  scannerState.percentage = 100;
  scannerState.currentFile = `Indexed ${indexedCount} assets from ${folderName} in ${durationSec}s`;
  scannerState.message = `Complete · ${indexedCount} items indexed into archive.db in ${durationSec}s`;
  scannerState.elapsed = `${durationSec}s`;

  return {
    folder: resolvedDir,
    totalDiscovered: total,
    indexedCount,
    durationSec
  };
}
