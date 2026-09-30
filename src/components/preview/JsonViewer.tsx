import React, { useState, useMemo } from 'react';

interface JsonViewerProps {
  jsonString: string;
  name: string;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({ jsonString, name }) => {
  const [filter, setFilter] = useState('');
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'tree' | 'raw'>('tree');

  const parsed = useMemo(() => {
    try {
      return { ok: true, data: JSON.parse(jsonString) };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }, [jsonString]);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const renderValue = (val: any): React.ReactNode => {
    if (val === null) return <span style={{ color: '#ff7b72' }}>null</span>;
    if (typeof val === 'boolean') return <span style={{ color: '#d2a8ff' }}>{String(val)}</span>;
    if (typeof val === 'number') return <span style={{ color: '#79c0ff' }}>{val}</span>;
    if (typeof val === 'string') return <span style={{ color: '#a5d6ff' }}>"{val}"</span>;
    return null;
  };

  const renderTreeNode = (key: string, value: any, depth = 0): React.ReactNode => {
    const isObject = typeof value === 'object' && value !== null;
    const isArr = Array.isArray(value);

    if (!isObject) {
      if (filter && !key.toLowerCase().includes(filter.toLowerCase()) && !String(value).toLowerCase().includes(filter.toLowerCase())) {
        return null;
      }
      return (
        <div key={key} style={{ paddingLeft: `${depth * 16}px`, lineHeight: 1.6 }}>
          <span style={{ color: '#94bce3', fontWeight: 600 }}>{key}</span>: {renderValue(value)}
        </div>
      );
    }

    const entries = Object.entries(value);
    return (
      <div key={key} style={{ paddingLeft: `${depth * 16}px`, lineHeight: 1.6 }}>
        <span style={{ color: '#b5d9fd', fontWeight: 600 }}>
          {key} {isArr ? `[${entries.length}]` : `{${entries.length}}`}
        </span>
        <div>{entries.map(([k, v]) => renderTreeNode(k, v, depth + 1))}</div>
      </div>
    );
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, maxWidth: '240px' }}>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter keys / values…"
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => setViewMode((m) => (m === 'tree' ? 'raw' : 'tree'))}
            style={{
              ...btnStyle,
              background: viewMode === 'tree' ? 'rgba(148,188,227,.25)' : 'transparent'
            }}
          >
            {viewMode === 'tree' ? 'Tree View' : 'Raw Text'}
          </button>

          <button onClick={handleCopy} style={btnStyle}>
            {copied ? 'Copied JSON' : 'Copy JSON'}
          </button>
        </div>
      </div>

      {/* JSON Viewer Body */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
          fontFamily: 'ui-monospace, Menlo, Monaco, Consolas, monospace',
          fontSize: '12px'
        }}
      >
        {!parsed.ok ? (
          <div style={{ color: '#ff7b72' }}>
            Invalid JSON: {parsed.error}
          </div>
        ) : viewMode === 'raw' ? (
          <pre style={{ margin: 0, color: '#94bce3', lineHeight: 1.6 }}>
            {JSON.stringify(parsed.data, null, 2)}
          </pre>
        ) : (
          <div>
            {Object.entries(parsed.data).map(([k, v]) => renderTreeNode(k, v))}
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
          <span>Status: {parsed.ok ? 'Valid JSON' : 'Syntax Error'}</span>
        </div>
        <div style={{ color: '#94bce3' }}>
          Interactive Key/Value Inspector
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
