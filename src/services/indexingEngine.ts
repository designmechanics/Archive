import { AssetEntry, WatchedFolder } from '../types';
import { createEntryFromPack, createPackFromBlob, createPackFromSingleFile } from './zipService';
import { saveSingleEntry } from './db';
import { api } from './api';

export interface IndexingStatus {
  status: 'idle' | 'scanning' | 'indexing' | 'complete' | 'error';
  percentage: number;
  currentFile: string;
  processedCount: number;
  totalCount: number;
  message: string;
}

type StatusListener = (status: IndexingStatus) => void;

class IndexingEngine {
  private currentStatus: IndexingStatus = {
    status: 'idle',
    percentage: 100,
    currentFile: 'Index ready · SQLite WAL active',
    processedCount: 0,
    totalCount: 0,
    message: 'Ready'
  };

  private listeners: Set<StatusListener> = new Set();

  public subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.currentStatus);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => fn(this.currentStatus));
  }

  public getStatus(): IndexingStatus {
    return this.currentStatus;
  }

  public setStatus(partial: Partial<IndexingStatus>) {
    this.currentStatus = { ...this.currentStatus, ...partial };
    this.notify();
  }

  /**
   * Scans a real directory on disk using the high-performance Node backend
   */
  public async scanDiskFolder(
    folderPath: string,
    onComplete?: (entries: AssetEntry[]) => void,
    onError?: (error: any) => void
  ): Promise<void> {
    try {
      await api.scanFolder(folderPath);
      this.setStatus({
        status: 'scanning',
        percentage: 5,
        currentFile: `Scanning ${folderPath} on disk…`,
        processedCount: 0,
        totalCount: 0,
        message: 'Scanning filesystem…'
      });

      // Poll scanner status until complete or error
      const pollInterval = setInterval(async () => {
        const status = await api.getScanStatus();
        if (!status) return;

        this.setStatus({
          status: status.status,
          percentage: status.percentage,
          currentFile: status.currentFile,
          processedCount: status.processedCount,
          totalCount: status.totalCount,
          message: status.message
        });

        if (status.status === 'complete' || status.status === 'error') {
          clearInterval(pollInterval);
          if (status.status === 'complete') {
            const freshAssets = await api.getAssets();
            if (onComplete) onComplete(freshAssets);
          } else if (status.status === 'error') {
            if (onError) onError(status.message);
          }
        }
      }, 400);
    } catch (err) {
      console.error('Failed to trigger disk scan:', err);
      this.setStatus({
        status: 'error',
        percentage: 0,
        currentFile: 'Disk scan failed',
        message: 'Failed to access path'
      });
      if (onError) onError(err);
    }
  }

  /**
   * Scans a real directory using the browser's File System Access API (showDirectoryPicker)
   */
  public async scanDirectoryPicker(
    dirHandle: FileSystemDirectoryHandle,
    onEntryCreated: (entry: AssetEntry) => void
  ): Promise<{ folder: WatchedFolder; entries: AssetEntry[] }> {
    const startTime = performance.now();
    this.setStatus({
      status: 'scanning',
      percentage: 5,
      currentFile: `Scanning folder ${dirHandle.name}…`,
      processedCount: 0,
      totalCount: 0,
      message: 'Scanning directory tree…'
    });

    const fileHandles: { path: string; file: File }[] = [];

    // Recursive traversal
    const walk = async (handle: FileSystemDirectoryHandle, currentPath: string) => {
      // @ts-ignore - async iteration over directory entries
      for await (const [name, entry] of handle.entries()) {
        if (
          name.startsWith('.') ||
          name === 'node_modules' ||
          name === '__MACOSX' ||
          name === 'dist' ||
          name === 'build'
        ) {
          continue;
        }

        const subPath = currentPath ? `${currentPath}/${name}` : name;
        if (entry.kind === 'directory') {
          await walk(entry as FileSystemDirectoryHandle, subPath);
        } else if (entry.kind === 'file') {
          const fileHandle = entry as FileSystemFileHandle;
          const file = await fileHandle.getFile();
          // Filter to relevant creative/asset files
          if (
            /\.(zip|html?|css|m?jsx?|tsx?|json|md|markdown|txt|csv|svg|png|jpe?g|gif|webp|avif|bmp|mp4|webm|mov|mp3|wav|ogg|otf|ttf|woff2?|psd|ai|prproj|pdf|glb|gltf|obj)$/i.test(
              file.name
            )
          ) {
            fileHandles.push({ path: subPath, file });
          }
        }
      }
    };

    try {
      await walk(dirHandle, dirHandle.name);
    } catch (err) {
      console.error('Directory traversal failed:', err);
      this.setStatus({
        status: 'error',
        percentage: 0,
        currentFile: 'Error scanning folder',
        message: 'Folder access permission denied or failed'
      });
      throw err;
    }

    const total = fileHandles.length;
    const folderId = 'f_' + Date.now();
    this.setStatus({
      status: 'indexing',
      percentage: 10,
      currentFile: `Found ${total} assets. Extracting metadata…`,
      processedCount: 0,
      totalCount: total,
      message: `Found ${total} assets`
    });

    const createdEntries: AssetEntry[] = [];

    for (let i = 0; i < total; i++) {
      const item = fileHandles[i];
      const isZip = /\.zip$/i.test(item.file.name);
      const pct = Math.round(10 + (85 * (i + 1)) / total);

      this.setStatus({
        status: 'indexing',
        percentage: pct,
        currentFile: item.path,
        processedCount: i + 1,
        totalCount: total,
        message: `Indexing ${i + 1} of ${total}`
      });

      try {
        const pack = isZip
          ? await createPackFromBlob(item.file.name, item.file)
          : createPackFromSingleFile(item.file);

        const entry = await createEntryFromPack(pack, isZip);
        // Tag with folder relative path and folderId
        entry.author = `local · ${dirHandle.name}`;
        entry.filePath = item.path;
        entry.folderId = folderId;
        entry.search += ` ${item.path}`;

        createdEntries.push(entry);
        onEntryCreated(entry);
        await saveSingleEntry(entry);
      } catch (e) {
        console.warn('Failed to parse file:', item.path, e);
      }
    }

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
    const watchedFolder: WatchedFolder = {
      id: folderId,
      path: dirHandle.name,
      count: String(createdEntries.length),
      enabled: true
    };

    this.setStatus({
      status: 'complete',
      percentage: 100,
      currentFile: `Indexed ${createdEntries.length} assets from ${dirHandle.name} in ${elapsed}s`,
      processedCount: total,
      totalCount: total,
      message: `Completed in ${elapsed}s`
    });

    return { folder: watchedFolder, entries: createdEntries };
  }

  /**
   * Ingests a list of files or dropped zips with live progress tracking
   */
  public async ingestFileList(
    files: FileList | File[],
    onEntryCreated: (entry: AssetEntry) => void,
    folderContext?: { folderName?: string; folderId?: string }
  ): Promise<AssetEntry[]> {
    const list = Array.from(files);
    const total = list.length;
    if (total === 0) return [];

    const startTime = performance.now();
    this.setStatus({
      status: 'indexing',
      percentage: 5,
      currentFile: `Unpacking ${list[0].name}…`,
      processedCount: 0,
      totalCount: total,
      message: `Ingesting ${total} item(s)`
    });

    const results: AssetEntry[] = [];

    for (let i = 0; i < total; i++) {
      const file = list[i];
      const isZip = /\.zip$/i.test(file.name) || /zip/.test(file.type || '');
      const pct = Math.round(5 + (90 * (i + 1)) / total);

      this.setStatus({
        status: 'indexing',
        percentage: pct,
        currentFile: `Processing ${file.name}…`,
        processedCount: i + 1,
        totalCount: total,
        message: `Unpacking ${file.name}`
      });

      try {
        const pack = isZip
          ? await createPackFromBlob(file.name, file)
          : createPackFromSingleFile(file);

        const entry = await createEntryFromPack(pack, isZip);

        const relPath = (file as any).webkitRelativePath;
        const topDir = relPath ? relPath.split('/')[0] : folderContext?.folderName;
        if (topDir) {
          entry.author = `local · ${topDir}`;
        }
        if (relPath) {
          entry.filePath = relPath;
          entry.search += ` ${relPath}`;
        } else if (topDir) {
          entry.filePath = `${topDir}/${file.name}`;
          entry.search += ` ${entry.filePath}`;
        }
        if (folderContext?.folderId) {
          entry.folderId = folderContext.folderId;
        }

        results.push(entry);
        onEntryCreated(entry);
        await saveSingleEntry(entry);
      } catch (err) {
        console.error('Failed to unpack', file.name, err);
        this.setStatus({
          currentFile: `Could not unpack ${file.name}`
        });
      }
    }

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
    this.setStatus({
      status: 'complete',
      percentage: 100,
      currentFile: `Added ${results.length} asset(s) in ${elapsed}s`,
      processedCount: total,
      totalCount: total,
      message: `Added ${results.length} assets`
    });

    return results;
  }
}

export const indexingEngine = new IndexingEngine();
