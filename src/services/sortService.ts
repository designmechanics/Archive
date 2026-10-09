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
  const n = entries.length;

  // A shared Collator is many times faster than String.localeCompare with options, which matters
  // when sorting a quarter of a million titles. Keys that need parsing are computed once, up front.
  let numKeys: number[] | null = null;
  let sizeKeys: number[] | null = null;
  let typeKeys: string[] | null = null;
  if (sortOption === 'number') numKeys = entries.map((e) => extractNumber(e.title));
  if (sortOption === 'size') sizeKeys = entries.map((e) => e.sizeBytes ?? parseSizeBytes(e.size));
  if (sortOption === 'type') typeKeys = entries.map((e) => (e.exts?.[0] || e.type || '').toLowerCase());

  const order = new Array<number>(n);
  for (let i = 0; i < n; i++) order[i] = i;

  order.sort((i, j) => {
    const a = entries[i];
    const b = entries[j];
    let cmp = 0;
    switch (sortOption) {
      case 'name':
        cmp = nameCollator.compare(a.title, b.title);
        break;

      case 'number':
        cmp = numKeys![i] !== numKeys![j] ? numKeys![i] - numKeys![j] : nameCollator.compare(a.title, b.title);
        break;

      case 'date_mod':
        cmp = cmpStr(a.dateModified || a.date || '', b.dateModified || b.date || '');
        break;

      case 'date_created':
      case 'age':
        // age: High age = earlier date / older file
        cmp = cmpStr(a.dateCreated || a.date || '', b.dateCreated || b.date || '');
        break;

      case 'size':
        cmp = sizeKeys![i] - sizeKeys![j];
        break;

      case 'type':
        cmp = cmpStr(typeKeys![i], typeKeys![j]);
        if (cmp === 0) cmp = titleCollator.compare(a.title, b.title);
        break;

      default:
        cmp = 0;
    }

    return isAsc ? cmp : -cmp;
  });

  const sorted = new Array<AssetEntry>(n);
  for (let i = 0; i < n; i++) sorted[i] = entries[order[i]];
  return sorted;
}

const nameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const titleCollator = new Intl.Collator(undefined, { numeric: true });
const cmpStr = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

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

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDateCompact(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const year = String(d.getFullYear()).slice(-2);
    const month = d.toLocaleString('en-US', { month: 'short' });
    const day = d.getDate();
    return `${month} ${day}, '${year}`;
  }
  return dateStr.slice(0, 10);
}

export function formatDateDisplay(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = d.toLocaleString('en-US', { month: 'short' });
    const day = d.getDate();
    return `${month} ${day}, ${year}`;
  }
  return dateStr.slice(0, 10);
}

export interface SortDisplayInfo {
  icon: string;
  label: string;
  badge: string;
  byline: string;
  full: string;
}

export function getSortDisplayInfo(entry: AssetEntry, sortOption: SortOption): SortDisplayInfo {
  if (!entry) {
    return { icon: '', label: '', badge: '', byline: '', full: '' };
  }

  const meta = SORT_CONFIGS[sortOption] || SORT_CONFIGS.name;

  switch (sortOption) {
    case 'size': {
      const sizeStr = entry.size || (entry.sizeBytes ? formatBytes(entry.sizeBytes) : '0 B');
      return {
        icon: meta.icon,
        label: `Size: ${sizeStr}`,
        badge: sizeStr,
        byline: sizeStr,
        full: sizeStr
      };
    }

    case 'date_mod': {
      const dStr = entry.dateModified || entry.date || '';
      const display = formatDateDisplay(dStr);
      const compact = formatDateCompact(dStr);
      return {
        icon: meta.icon,
        label: `Mod: ${display}`,
        badge: compact,
        byline: `Mod: ${compact}`,
        full: dStr || display
      };
    }

    case 'date_created': {
      const dStr = entry.dateCreated || entry.date || '';
      const display = formatDateDisplay(dStr);
      const compact = formatDateCompact(dStr);
      return {
        icon: meta.icon,
        label: `Created: ${display}`,
        badge: compact,
        byline: `Added: ${compact}`,
        full: dStr || display
      };
    }

    case 'age': {
      const dStr = entry.dateCreated || entry.date || '';
      const ageStr = formatAgeWatermark(dStr);
      const compact = formatDateCompact(dStr);
      return {
        icon: meta.icon,
        label: `Age: ${ageStr}`,
        badge: ageStr,
        byline: `${ageStr.toLowerCase()} (${compact})`,
        full: `${ageStr} (${dStr})`
      };
    }

    case 'number': {
      const num = extractNumber(entry.title);
      const numDisplay = num === Number.MAX_SAFE_INTEGER ? 'None' : `#${num}`;
      return {
        icon: meta.icon,
        label: `Num: ${numDisplay}`,
        badge: numDisplay,
        byline: `Seq ${numDisplay}`,
        full: `Sequence number ${numDisplay}`
      };
    }

    case 'type': {
      const typeStr = (entry.exts?.[0] || entry.type || '').toUpperCase();
      return {
        icon: meta.icon,
        label: `Type: ${typeStr}`,
        badge: typeStr,
        byline: `Type: ${typeStr}`,
        full: typeStr
      };
    }

    case 'name':
    default: {
      const firstLetter = (entry.title || '').trim().charAt(0).toUpperCase() || 'A';
      return {
        icon: meta.icon,
        label: `Name: A–Z`,
        badge: firstLetter,
        byline: entry.date || '',
        full: entry.title
      };
    }
  }
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


