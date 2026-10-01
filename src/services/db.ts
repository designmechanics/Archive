import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { AssetEntry, WatchedFolder, Pool } from '../types';
import { getInitialSeedEntries } from '../data/seedData';
import { api, DatabaseStats } from './api';

interface ArchiveDB extends DBSchema {
  entries: {
    key: string;
    value: AssetEntry;
    indexes: { 'by-cat': string; 'by-type': string };
  };
  packs: {
    key: string;
    value: {
      id: string;
      name: string;
      size: number;
      blob: Blob;
      list: { path: string; size: number }[];
    };
  };
  settings: {
    key: string;
    value: any;
  };
  folders: {
    key: string;
    value: WatchedFolder;
  };
}

const DB_NAME = 'archive-library-db';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<ArchiveDB>> | null = null;
let isBackendAvailable: boolean | null = null;

export async function checkSQLiteBackend(): Promise<boolean> {
  try {
    const stats = await api.getStats();
    isBackendAvailable = stats !== null;
    return isBackendAvailable;
  } catch {
    isBackendAvailable = false;
    return false;
  }
}

export function getDB(): Promise<IDBPDatabase<ArchiveDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ArchiveDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('entries')) {
          const entryStore = db.createObjectStore('entries', { keyPath: 'id' });
          entryStore.createIndex('by-cat', 'cat');
          entryStore.createIndex('by-type', 'type');
        }
        if (!db.objectStoreNames.contains('packs')) {
          db.createObjectStore('packs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
        if (!db.objectStoreNames.contains('folders')) {
          db.createObjectStore('folders', { keyPath: 'id' });
        }
      }
    });
  }
  return dbPromise;
}

/**
 * Loads real assets directly from SQLite database (D:\Archive\archive.db).
 * Falls back to IndexedDB if backend API is not running.
 */
export async function loadEntries(): Promise<AssetEntry[]> {
  try {
    const sqliteAssets = await api.getAssets();
    // Filter out any mock prototype leftovers
    const realAssets = sqliteAssets.filter((e) => !/^a\d+$/.test(e.id) || e.isUserUploaded);
    isBackendAvailable = true;
    return realAssets;
  } catch (err) {
    console.warn('[Storage] SQLite backend not reachable, using IndexedDB fallback:', err);
    isBackendAvailable = false;
  }

  // Fallback to IndexedDB
  const db = await getDB();
  const all = await db.getAll('entries');

  // Purge any mock prototype assets (ids starting with 'a' followed by digits)
  const mockEntries = all.filter((e) => /^a\d+$/.test(e.id) && !e.isUserUploaded);
  if (mockEntries.length > 0) {
    const tx = db.transaction('entries', 'readwrite');
    for (const m of mockEntries) {
      await tx.store.delete(m.id);
    }
    await tx.done;
  }

  const remaining = await db.getAll('entries');
  return remaining.filter((e) => !/^a\d+$/.test(e.id) || e.isUserUploaded);
}

/**
 * Explicitly loads demo assets if the user ever requests them.
 */
export async function loadDemoEntries(): Promise<AssetEntry[]> {
  const initial = getInitialSeedEntries();

  try {
    await api.saveAssetsBulk(initial);
  } catch (err) {
    console.warn('Could not save demos to SQLite, saving to IndexedDB:', err);
  }

  const db = await getDB();
  const tx = db.transaction('entries', 'readwrite');
  for (const item of initial) {
    await tx.store.put(item);
  }
  await tx.done;
  return initial;
}

/**
 * Clears all assets from the archive (both SQLite archive.db and IndexedDB).
 */
export async function clearAllEntries(): Promise<void> {
  try {
    await api.clearAll();
  } catch (err) {
    console.warn('SQLite clear failed:', err);
  }

  const db = await getDB();
  await db.clear('entries');
  await db.clear('packs');
}

export async function saveEntries(entries: AssetEntry[]): Promise<void> {
  try {
    await api.saveAssetsBulk(entries);
  } catch (err) {
    console.warn('Failed saving to SQLite, saving to IndexedDB:', err);
  }

  const db = await getDB();
  const tx = db.transaction('entries', 'readwrite');
  for (const entry of entries) {
    await tx.store.put(entry);
  }
  await tx.done;
}

