import React, { useEffect, useState } from 'react';
import { parseDsc, sourceText, DscInfo } from '../../services/postscript';
import { renderEmbeddedPreview, renderWithGhostscript, PsPreview } from '../../services/postscriptRender';
import { viewerRoot, viewerBar, viewerBtn, viewerColors, viewerMono, viewerMessage } from './viewerStyles';

interface PostscriptViewerProps {
  src: string;
  name: string;
  /** Query string for the server-side renderer, e.g. "path=...", only for files on disk */
  serverParams?: string;
}

const SOURCE_LABEL: Record<string, string> = {
  pdf: 'Rendered from the PDF inside the file',
  embedded: 'Preview image stored inside the file',
  ghostscript: 'Rendered with Ghostscript'
};

export const PostscriptViewer: React.FC<PostscriptViewerProps> = ({ src, name, serverParams }) => {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<PsPreview | null>(null);
  const [info, setInfo] = useState<DscInfo | null>(null);
  const [source, setSource] = useState('');
  const [bytes, setBytes] = useState(0);
  const [tab, setTab] = useState<'preview' | 'info' | 'source'>('preview');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setPreview(null);
    setTab('preview');

    (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`Could not read the file (${res.status})`);
        const buf = new Uint8Array(await res.arrayBuffer());
        if (cancelled) return;
        setBytes(buf.length);
        setInfo(parseDsc(buf));
        setSource(sourceText(buf));

        // EPS files on disk: draw the real artwork with Ghostscript; the small picture stored
        // inside the file is only the fallback
        let result: PsPreview | null = null;
        if (serverParams) result = await renderWithGhostscript(serverParams, 1600);
        if (!result) result = await renderEmbeddedPreview(buf, 1600);
        if (cancelled) return;
        setPreview(result);
        setState('ready');
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Could not read this file');
          setState('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src, serverParams]);

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

  const rows: [string, string][] = info
    ? ([
        ['Title', info.title],
        ['Creator', info.creator],
        ['Created', info.creationDate],
        ['For', info.forWho],
        ['Bounding box', info.boundingBox?.join(' ')],
        ['Hi-res box', info.hiResBoundingBox?.join(' ')],
        ['Language level', info.languageLevel],
        ['Pages', info.pages],
        ['Container', info.pdfBased ? 'PDF-based' : info.dosHeader ? 'EPS with binary preview header' : 'PostScript'],
        ['Size', `${(bytes / 1048576).toFixed(2)} MB`]
      ] as [string, string | undefined][]).filter((r): r is [string, string] => Boolean(r[1]))
    : [];

  return (
    <div style={viewerRoot}>
      <div style={viewerBar}>
        {(['preview', 'info', 'source'] as const).map((t) => (
          <button key={t} style={viewerBtn(tab === t)} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
        {preview && <span style={{ ...viewerMono, marginLeft: 'auto' }}>{SOURCE_LABEL[preview.source]}</span>}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 12, display: 'flex' }}>
        {tab === 'preview' &&
          (preview ? (
            <img
              src={preview.dataUrl}
              alt={name}
              style={{
                margin: 'auto',
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                background: '#ffffff',
                borderRadius: 6
              }}
            />
          ) : (
            <div style={viewerMessage}>
              This file has no preview picture inside it, and Ghostscript could not draw it (it may not be an EPS, or it is damaged).
              <br />
              Header details and the PostScript source are on the other tabs.
            </div>
          ))}
        {tab === 'info' && (
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12, alignSelf: 'flex-start' }}>
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k} style={{ borderBottom: `1px solid ${viewerColors.line}` }}>
                  <td style={{ ...viewerMono, padding: '6px 10px 6px 0', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{k}</td>
                  <td style={{ padding: '6px 0', wordBreak: 'break-word' }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'source' && (
          <pre style={{ margin: 0, fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: viewerColors.dim, alignSelf: 'flex-start' }}>
            {source}
          </pre>
        )}
      </div>
    </div>
  );
};

export default PostscriptViewer;
