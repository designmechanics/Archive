import { AssetEntry, WatchedFolder } from '../types';

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
}

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
  }
};
