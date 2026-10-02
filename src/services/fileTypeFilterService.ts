import { AssetEntry } from '../types';

export interface FileTypeDefinition {
  ext: string;
  label: string;
  category: FileTypeCategory;
  color?: string;
}

export type FileTypeCategory =
  | '3D & VRM'
  | 'Images'
  | 'Vectors'
  | 'Video'
  | 'Audio'
  | 'Fonts'
  | 'Documents'
  | 'Code & Data'
  | 'Archives';

export const FILE_TYPE_CATEGORIES: FileTypeCategory[] = [
  '3D & VRM',
  'Images',
  'Vectors',
  'Video',
  'Audio',
  'Fonts',
  'Documents',
  'Code & Data',
  'Archives'
];

export const CATEGORY_COLORS: Record<FileTypeCategory, string> = {
  '3D & VRM': '#c084fc',
  'Images': '#38bdf8',
  'Vectors': '#f472b6',
  'Video': '#fb923c',
  'Audio': '#4ade80',
  'Fonts': '#a78bfa',
  'Documents': '#facc15',
  'Code & Data': '#60a5fa',
  'Archives': '#fbbf24'
};

export const SUPPORTED_FILE_TYPES: FileTypeDefinition[] = [
  // 3D & VRM
  { ext: 'vrm', label: 'VRM Humanoid Avatar', category: '3D & VRM', color: '#c084fc' },
  { ext: 'vrma', label: 'VRMA Animation Motion', category: '3D & VRM', color: '#e879f9' },
  { ext: 'glb', label: 'GLTF Binary 3D Model', category: '3D & VRM', color: '#a855f7' },
  { ext: 'gltf', label: 'GLTF 3D Scene', category: '3D & VRM', color: '#a855f7' },
  { ext: 'obj', label: 'Wavefront 3D Object', category: '3D & VRM', color: '#818cf8' },
  { ext: 'stl', label: 'STL 3D Geometry', category: '3D & VRM', color: '#6366f1' },
  { ext: 'blend', label: 'Blender 3D Project', category: '3D & VRM', color: '#ea580c' },
  { ext: 'fbx', label: 'Autodesk FBX', category: '3D & VRM', color: '#d946ef' },
  { ext: 'dae', label: 'Collada DAE', category: '3D & VRM', color: '#9333ea' },

  // Images
  { ext: 'png', label: 'PNG Image', category: 'Images', color: '#38bdf8' },
  { ext: 'jpg', label: 'JPEG Image', category: 'Images', color: '#0ea5e9' },
  { ext: 'jpeg', label: 'JPEG Image', category: 'Images', color: '#0ea5e9' },
  { ext: 'webp', label: 'WebP Image', category: 'Images', color: '#2dd4bf' },
  { ext: 'gif', label: 'GIF Animated Image', category: 'Images', color: '#34d399' },
  { ext: 'avif', label: 'AVIF Image', category: 'Images', color: '#06b6d4' },
  { ext: 'bmp', label: 'Bitmap Image', category: 'Images', color: '#64748b' },
  { ext: 'tiff', label: 'TIFF Image', category: 'Images', color: '#64748b' },
  { ext: 'tif', label: 'TIF Image', category: 'Images', color: '#64748b' },
  { ext: 'ico', label: 'Icon', category: 'Images', color: '#f59e0b' },
  { ext: 'psd', label: 'Photoshop PSD', category: 'Images', color: '#3b82f6' },
  { ext: 'psb', label: 'Photoshop PSB', category: 'Images', color: '#1d4ed8' },

  // Vectors
  { ext: 'svg', label: 'SVG Vector', category: 'Vectors', color: '#f472b6' },
  { ext: 'ai', label: 'Adobe Illustrator', category: 'Vectors', color: '#f97316' },
  { ext: 'eps', label: 'Encapsulated PostScript', category: 'Vectors', color: '#ec4899' },

  // Video
  { ext: 'mp4', label: 'MP4 Video', category: 'Video', color: '#fb923c' },
  { ext: 'webm', label: 'WebM Video', category: 'Video', color: '#f97316' },
  { ext: 'mov', label: 'QuickTime Movie', category: 'Video', color: '#ea580c' },
  { ext: 'mkv', label: 'Matroska Video', category: 'Video', color: '#c2410c' },
  { ext: 'm4v', label: 'M4V Video', category: 'Video', color: '#fb923c' },
  { ext: 'avi', label: 'AVI Video', category: 'Video', color: '#d97706' },
  { ext: 'prproj', label: 'Premiere Pro Project', category: 'Video', color: '#9333ea' },
  { ext: 'aep', label: 'After Effects Project', category: 'Video', color: '#7e22ce' },

  // Audio
  { ext: 'mp3', label: 'MP3 Audio', category: 'Audio', color: '#4ade80' },
  { ext: 'wav', label: 'WAV Audio', category: 'Audio', color: '#22c55e' },
  { ext: 'ogg', label: 'Ogg Vorbis Audio', category: 'Audio', color: '#16a34a' },
  { ext: 'm4a', label: 'M4A Audio', category: 'Audio', color: '#15803d' },
  { ext: 'flac', label: 'FLAC Lossless Audio', category: 'Audio', color: '#10b981' },
  { ext: 'aac', label: 'AAC Audio', category: 'Audio', color: '#059669' },

  // Fonts
  { ext: 'ttf', label: 'TrueType Font', category: 'Fonts', color: '#a78bfa' },
  { ext: 'otf', label: 'OpenType Font', category: 'Fonts', color: '#8b5cf6' },
  { ext: 'woff', label: 'Web Font (WOFF)', category: 'Fonts', color: '#7c3aed' },
  { ext: 'woff2', label: 'Web Font 2 (WOFF2)', category: 'Fonts', color: '#6d28d9' },

  // Documents
  { ext: 'pdf', label: 'PDF Document', category: 'Documents', color: '#ef4444' },
  { ext: 'md', label: 'Markdown Document', category: 'Documents', color: '#facc15' },
  { ext: 'txt', label: 'Plain Text', category: 'Documents', color: '#eab308' },
  { ext: 'csv', label: 'CSV Spreadsheet', category: 'Documents', color: '#ca8a04' },
  { ext: 'tsv', label: 'TSV Spreadsheet', category: 'Documents', color: '#a16207' },
  { ext: 'log', label: 'Log File', category: 'Documents', color: '#854d0e' },
  { ext: 'rtf', label: 'Rich Text Format', category: 'Documents', color: '#d97706' },

  // Code & Data
  { ext: 'html', label: 'HTML Webpage', category: 'Code & Data', color: '#f97316' },
  { ext: 'htm', label: 'HTML Webpage', category: 'Code & Data', color: '#f97316' },
  { ext: 'css', label: 'CSS Stylesheet', category: 'Code & Data', color: '#06b6d4' },
  { ext: 'scss', label: 'Sass / SCSS', category: 'Code & Data', color: '#ec4899' },
  { ext: 'sass', label: 'Sass Stylesheet', category: 'Code & Data', color: '#ec4899' },
  { ext: 'less', label: 'Less Stylesheet', category: 'Code & Data', color: '#1d4ed8' },
  { ext: 'js', label: 'JavaScript Script', category: 'Code & Data', color: '#eab308' },
  { ext: 'jsx', label: 'React JSX Component', category: 'Code & Data', color: '#38bdf8' },
  { ext: 'ts', label: 'TypeScript Code', category: 'Code & Data', color: '#3b82f6' },
  { ext: 'tsx', label: 'React TSX Component', category: 'Code & Data', color: '#2563eb' },
  { ext: 'json', label: 'JSON Data', category: 'Code & Data', color: '#10b981' },
  { ext: 'xml', label: 'XML Document', category: 'Code & Data', color: '#6366f1' },
  { ext: 'py', label: 'Python Script', category: 'Code & Data', color: '#3b82f6' },
  { ext: 'sql', label: 'SQL Database Script', category: 'Code & Data', color: '#8b5cf6' },
  { ext: 'sh', label: 'Shell Script', category: 'Code & Data', color: '#10b981' },

  // Archives
  { ext: 'zip', label: 'ZIP Package Archive', category: 'Archives', color: '#fbbf24' },
  { ext: 'rar', label: 'RAR Archive', category: 'Archives', color: '#f59e0b' },
  { ext: '7z', label: '7-Zip Archive', category: 'Archives', color: '#d97706' },
  { ext: 'tar', label: 'TAR Archive', category: 'Archives', color: '#b45309' },
  { ext: 'gz', label: 'GZip Archive', category: 'Archives', color: '#92400e' }
];

