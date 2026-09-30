import React, { useState } from 'react';

interface HtmlViewerProps {
  htmlContent: string;
  name: string;
}

export const HtmlViewer: React.FC<HtmlViewerProps> = ({ htmlContent, name }) => {
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [key, setKey] = useState(0);
  const [showSource, setShowSource] = useState(false);
  const [copied, setCopied] = useState(false);

  const getWidth = () => {
    if (device === 'mobile') return '375px';
    if (device === 'tablet') return '768px';
    return '100%';
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(htmlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0c131a',
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
        {/* Device Viewport Pills */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['desktop', 'tablet', 'mobile'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDevice(d)}
              style={{
                ...btnStyle,
                background: device === d ? 'rgba(148,188,227,.3)' : 'transparent',
                borderColor: device === d ? '#94bce3' : 'rgba(148,188,227,.2)',
                color: device === d ? '#ffffff' : '#b5d9fd'
              }}
            >
              {d === 'desktop' ? '🖥 Desktop' : d === 'tablet' ? '📱 Tablet' : '📲 Mobile'}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setKey((k) => k + 1)} style={btnStyle} title="Reload / Replay Sandbox">
            ↻ Replay
          </button>

          <button
            onClick={() => setShowSource(!showSource)}
            style={{
              ...btnStyle,
              background: showSource ? 'rgba(148,188,227,.25)' : 'transparent'
            }}
          >
            {showSource ? 'Live View' : 'Source'}
          </button>

          <button onClick={handleCopy} style={btnStyle}>
            {copied ? 'Copied' : 'Copy HTML'}
          </button>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#090e13',
          overflow: 'auto',
          padding: device !== 'desktop' ? '16px' : '0'
        }}
      >
        {showSource ? (
          <pre
            style={{
              margin: 0,
              padding: '16px',
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '11px',
              lineHeight: 1.6,
              color: '#94bce3',
              width: '100%',
              height: '100%',
              overflow: 'auto',
              whiteSpace: 'pre-wrap'
            }}
          >
            <code>{htmlContent}</code>
          </pre>
        ) : (
          <iframe
            key={key}
            srcDoc={htmlContent}
            title={name}
            sandbox="allow-scripts allow-forms allow-same-origin allow-pointer-lock"
            style={{
              width: getWidth(),
              height: '100%',
              border: device !== 'desktop' ? '1px solid rgba(148,188,227,.3)' : 'none',
              borderRadius: device !== 'desktop' ? '12px' : '0',
              background: '#ffffff',
              boxShadow: device !== 'desktop' ? '0 12px 40px rgba(0,0,0,.6)' : 'none',
              transition: 'width 0.25s ease-in-out'
            }}
          />
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
          <span>Viewport: {device.toUpperCase()} ({getWidth()})</span>
        </div>
        <div style={{ color: '#38ef7d' }}>
          Sandboxed Execution Active
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
