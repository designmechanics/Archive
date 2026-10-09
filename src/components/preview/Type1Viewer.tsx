import React, { useEffect, useMemo, useState } from 'react';
import {
  parsePfb,
  parseAfm,
  parsePfm,
  sniffType1,
  glyphNameForChar,
  Type1Font,
  AfmData,
  PfmData
} from '../../services/type1';
import { viewerRoot, viewerBar, viewerBtn, viewerColors, viewerMono, viewerMessage } from './viewerStyles';

interface Type1ViewerProps {
  src: string;
  name: string;
}

type Loaded =
  | { kind: 'pfb'; font: Type1Font }
  | { kind: 'afm'; afm: AfmData }
  | { kind: 'pfm'; pfm: PfmData };

const GLYPH_PAGE = 300;

/** One glyph or one word, drawn from the font's outlines. */
const OutlineText: React.FC<{ font: Type1Font; text: string; size: number }> = ({ font, text, size }) => {
  const { d, width, height } = useMemo(() => {
    const scale = size / font.info.unitsPerEm;
    const bbox = font.info.bbox || [0, -250, 1000, 900];
    let x = 0;
    const paths: string[] = [];
    for (const ch of text) {
      const name = glyphNameForChar(ch, font.encoding);
      const g = name ? font.glyph(name) : null;
      if (!g) {
        x += font.info.unitsPerEm * 0.3;
        continue;
      }
      paths.push(`<path transform="translate(${x} 0)" d="${g.path}"/>`);
      x += g.width;
    }
    return { d: paths.join(''), width: Math.max(1, x * scale), height: (bbox[3] - bbox[1]) * scale, scale, bbox };
  }, [font, text, size]);

  const bbox = font.info.bbox || [0, -250, 1000, 900];
  const scale = size / font.info.unitsPerEm;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 ${-bbox[3] * scale} ${width} ${height}`}
      fill="currentColor"
      style={{ display: 'inline-block', verticalAlign: 'bottom' }}
    >
      <g transform={`scale(${scale} ${-scale})`} dangerouslySetInnerHTML={{ __html: d }} />
    </svg>
  );
};

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

export const Type1Viewer: React.FC<Type1ViewerProps> = ({ src, name }) => {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [data, setData] = useState<Loaded | null>(null);
  const [tab, setTab] = useState<'specimen' | 'glyphs' | 'info' | 'chars' | 'kerning'>('info');
  const [text, setText] = useState('The quick brown fox jumps over the lazy dog 0123456789');
  const [size, setSize] = useState(56);
  const [glyphLimit, setGlyphLimit] = useState(GLYPH_PAGE);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setData(null);
    (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`Could not read the file (${res.status})`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (cancelled) return;
        const kind = sniffType1(bytes);
        if (kind === 'pfb') {
          const font = parsePfb(bytes);
          if (!font) throw new Error('This Type 1 font could not be decoded.');
          setData({ kind: 'pfb', font });
          setTab('specimen');
        } else if (kind === 'afm') {
          const afm = parseAfm(new TextDecoder('latin1').decode(bytes));
          if (!afm) throw new Error('This metrics file could not be read.');
          setData({ kind: 'afm', afm });
          setTab('info');
        } else if (kind === 'pfm') {
          const pfm = parsePfm(bytes);
          if (!pfm) throw new Error('This metrics file could not be read.');
          setData({ kind: 'pfm', pfm });
          setTab('info');
        } else {
          throw new Error('This is not a Type 1 font file.');
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
  }, [src]);

  if (state === 'loading') return <div style={{ ...viewerRoot, ...viewerMessage }}>Reading font…</div>;
  if (state === 'error' || !data) {
    return (
      <div style={viewerRoot}>
        <div style={viewerMessage}>
          {error}
          <div style={{ marginTop: 8 }}>{name}</div>
        </div>
      </div>
    );
  }

  let tabs: ('specimen' | 'glyphs' | 'info' | 'chars' | 'kerning')[] = [];
  let title = '';
  if (data.kind === 'pfb') {
    tabs = ['specimen', 'glyphs', 'info'];
    title = `${data.font.info.fullName || data.font.info.fontName} · ${data.font.glyphNames.length} glyphs`;
  } else if (data.kind === 'afm') {
    tabs = ['info', 'chars', 'kerning'];
    title = `${data.afm.info.FullName || data.afm.info.FontName || name} · metrics`;
  } else {
    tabs = ['info', 'chars', 'kerning'];
    title = `${data.pfm.faceName || name} · Windows metrics`;
  }

  return (
    <div style={viewerRoot}>
      <div style={viewerBar}>
        {tabs.map((t) => (
          <button key={t} style={viewerBtn(tab === t)} onClick={() => setTab(t)}>
            {t === 'chars' ? 'characters' : t}
          </button>
        ))}
        <span style={{ ...viewerMono, marginLeft: 'auto' }}>{title}</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px' }}>
        {data.kind === 'pfb' && tab === 'specimen' && (
          <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                style={{
                  flex: '1 1 220px',
                  background: viewerColors.well,
                  border: `1px solid ${viewerColors.line}`,
                  borderRadius: 8,
                  color: viewerColors.ink,
                  padding: '6px 10px',
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: 12
                }}
              />
              <label style={{ ...viewerMono, display: 'flex', alignItems: 'center', gap: 6 }}>
                {size}px
                <input type="range" min={14} max={140} value={size} onChange={(e) => setSize(Number(e.target.value))} />
              </label>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: size * 0.3, rowGap: 6 }}>
              {text.split(' ').map((w, i) => (
                <OutlineText key={i} font={data.font} text={w} size={size} />
              ))}
            </div>
            {[18, 28, 44].map((px) => (
              <div key={px} style={{ marginTop: 16 }}>
                <div style={{ ...viewerMono, fontSize: 9.5 }}>{px}px</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: px * 0.3 }}>
                  {'ABCDEFGHIJKLM NOPQRSTUVWXYZ abcdefghijklm nopqrstuvwxyz 0123456789'.split(' ').map((w, i) => (
                    <OutlineText key={i} font={data.font} text={w} size={px} />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {data.kind === 'pfb' && tab === 'glyphs' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(86px, 1fr))', gap: 6 }}>
              {data.font.glyphNames.slice(0, glyphLimit).map((n) => {
                const g = data.font.glyph(n);
                if (!g) return null;
                const upm = data.font.info.unitsPerEm;
                const bb = data.font.info.bbox || [0, -250, upm, 900];
                return (
                  <div
                    key={n}
                    title={n}
                    style={{
                      border: `1px solid ${viewerColors.line}`,
                      borderRadius: 8,
                      background: viewerColors.well,
                      padding: 4,
                      textAlign: 'center'
                    }}
                  >
                    <svg
                      viewBox={`${Math.min(0, bb[0])} ${-bb[3]} ${Math.max(g.width, bb[2]) - Math.min(0, bb[0])} ${bb[3] - bb[1]}`}
                      width="100%"
                      height={56}
                      fill="currentColor"
                    >
                      <g transform="scale(1 -1)">
                        <path d={g.path} />
                      </g>
                    </svg>
                    <div style={{ ...viewerMono, fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n}</div>
                  </div>
                );
              })}
            </div>
            {glyphLimit < data.font.glyphNames.length && (
              <button style={{ ...viewerBtn(), marginTop: 10 }} onClick={() => setGlyphLimit((n) => n + GLYPH_PAGE)}>
                Show more ({data.font.glyphNames.length - glyphLimit} left)
              </button>
            )}
          </>
        )}

        {data.kind === 'pfb' && tab === 'info' && (
          <Table
            rows={[
              ['Font name', data.font.info.fontName],
              ['Full name', data.font.info.fullName],
              ['Family', data.font.info.familyName],
              ['Weight', data.font.info.weight],
              ['Version', data.font.info.version],
              ['Copyright', data.font.info.notice],
              ['Italic angle', String(data.font.info.italicAngle)],
              ['Fixed pitch', data.font.info.isFixedPitch ? 'yes' : 'no'],
              ['Font box', data.font.info.bbox ? data.font.info.bbox.join(' ') : ''],
              ['Units per em', String(data.font.info.unitsPerEm)],
              ['Glyphs', String(data.font.glyphNames.length)],
              ['Format', 'Adobe Type 1 (PostScript outlines)']
            ]}
          />
        )}

        {data.kind === 'afm' && tab === 'info' && (
          <Table
            rows={[
              ['Font name', data.afm.info.FontName],
              ['Full name', data.afm.info.FullName],
              ['Family', data.afm.info.FamilyName],
              ['Weight', data.afm.info.Weight],
              ['Version', data.afm.info.Version],
              ['Copyright', data.afm.info.Notice],
              ['Encoding', data.afm.info.EncodingScheme],
              ['Italic angle', data.afm.info.ItalicAngle],
              ['Fixed pitch', data.afm.info.IsFixedPitch],
              ['Font box', data.afm.info.FontBBox],
              ['Cap height', data.afm.info.CapHeight],
              ['x-height', data.afm.info.XHeight],
              ['Ascender', data.afm.info.Ascender],
              ['Descender', data.afm.info.Descender],
              ['Characters', String(data.afm.chars.length)],
              ['Kerning pairs', String(data.afm.kernPairs.length)]
            ]}
          />
        )}

        {data.kind === 'afm' && tab === 'chars' && (
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
            <thead>
              <tr style={{ ...viewerMono, textAlign: 'left' }}>
                <th style={{ padding: '4px 8px' }}>Code</th>
                <th style={{ padding: '4px 8px' }}>Name</th>
                <th style={{ padding: '4px 8px' }}>Width</th>
                <th style={{ padding: '4px 8px' }}>Box</th>
              </tr>
            </thead>
            <tbody>
              {data.afm.chars.map((c, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${viewerColors.line}` }}>
                  <td style={{ padding: '3px 8px' }}>{c.code >= 0 ? c.code : '–'}</td>
                  <td style={{ padding: '3px 8px' }}>{c.name}</td>
                  <td style={{ padding: '3px 8px' }}>{c.width}</td>
                  <td style={{ padding: '3px 8px', ...viewerMono }}>{c.bbox ? c.bbox.join(' ') : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {data.kind === 'afm' && tab === 'kerning' && (
          <>
            <div style={{ ...viewerMono, marginBottom: 8 }}>
              {data.afm.kernPairs.length.toLocaleString()} pairs{data.afm.kernPairs.length > 400 ? ' · first 400 shown' : ''}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 4, fontSize: 12 }}>
              {data.afm.kernPairs.slice(0, 400).map((k, i) => (
                <div key={i} style={{ borderBottom: `1px solid ${viewerColors.line}`, padding: '2px 0' }}>
                  {k.a} {k.b} <span style={viewerMono}>{k.amount}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {data.kind === 'pfm' && tab === 'info' && (
          <Table
            rows={[
              ['Face name', data.pfm.faceName],
              ['PostScript name', data.pfm.postscriptName],
              ['Copyright', data.pfm.copyright],
              ['Weight', String(data.pfm.weight)],
              ['Italic', data.pfm.italic ? 'yes' : 'no'],
              ['Ascent', String(data.pfm.ascent)],
              ['Average width', String(data.pfm.avgWidth)],
              ['Maximum width', String(data.pfm.maxWidth)],
              ['Character range', `${data.pfm.firstChar}–${data.pfm.lastChar}`],
              ['Kerning pairs', String(data.pfm.kernPairs.length)]
            ]}
          />
        )}

        {data.kind === 'pfm' && tab === 'chars' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 4, fontSize: 12 }}>
            {data.pfm.widths.map((w, i) => {
              const code = data.pfm.firstChar + i;
              return (
                <div key={code} style={{ borderBottom: `1px solid ${viewerColors.line}`, padding: '2px 0' }}>
                  <span style={viewerMono}>{code}</span> {code > 32 ? String.fromCharCode(code) : ''} · {w}
                </div>
              );
            })}
          </div>
        )}

        {data.kind === 'pfm' && tab === 'kerning' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 4, fontSize: 12 }}>
            {data.pfm.kernPairs.slice(0, 600).map((k, i) => (
              <div key={i} style={{ borderBottom: `1px solid ${viewerColors.line}`, padding: '2px 0' }}>
                {String.fromCharCode(k.first)}
                {String.fromCharCode(k.second)} <span style={viewerMono}>{k.amount}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Type1Viewer;
