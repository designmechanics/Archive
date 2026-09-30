import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { AssetEntry, WatchedFolder } from '../types';
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

export async function getDatabaseStatus(): Promise<DatabaseStats | null> {
  return await api.getStats();
}
