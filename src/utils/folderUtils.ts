import { AssetEntry, WatchedFolder } from '../types';

/**
 * Robust matching between an AssetEntry and a WatchedFolder.
 * Supports direct folderId, full disk path prefix matching, relative paths,
 * author tags, and search index metadata.
 *
 * `makeFolderMatcher` prepares the folder's strings once, so it can be applied to a whole library
 * (hundreds of thousands of entries) without redoing that work for every entry.
 */
export function makeFolderMatcher(folder: WatchedFolder | null | undefined): (entry: AssetEntry) => boolean {
  if (!folder) return () => false;
  const id = folder.id;
  if (!folder.path) return (entry) => Boolean(entry && entry.folderId && entry.folderId === id);

  const fPath = folder.path.replace(/\\/g, '/').toLowerCase().trim();
  const fName = fPath.split('/').filter(Boolean).pop() || fPath;
  const prefix = fPath + '/';
  const inside = '/' + fPath + '/';
  const namePrefix = fName + '/';
  const nameInside = '/' + fName + '/';

  return (entry) => {
    if (!entry) return false;
    if (entry.folderId && entry.folderId === id) return true;

    // 1. Check filePath
    if (entry.filePath) {
      const ePath = entry.filePath.replace(/\\/g, '/').toLowerCase();
      if (
        ePath === fPath ||
        ePath.startsWith(prefix) ||
        ePath.includes(inside) ||
        ePath.startsWith(namePrefix) ||
        ePath.includes(nameInside)
      ) {
        return true;
      }
    }

    // 2. Check author string (scanned assets are labelled "local · <folder name>")
    if (entry.author) {
      const authorLower = entry.author.toLowerCase();
      if (authorLower.includes(fPath) || authorLower.includes(fName)) return true;
    }

    // 3. Search metadata, only for entries that have no path of their own (the search text of a
    // disk entry already contains its path, which was checked above)
    if (!entry.filePath && entry.search) {
      const searchLower = entry.search.toLowerCase();
      if (searchLower.includes(fPath) || searchLower.includes(fName)) return true;
    }

    return false;
  };
}

export function isEntryInFolder(entry: AssetEntry, folder: WatchedFolder): boolean {
  if (!entry || !folder) return false;
  return makeFolderMatcher(folder)(entry);
}
