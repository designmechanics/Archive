import { AssetEntry, WatchedFolder } from '../types';

/**
 * Robust matching between an AssetEntry and a WatchedFolder.
 * Supports direct folderId, full disk path prefix matching, relative paths,
 * author tags, and search index metadata.
 */
export function isEntryInFolder(entry: AssetEntry, folder: WatchedFolder): boolean {
  if (!entry || !folder) return false;
  if (entry.folderId && entry.folderId === folder.id) return true;
  if (!folder.path) return false;

  const fPath = folder.path.replace(/\\/g, '/').toLowerCase().trim();
  const fName = fPath.split('/').filter(Boolean).pop() || fPath;

  // 1. Check filePath
  if (entry.filePath) {
    const ePath = entry.filePath.replace(/\\/g, '/').toLowerCase().trim();
    if (
      ePath === fPath ||
      ePath.startsWith(fPath + '/') ||
      ePath.startsWith(fPath + '\\') ||
      ePath.includes('/' + fPath + '/') ||
      ePath.startsWith(fName + '/') ||
      ePath.includes('/' + fName + '/')
    ) {
      return true;
    }
  }

  // 2. Check author string (scanned assets are labelled "local · <folder name>")
  if (entry.author) {
    const authorLower = entry.author.toLowerCase();
    if (
      authorLower.includes(fPath) ||
      authorLower.includes(fName)
    ) {
      return true;
    }
  }

  // 3. Check search metadata
  if (entry.search) {
    const searchLower = entry.search.toLowerCase();
    if (searchLower.includes(fPath) || searchLower.includes(fName)) {
      return true;
    }
  }

  return false;
}
