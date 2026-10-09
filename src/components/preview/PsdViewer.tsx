import React, { useEffect, useRef, useState } from 'react';
import { extractPsdThumbnail, psdHeader } from '../../services/psdThumb';
import { viewerRoot, viewerBar, viewerBtn, viewerColors, viewerMono, viewerMessage } from './viewerStyles';

interface PsdViewerProps {
  src: string;
  name: string;
}

interface LayerNode {
  key: string;
  name: string;
  hidden: boolean;
  opacity: number;
  blend: string;
  text?: string;
  isGroup: boolean;
  canvas?: HTMLCanvasElement;
  left: number;
  top: number;
  children: LayerNode[];
}

const LAYER_DATA_LIMIT = 300 * 1024 * 1024; // above this, show the flattened image only

const BLEND_MAP: Record<string, GlobalCompositeOperation> = {
  normal: 'source-over',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
  'color dodge': 'color-dodge',
  'color burn': 'color-burn',
  'hard light': 'hard-light',
  'soft light': 'soft-light',
  difference: 'difference',
  exclusion: 'exclusion',
  hue: 'hue',
  saturation: 'saturation',
  color: 'color',
  luminosity: 'luminosity'
};

function mapLayers(list: any[] | undefined, prefix = ''): LayerNode[] {
  return (list || []).map((l, i) => ({
    key: `${prefix}${i}`,
    name: l.name || '(unnamed)',
    hidden: Boolean(l.hidden),
    opacity: l.opacity == null ? 1 : l.opacity,
    blend: l.blendMode || 'normal',
    text: l.text?.text,
    isGroup: Array.isArray(l.children),
    canvas: l.canvas,
    left: l.left || 0,
    top: l.top || 0,
    children: mapLayers(l.children, `${prefix}${i}.`)
  }));
}

function flattenKeys(nodes: LayerNode[], out: Record<string, boolean> = {}) {
  nodes.forEach((n) => {
    out[n.key] = !n.hidden;
    flattenKeys(n.children, out);
  });
  return out;
}

function countLayers(nodes: LayerNode[]): number {
  return nodes.reduce((n, l) => n + (l.isGroup ? countLayers(l.children) : 1), 0);
}

