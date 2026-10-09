import React, { useEffect, useMemo, useRef, useState } from 'react';
import { viewerRoot, viewerBar, viewerBtn, viewerColors, viewerMono, viewerMessage } from './viewerStyles';

interface FontViewerProps {
  src: string;
  name: string;
  ext?: string;
}

interface FontInfo {
  family: string;
  style: string;
  fullName: string;
  postscript: string;
  version: string;
  designer: string;
  manufacturer: string;
  license: string;
  licenseUrl: string;
  copyright: string;
  glyphCount: number;
  unitsPerEm: number;
  features: string[];
  axes: { tag: string; name: string; min: number; def: number; max: number }[];
  codepoints: number[];
}

const FEATURE_NAMES: Record<string, string> = {
  liga: 'Ligatures',
  dlig: 'Discretionary ligatures',
  kern: 'Kerning',
  smcp: 'Small caps',
  c2sc: 'Caps to small caps',
  onum: 'Oldstyle figures',
  lnum: 'Lining figures',
  tnum: 'Tabular figures',
  pnum: 'Proportional figures',
  frac: 'Fractions',
  ordn: 'Ordinals',
  sups: 'Superscript',
  subs: 'Subscript',
  zero: 'Slashed zero',
  swsh: 'Swashes',
  salt: 'Stylistic alternates',
  calt: 'Contextual alternates'
};
const TOGGLEABLE = Object.keys(FEATURE_NAMES);

const SAMPLE_SIZES = [12, 16, 24, 36, 56, 84];
const GLYPH_PAGE = 400;

let fontCounter = 0;

function nameRecord(font: any, key: string): string {
  try {
    const r = font.name?.records?.[key];
    if (!r) return '';
    return String(r.en || Object.values(r)[0] || '');
  } catch {
    return '';
  }
}

function readInfo(font: any): FontInfo {
  const axesObj = font.variationAxes || {};
  return {
    family: font.familyName || '',
    style: font.subfamilyName || '',
    fullName: font.fullName || '',
    postscript: font.postscriptName || '',
    version: font.version != null ? String(font.version) : '',
    designer: nameRecord(font, 'designer'),
    manufacturer: nameRecord(font, 'manufacturer'),
    license: nameRecord(font, 'license'),
    licenseUrl: nameRecord(font, 'licenseURL'),
    copyright: font.copyright || '',
    glyphCount: font.numGlyphs || 0,
    unitsPerEm: font.unitsPerEm || 0,
    features: Array.from(font.availableFeatures || []).map(String),
    axes: Object.keys(axesObj).map((tag) => ({
      tag,
      name: axesObj[tag].name || tag,
      min: axesObj[tag].min,
      def: axesObj[tag].default,
      max: axesObj[tag].max
    })),
    codepoints: Array.from(font.characterSet || []) as number[]
  };
}

/** SVG fallback for fonts the browser cannot load (collections): draws text with fontkit outlines. */
const SvgText: React.FC<{ font: any; text: string; size: number }> = ({ font, text, size }) => {
  const { paths, width, height } = useMemo(() => {
    try {
      const run = font.layout(text);
      const scale = size / font.unitsPerEm;
      let x = 0;
      const out: string[] = [];
      run.glyphs.forEach((g: any, i: number) => {
        const pos = run.positions[i];
        out.push(`<path transform="translate(${(x + pos.xOffset) * scale} ${font.ascent * scale}) scale(${scale} ${-scale})" d="${g.path.toSVG()}"/>`);
        x += pos.xAdvance;
      });
      return { paths: out.join(''), width: Math.max(1, x * scale), height: (font.ascent - font.descent) * scale };
    } catch {
      return { paths: '', width: 1, height: size };
    }
  }, [font, text, size]);
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="currentColor"
      dangerouslySetInnerHTML={{ __html: paths }}
    />
  );
};

