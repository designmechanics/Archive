export type AssetType =
  | 'code'
  | 'zip'
  | 'svg'
  | 'font'
  | 'video'
  | 'photo'
  | 'psd'
  | 'ai'
  | 'prproj'
  | 'icon'
  | 'file';

export interface AssetEntry {
  id: string;
  title: string;
  cat: string;
  type: AssetType;
  author: string;
  date: string;
  deps: string;
  size: string;
  fileCount: number;
  exts: string[];
  thumb: string | null;
  packId: string | null;
  search: string;
  demo: string;
  isUserUploaded?: boolean;
  filePath?: string | null;
  folderId?: string | null;
  isZipInnerFile?: boolean;
  zipParentId?: string;
  zipParentTitle?: string;
  zipInnerPath?: string;
}

export interface ActiveZipArchive {
  parent: AssetEntry;
  innerEntries: AssetEntry[];
}

export type ViewMode =
  | 'grid'
  | 'list'
  | 'coverflow'
  | 'strip'
  | 'radial'
  | 'filmstrip'
  | 'peel';

export type ThemeMode = 'light' | 'mid' | 'dark';

export type Density = 2 | 3 | 4 | 5 | 6 | 8;

export type MaxPerPage = 'ALL' | 256 | 128 | 64 | 48 | 32 | 24 | 16;
export const MAX_PER_PAGE_OPTIONS: MaxPerPage[] = ['ALL', 256, 128, 64, 48, 32, 24, 16];

export interface ZipFileInfo {
  path: string;
  size: number;
}

export interface ZipPack {
  name: string;
  size: number;
  list: ZipFileInfo[];
  has: (p: string) => boolean;
  text: (p: string) => Promise<string>;
  b64: (p: string) => Promise<string>;
  blob?: (p: string) => Promise<Blob>;
  rawBlob?: Blob;
}

export interface WatchedFolder {
  id: string;
  path: string;
  count: string;
  enabled?: boolean;
  isIngesting?: boolean;
  ingestStatus?: 'scanning' | 'indexing' | 'complete' | 'error';
}

export interface Pool {
  id: string;
  name: string;
  description?: string;
  color?: string;
  sortOrder?: number;
  createdAt?: number;
}
