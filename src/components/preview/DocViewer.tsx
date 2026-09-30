import React, { useState, useMemo } from 'react';

interface DocViewerProps {
  content: string;
  name: string;
}

export const DocViewer: React.FC<DocViewerProps> = ({ content, name }) => {
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  const wordCount = useMemo(() => {
    return content.trim().split(/\s+/).filter(Boolean).length;
  }, [content]);

  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
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
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setShowRaw(!showRaw)}
            style={{
              ...btnStyle,
              background: showRaw ? 'rgba(148,188,227,.25)' : 'transparent'
            }}
          >
            {showRaw ? 'Formatted View' : 'Raw Markdown'}
          </button>
        </div>

        <button onClick={handleCopy} style={btnStyle}>
          {copied ? 'Copied' : 'Copy Text'}
        </button>
      </div>

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '20px 24px',
          color: '#e9edf2',
          lineHeight: 1.7
        }}
      >
        {showRaw ? (
          <pre
            style={{
              margin: 0,
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '11.5px',
              color: '#94bce3',
              whiteSpace: 'pre-wrap'
            }}
          >
            {content}
          </pre>
        ) : (
          <div
            style={{
              fontFamily: 'Barlow, system-ui, sans-serif',
              fontSize: '14px',
              maxWidth: '680px',
              margin: '0 auto'
            }}
          >
            <div
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '24px',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: '#b5d9fd',
                marginBottom: '12px'
              }}
            >
              {name}
            </div>
            <div style={{ whiteSpace: 'pre-wrap', color: 'rgba(233,237,242,.85)' }}>
              {content}
            </div>
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
          <span>{wordCount} words</span>
          <span style={{ marginLeft: '12px', color: '#94bce3' }}>~{readingTime} min read</span>
        </div>
        <div style={{ color: 'rgba(233,237,242,.4)' }}>
          Document / Markdown Preview
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
