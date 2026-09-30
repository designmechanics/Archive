import { AssetEntry, SortOption, SortDirection } from '../types';

export interface SortMeta {
  key: SortOption;
  label: string;
  icon: string;
  description: string;
  defaultDirection: SortDirection;
}

export const SORT_CONFIGS: Record<SortOption, SortMeta> = {
  name: {
    key: 'name',
    label: 'Name',
    icon: '🔤',
    description: 'Alphabetical by filename / title',
    defaultDirection: 'asc'
  },
  number: {
    key: 'number',
    label: 'Number',
    icon: '🔢',
    description: 'Sequential numeric prefix or contained digits',
    defaultDirection: 'asc'
  },
  date_mod: {
    key: 'date_mod',
    label: 'Date Mod',
    icon: '🕒',
    description: 'Last modified timestamp (recent first)',
    defaultDirection: 'desc'
  },
  date_created: {
    key: 'date_created',
    label: 'Date Created',
    icon: '📅',
    description: 'Creation or indexing date (recent first)',
    defaultDirection: 'desc'
  },
  age: {
    key: 'age',
    label: 'Age',
    icon: '⏳',
    description: 'Chronological asset age (oldest first)',
    defaultDirection: 'desc'
  },
  size: {
    key: 'size',
    label: 'Size',
    icon: '💾',
    description: 'File size in bytes (largest first)',
    defaultDirection: 'desc'
  },
  type: {
    key: 'type',
    label: 'Type',
    icon: '🏷️',
    description: 'Extension and media kind grouping (A–Z)',
    defaultDirection: 'asc'
  }
};

export const SORT_OPTIONS: SortOption[] = [
  'name',
  'number',
  'date_mod',
  'date_created',
  'size',
  'type',
  'age'
];

/**
 * Extracts the first contiguous numeric sequence from a title.
 * E.g. "asset_042.png" -> 42, "12_clip.mp4" -> 12, "logo.svg" -> MAX_SAFE_INTEGER
 */
export function extractNumber(str?: string): number {
  if (!str) return Number.MAX_SAFE_INTEGER;
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : Number.MAX_SAFE_INTEGER;
}

/**
 * Parses size strings like "2.4 MB", "512 KB", "1.2 GB" into total bytes.
 */
export function parseSizeBytes(sizeStr?: string): number {
  if (!sizeStr) return 0;
  const match = sizeStr.trim().match(/^([0-9.]+)\s*([a-zA-Z]+)?$/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  if (isNaN(num)) return 0;
  const unit = (match[2] || 'B').toUpperCase();
  if (unit.startsWith('T')) return num * 1024 * 1024 * 1024 * 1024;
  if (unit.startsWith('G')) return num * 1024 * 1024 * 1024;
  if (unit.startsWith('M')) return num * 1024 * 1024;
  if (unit.startsWith('K')) return num * 1024;
  return num;
}

/**
 * Sorts an array of asset entries based on the chosen sortOption and direction.
 */
export function sortEntries(
  entries: AssetEntry[],
  sortOption: SortOption,
  sortDirection: SortDirection
): AssetEntry[] {
  const isAsc = sortDirection === 'asc';
  const copy = [...entries];

  copy.sort((a, b) => {
    let cmp = 0;
    switch (sortOption) {
      case 'name': {
        cmp = a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
        break;
      }

      case 'number': {
        const numA = extractNumber(a.title);
        const numB = extractNumber(b.title);
        if (numA !== numB) {
          cmp = numA - numB;
        } else {
          cmp = a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
        }
        break;
      }

      case 'date_mod': {
        const dateA = a.dateModified || a.date || '';
        const dateB = b.dateModified || b.date || '';
        cmp = dateA.localeCompare(dateB);
        break;
      }

      case 'date_created': {
        const dateA = a.dateCreated || a.date || '';
        const dateB = b.dateCreated || b.date || '';
        cmp = dateA.localeCompare(dateB);
        break;
      }

      case 'age': {
        // High age = earlier date / older file
        const dateA = a.dateCreated || a.date || '';
        const dateB = b.dateCreated || b.date || '';
        // If sorting DESC by age (default): oldest first (earlier date first)
        cmp = dateA.localeCompare(dateB);
        break;
      }

      case 'size': {
        const sizeA = a.sizeBytes ?? parseSizeBytes(a.size);
        const sizeB = b.sizeBytes ?? parseSizeBytes(b.size);
        cmp = sizeA - sizeB;
        break;
      }

      case 'type': {
        const typeA = (a.exts?.[0] || a.type || '').toLowerCase();
        const typeB = (b.exts?.[0] || b.type || '').toLowerCase();
        cmp = typeA.localeCompare(typeB);
        if (cmp === 0) {
          cmp = a.title.localeCompare(b.title, undefined, { numeric: true });
        }
        break;
      }

      default:
        cmp = 0;
    }

    return isAsc ? cmp : -cmp;
  });

  return copy;
}

/**
 * Extracts the initial letter/number glyph from a filename for the Name/Number watermark.
 */
export function getInitialGlyph(title: string, sortOption: SortOption): string {
  if (!title) return '';
  const trimmed = title.trim();
  if (!trimmed) return '';

  if (sortOption === 'number') {
    const numMatch = trimmed.match(/\d+/);
    if (numMatch) {
      return numMatch[0].slice(0, 2);
    }
    return '#';
  }

  // Name: take first alphanumeric character or symbol
  const char = trimmed.charAt(0).toUpperCase();
  return char;
}

/**
 * Formats a date string for the backdrop watermark (e.g. "OCT 2024" or "2024").
 */
export function formatDateWatermark(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    return `${month} ${year}`;
  }
  return dateStr.slice(0, 7).toUpperCase();
}

/**
 * Formats the age watermark (e.g. "2 YEARS", "6 MONTHS", "3 WEEKS", "TODAY").
 */
export function formatAgeWatermark(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = Date.now();
  const diffMs = Math.max(0, now - d.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diffDays / 30.4375);
  const diffYears = Math.floor(diffDays / 365.25);

  if (diffYears >= 1) {
    return diffYears === 1 ? '1 YEAR' : `${diffYears} YEARS`;
  }
  if (diffMonths >= 1) {
    return diffMonths === 1 ? '1 MONTH' : `${diffMonths} MONTHS`;
  }
  if (diffDays >= 7) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? '1 WEEK' : `${weeks} WEEKS`;
  }
  if (diffDays >= 1) {
    return diffDays === 1 ? '1 DAY' : `${diffDays} DAYS`;
  }
  return 'TODAY';
}

/**
 * Computes the backdrop watermark string for an individual asset entry based on the active sort option.
 */
export function computeItemWatermark(entry: AssetEntry, sortOption: SortOption): string {
  if (!entry) return '';

  switch (sortOption) {
    case 'name':
      return getInitialGlyph(entry.title, 'name');

    case 'number':
      return getInitialGlyph(entry.title, 'number');

    case 'date_mod':
      return formatDateWatermark(entry.dateModified || entry.date);

    case 'date_created':
      return formatDateWatermark(entry.dateCreated || entry.date);

    case 'age':
      return formatAgeWatermark(entry.dateCreated || entry.date);

    case 'type':
      return (entry.exts?.[0] || entry.type).toUpperCase();

    case 'size':
      return entry.size ? entry.size.toUpperCase() : '0 B';

    default:
      return '';
  }
}
