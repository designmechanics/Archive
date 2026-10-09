import React, { useEffect, useState } from 'react';
import { sniffBinary, parseThumbsDb } from '../../services/binaryInfo';
import { BinaryViewer } from './BinaryViewer';
import { viewerRoot, viewerBar, viewerBtn, viewerColors, viewerMono, viewerMessage } from './viewerStyles';

interface DatabaseViewerProps {
  src: string;
  name: string;
  /** query string for the server-side SQLite reader, e.g. "path=..." (whole files on disk only) */
  serverParams?: string;
}

interface SqliteTable {
  name: string;
  kind: string;
  columns: { name: string; type: string }[];
  rowCount: number | null;
  rows: (string | number | null)[][];
}

type Loaded =
  | { kind: 'thumbs'; items: { name: string; url: string }[] }
  | { kind: 'sqlite'; tables: SqliteTable[]; encoding: string }
  | { kind: 'other' };

const MAX_THUMBS_DB = 64 * 1024 * 1024;

/**
 * Database files: Windows Thumbs.db caches show their pictures with the original file names,
 * SQLite files list their tables and first rows, anything else falls back to the binary viewer.
 */
export const DatabaseViewer: React.FC<DatabaseViewerProps> = ({ src, name, serverParams }) => {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [data, setData] = useState<Loaded | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    setState('loading');
    setData(null);
    setActive(0);

    (async () => {
      try {
        const headRes = await fetch(src, { headers: { Range: 'bytes=0-4095' } });
        if (!headRes.ok && headRes.status !== 206) throw new Error(`Could not read the file (${headRes.status})`);
        const head = new Uint8Array(await headRes.arrayBuffer());
        const kind = sniffBinary(head);

        if (kind === 'ole') {
          const full = await fetch(src);
          const bytes = new Uint8Array(await full.arrayBuffer());
          if (bytes.length > MAX_THUMBS_DB) throw new Error('too large');
          const XLSX: any = await import('xlsx');
          const cfb = XLSX.CFB.read(bytes, { type: 'array' });
          const entries = parseThumbsDb(cfb);
          if (entries.length > 0) {
            const items = entries.map((e) => {
              const url = URL.createObjectURL(new Blob([e.jpeg.slice().buffer as ArrayBuffer], { type: 'image/jpeg' }));
              urls.push(url);
              return { name: e.name, url };
            });
            if (!cancelled) {
              setData({ kind: 'thumbs', items });
              setState('ready');
            }
            return;
          }
        } else if (kind === 'sqlite' && serverParams) {
          const res = await fetch(`/api/sqlite/inspect?${serverParams}`);
          const json = await res.json();
          if (json.success) {
            if (!cancelled) {
              setData({ kind: 'sqlite', tables: json.tables, encoding: json.encoding });
              setState('ready');
            }
            return;
          }
        }
        if (!cancelled) {
          setData({ kind: 'other' });
          setState('ready');
        }
      } catch (err: any) {
        if (!cancelled) {
          setData({ kind: 'other' });
          setError(err?.message || '');
          setState('ready');
        }
      }
    })();

    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [src, serverParams]);

  if (state === 'loading') return <div style={{ ...viewerRoot, ...viewerMessage }}>Reading database…</div>;
  if (!data || data.kind === 'other') return <BinaryViewer src={src} name={name} />;

  if (data.kind === 'thumbs') {
    return (
      <div style={viewerRoot}>
        <div style={viewerBar}>
          <span style={viewerMono}>Windows thumbnail cache · {data.items.length} pictures</span>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
            {data.items.map((it, i) => (
              <div key={i} style={{ border: `1px solid ${viewerColors.line}`, borderRadius: 8, padding: 6, background: viewerColors.well }}>
                <img src={it.url} alt="" style={{ width: '100%', height: 100, objectFit: 'contain', background: '#fff', borderRadius: 4 }} />
                <div style={{ ...viewerMono, fontSize: 9.5, marginTop: 4, wordBreak: 'break-all' }}>{it.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const table = data.tables[active];
  return (
    <div style={viewerRoot}>
      <div style={viewerBar}>
        {data.tables.map((t, i) => (
          <button key={t.name} style={viewerBtn(i === active)} onClick={() => setActive(i)}>
            {t.name}
          </button>
        ))}
        <span style={{ ...viewerMono, marginLeft: 'auto' }}>
          SQLite · {data.tables.length} tables · {data.encoding}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {!table && <div style={viewerMessage}>This database has no tables.</div>}
        {table && (
          <>
            <div style={{ ...viewerMono, padding: '8px 12px' }}>
              {table.rowCount != null ? `${table.rowCount.toLocaleString()} rows` : 'rows unavailable'}
              {table.rowCount != null && table.rowCount > table.rows.length ? ` · first ${table.rows.length} shown` : ''}
            </div>
            <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: '100%' }}>
              <thead>
                <tr style={{ background: viewerColors.bar }}>
                  {table.columns.map((c) => (
                    <th key={c.name} style={{ padding: '4px 10px', textAlign: 'left', whiteSpace: 'nowrap', borderRight: `1px solid ${viewerColors.line}` }}>
                      {c.name}
                      <span style={{ ...viewerMono, fontSize: 9.5, marginLeft: 6 }}>{c.type}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, ri) => (
                  <tr key={ri}>
                    {r.map((v, ci) => (
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
                          color: v === null ? viewerColors.dim : viewerColors.ink
                        }}
                      >
                        {v === null ? 'NULL' : String(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
};

export default DatabaseViewer;
