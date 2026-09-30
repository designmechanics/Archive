import React, { useState, useMemo } from 'react';

interface CodeViewerProps {
  code: string;
  name: string;
  ext?: string;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({ code, name, ext = 'js' }) => {
  const [wrap, setWrap] = useState(false);
  const [fontSize, setFontSize] = useState(12);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  const lines = useMemo(() => code.split('\n'), [code]);

  const searchMatches = useMemo(() => {
    if (!search.trim()) return 0;
    const q = search.toLowerCase();
    return lines.filter((l) => l.toLowerCase().includes(q)).length;
  }, [lines, search]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#090e13',
        borderRadius: '14px',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* Top Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'rgba(24,36,50,.92)',
          borderBottom: '1px solid rgba(148,188,227,.14)',
          zIndex: 10,
          flexWrap: 'wrap',
          gap: '6px'
        }}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, maxWidth: '240px' }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code…"
            style={{
              width: '100%',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid rgba(148,188,227,.2)',
              background: '#0d151c',
              color: '#e9edf2',
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '11px'
            }}
          />
          {search && (
            <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '10px', color: '#94bce3' }}>
              {searchMatches}
            </span>
          )}
        </div>

        {/* View toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => setWrap(!wrap)}
            style={{
              ...btnStyle,
              background: wrap ? 'rgba(56,239,125,.18)' : 'transparent',
              color: wrap ? '#38ef7d' : '#b5d9fd'
            }}
          >
            Wrap {wrap ? 'On' : 'Off'}
          </button>

          <button onClick={() => setFontSize((s) => Math.max(10, s - 1))} style={btnStyle} title="Smaller text">
            A-
          </button>
          <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '10px', color: '#94bce3' }}>
            {fontSize}px
          </span>
          <button onClick={() => setFontSize((s) => Math.min(18, s + 1))} style={btnStyle} title="Larger text">
            A+
          </button>

          <button onClick={handleCopy} style={btnStyle}>
            {copied ? 'Copied' : 'Copy All'}
          </button>
        </div>
      </div>

      {/* Code Editor / Inspector Body */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          fontFamily: 'ui-monospace, Menlo, Monaco, Consolas, monospace',
          fontSize: `${fontSize}px`,
          lineHeight: 1.6
        }}
      >
        {/* Line Numbers Gutter */}
        <div
          style={{
            userSelect: 'none',
            padding: '12px 8px 12px 14px',
            textAlign: 'right',
            color: 'rgba(148,188,227,.35)',
            borderRight: '1px solid rgba(148,188,227,.1)',
            background: 'rgba(12,18,24,.6)',
            flex: 'none'
          }}
        >
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {/* Code Content */}
        <div
          style={{
            flex: 1,
            padding: '12px 16px',
            whiteSpace: wrap ? 'pre-wrap' : 'pre',
            wordBreak: wrap ? 'break-word' : 'normal',
            color: '#b5d9fd',
            overflowX: wrap ? 'hidden' : 'auto'
          }}
        >
          {lines.map((line, i) => {
            const isMatch = search.trim() && line.toLowerCase().includes(search.toLowerCase());
            return (
              <div
                key={i}
                style={{
                  background: isMatch ? 'rgba(148,188,227,.2)' : 'transparent',
                  borderRadius: '2px'
                }}
              >
                {line || ' '}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom HUD Bar */}
      <div
        style={{
          padding: '6px 14px',
          background: 'rgba(24,36,50,.94)',
          borderTop: '1px solid rgba(148,188,227,.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: '10px',
          color: 'rgba(233,237,242,.7)'
        }}
      >
        <div>
          <span>{lines.length} lines</span>
          <span style={{ marginLeft: '12px' }}>{code.length} chars</span>
        </div>
        <div style={{ color: '#94bce3' }}>
          .{ext.toUpperCase()} Source
        </div>
      </div>
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: '6px',
  border: '1px solid rgba(148,188,227,.2)',
  background: 'rgba(148,188,227,.1)',
  color: '#b5d9fd',
  fontFamily: 'ui-monospace, Menlo, monospace',
  fontSize: '10.5px',
  cursor: 'pointer'
};
