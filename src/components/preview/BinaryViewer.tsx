import React, { useEffect, useMemo, useState } from 'react';
import {
  sniffBinary,
  parsePe,
  describeQuarkHeader,
  extractStrings,
  hexDump,
  findEmbeddedImages,
  PeInfo,
  EmbeddedImage,
  BinaryKind
} from '../../services/binaryInfo';
import { viewerRoot, viewerBar, viewerBtn, viewerColors, viewerMono, viewerMessage } from './viewerStyles';

interface BinaryViewerProps {
  src: string;
  name: string;
}

const MAX_READ = 64 * 1024 * 1024;

const Table: React.FC<{ rows: [string, string][] }> = ({ rows }) => (
  <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
    <tbody>
      {rows
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <tr key={k} style={{ borderBottom: `1px solid ${viewerColors.line}` }}>
            <td style={{ ...viewerMono, padding: '6px 10px 6px 0', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{k}</td>
            <td style={{ padding: '6px 0', wordBreak: 'break-word' }}>{v}</td>
          </tr>
        ))}
    </tbody>
  </table>
);

const fmtBytes = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1024).toFixed(1)} KB`);

/**
 * Last-resort viewer: identifies what a file is from its bytes and shows what can be read safely.
 * Windows programs and libraries get a proper summary (icon, version, imports, sections).
 */
export const BinaryViewer: React.FC<BinaryViewerProps> = ({ src, name }) => {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [totalSize, setTotalSize] = useState(0);
  const [tab, setTab] = useState<'info' | 'strings' | 'hex' | 'pictures'>('info');
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setBytes(null);
    setTab('info');
    (async () => {
      try {
        const head = await fetch(src, { method: 'HEAD' }).catch(() => null);
        const size = Number(head?.headers.get('Content-Length') || 0);
        const big = size > MAX_READ;
        const res = await fetch(src, big ? { headers: { Range: `bytes=0-${MAX_READ - 1}` } } : undefined);
        if (!res.ok && res.status !== 206) throw new Error(`Could not read the file (${res.status})`);
        const buf = new Uint8Array(await res.arrayBuffer());
        if (cancelled) return;
        setBytes(buf);
        setTotalSize(size || buf.length);
        setTruncated(big);
        setState('ready');
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Could not open this file');
          setState('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  const kind: BinaryKind = useMemo(() => (bytes ? sniffBinary(bytes) : 'unknown'), [bytes]);
  const pe: PeInfo | null = useMemo(() => (bytes && kind === 'pe' ? parsePe(bytes) : null), [bytes, kind]);
  const strings = useMemo(() => (bytes ? extractStrings(bytes, 6, 2500) : []), [bytes]);
  const pictures: EmbeddedImage[] = useMemo(() => (bytes && kind !== 'pe' ? findEmbeddedImages(bytes, 12) : []), [bytes, kind]);

  // Object URLs for the program icon and embedded pictures
  useEffect(() => {
    const urls: string[] = [];
    if (pe?.iconIco) {
      const u = URL.createObjectURL(new Blob([pe.iconIco.slice().buffer as ArrayBuffer], { type: 'image/x-icon' }));
      urls.push(u);
      setIconUrl(u);
    } else {
      setIconUrl(null);
    }
    const imgs = pictures.map((p) => {
      const u = URL.createObjectURL(new Blob([p.bytes.slice().buffer as ArrayBuffer], { type: p.mime }));
      urls.push(u);
      return u;
    });
    setImageUrls(imgs);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [pe, pictures]);

  if (state === 'loading') return <div style={{ ...viewerRoot, ...viewerMessage }}>Reading file…</div>;
  if (state === 'error' || !bytes) {
    return (
      <div style={viewerRoot}>
        <div style={viewerMessage}>
          {error}
          <div style={{ marginTop: 8 }}>{name}</div>
        </div>
      </div>
    );
  }

  const kindLabel =
    kind === 'pe'
      ? pe?.isDll
        ? 'Windows library (DLL)'
        : 'Windows program'
      : kind === 'quark'
      ? 'QuarkXPress document'
      : kind === 'sqlite'
      ? 'SQLite database'
      : kind === 'ole'
      ? 'OLE compound file'
      : kind === 'zip'
      ? 'ZIP container'
      : 'Unrecognised binary';

  const infoRows: [string, string][] = [['Type', kindLabel], ['Size', fmtBytes(totalSize)]];
  if (truncated) infoRows.push(['Read', `first ${fmtBytes(MAX_READ)} only`]);
  if (pe) {
    infoRows.push(
      ['Architecture', pe.machine],
      ['Interface', pe.subsystem],
      ['Built', pe.timestamp],
      ['Description', pe.version.FileDescription || ''],
      ['Product', pe.version.ProductName || ''],
      ['Company', pe.version.CompanyName || ''],
      ['File version', pe.version.FileVersion || ''],
      ['Product version', pe.version.ProductVersion || ''],
      ['Original name', pe.version.OriginalFilename || ''],
      ['Copyright', pe.version.LegalCopyright || ''],
      ['Imports', pe.imports.join(', ')],
      ['Sections', pe.sections.map((s) => `${s.name} (${fmtBytes(s.rawSize)})`).join(', ')]
    );
  }
  if (kind === 'quark') {
    infoRows.push(...describeQuarkHeader(bytes));
    infoRows.push(['Readable text', `${strings.length.toLocaleString()} text runs found (see Strings)`]);
    infoRows.push(['Note', 'QuarkXPress layouts cannot be rendered here; text, pictures and header details are shown.']);
  }

  const tabs: ('info' | 'strings' | 'hex' | 'pictures')[] = ['info', 'strings', 'hex'];
  if (pictures.length) tabs.push('pictures');

  return (
    <div style={viewerRoot}>
      <div style={viewerBar}>
        {tabs.map((t) => (
          <button key={t} style={viewerBtn(tab === t)} onClick={() => setTab(t)}>
            {t}
            {t === 'pictures' ? ` (${pictures.length})` : ''}
          </button>
        ))}
        <span style={{ ...viewerMono, marginLeft: 'auto' }}>{kindLabel}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px' }}>
        {tab === 'info' && (
          <>
            {iconUrl && (
              <img
                src={iconUrl}
                alt=""
                style={{
                  width: 96,
                  height: 96,
                  objectFit: 'contain',
                  padding: 10,
                  background: '#e9edf2',
                  borderRadius: 14,
                  boxSizing: 'content-box',
                  marginBottom: 14,
                  display: 'block'
                }}
              />
            )}
            <Table rows={infoRows} />
          </>
        )}
        {tab === 'strings' && (
          <pre style={{ margin: 0, fontSize: 11.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: viewerColors.ink }}>
            {strings.length ? strings.join('\n') : 'No readable text found.'}
          </pre>
        )}
        {tab === 'hex' && (
          <pre style={{ margin: 0, fontSize: 11.5, color: viewerColors.dim, fontFamily: 'ui-monospace, Menlo, monospace' }}>
            {hexDump(bytes, 2048)}
          </pre>
        )}
        {tab === 'pictures' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {imageUrls.map((u, i) => (
              <div key={u} style={{ border: `1px solid ${viewerColors.line}`, borderRadius: 8, padding: 6, background: viewerColors.well }}>
                <img src={u} alt="" style={{ width: '100%', height: 110, objectFit: 'contain' }} />
                <div style={{ ...viewerMono, fontSize: 9.5, marginTop: 4 }}>
                  {pictures[i].mime.replace('image/', '')} · {fmtBytes(pictures[i].bytes.length)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BinaryViewer;
