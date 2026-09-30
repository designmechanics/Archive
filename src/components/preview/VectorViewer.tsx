import React, { useState } from 'react';

interface VectorViewerProps {
  content: string; // SVG text or data URI
  name: string;
}

export const VectorViewer: React.FC<VectorViewerProps> = ({ content, name }) => {
  const [zoom, setZoom] = useState(1);
  const [outlineMode, setOutlineMode] = useState(false);
  const [bgMode, setBgMode] = useState<'checker' | 'dark' | 'light'>('checker');
  const [showSource, setShowSource] = useState(false);
  const [copied, setCopied] = useState<'code' | 'uri' | null>(null);

  // If content is data URI, extract SVG XML
  let svgXml = content;
  if (content.startsWith('data:image/svg+xml;utf8,')) {
    svgXml = decodeURIComponent(content.replace('data:image/svg+xml;utf8,', ''));
  } else if (content.startsWith('data:image/svg+xml;base64,')) {
    try {
      svgXml = atob(content.replace('data:image/svg+xml;base64,', ''));
    } catch {}
  }

  // Count path elements
  const pathMatches = svgXml.match(/<path|<polygon|<rect|<circle|<ellipse|<polyline/gi);
  const shapeCount = pathMatches ? pathMatches.length : 1;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(svgXml);
    setCopied('code');
    setTimeout(() => setCopied(null), 1400);
  };

  const handleCopyUri = () => {
    const uri = `data:image/svg+xml;utf8,${encodeURIComponent(svgXml)}`;
    navigator.clipboard.writeText(uri);
    setCopied('uri');
    setTimeout(() => setCopied(null), 1400);
  };

  const getBg = () => {
    if (bgMode === 'dark') return '#0a1017';
    if (bgMode === 'light') return '#ffffff';
    return 'repeating-conic-gradient(#182432 0% 25%, #111a24 0% 50%) 50% / 18px 18px';
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0d151c',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} style={btnStyle}>
            －
          </button>
          <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', color: '#94bce3' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={() => setZoom((z) => Math.min(5, z + 0.25))} style={btnStyle}>
            ＋
          </button>
          <button onClick={() => setZoom(1)} style={btnStyle}>
            Fit
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => setOutlineMode(!outlineMode)}
            style={{
              ...btnStyle,
              background: outlineMode ? 'rgba(56,239,125,.18)' : 'transparent',
              color: outlineMode ? '#38ef7d' : '#b5d9fd',
              borderColor: outlineMode ? '#38ef7d' : 'rgba(148,188,227,.2)'
            }}
            title="Stroke wireframe mode"
          >
            Outline
          </button>
          <button
            onClick={() => setBgMode((b) => (b === 'checker' ? 'dark' : b === 'dark' ? 'light' : 'checker'))}
            style={btnStyle}
            title="Toggle background"
          >
            Backdrop
          </button>
          <button
            onClick={() => setShowSource(!showSource)}
            style={{
              ...btnStyle,
              background: showSource ? 'rgba(148,188,227,.25)' : 'transparent'
            }}
          >
            {showSource ? 'Canvas' : 'XML Source'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button onClick={handleCopyCode} style={btnStyle}>
            {copied === 'code' ? 'Copied XML' : 'Copy SVG'}
          </button>
          <button onClick={handleCopyUri} style={btnStyle}>
            {copied === 'uri' ? 'Copied URI' : 'Data URI'}
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {showSource ? (
          <pre
            style={{
              margin: 0,
              padding: '16px',
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '11px',
              lineHeight: 1.6,
              color: '#94bce3',
              background: '#090e13',
              height: '100%',
              overflow: 'auto'
            }}
          >
            <code>{svgXml}</code>
          </pre>
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: getBg(),
              display: 'grid',
              placeItems: 'center',
              overflow: 'auto',
              padding: '20px'
            }}
          >
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
                transition: 'transform 0.15s ease-out',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                filter: outlineMode ? 'drop-shadow(0 0 1px #94bce3)' : undefined
              }}
              className={outlineMode ? 'svg-outline-preview' : undefined}
              dangerouslySetInnerHTML={{ __html: svgXml }}
            />
          </div>
        )}
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
          <span>Vector Elements: {shapeCount}</span>
          <span style={{ marginLeft: '12px', color: '#94bce3' }}>SVG 1.1 Vector</span>
        </div>
        <div style={{ color: 'rgba(233,237,242,.4)' }}>
          Lossless Vector Scaling
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