export async function saveSingleEntry(entry: AssetEntry): Promise<void> {
  try {
    await api.saveAsset(entry);
  } catch (err) {
    console.warn('Failed saving single entry to SQLite:', err);
  }

  const db = await getDB();
  await db.put('entries', entry);
}

export async function updateEntryCategory(id: string, newCat: string): Promise<void> {
  try {
    await api.updateCategory(id, newCat);
  } catch (err) {
    console.warn('Failed updating category in SQLite:', err);
  }

  const db = await getDB();
  const entry = await db.get('entries', id);
  if (entry) {
    entry.cat = newCat;
    await db.put('entries', entry);
  }
}

export async function savePackBlob(
  id: string,
  name: string,
  size: number,
  blob: Blob,
  list: { path: string; size: number }[]
): Promise<void> {
  const db = await getDB();
  await db.put('packs', { id, name, size, blob, list });
}

export async function getPackBlob(id: string) {
  const db = await getDB();
  return await db.get('packs', id);
}

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const val = await api.getSetting<T>(key, defaultValue);
    if (val !== undefined && val !== null) return val;
  } catch {
    // Fall back to IndexedDB
  }

  try {
    const db = await getDB();
    const val = await db.get('settings', key);
    return val !== undefined ? val : defaultValue;
  } catch {
    return defaultValue;
  }
}

export async function saveSetting<T>(key: string, value: T): Promise<void> {
  try {
    await api.saveSetting(key, value);
  } catch {
    // Ignore error
  }

  try {
    const db = await getDB();
    await db.put('settings', value, key);
  } catch (err) {
    console.error('Failed to save setting to IndexedDB:', key, err);
  }
}

/**
 * Returns watched folders from SQLite database (or IndexedDB).
 */
export async function getWatchedFolders(): Promise<WatchedFolder[]> {
  try {
    const folders = await api.getFolders();
    const realFolders = folders.filter((f) => f.id !== 'f1' && f.id !== 'f2' && f.id !== 'f3');
    return realFolders;
  } catch (err) {
    console.warn('Failed to load folders from SQLite:', err);
  }

  const db = await getDB();
  const list = await db.getAll('folders');
  return list.filter((f) => f.id !== 'f1' && f.id !== 'f2' && f.id !== 'f3');
}

export async function addWatchedFolder(path: string, count: string = '0'): Promise<WatchedFolder[]> {
  try {
    const folders = await api.addFolder(path, parseInt(count, 10) || 0);
    return folders;
  } catch (err) {
    console.warn('Failed to add folder to SQLite, saving to IndexedDB:', err);
  }

  const db = await getDB();
  const item: WatchedFolder = {
    id: 'f_' + Date.now(),
    path,
    count
  };
  await db.put('folders', item);
  return getWatchedFolders();
}

export async function removeWatchedFolder(id: string): Promise<WatchedFolder[]> {
  try {
    const folders = await api.removeFolder(id);
    return folders;
  } catch (err) {
    console.warn('Failed to remove folder from SQLite:', err);
  }

  const db = await getDB();
  await db.delete('folders', id);
  return getWatchedFolders();
}

export async function updateWatchedFolder(folder: WatchedFolder): Promise<void> {
  const db = await getDB();
  await db.put('folders', folder);
}

export async function toggleWatchedFolder(id: string, enabled: boolean): Promise<WatchedFolder[]> {
  try {
    const folders = await api.updateFolder(id, { enabled });
    if (folders && folders.length > 0) return folders;
  } catch (err) {
    console.warn('Failed to toggle folder in SQLite:', err);
  }

  const db = await getDB();
  const folder = await db.get('folders', id);
  if (folder) {
    folder.enabled = enabled;
    await db.put('folders', folder);
  }
  return getWatchedFolders();
}

export async function getDatabaseStatus(): Promise<DatabaseStats | null> {
  return await api.getStats();
}

