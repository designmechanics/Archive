import React, { useState, useMemo } from 'react';

interface CssViewerProps {
  css: string;
  name: string;
}

export const CssViewer: React.FC<CssViewerProps> = ({ css, name }) => {
  const [filter, setFilter] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  // Extract all hex, rgb, and hsl colors
  const extractedColors = useMemo(() => {
    const hex = css.match(/#(?:[0-9a-fA-F]{3,4}){1,2}\b/g) || [];
    const rgb = css.match(/rgba?\([^)]+\)/gi) || [];
    const hsl = css.match(/hsla?\([^)]+\)/gi) || [];
    return Array.from(new Set([...hex, ...rgb, ...hsl])).slice(0, 24);
  }, [css]);

  const handleCopyColor = (color: string) => {
    navigator.clipboard.writeText(color);
    setCopied(color);
    setTimeout(() => setCopied(null), 1200);
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(css);
    setCopied('all');
    setTimeout(() => setCopied(null), 1200);
  };

  const lines = useMemo(() => {
    const all = css.split('\n');
    if (!filter.trim()) return all;
    return all.filter((l) => l.toLowerCase().includes(filter.toLowerCase()));
  }, [css, filter]);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, maxWidth: '240px' }}>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search CSS selectors…"
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
        </div>

        <button onClick={handleCopyAll} style={btnStyle}>
          {copied === 'all' ? 'Copied All CSS' : 'Copy All CSS'}
        </button>
      </div>

      {/* Extracted Color Palette Swatches Bar */}
      {extractedColors.length > 0 && (
        <div
          style={{
            padding: '8px 14px',
            background: 'rgba(18,28,40,.85)',
            borderBottom: '1px solid rgba(148,188,227,.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto'
          }}
        >
          <span
            style={{
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '9.5px',
              color: 'rgba(148,188,227,.6)',
              textTransform: 'uppercase',
              flex: 'none'
            }}
          >
            Palette ({extractedColors.length}):
          </span>

          <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
            {extractedColors.map((c) => (
              <div
                key={c}
                onClick={() => handleCopyColor(c)}
                title={`Click to copy: ${c}`}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '5px',
                  background: c,
                  border: '1px solid rgba(255,255,255,.25)',
                  cursor: 'pointer',
                  flex: 'none',
                  boxShadow: '0 2px 5px rgba(0,0,0,.3)',
                  transform: copied === c ? 'scale(1.2)' : 'scale(1)',
                  transition: 'transform 0.15s'
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* CSS Rules Content */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '14px 16px',
          fontFamily: 'ui-monospace, Menlo, Monaco, Consolas, monospace',
          fontSize: '11.5px',
          lineHeight: 1.6,
          color: '#b5d9fd',
          whiteSpace: 'pre'
        }}
      >
        {lines.join('\n')}
      </div>

      {/* Bottom HUD */}
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
          <span style={{ marginLeft: '12px', color: '#94bce3' }}>CSS / Stylesheet</span>
        </div>
        <div style={{ color: 'rgba(233,237,242,.4)' }}>
          Click swatch to copy hex code
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
