import React, { useEffect, useState } from 'react';
import { readBlendPreview, blendCompression } from '../../services/blendPreview';
import { viewerRoot, viewerBar, viewerMono, viewerMessage } from './viewerStyles';

interface BlendViewerProps {
  src: string;
  name: string;
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes.slice().buffer as ArrayBuffer]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Blender project: shows the preview picture stored inside the file. */
export const BlendViewer: React.FC<BlendViewerProps> = ({ src, name }) => {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [facts, setFacts] = useState('');

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setState('loading');
    setImageUrl(null);
    (async () => {
      try {
        // The preview sits near the start, so read only the first part of big files
        const head = await fetch(src, { headers: { Range: 'bytes=0-6291455' } });
        if (!head.ok && head.status !== 206) throw new Error(`Could not read the file (${head.status})`);
        let bytes: Uint8Array = new Uint8Array(await head.arrayBuffer());
        const kind = blendCompression(bytes);
        if (kind === 'zstd') {
          setMessage('This Blender file uses zstd compression, which cannot be read here. Re-save it with compression off to see its preview.');
          setState('error');
          return;
        }
        if (kind === 'gzip') {
          const full = await fetch(src);
          bytes = await gunzip(new Uint8Array(await full.arrayBuffer()));
        }
        const preview = readBlendPreview(bytes);
        if (cancelled) return;
        if (!preview) {
          setMessage('No preview picture is stored in this Blender file.');
          setState('error');
          return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = preview.width;
        canvas.height = preview.height;
        canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(preview.rgba), preview.width, preview.height), 0, 0);
        const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/png'));
        if (!blob || cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
        setFacts(`Blender ${preview.version.split('').join('.')} · preview ${preview.width} × ${preview.height}${kind === 'gzip' ? ' · gzip' : ''}`);
        setState('ready');
      } catch (err: any) {
        if (!cancelled) {
          setMessage(err?.message || 'Could not read this Blender file');
          setState('error');
        }
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (state === 'loading') return <div style={{ ...viewerRoot, ...viewerMessage }}>Reading Blender file…</div>;
  if (state === 'error') {
    return (
      <div style={viewerRoot}>
        <div style={viewerMessage}>
          {message}
          <div style={{ marginTop: 8 }}>{name}</div>
        </div>
      </div>
    );
  }
  return (
    <div style={viewerRoot}>
      <div style={viewerBar}>
        <span style={viewerMono}>{facts}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
        {imageUrl && <img src={imageUrl} alt={name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 6 }} />}
      </div>
    </div>
  );
};

export default BlendViewer;
