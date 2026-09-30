import React, { useState } from 'react';

interface PdfViewerProps {
  src: string;
  name: string;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ src, name }) => {
  const [rotation, setRotation] = useState(0);

  const handleRotate = () => {
    setRotation((r) => (r + 90) % 360);
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
      {/* Top Controls Toolbar */}
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
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={handleRotate} style={btnStyle} title="Rotate 90 degrees">
            ↻ Rotate 90°
          </button>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...btnStyle, textDecoration: 'none', display: 'inline-block' }}
          >
            Open in Tab ↗
          </a>
          <a
            href={src}
            download={name}
            style={{ ...btnStyle, textDecoration: 'none', display: 'inline-block' }}
          >
            Download ↓
          </a>
        </div>
      </div>

      {/* Embedded PDF iframe */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          background: '#151d26',
          transform: `rotate(${rotation}deg)`,
          transformOrigin: 'center center',
          transition: 'transform 0.25s ease'
        }}
      >
        {src ? (
          <iframe
            src={src}
            title={name}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: '#ffffff'
            }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#94bce3',
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '11px',
              letterSpacing: '.06em',
              textTransform: 'uppercase'
            }}
          >
            Loading PDF Document…
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
          <span>{name}</span>
        </div>
        <div style={{ color: '#94bce3' }}>
          Portable Document Format (PDF)
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