export const ALL_SUPPORTED_EXTENSIONS: string[] = SUPPORTED_FILE_TYPES.map((t) => t.ext);

export interface FileTypeFilterConfig {
  active: boolean;
  enabledTypes: Record<string, boolean>;
  showOtherTypes: boolean; // "Rest of" toggle for unknown/other files. Default is false.
}

const STORAGE_KEY = 'archive_filetype_filter_config';

export function createDefaultEnabledTypes(): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const item of SUPPORTED_FILE_TYPES) {
    map[item.ext] = true;
  }
  return map;
}

export const DEFAULT_FILE_TYPE_CONFIG: FileTypeFilterConfig = {
  active: false,
  enabledTypes: createDefaultEnabledTypes(),
  showOtherTypes: false // default to NOT show unknown filetypes as requested
};

export function getFileTypeFilterConfig(): FileTypeFilterConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FILE_TYPE_CONFIG };
    const parsed = JSON.parse(raw);
    return {
      active: typeof parsed.active === 'boolean' ? parsed.active : DEFAULT_FILE_TYPE_CONFIG.active,
      enabledTypes: { ...createDefaultEnabledTypes(), ...(parsed.enabledTypes || {}) },
      showOtherTypes: typeof parsed.showOtherTypes === 'boolean' ? parsed.showOtherTypes : DEFAULT_FILE_TYPE_CONFIG.showOtherTypes
    };
  } catch {
    return { ...DEFAULT_FILE_TYPE_CONFIG };
  }
}

