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
  | '3d'
  | 'raw'
  | 'swf'
  | 'doc'
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
  /** A preview was attempted and could not be made; do not retry automatically */
  thumbFailed?: boolean;
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
  dateCreated?: string;
  dateModified?: string;
  sizeBytes?: number;
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

export type ThemeMode = 'light' | 'mid' | 'dark' | 'black' | 'custom';

export interface CustomThemeColors {
  bg: string;
  surface: string;
  rail: string;
  well: string;
  ink: string;
  tint: string;
  "tint-ink": string;
  accent: string;
}

export type BackgroundFit = 'cover' | 'contain' | 'tile' | 'center';

export interface CustomBackgroundConfig {
  url: string | null;
  opacity: number;
  fit: BackgroundFit;
  blur: number;
}

export type Density = 2 | 3 | 4 | 5 | 6 | 8;

export type ListColumns = 1 | 2 | 3 | 4;
export type ListOrder = 'down' | 'across';

export type SortOption =
  | 'name'
  | 'number'
  | 'date_mod'
  | 'date_created'
  | 'age'
  | 'size'
  | 'type';

export type SortDirection = 'asc' | 'desc';

/** How zip files appear in the main library view */
export type ZipMode = 'show' | 'hide' | 'only';

export type MaxPerPage ='ALL' | 256 | 128 | 64 | 48 | 32 | 24 | 16;
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