export const PsdViewer: React.FC<PsdViewerProps> = ({ src, name }) => {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [dims, setDims] = useState({ w: 0, h: 0, mode: '', bits: 0 });
  const [layers, setLayers] = useState<LayerNode[]>([]);
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [edited, setEdited] = useState(false);
  const [bytes, setBytes] = useState(0);
  const [flattenedOnly, setFlattenedOnly] = useState(false);
  const [previewOnly, setPreviewOnly] = useState<{ url: string; w: number; h: number; reason: string } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const compositeRef = useRef<HTMLCanvasElement | null>(null);
  const psdSizeRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setError('');
    setLayers([]);
    setEdited(false);
    compositeRef.current = null;

    setPreviewOnly(null);
    let objectUrl: string | null = null;

    (async () => {
      let buf: ArrayBuffer | null = null;
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`Could not read the PSD (${res.status})`);
        buf = await res.arrayBuffer();
        if (cancelled) return;
        setBytes(buf.byteLength);

        const { readPsd } = await import('ag-psd');
        const heavy = buf.byteLength > LAYER_DATA_LIMIT;
        setFlattenedOnly(heavy);
        const psd: any = readPsd(buf, { skipLayerImageData: heavy, skipThumbnail: true });
        if (cancelled) return;

        compositeRef.current = psd.canvas || null;
        psdSizeRef.current = { w: psd.width, h: psd.height };
        setDims({ w: psd.width, h: psd.height, mode: String(psd.colorMode ?? ''), bits: psd.bitsPerChannel || 8 });
        const tree = mapLayers(psd.children);
        setLayers(tree);
        setVisible(flattenKeys(tree));
        setState('ready');
      } catch (err: any) {
        if (cancelled) return;
        // CMYK, Lab and other modes the decoder cannot draw: fall back to the preview Photoshop
        // stores inside the file
        if (buf) {
          const found = extractPsdThumbnail(new Uint8Array(buf));
          const head = psdHeader(new Uint8Array(buf));
          if (found.status === 'found' && head) {
            objectUrl = URL.createObjectURL(new Blob([found.thumb.jpeg.slice().buffer as ArrayBuffer], { type: 'image/jpeg' }));
            setPreviewOnly({
              url: objectUrl,
              w: head.width,
              h: head.height,
              reason: (err?.message || 'This colour mode cannot be drawn') + '. Showing the small preview stored in the file.'
            });
            setState('ready');
            return;
          }
        }
        setError(err?.message || 'Could not read this PSD');
        setState('error');
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  // Paint the stage: the file's own flattened image until a layer is toggled, then a recomposite
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || state !== 'ready') return;
    stage.innerHTML = '';

    let canvas: HTMLCanvasElement | null = null;
    if (!edited && compositeRef.current) {
      canvas = compositeRef.current;
    } else {
      const { w, h } = psdSizeRef.current;
      canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const draw = (nodes: LayerNode[], parentAlpha: number) => {
          // PSD stores layers bottom to top
          for (const n of nodes) {
            if (!visible[n.key]) continue;
            if (n.isGroup) {
              draw(n.children, parentAlpha * n.opacity);
            } else if (n.canvas) {
              ctx.globalAlpha = parentAlpha * n.opacity;
              ctx.globalCompositeOperation = BLEND_MAP[n.blend] || 'source-over';
              ctx.drawImage(n.canvas, n.left, n.top);
            }
          }
        };
        draw(layers, 1);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    if (canvas) {
      canvas.style.maxWidth = '100%';
      canvas.style.maxHeight = '100%';
      canvas.style.width = 'auto';
      canvas.style.height = 'auto';
      canvas.style.objectFit = 'contain';
      canvas.style.background =
        'repeating-conic-gradient(#1b2530 0% 25%, #121a22 0% 50%) 50% / 16px 16px';
      stage.appendChild(canvas);
    }
  }, [state, edited, visible, layers]);

  const exportPng = () => {
    const c = stageRef.current?.querySelector('canvas');
    if (!c) return;
    c.toBlob((b) => {
      if (!b) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = name.replace(/\.[^.]+$/, '') + '.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
  };

  const toggle = (key: string) => {
    setEdited(true);
    setVisible((p) => ({ ...p, [key]: !p[key] }));
  };

  const renderNodes = (nodes: LayerNode[], depth = 0): React.ReactNode =>
    // show top-most layer first, like Photoshop
    [...nodes].reverse().map((n) => (
      <div key={n.key}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 0',
            paddingLeft: depth * 12,
            opacity: visible[n.key] ? 1 : 0.4
          }}
        >
          <button
            onClick={() => toggle(n.key)}
            title={visible[n.key] ? 'Hide layer' : 'Show layer'}
            style={{ ...viewerBtn(Boolean(visible[n.key])), padding: '1px 6px' }}
          >
            {visible[n.key] ? '●' : '○'}
          </button>
          <span style={{ fontSize: 12, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={n.text || n.name}>
            {n.isGroup ? '▸ ' : ''}
            {n.name}
          </span>
          {!n.isGroup && (n.opacity < 1 || n.blend !== 'normal') && (
            <span style={{ ...viewerMono, fontSize: 9.5 }}>
              {Math.round(n.opacity * 100)}% {n.blend !== 'normal' ? n.blend : ''}
            </span>
          )}
        </div>
        {n.text && (
          <div style={{ ...viewerMono, fontSize: 10, paddingLeft: depth * 12 + 30, paddingBottom: 3, whiteSpace: 'pre-wrap' }}>
            “{n.text.slice(0, 160)}”
          </div>
        )}
        {n.isGroup && renderNodes(n.children, depth + 1)}
      </div>
    ));

  if (state === 'loading') return <div style={{ ...viewerRoot, ...viewerMessage }}>Reading PSD…</div>;
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

  if (previewOnly) {
    return (
      <div style={viewerRoot}>
        <div style={viewerBar}>
          <span style={viewerMono}>
            {previewOnly.w} × {previewOnly.h}px · {previewOnly.reason}
          </span>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
          <img
            src={previewOnly.url}
            alt={name}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', imageRendering: 'auto', borderRadius: 6 }}
          />
        </div>
      </div>
    );
  }

  const layerCount = countLayers(layers);

  return (
    <div style={viewerRoot}>
      <div style={viewerBar}>
        <span style={viewerMono}>
          {dims.w} × {dims.h}px · {dims.bits}-bit · {layerCount} layers · {(bytes / 1048576).toFixed(1)} MB
        </span>
        {edited && (
          <button
            style={viewerBtn()}
            onClick={() => {
              setEdited(false);
              setVisible(flattenKeys(layers));
            }}
          >
            Reset layers
          </button>
        )}
        <button style={{ ...viewerBtn(), marginLeft: 'auto' }} onClick={exportPng}>
          Export PNG
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div
          ref={stageRef}
          style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10, overflow: 'hidden' }}
        />
        {layerCount > 0 && (
          <div style={{ width: 230, flexShrink: 0, overflowY: 'auto', borderLeft: `1px solid ${viewerColors.line}`, padding: '8px 10px' }}>
            <div style={{ ...viewerMono, marginBottom: 6 }}>LAYERS</div>
            {renderNodes(layers)}
            {edited && (
              <div style={{ ...viewerMono, fontSize: 9.5, marginTop: 8 }}>
                Showing a rebuilt image: layer effects and masks are not applied.
              </div>
            )}
          </div>
        )}
        {layerCount === 0 && flattenedOnly && (
          <div style={{ ...viewerMono, padding: 10, width: 200 }}>Large file: layers skipped, showing the flattened image.</div>
        )}
      </div>
    </div>
  );
};

export default PsdViewer;
