import React, { useEffect, useState } from 'react';
import { extractWordText, extractPptText, isRtf, rtfToText, LegacyOfficeResult } from '../../services/legacyOffice';
import { viewerRoot, viewerBar, viewerBtn, viewerColors, viewerMono, viewerMessage } from './viewerStyles';

interface LegacyOfficeViewerProps {
  src: string;
  name: string;
  ext: string; // doc | ppt
}

export const LegacyOfficeViewer: React.FC<LegacyOfficeViewerProps> = ({ src, name, ext }) => {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [result, setResult] = useState<LegacyOfficeResult | null>(null);
  const [tab, setTab] = useState<'text' | 'info'>('text');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setResult(null);
    setTab('text');
    (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`Could not read the file (${res.status})`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (cancelled) return;

        let r: LegacyOfficeResult;
        if (isRtf(bytes)) {
          // Many ".doc" files are Rich Text Format underneath
          r = { kind: 'word', properties: [['Format', 'Rich Text Format (saved with a .doc name)']], text: rtfToText(bytes) };
        } else {
          const XLSX: any = await import('xlsx');
          const cfb = XLSX.CFB.read(bytes, { type: 'array' });
          r = ext === 'ppt' || ext === 'pps' ? extractPptText(cfb) : extractWordText(cfb);
        }
        if (cancelled) return;
        setResult(r);
        setState('ready');
      } catch (err: any) {
        if (!cancelled) {
          setError(
            /Signature/i.test(err?.message || '')
              ? 'This file is not an old Office document.'
              : err?.message || 'Could not open this file'
          );
          setState('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src, ext]);

  if (state === 'loading') return <div style={{ ...viewerRoot, ...viewerMessage }}>Reading document…</div>;
  if (state === 'error' || !result) {
    return (
      <div style={viewerRoot}>
        <div style={viewerMessage}>
          {error}
          <div style={{ marginTop: 8 }}>{name}</div>
        </div>
      </div>
    );
  }

  const isPpt = result.kind === 'powerpoint';
  const hasText = result.text.join('').trim().length > 0;

  return (
    <div style={viewerRoot}>
      <div style={viewerBar}>
        <button style={viewerBtn(tab === 'text')} onClick={() => setTab('text')}>
          {isPpt ? 'slides' : 'text'}
        </button>
        <button style={viewerBtn(tab === 'info')} onClick={() => setTab('info')}>
          info
        </button>
        <span style={{ ...viewerMono, marginLeft: 'auto' }}>
          {isPpt ? 'PowerPoint 97-2003' : 'Word 97-2003'} · text only
          {isPpt && result.text.length ? ` · ${result.text.length} slides` : ''}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px' }}>
        {tab === 'text' && result.encrypted && <div style={viewerMessage}>This document is password protected.</div>}
        {tab === 'text' && !result.encrypted && !hasText && (
          <div style={viewerMessage}>{result.note || 'No readable text was found in this document.'}</div>
        )}
        {tab === 'text' && !result.encrypted && hasText && !isPpt && (
          <div style={{ maxWidth: 760, margin: '0 auto', fontSize: 14, lineHeight: 1.65 }}>
            {result.text.map((p, i) => (
              <p key={i} style={{ margin: '0 0 0.9em', whiteSpace: 'pre-wrap', minHeight: p ? undefined : '0.6em' }}>
                {p}
              </p>
            ))}
          </div>
        )}
        {tab === 'text' && !result.encrypted && hasText && isPpt && (
          <div style={{ display: 'grid', gap: 12, maxWidth: 760, margin: '0 auto' }}>
            {result.text.map((s, i) => (
              <div
                key={i}
                style={{ border: `1px solid ${viewerColors.line}`, borderRadius: 10, padding: '12px 16px', background: viewerColors.well }}
              >
                <div style={{ ...viewerMono, marginBottom: 6 }}>SLIDE {i + 1}</div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.55 }}>{s}</div>
              </div>
            ))}
          </div>
        )}
        {tab === 'info' && (
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
            <tbody>
              {(result.properties.length ? result.properties : [['Properties', 'none stored in this file'] as [string, string]]).map(([k, v]) => (
                <tr key={k} style={{ borderBottom: `1px solid ${viewerColors.line}` }}>
                  <td style={{ ...viewerMono, padding: '6px 10px 6px 0', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{k}</td>
                  <td style={{ padding: '6px 0', wordBreak: 'break-word' }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default LegacyOfficeViewer;
