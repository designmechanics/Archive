import { AssetEntry, WatchedFolder, Pool } from '../types';

export interface DatabaseStats {
  dbPath: string;
  dbSizeBytes: number;
  walSizeBytes: number;
  totalSizeBytes: number;
  dbSizeFormatted: string;
  assetCount: number;
  innerFileCount: number;
  folderCount: number;
  categories: Record<string, number>;
  types: Record<string, number>;
  sqliteVersion: string;
  walMode: boolean;
}

export interface DatabaseBackup {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  sizeFormatted: string;
  createdAt: number;
  dateFormatted: string;
}

export interface ScannerStatus {

  status: 'idle' | 'scanning' | 'indexing' | 'complete' | 'error';
  currentFolder: string;
  currentFile: string;
  processedCount: number;
  totalCount: number;
  percentage: number;
  message: string;
  startTime: number;
  elapsed: string;
  /** Stage two: zip contents read in the background after indexing completes */
  zips?: ZipStageStatus;
}

export interface ZipStageStatus {
  running: boolean;
  total: number;
  done: number;
  current: string;
}

/** Rows fetched per request when loading the whole library */
const ASSET_PAGE_SIZE = 20000;

const API_BASE = '/api';

export const api = {
  /**
   * Check health and fetch SQLite database statistics
   */
  async getStats(): Promise<DatabaseStats | null> {
    try {
      const res = await fetch(`${API_BASE}/stats`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.stats;
    } catch {
      return null;
    }
  },

  /**
   * Fetch assets with optional full-text search and pool filter
   */
  async getAssets(params?: {
    q?: string;
    cat?: string;
    type?: string;
    limit?: number;
    offset?: number;
    sort?: string;
    order?: 'asc' | 'desc';
  }): Promise<AssetEntry[]> {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.cat) qs.set('cat', params.cat);
    if (params?.type) qs.set('type', params.type);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    if (params?.sort) qs.set('sort', params.sort);
    if (params?.order) qs.set('order', params.order);

    const res = await fetch(`${API_BASE}/assets?${qs.toString()}`);
    if (!res.ok) throw new Error(`Failed to fetch assets: ${res.statusText}`);
    const data = await res.json();
    return data.assets || [];
  },

  /**
   * Fetch the whole library in pages so no single response is huge and nothing is cut off by a
   * server-side cap. `onChunk` receives the rows loaded so far after each page, so the UI can
   * show the first page immediately while the rest streams in.
   */
  async getAllAssets(
    params?: { cat?: string; type?: string; sort?: string; order?: 'asc' | 'desc' },
    onChunk?: (loadedSoFar: AssetEntry[], total: number | null) => void
  ): Promise<AssetEntry[]> {
    const all: AssetEntry[] = [];
    let offset = 0;
    while (true) {
      const qs = new URLSearchParams();
      if (params?.cat) qs.set('cat', params.cat);
      if (params?.type) qs.set('type', params.type);
      if (params?.sort) qs.set('sort', params.sort);
      if (params?.order) qs.set('order', params.order);
      qs.set('limit', String(ASSET_PAGE_SIZE));
      qs.set('offset', String(offset));

      const res = await fetch(`${API_BASE}/assets?${qs.toString()}`);
      if (!res.ok) throw new Error(`Failed to fetch assets: ${res.statusText}`);
      const data = await res.json();
      const page: AssetEntry[] = data.assets || [];
      for (const a of page) all.push(a);
      offset += page.length;
      if (onChunk) onChunk(all, typeof data.total === 'number' ? data.total : null);
      if (page.length < ASSET_PAGE_SIZE) break;
    }
    return all;
  },

  /**
   * Complete file list of one indexed archive (the index keeps only the first 500 per archive)
   */
  async getArchiveList(
    id: string
  ): Promise<{ files: { path: string; size: number; ext: string }[]; fileCount: number; encrypted: boolean } | null> {
    try {
      const res = await fetch(`${API_BASE}/archive/list?id=${encodeURIComponent(id)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.success ? data : null;
    } catch {
      return null;
    }
  },

  /**
   * Ask the server to read the contents of any zips still waiting (stage two). Idempotent.
   */
  async processZips(): Promise<ZipStageStatus | null> {
    try {
      const res = await fetch(`${API_BASE}/zips/process`, { method: 'POST' });
      if (!res.ok) return null;
      const data = await res.json();
      return data.zips || null;
    } catch {
      return null;
    }
  },

  /**
   * Ask the server to make a thumbnail (raster images). Returns the thumbnail URL, or null when the
   * server cannot (unsupported type, unreadable image) so the caller can fall back to the browser.
   */
  async makeThumbnail(id: string): Promise<string | null> {
    try {
      const res = await fetch(`${API_BASE}/thumb/make`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.success ? (data.thumbUrl as string) : null;
    } catch {
      return null;
    }
  },

  /**
   * Batch version of makeThumbnail: one request for many images. Returns id -> URL (null when the
   * server could not make that one).
   */
  async makeThumbnails(ids: string[]): Promise<Record<string, string | null>> {
    const res = await fetch(`${API_BASE}/thumb/make-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    if (!res.ok) throw new Error(`Thumbnail batch failed: ${res.status}`);
    const data = await res.json();
    return data.results || {};
  },

  /**
   * Remember previews that could not be generated so they are not retried on every launch
   */
  async markThumbsFailed(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    try {
      await fetch(`${API_BASE}/thumbnail/failed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
    } catch {
      // not critical
    }
  },

  /**
   * Fetch a single asset with full inner files
   */
  async getAssetById(id: string): Promise<(AssetEntry & { files?: any[] }) | null> {
    try {
      const res = await fetch(`${API_BASE}/assets/${encodeURIComponent(id)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.asset || null;
    } catch {
      return null;
    }
  },

  /**
   * Save or update an asset in SQLite
   */
  async saveAsset(asset: AssetEntry, files?: { path: string; size: number; ext?: string }[]): Promise<void> {
    const body = files ? { ...asset, files } : asset;
    await fetch(`${API_BASE}/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  },

  /**
   * Bulk insert assets in a single SQLite transaction
   */
  async saveAssetsBulk(assets: AssetEntry[]): Promise<void> {
    await fetch(`${API_BASE}/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assets)
    });
  },

  /**
   * Update category of an asset
   */
  async updateCategory(id: string, cat: string): Promise<void> {
    await fetch(`${API_BASE}/assets/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cat })
    });
  },

  /**
   * Saves a thumbnail snapshot into .thumbnails on disk and references it in SQLite
   */
  async saveThumbnail(id: string, dataUrl: string): Promise<string | null> {
    try {
      const res = await fetch(`${API_BASE}/thumbnail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, dataUrl })
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.thumbUrl || null;
    } catch {
      return null;
    }
  },

  /**
   * Delete single asset
   */
  async deleteAsset(id: string): Promise<void> {
    await fetch(`${API_BASE}/assets/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  },

  /**
   * Clear all assets from SQLite
   */
  async clearAll(): Promise<void> {
    await fetch(`${API_BASE}/assets`, {
      method: 'DELETE'
    });
  },

  /**
   * Get watched folders from SQLite
   */
  async getFolders(): Promise<WatchedFolder[]> {
    try {
      const res = await fetch(`${API_BASE}/folders`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.folders || [];
    } catch {
      return [];
    }
  },

  /**
   * Add watched folder
   */
  async addFolder(folderPath: string, count = 0): Promise<WatchedFolder[]> {
    const res = await fetch(`${API_BASE}/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: folderPath, count })
    });
    const data = await res.json();
    return data.folders || [];
  },

  /**
   * Remove watched folder
   */
  async removeFolder(id: string): Promise<WatchedFolder[]> {
    const res = await fetch(`${API_BASE}/folders/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    return data.folders || [];
  },

  /**
   * Update watched folder (enable/disable, count)
   */
  async updateFolder(id: string, updates: { enabled?: boolean; count?: number }): Promise<WatchedFolder[]> {
    try {
      const res = await fetch(`${API_BASE}/folders/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      return data.folders || [];
    } catch {
      return [];
    }
  },

  /**
   * Trigger local disk scan
   */
  async scanFolder(folderPath: string): Promise<void> {
    await fetch(`${API_BASE}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath })
    });
  },

  /**
   * Get live scanner progress
   */
  async getScanStatus(): Promise<ScannerStatus | null> {
    try {
      const res = await fetch(`${API_BASE}/scan/status`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.status || null;
    } catch {
      return null;
    }
  },

  /**
   * Get setting from SQLite
   */
  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const res = await fetch(`${API_BASE}/settings?key=${encodeURIComponent(key)}`);
      if (!res.ok) return defaultValue;
      const data = await res.json();
      return data.value !== null && data.value !== undefined ? data.value : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  /**
   * Save setting to SQLite
   */
  async saveSetting<T>(key: string, value: T): Promise<void> {
    try {
      await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });
    } catch (e) {
      console.warn('Failed to save setting to SQLite:', e);
    }
  },

  /**
   * Optimize SQLite database (VACUUM and PRAGMA optimize)
   */
  async optimizeDatabase(): Promise<DatabaseStats | null> {
    try {
      const res = await fetch(`${API_BASE}/db/optimize`, { method: 'POST' });
      const data = await res.json();
      return data.stats || null;
    } catch {
      return null;
    }
  },

  /**
   * Create point-in-time SQLite database backup into backups/ folder
   */
  async createBackup(): Promise<DatabaseBackup | null> {
    try {
      const res = await fetch(`${API_BASE}/db/backup`, { method: 'POST' });
      if (!res.ok) return null;
      const data = await res.json();
      return data.backup || null;
    } catch {
      return null;
    }
  },

  /**
   * List all database backups in backups/ folder
   */
  async listBackups(): Promise<DatabaseBackup[]> {
    try {
      const res = await fetch(`${API_BASE}/db/backups`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.backups || [];
    } catch {
      return [];
    }
  },

  /**
   * Get all pools/categories from database
   */
  async getPools(): Promise<Pool[]> {
    try {
      const res = await fetch(`${API_BASE}/pools`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.pools || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        color: p.color || '#94bce3',
        sortOrder: p.sort_order || 0,
        createdAt: p.created_at || Date.now()
      }));
    } catch {
      return [];
    }
  },

  /**
   * Add a new custom pool
   */
  async addPool(pool: { name: string; description?: string; color?: string; sortOrder?: number }): Promise<Pool | null> {
    try {
      const res = await fetch(`${API_BASE}/pools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pool.name,
          description: pool.description || '',
          color: pool.color || '#94bce3',
          sort_order: pool.sortOrder || 0
        })
      });
      if (!res.ok) return null;
      const data = await res.json();
      const p = data.pool;
      return {
        id: p.id,
        name: p.name,
        description: p.description || '',
        color: p.color || '#94bce3',
        sortOrder: p.sort_order || 0,
        createdAt: p.created_at || Date.now()
      };
    } catch {
      return null;
    }
  },

  /**
   * Update an existing pool (renames cascade to assets)
   */
  async updatePool(id: string, updates: Partial<Pool>): Promise<Pool | null> {
    try {
      const res = await fetch(`${API_BASE}/pools/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: updates.name,
          description: updates.description,
          color: updates.color,
          sort_order: updates.sortOrder
        })
      });
      if (!res.ok) return null;
      const data = await res.json();
      const p = data.pool;
      return {
        id: p.id,
        name: p.name,
        description: p.description || '',
        color: p.color || '#94bce3',
        sortOrder: p.sort_order || 0,
        createdAt: p.created_at || Date.now()
      };
    } catch {
      return null;
    }
  },

  /**
   * Delete a pool and optionally reassign its assets
   */
  async deletePool(id: string, reassignTo?: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/pools/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reassignTo })
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  /**
   * Reorder pools by their sorted array of IDs
   */
  async reorderPools(orderedIds: string[]): Promise<Pool[]> {
    try {
      const res = await fetch(`${API_BASE}/pools/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: orderedIds })
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.pools || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        color: p.color || '#94bce3',
        sortOrder: p.sort_order ?? 0,
        createdAt: p.created_at || Date.now()
      }));
    } catch {
      return [];
    }
  }
};