const DEFAULT_POOLS: Pool[] = [
  { id: 'pool_1', name: 'Effects', color: '#94bce3', description: 'Visual effects, shaders, and display animations' },
  { id: 'pool_2', name: 'Buttons', color: '#60a5fa', description: 'Interactive button controls, micro-interactions' },
  { id: 'pool_3', name: 'Loaders', color: '#38bdf8', description: 'Progress bars, spinners, and skeleton loaders' },
  { id: 'pool_4', name: 'Backgrounds', color: '#a78bfa', description: 'Canvas backgrounds, gradients, and dynamic patterns' },
  { id: 'pool_5', name: 'Transitions', color: '#c084fc', description: 'Page transitions, view morphs, slide states' },
  { id: 'pool_6', name: 'Typography', color: '#f472b6', description: 'Type specimens, kinetic text, and font kits' },
  { id: 'pool_7', name: 'Layouts', color: '#fb7185', description: 'Responsive grids, hero sections, and card systems' },
  { id: 'pool_8', name: 'Scroll', color: '#fb923c', description: 'Scroll triggers, parallax, and sticky viewports' },
  { id: 'pool_9', name: 'Physics', color: '#facc15', description: 'Matter.js, collision, and particle dynamics' },
  { id: 'pool_10', name: 'Shaders', color: '#4ade80', description: 'WebGL fragments, GLSL rays, and lens distortion' },
  { id: 'pool_11', name: 'Routines/utils', color: '#2dd4bf', description: 'Helper functions, mathematical formulas, and hooks' },
  { id: 'pool_12', name: 'Experiments', color: '#e879f9', description: 'Experimental sandbox rigs and creative prototypes' }
];

export async function loadPools(): Promise<Pool[]> {
  try {
    const list = await api.getPools();
    if (list && list.length > 0) return list;
  } catch (err) {
    console.warn('Failed to load pools from SQLite:', err);
  }

  // Fallback to IndexedDB settings
  const saved = await getSetting<Pool[]>('custom_pools', DEFAULT_POOLS);
  return saved && saved.length > 0 ? saved : DEFAULT_POOLS;
}

export async function createPool(pool: { name: string; description?: string; color?: string; sortOrder?: number }): Promise<Pool[]> {
  try {
    await api.addPool(pool);
    return await loadPools();
  } catch (err) {
    console.warn('Failed to add pool via SQLite:', err);
  }

  const current = await loadPools();
  const newPool: Pool = {
    id: 'pool_' + Date.now(),
    name: pool.name.trim(),
    description: pool.description || '',
    color: pool.color || '#94bce3',
    sortOrder: current.length,
    createdAt: Date.now()
  };
  const updated = [...current, newPool];
  await saveSetting('custom_pools', updated);
  return updated;
}

export async function editPool(id: string, updates: Partial<Pool>): Promise<Pool[]> {
  try {
    await api.updatePool(id, updates);
    return await loadPools();
  } catch (err) {
    console.warn('Failed to update pool via SQLite:', err);
  }

  const current = await loadPools();
  const existing = current.find((p) => p.id === id);
  if (existing && updates.name && updates.name !== existing.name) {
    // cascade update entries in IDB
    const db = await getDB();
    const entries = await db.getAll('entries');
    const tx = db.transaction('entries', 'readwrite');
    for (const e of entries) {
      if (e.cat === existing.name) {
        e.cat = updates.name;
        await tx.store.put(e);
      }
    }
    await tx.done;
  }

  const updated = current.map((p) => (p.id === id ? { ...p, ...updates } : p));
  await saveSetting('custom_pools', updated);
  return updated;
}

export async function removePool(id: string, reassignTo?: string): Promise<Pool[]> {
  try {
    await api.deletePool(id, reassignTo);
    return await loadPools();
  } catch (err) {
    console.warn('Failed to delete pool via SQLite:', err);
  }

  const current = await loadPools();
  const target = current.find((p) => p.id === id);
  if (target) {
    const fallback = reassignTo || 'Uncategorized';
    const db = await getDB();
    const entries = await db.getAll('entries');
    const tx = db.transaction('entries', 'readwrite');
    for (const e of entries) {
      if (e.cat === target.name) {
        e.cat = fallback;
        await tx.store.put(e);
      }
    }
    await tx.done;
  }

  const updated = current.filter((p) => p.id !== id);
  await saveSetting('custom_pools', updated);
  return updated;
}

export async function reorderPools(orderedPools: Pool[]): Promise<Pool[]> {
  const indexedPools = orderedPools.map((p, idx) => ({ ...p, sortOrder: idx }));
  try {
    const updated = await api.reorderPools(indexedPools.map((p) => p.id));
    if (updated && updated.length > 0) return updated;
  } catch (err) {
    console.warn('Failed to reorder pools via SQLite:', err);
  }

  await saveSetting('custom_pools', indexedPools);
  return indexedPools;
}