export const FontViewer: React.FC<FontViewerProps> = ({ src, name, ext }) => {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [fonts, setFonts] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [family, setFamily] = useState<string | null>(null); // CSS family when the browser can load it
  const [tab, setTab] = useState<'specimen' | 'glyphs' | 'info'>('specimen');
  const [text, setText] = useState('The quick brown fox jumps over the lazy dog 0123456789');
  const [size, setSize] = useState(48);
  const [axisValues, setAxisValues] = useState<Record<string, number>>({});
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [glyphLimit, setGlyphLimit] = useState(GLYPH_PAGE);
  const [selectedCp, setSelectedCp] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const faceRef = useRef<FontFace | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setError('');
    setFamily(null);
    setFonts([]);
    setIndex(0);
    setAxisValues({});
    setFeatures({});
    setGlyphLimit(GLYPH_PAGE);

    (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`Could not read the font file (${res.status})`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;

        const lower = (ext || name.split('.').pop() || '').toLowerCase();
        if (lower === 'eot') {
          throw new Error('EOT is a legacy Internet Explorer font format. Browsers cannot load it, so there is no specimen to show.');
        }

        const fontkit: any = await import('fontkit');
        const created = (fontkit.create || fontkit.default?.create)(new Uint8Array(buf));
        const list: any[] = created.fonts ? created.fonts : [created];
        if (cancelled) return;
        setFonts(list);

        // Let the browser render it when it can (everything except collections)
        if (!created.fonts) {
          try {
            const css = `arc-font-${++fontCounter}`;
            const face = new FontFace(css, buf);
            await face.load();
            document.fonts.add(face);
            faceRef.current = face;
            if (!cancelled) setFamily(css);
          } catch {
            // fall back to outline rendering
          }
        }
        if (!cancelled) setState('ready');
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Could not open this font');
          setState('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      if (faceRef.current) {
        try {
          document.fonts.delete(faceRef.current);
        } catch {}
        faceRef.current = null;
      }
    };
  }, [src, name, ext]);

  const font = fonts[index];
  const info = useMemo(() => (font ? readInfo(font) : null), [font]);

  const fontStyle = useMemo<React.CSSProperties>(() => {
    const variation = Object.entries(axisValues)
      .map(([tag, v]) => `"${tag}" ${v}`)
      .join(', ');
    const feats = Object.entries(features)
      .map(([tag, on]) => `"${tag}" ${on ? 1 : 0}`)
      .join(', ');
    return {
      fontFamily: family ? `"${family}", sans-serif` : undefined,
      fontVariationSettings: variation || undefined,
      fontFeatureSettings: feats || undefined
    };
  }, [family, axisValues, features]);

  const fontFaceCss = useMemo(() => {
    if (!info) return '';
    const fam = info.family || name.replace(/\.[^.]+$/, '');
    return `@font-face {\n  font-family: "${fam}";\n  src: url("${name}");\n  font-weight: normal;\n  font-style: normal;\n}`;
  }, [info, name]);

  if (state === 'loading') return <div style={{ ...viewerRoot, ...viewerMessage }}>Reading font…</div>;
  if (state === 'error' || !info) {
    return (
      <div style={{ ...viewerRoot }}>
        <div style={viewerMessage}>
          {error || 'This font could not be read.'}
          <div style={{ marginTop: 8 }}>{name}</div>
        </div>
      </div>
    );
  }

  const Render: React.FC<{ value: string; px: number; style?: React.CSSProperties }> = ({ value, px, style }) =>
    family ? (
      <div style={{ ...fontStyle, fontSize: px, lineHeight: 1.25, wordBreak: 'break-word', ...style }}>{value}</div>
    ) : (
      <div style={{ ...style, color: viewerColors.ink }}>
        <SvgText font={font} text={value} size={px} />
      </div>
    );

  const cps = info.codepoints.filter((c) => c > 32 && !(c >= 0x7f && c <= 0x9f));
  const shownCps = cps.slice(0, glyphLimit);

  return (
    <div style={viewerRoot}>
      <div style={viewerBar}>
        {(['specimen', 'glyphs', 'info'] as const).map((t) => (
          <button key={t} style={viewerBtn(tab === t)} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
        {fonts.length > 1 && (
          <select
            value={index}
            onChange={(e) => setIndex(Number(e.target.value))}
            style={{ ...viewerBtn(), background: viewerColors.bg }}
          >
            {fonts.map((f, i) => (
              <option key={i} value={i}>
                {f.fullName || f.postscriptName || `Font ${i + 1}`}
              </option>
            ))}
          </select>
        )}
        <span style={{ ...viewerMono, marginLeft: 'auto' }}>
          {info.family} {info.style} · {info.glyphCount.toLocaleString()} glyphs
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px' }}>
        {tab === 'specimen' && (
          <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
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
                <input type="range" min={12} max={160} value={size} onChange={(e) => setSize(Number(e.target.value))} />
              </label>
            </div>

            <Render value={text || ' '} px={size} style={{ marginBottom: 18 }} />

            {info.axes.length > 0 && family && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ ...viewerMono, marginBottom: 6 }}>VARIABLE AXES</div>
                {info.axes.map((a) => (
                  <label key={a.tag} style={{ ...viewerMono, display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ width: 120 }}>{a.name}</span>
                    <input
                      type="range"
                      min={a.min}
                      max={a.max}
                      step={(a.max - a.min) / 200 || 1}
                      value={axisValues[a.tag] ?? a.def}
                      onChange={(e) => setAxisValues((p) => ({ ...p, [a.tag]: Number(e.target.value) }))}
                    />
                    <span>{Math.round(axisValues[a.tag] ?? a.def)}</span>
                  </label>
                ))}
              </div>
            )}

            {family && info.features.some((f) => TOGGLEABLE.includes(f)) && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ ...viewerMono, marginBottom: 6 }}>OPENTYPE FEATURES</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {info.features
                    .filter((f) => TOGGLEABLE.includes(f))
                    .map((f) => (
                      <button
                        key={f}
                        style={viewerBtn(Boolean(features[f]))}
                        onClick={() => setFeatures((p) => ({ ...p, [f]: !p[f] }))}
                        title={FEATURE_NAMES[f]}
                      >
                        {f}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {SAMPLE_SIZES.map((px) => (
              <div key={px} style={{ display: 'flex', gap: 12, alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ ...viewerMono, width: 34, flexShrink: 0 }}>{px}</span>
                <Render value="ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789" px={px} />
              </div>
            ))}
          </>
        )}

        {tab === 'glyphs' && (
          <>
            <div style={{ ...viewerMono, marginBottom: 8 }}>
              {cps.length.toLocaleString()} characters
              {selectedCp != null &&
                ` · U+${selectedCp.toString(16).toUpperCase().padStart(4, '0')} “${String.fromCodePoint(selectedCp)}”`}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(54px, 1fr))', gap: 4 }}>
              {shownCps.map((cp) => (
                <button
                  key={cp}
                  onClick={() => setSelectedCp(cp)}
                  title={`U+${cp.toString(16).toUpperCase().padStart(4, '0')}`}
                  style={{
                    aspectRatio: '1',
                    border: `1px solid ${selectedCp === cp ? viewerColors.accent : viewerColors.line}`,
                    background: viewerColors.well,
                    color: viewerColors.ink,
                    borderRadius: 8,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    ...fontStyle,
                    fontSize: 24
                  }}
                >
                  {family ? String.fromCodePoint(cp) : <SvgText font={font} text={String.fromCodePoint(cp)} size={24} />}
                </button>
              ))}
            </div>
            {glyphLimit < cps.length && (
              <button style={{ ...viewerBtn(), marginTop: 10 }} onClick={() => setGlyphLimit((n) => n + GLYPH_PAGE)}>
                Show more ({(cps.length - glyphLimit).toLocaleString()} left)
              </button>
            )}
          </>
        )}

        {tab === 'info' && (
          <>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
              <tbody>
                {(
                  [
                    ['Family', info.family],
                    ['Style', info.style],
                    ['Full name', info.fullName],
                    ['PostScript name', info.postscript],
                    ['Version', info.version],
                    ['Designer', info.designer],
                    ['Foundry', info.manufacturer],
                    ['Copyright', info.copyright],
                    ['License', info.license],
                    ['License URL', info.licenseUrl],
                    ['Glyphs', info.glyphCount.toLocaleString()],
                    ['Units per em', String(info.unitsPerEm)],
                    ['Format', (ext || name.split('.').pop() || '').toUpperCase()],
                    ['Features', info.features.join(' ') || 'none'],
                    ['Variable axes', info.axes.map((a) => `${a.tag} ${a.min}–${a.max}`).join(', ') || 'none']
                  ] as [string, string][]
                )
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <tr key={k} style={{ borderBottom: `1px solid ${viewerColors.line}` }}>
                      <td style={{ ...viewerMono, padding: '6px 10px 6px 0', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{k}</td>
                      <td style={{ padding: '6px 0', wordBreak: 'break-word' }}>{v}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <div style={{ ...viewerMono, margin: '14px 0 6px' }}>CSS</div>
            <pre
              style={{
                margin: 0,
                padding: 10,
                background: viewerColors.well,
                borderRadius: 8,
                fontSize: 11,
                whiteSpace: 'pre-wrap'
              }}
            >
              {fontFaceCss}
            </pre>
            <button
              style={{ ...viewerBtn(), marginTop: 8 }}
              onClick={() => {
                navigator.clipboard.writeText(fontFaceCss);
                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
              }}
            >
              {copied ? 'Copied' : 'Copy CSS'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default FontViewer;
