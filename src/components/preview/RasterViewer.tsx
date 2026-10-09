import React, { useEffect, useRef, useState } from 'react';
import { findLargestJpeg } from '../../services/rawPreview';
import { viewerRoot, viewerBar, viewerBtn, viewerColors, viewerMono, viewerMessage } from './viewerStyles';

interface RasterViewerProps {
  src: string;
  name: string;
  /** 'tiff' decodes TIFF pages; 'raw' shows the JPEG preview inside a camera RAW file */
  mode: 'tiff' | 'raw';
}

const EXIF_ROWS: [string, string][] = [
  ['Camera', 'Model'],
  ['Make', 'Make'],
  ['Lens', 'LensModel'],
  ['Taken', 'DateTimeOriginal'],
  ['Exposure', 'ExposureTime'],
  ['Aperture', 'FNumber'],
  ['ISO', 'ISO'],
  ['Focal length', 'FocalLength'],
  ['Width', 'ExifImageWidth'],
  ['Height', 'ExifImageHeight'],
  ['Software', 'Software'],
  ['Artist', 'Artist'],
  ['Copyright', 'Copyright']
];

function fmt(key: string, v: any): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toLocaleString();
  if (key === 'ExposureTime' && typeof v === 'number') return v < 1 ? `1/${Math.round(1 / v)} s` : `${v} s`;
  if (key === 'FNumber') return `f/${v}`;
  if (key === 'FocalLength') return `${v} mm`;
  return String(v);
}

export const RasterViewer: React.FC<RasterViewerProps> = ({ src, name, mode }) => {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(0);
  const [exif, setExif] = useState<[string, string][]>([]);
  const tiffRef = useRef<{ buf: ArrayBuffer; ifds: any[]; UTIF: any } | null>(null);
  const urlRef = useRef<string | null>(null);

  const setUrl = (u: string | null) => {
    if (urlRef.current && urlRef.current.startsWith('blob:')) URL.revokeObjectURL(urlRef.current);
    urlRef.current = u;
    setImageUrl(u);
  };

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setPage(0);
    setExif([]);
    tiffRef.current = null;

    (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`Could not read the file (${res.status})`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;

        if (mode === 'raw') {
          const j = findLargestJpeg(new Uint8Array(buf));
          if (!j) throw new Error('No preview picture found inside this RAW file.');
          setUrl(URL.createObjectURL(new Blob([buf.slice(j.offset, j.offset + j.length)], { type: 'image/jpeg' })));
          try {
            const exifr: any = (await import('exifr')).default || (await import('exifr'));
            const data = await exifr.parse(buf, true);
            if (!cancelled && data) {
              setExif(
                EXIF_ROWS.map(([label, key]) => [label, fmt(key, data[key])] as [string, string]).filter(([, v]) => v)
              );
            }
          } catch {
            // metadata is optional
          }
        } else {
          const UTIF: any = (await import('utif2')).default || (await import('utif2'));
          const ifds = UTIF.decode(buf);
          if (!ifds.length) throw new Error('This TIFF has no readable image.');
          tiffRef.current = { buf, ifds, UTIF };
          setPages(ifds.length);
        }
        if (!cancelled) setState('ready');
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Could not open this file');
          setState('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      if (urlRef.current && urlRef.current.startsWith('blob:')) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    };
  }, [src, mode]);

  // TIFF: decode the selected page
  useEffect(() => {
    if (mode !== 'tiff' || state !== 'ready' || !tiffRef.current) return;
    const { buf, ifds, UTIF } = tiffRef.current;
    try {
      const ifd = ifds[page];
      UTIF.decodeImage(buf, ifd);
      const rgba = UTIF.toRGBA8(ifd);
      const c = document.createElement('canvas');
      c.width = ifd.width;
      c.height = ifd.height;
      c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(rgba), c.width, c.height), 0, 0);
      c.toBlob((b) => b && setUrl(URL.createObjectURL(b)), 'image/png');
    } catch (err: any) {
      setError(err?.message || 'Could not decode this page');
    }
  }, [mode, state, page]);

  if (state === 'loading') return <div style={{ ...viewerRoot, ...viewerMessage }}>Reading file…</div>;
  if (state === 'error') {
    return (
      <div style={viewerRoot}>
        <div style={viewerMessage}>
          {error}
          <div style={{ marginTop: 8 }}>{name}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={viewerRoot}>
      <div style={viewerBar}>
        <span style={viewerMono}>{mode === 'raw' ? 'Camera RAW: showing the JPEG preview stored in the file' : 'TIFF'}</span>
        {pages > 1 && (
          <>
            <button style={viewerBtn()} disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              ‹
            </button>
            <span style={viewerMono}>
              page {page + 1} / {pages}
            </span>
            <button style={viewerBtn()} disabled={page >= pages - 1} onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}>
              ›
            </button>
          </>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10, overflow: 'hidden' }}>
          {imageUrl && (
            <img src={imageUrl} alt={name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 4 }} />
          )}
        </div>
        {exif.length > 0 && (
          <div style={{ width: 210, flexShrink: 0, overflowY: 'auto', borderLeft: `1px solid ${viewerColors.line}`, padding: '8px 10px' }}>
            <div style={{ ...viewerMono, marginBottom: 6 }}>EXIF</div>
            {exif.map(([k, v]) => (
              <div key={k} style={{ marginBottom: 6 }}>
                <div style={{ ...viewerMono, fontSize: 9.5 }}>{k}</div>
                <div style={{ fontSize: 12, wordBreak: 'break-word' }}>{v}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RasterViewer;
