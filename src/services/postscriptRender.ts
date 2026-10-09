import { findEmbeddedPreview, findXmpThumbnailAnywhere, isPdfBased } from './postscript';
import { generatePdfThumbnail } from './thumbnailService';

export type PsPreviewSource = 'pdf' | 'embedded' | 'ghostscript';

export interface PsPreview {
  dataUrl: string;
  source: PsPreviewSource;
}

function canvasToDataUrl(c: HTMLCanvasElement, maxWidth: number): string {
  if (c.width > maxWidth) {
    const scale = maxWidth / c.width;
    const out = document.createElement('canvas');
    out.width = maxWidth;
    out.height = Math.max(1, Math.round(c.height * scale));
    const ctx = out.getContext('2d');
    if (ctx) {
      ctx.drawImage(c, 0, 0, out.width, out.height);
      return out.toDataURL('image/jpeg', 0.88);
    }
  }
  return c.toDataURL('image/jpeg', 0.88);
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 8192)));
  }
  return `data:${mime};base64,${btoa(bin)}`;
}

/** Renders the preview image that is stored inside an EPS / AI file, without any server help. */
export async function renderEmbeddedPreview(bytes: Uint8Array, maxWidth: number): Promise<PsPreview | null> {
  // Modern Illustrator files are PDFs: render page one properly
  if (isPdfBased(bytes)) {
    const url = await generatePdfThumbnail(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, maxWidth);
    if (url) return { dataUrl: url, source: 'pdf' };
  }

  const pv = findEmbeddedPreview(bytes) || (bytes.length < 250_000_000 ? findXmpThumbnailAnywhere(bytes) : null);
  if (!pv) return null;

  if (pv.kind === 'jpeg') {
    return { dataUrl: bytesToDataUrl(pv.bytes, 'image/jpeg'), source: 'embedded' };
  }
  if (pv.kind === 'bitmap') {
    const c = document.createElement('canvas');
    c.width = pv.width;
    c.height = pv.height;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(pv.rgba), pv.width, pv.height), 0, 0);
    return { dataUrl: canvasToDataUrl(c, maxWidth), source: 'embedded' };
  }
  // TIFF preview (DOS-EPS header): browsers cannot decode TIFF, so decode it with UTIF
  try {
    const UTIF: any = (await import('utif2')).default || (await import('utif2'));
    const buf = pv.bytes.buffer.slice(pv.bytes.byteOffset, pv.bytes.byteOffset + pv.bytes.byteLength);
    const ifds = UTIF.decode(buf);
    UTIF.decodeImage(buf, ifds[0]);
    const rgba = UTIF.toRGBA8(ifds[0]);
    const c = document.createElement('canvas');
    c.width = ifds[0].width;
    c.height = ifds[0].height;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), c.width, c.height), 0, 0);
    return { dataUrl: canvasToDataUrl(c, maxWidth), source: 'embedded' };
  } catch {
    return null;
  }
}

/** Asks the server to rasterise with Ghostscript (only works when Ghostscript is installed). */
export async function renderWithGhostscript(fileUrlParams: string, width: number): Promise<PsPreview | null> {
  try {
    const res = await fetch(`/api/render/eps?${fileUrlParams}&width=${width}`);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    return { dataUrl, source: 'ghostscript' };
  } catch {
    return null;
  }
}
