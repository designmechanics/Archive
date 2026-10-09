export type PreviewFormat =
  | 'image'
  | 'video'
  | 'audio'
  | '3d'
  | 'vector'
  | 'pdf'
  | 'markdown'
  | 'doc'
  | 'code'
  | 'json'
  | 'css'
  | 'html'
  | 'font'
  | 'psd'
  | 'postscript'
  | 'raster'
  | 'swf'
  | 'office'
  | 'type1'
  | 'legacydoc'
  | 'binary'
  | 'database'
  | 'blend';

/** Formats whose viewers fetch raw bytes themselves (served from a URL, not read as text). */
export const BINARY_FORMATS: PreviewFormat[] = [
  'image',
  'video',
  'audio',
  '3d',
  'pdf',
  'font',
  'psd',
  'postscript',
  'raster',
  'swf',
  'office',
  'type1',
  'legacydoc',
  'binary',
  'database',
  'blend'
];

export interface PreviewFile {
  name: string;
  path: string;
  ext: string;
  size?: number;
  url?: string;
  content?: string;
  format: PreviewFormat;
}

export function detectFormat(ext: string, name?: string): PreviewFormat {
  const e = (ext || '').toLowerCase().replace('.', '');
  const n = (name || '').toLowerCase();

  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico'].includes(e)) {
    return 'image';
  }
  if (['ttf', 'otf', 'woff', 'woff2', 'ttc', 'eot', 'dfont'].includes(e)) {
    return 'font';
  }
  if (['pfb', 'pfm', 'afm'].includes(e)) {
    return 'type1';
  }
  if (['doc', 'ppt', 'pps'].includes(e)) {
    return 'legacydoc';
  }
  if (['exe', 'dll', 'qxp', 'sys', 'ocx'].includes(e)) {
    return 'binary';
  }
  if (['db', 'sqlite', 'sqlite3'].includes(e)) {
    return 'database';
  }
  if (['psd', 'psb'].includes(e)) {
    return 'psd';
  }
  if (['eps', 'ai', 'indd'].includes(e)) {
    return 'postscript';
  }
  if (['tif', 'tiff', 'cr2', 'nef', 'dng', 'arw'].includes(e)) {
    return 'raster';
  }
  if (e === 'swf') {
    return 'swf';
  }
  if (['docx', 'xlsx', 'xls', 'csv'].includes(e)) {
    return 'office';
  }
  if (['mp4', 'webm', 'mov', 'mkv', 'm4v', 'avi'].includes(e)) {
    return 'video';
  }
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'aiff', 'm4a'].includes(e)) {
    return 'audio';
  }
  if (e === 'blend') {
    return 'blend';
  }
  if (['glb', 'gltf', 'obj', 'fbx', 'stl', 'dae', 'ply', '3mf', 'vrm', 'vrma'].includes(e)) {
    return '3d';
  }
  if (['svg'].includes(e)) {
    return 'vector';
  }
  if (['pdf'].includes(e)) {
    return 'pdf';
  }
  if (['md', 'markdown', 'mdown', 'mkdn', 'mdx'].includes(e) || n.endsWith('.md')) {
    return 'markdown';
  }
  if (['txt', 'rtf', 'log', 'tsv'].includes(e)) {
    return 'doc';
  }
  if (['json', 'geojson', 'topojson'].includes(e)) {
    return 'json';
  }
  if (['css', 'scss', 'sass', 'less'].includes(e)) {
    return 'css';
  }
  if (['html', 'htm'].includes(e)) {
    return 'html';
  }

  return 'code';
}

