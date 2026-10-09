import React, { useEffect, useState } from 'react';
import { viewerRoot, viewerBar, viewerBtn, viewerColors, viewerMono, viewerMessage } from './viewerStyles';

interface OfficeViewerProps {
  src: string;
  name: string;
  ext: string; // docx | xlsx | csv
}

const MAX_ROWS = 1000;
const MAX_COLS = 60;

interface Sheet {
  name: string;
  rows: string[][];
  totalRows: number;
}

export const OfficeViewer: React.FC<OfficeViewerProps> = ({ src, name, ext }) => {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [html, setHtml] = useState('');
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [active, setActive] = useState(0);
  const [notes, setNotes] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setHtml('');
    setSheets([]);
    setActive(0);
    setNotes([]);

    (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`Could not read the file (${res.status})`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;

        if (ext === 'docx') {
          const mammoth: any = (await import('mammoth')).default || (await import('mammoth'));
          const out = await mammoth.convertToHtml({ arrayBuffer: buf });
          if (cancelled) return;
          setHtml(out.value);
          setNotes((out.messages || []).slice(0, 5).map((m: any) => m.message));
        } else {
          const XLSX: any = await import('xlsx');
          const wb =
            ext === 'csv'
              ? XLSX.read(new TextDecoder().decode(buf), { type: 'string' })
              : XLSX.read(buf, { type: 'array' });
          const list: Sheet[] = wb.SheetNames.map((sn: string) => {
            const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: false, defval: '' });
            return {
              name: sn,
              totalRows: rows.length,
              rows: rows.slice(0, MAX_ROWS).map((r) => r.slice(0, MAX_COLS).map((c) => String(c ?? '')))
            };
          });
          if (cancelled) return;
          setSheets(list);
        }
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
  }, [src, ext]);

  if (state === 'loading') return <div style={{ ...viewerRoot, ...viewerMessage }}>Reading document…</div>;
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

  if (ext === 'docx') {
    // Rendered in a sandboxed frame with no scripts, so nothing inside the document can run
    const doc = `<!doctype html><meta charset="utf-8"><style>
      body{font:15px/1.6 Georgia,serif;color:#1d1f20;background:#fff;margin:0;padding:28px 34px;max-width:780px}
      img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:4px 8px}
      h1,h2,h3{font-family:system-ui,sans-serif}</style>${html}`;
    return (
      <div style={viewerRoot}>
        <div style={viewerBar}>
          <span style={viewerMono}>Word document (read only){notes.length ? ` · ${notes.length} conversion notes` : ''}</span>
        </div>
        <iframe title={name} sandbox="" srcDoc={doc} style={{ flex: 1, minHeight: 0, border: 0, background: '#fff' }} />
      </div>
    );
  }

  const sheet = sheets[active];
  return (
    <div style={viewerRoot}>
      <div style={viewerBar}>
        {sheets.map((s, i) => (
          <button key={s.name + i} style={viewerBtn(i === active)} onClick={() => setActive(i)}>
            {s.name}
          </button>
        ))}
        {sheet && (
          <span style={{ ...viewerMono, marginLeft: 'auto' }}>
            {sheet.totalRows.toLocaleString()} rows
            {sheet.totalRows > MAX_ROWS ? ` · first ${MAX_ROWS.toLocaleString()} shown` : ''}
          </span>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {sheet && (
          <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: '100%' }}>
            <tbody>
              {sheet.rows.map((r, ri) => (
                <tr key={ri} style={{ background: ri === 0 ? viewerColors.bar : 'transparent' }}>
                  <td style={{ ...viewerMono, padding: '3px 8px', borderRight: `1px solid ${viewerColors.line}`, position: 'sticky', left: 0, background: viewerColors.bg }}>
                    {ri + 1}
                  </td>
                  {r.map((c, ci) => (
                    <td
                      key={ci}
                      style={{
                        padding: '3px 10px',
                        borderBottom: `1px solid ${viewerColors.line}`,
                        borderRight: `1px solid ${viewerColors.line}`,
                        whiteSpace: 'nowrap',
                        maxWidth: 320,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontWeight: ri === 0 ? 600 : 400
                      }}
                    >
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default OfficeViewer;