export function saveFileTypeFilterConfig(config: FileTypeFilterConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('archive-filetype-filter-changed', { detail: config }));
  } catch (err) {
    console.error('Failed to save file type filter config:', err);
  }
}

/**
 * Robustly extract primary file extension from an AssetEntry
 */
export function getEntryExtension(entry: AssetEntry): string {
  if (entry.exts && entry.exts.length > 0) {
    const first = entry.exts[0]?.toLowerCase().replace(/^\./, '').trim();
    if (first) return first;
  }
  const pathToCheck = entry.zipInnerPath || entry.filePath || entry.title;
  if (pathToCheck && pathToCheck.includes('.')) {
    const parts = pathToCheck.split('.');
    const last = parts.pop()?.toLowerCase().replace(/^\./, '').trim() || '';
    if (last) return last;
  }
  return '';
}

/**
 * Filter an array of entries using the FileTypeFilterConfig
 */
export function filterEntriesByFileType(
  entries: AssetEntry[],
  config: FileTypeFilterConfig
): AssetEntry[] {
  if (!config.active) {
    return entries;
  }

  return entries.filter((entry) => {
    const ext = getEntryExtension(entry);
    if (!ext) {
      // Entry has no detectable extension
      return config.showOtherTypes;
    }

    if (ALL_SUPPORTED_EXTENSIONS.includes(ext)) {
      return config.enabledTypes[ext] !== false;
    }

    // Unrecognized / other extension
    return config.showOtherTypes;
  });
}

/**
 * Compute live counts of entries in the current catalog for each extension
 */
export function getCatalogExtensionCounts(entries: AssetEntry[]): {
  byExt: Record<string, number>;
  otherCount: number;
} {
  const byExt: Record<string, number> = {};
  let otherCount = 0;

  for (const entry of entries) {
    const ext = getEntryExtension(entry);
    if (!ext) {
      otherCount++;
    } else if (ALL_SUPPORTED_EXTENSIONS.includes(ext)) {
      byExt[ext] = (byExt[ext] || 0) + 1;
    } else {
      otherCount++;
    }
  }

  return { byExt, otherCount };
}
