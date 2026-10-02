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
  | 'html';

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

  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'tiff', 'tif'].includes(e)) {
    return 'image';
  }
  if (['mp4', 'webm', 'mov', 'mkv', 'm4v', 'avi'].includes(e)) {
    return 'video';
  }
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'aiff', 'm4a'].includes(e)) {
    return 'audio';
  }
  if (['glb', 'gltf', 'obj', 'blend', 'fbx', 'stl', 'dae', 'vrm', 'vrma'].includes(e)) {
    return '3d';
  }
  if (['svg', 'ai', 'eps'].includes(e)) {
    return 'vector';
  }
  if (['pdf'].includes(e)) {
    return 'pdf';
  }
  if (['md', 'markdown', 'mdown', 'mkdn', 'mdx'].includes(e) || n.endsWith('.md')) {
    return 'markdown';
  }
  if (['txt', 'rtf', 'log', 'csv', 'tsv'].includes(e)) {
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

