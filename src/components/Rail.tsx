import React from 'react';
import { WatchedFolder } from '../types';

interface RailProps {
  totalCount: number;
  poolCounts: Record<string, number>;
  selectedPool: string | null;
  onSelectPool: (pool: string | null) => void;
  onHoverPool: (pool: string | null) => void;
  fanPool: string | null;
  onToggleFan: (pool: string) => void;
  folders: WatchedFolder[];
  onOpenModal: () => void;
  onRemoveFolder?: (id: string) => void;
  indexPct: number;
  indexFile: string;
  indexStatus?: 'idle' | 'scanning' | 'indexing' | 'complete' | 'error';
  dbSize?: string;
  dbPath?: string;
  onOptimizeDb?: () => void;
  onClearAll?: () => void;
  onOpenSettings?: () => void;
}

export const Rail: React.FC<RailProps> = ({
  totalCount,
  poolCounts,
  selectedPool,
  onSelectPool,
  onHoverPool,
  fanPool,
  onToggleFan,
  folders,
  onOpenModal,
  onRemoveFolder,
  indexPct,
  indexFile,
  indexStatus = 'idle',
  dbSize,
  dbPath,
  onOptimizeDb,
  onClearAll,
  onOpenSettings
}) => {


  const pools = [
    'Effects',
    'Buttons',
    'Loaders',
    'Backgrounds',
    'Transitions',
    'Typography',
    'Layouts',
    'Scroll',
    'Physics',
    'Shaders',
    'Routines/utils',
    'Experiments'
  ];

  return (
    <aside
      data-rail="1"
      style={{
        position: 'relative',
        zIndex: 30,
        background: 'var(--rail, #1d2d3d)',
        color: '#e9edf2',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '14px 0 40px rgba(29,45,61,.28)',
        height: '100%',
        userSelect: 'none'
      }}
    >
      {/* Brand Header */}
      <div style={{ padding: '22px 20px 16px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div
          data-intro="1"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 700,
            fontSize: '27px',
            letterSpacing: '.02em',
            lineHeight: 1,
            textTransform: 'uppercase'
          }}
        >
          Archive
        </div>
        <div
          data-intro="1"
          style={{
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: '10px',
            letterSpacing: '.14em',
            color: '#94bce3',
            textTransform: 'uppercase'
          }}
        >
          index · {totalCount.toLocaleString()} assets · 12 pools
        </div>
      </div>

      {/* Indexing status card */}
      <div
        data-intro="1"
        style={{
          margin: '0 16px 14px',
          padding: '10px 12px',
          borderRadius: '12px',
          background: 'rgba(148,188,227,.1)',
          border: '1px solid rgba(148,188,227,.22)',
          display: 'flex',
          flexDirection: 'column',
          gap: '7px'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: '9.5px',
            letterSpacing: '.12em',
            color: '#b5d9fd',
            textTransform: 'uppercase'
          }}
        >
          <span>
            {indexStatus === 'scanning'
              ? 'Scanning'
              : indexStatus === 'indexing'
              ? 'Indexing'
              : indexStatus === 'complete'
              ? 'Indexed'
              : indexStatus === 'error'
              ? 'Error'
              : 'Idle'}
          </span>
          <span>{indexPct}%</span>
        </div>
        <div
          style={{
            height: '4px',
            borderRadius: '99px',
            background: 'rgba(148,188,227,.2)',
            overflow: 'hidden'
          }}
        >
          <div
            data-idxbar="1"
            style={{
              height: '100%',
              width: `${indexPct}%`,
              borderRadius: '99px',
              background: 'linear-gradient(90deg, #5980a6, #b5d9fd)',
              transition: 'width 0.4s ease'
            }}
          />
        </div>
        <div
          style={{
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: '9.5px',
            color: 'rgba(233,237,242,.55)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
          title={indexFile}
        >
          {indexFile}
        </div>
      </div>

      {/* Scrollable Navigation / Pools */}
      <div data-scroll="1" style={{ flex: 1, overflowY: 'auto', padding: '2px 12px 12px' }}>
        <div
          data-intro="1"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 8px 8px',
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: '9.5px',
            letterSpacing: '.14em',
            color: 'rgba(233,237,242,.45)',
            textTransform: 'uppercase'
          }}
        >
          <span>Pools</span>
          <span>{selectedPool ? 'filtered' : 'all'}</span>
        </div>

        {/* Everything Button */}
        <button
          data-intro="1"
          onClick={() => onSelectPool(null)}
          style={{
            width: '100%',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            padding: '9px 10px',
            marginBottom: '4px',
            border: 0,
            borderRadius: '11px',
            cursor: 'pointer',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '15px',
            fontWeight: 600,
            letterSpacing: '.03em',
            textTransform: 'uppercase',
            color: '#e9edf2',
            background: selectedPool === null ? 'rgba(148,188,227,.22)' : 'transparent',
            transition: 'background 0.18s'
          }}
          onMouseEnter={(e) => {
            if (selectedPool !== null) e.currentTarget.style.background = 'rgba(148,188,227,.16)';
          }}
          onMouseLeave={(e) => {
            if (selectedPool !== null) e.currentTarget.style.background = 'transparent';
          }}
        >
          <span style={{ flex: 1 }}>Everything</span>
          <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '10px', color: '#94bce3' }}>
            {totalCount}
          </span>
        </button>

        {/* Pool Rows */}
        {pools.map((p) => {
          const isSelected = selectedPool === p;
          const isFanOpen = fanPool === p;
          const count = poolCounts[p] || 0;

          return (
            <div key={p} data-pool={p} style={{ marginBottom: '3px' }}>
              <button
                onClick={() => onSelectPool(isSelected ? null : p)}
                onMouseEnter={(e) => {
                  onHoverPool(p);
                  if (!isSelected) e.currentTarget.style.background = 'rgba(148,188,227,.14)';
                }}
                onMouseLeave={(e) => {
                  onHoverPool(null);
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '9px',
                  padding: '8px 10px',
                  border: 0,
                  borderRadius: '11px',
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(148,188,227,.22)' : 'transparent',
                  color: '#e9edf2',
                  transition: 'background 0.18s'
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '3px',
                    background: '#94bce3',
                    flex: 'none',
                    opacity: 0.75
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: '15px',
                    fontWeight: 600,
                    letterSpacing: '.03em',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {p}
                </span>
                <span
                  style={{
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontSize: '10px',
                    color: 'rgba(233,237,242,.5)'
                  }}
                >
                  {count}
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFan(p);
                  }}
                  title="Fan preview"
                  style={{
                    width: '20px',
                    height: '20px',
                    flex: 'none',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontSize: '11px',
                    color: '#b5d9fd',
                    background: 'rgba(148,188,227,.14)',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(148,188,227,.32)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(148,188,227,.14)';
                  }}
                >
                  {isFanOpen ? '–' : '⊞'}
                </span>
              </button>

              {/* Fan Mini Cards Preview */}
              <div
                data-fanwrap={p}
                style={{
                  height: isFanOpen ? '72px' : '0px',
                  overflow: 'hidden',
                  opacity: isFanOpen ? 1 : 0,
                  transition: 'height 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s'
                }}
              >
                <div style={{ display: 'flex', padding: '10px 14px 14px', alignItems: 'flex-end' }}>
                  {[0, 1, 2, 3, 4].map((i) => {
                    const offset = i - 2;
                    const rotate = isFanOpen ? offset * 13 : 0;
                    const transY = isFanOpen ? -Math.abs(offset) * 5 : 0;
                    const transX = isFanOpen ? offset * 7 : 0;
                    return (
                      <div
                        key={i}
                        data-mini="1"
                        style={{
                          width: '38px',
                          height: '48px',
                          marginLeft: i === 0 ? 0 : '-10px',
                          flex: 'none',
                          borderRadius: '7px',
                          border: '1px solid rgba(181,217,253,.4)',
                          background:
                            'repeating-linear-gradient(135deg, rgba(148,188,227,.5) 0 3px, rgba(29,45,61,.1) 3px 7px)',
                          boxShadow: '0 3px 10px rgba(0,0,0,.3)',
                          transformOrigin: '50% 100%',
                          transform: `translate(${transX}px, ${transY}px) rotate(${rotate}deg)`,
                          transition: `transform 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275) ${i * 0.03}s`
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {/* Watched Folders Section */}
        <div
          data-intro="1"
          style={{
            padding: '18px 8px 8px',
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: '9.5px',
            letterSpacing: '.14em',
            color: 'rgba(233,237,242,.45)',
            textTransform: 'uppercase'
          }}
        >
          Watched folders
        </div>

        {folders.map((f) => (
          <div
            key={f.id}
            data-intro="1"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 10px',
              borderRadius: '10px',
              background: 'rgba(148,188,227,.06)',
              marginBottom: '4px'
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '99px',
                background: '#94bce3',
                flex: 'none',
                animation: 'idxpulse 2.4s ease-in-out infinite'
              }}
            />
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '10px',
                color: 'rgba(233,237,242,.72)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
              title={f.path}
            >
              {f.path}
            </span>
            <span
              style={{
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '9.5px',
                color: '#94bce3'
              }}
            >
              {f.count}
            </span>
            {onRemoveFolder && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFolder(f.id);
                }}
                title="Remove folder"
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: '11px',
                  color: 'rgba(233,237,242,.4)',
                  cursor: 'pointer',
                  padding: '2px 4px'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ff5566')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(233,237,242,.4)')}
              >
                ✕
              </span>
            )}
          </div>
        ))}

        <button
          data-intro="1"
          onClick={onOpenModal}
          style={{
            width: '100%',
            marginTop: '6px',
            padding: '9px',
            borderRadius: '10px',
            cursor: 'pointer',
            border: '1px dashed rgba(181,217,253,.4)',
            background: 'transparent',
            color: '#b5d9fd',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '14px',
            fontWeight: 600,
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            transition: 'background 0.2s, border-color 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(148,188,227,.14)';
            e.currentTarget.style.borderColor = '#94bce3';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'rgba(181,217,253,.4)';
          }}
        >
          + Add folder / drop zip
        </button>

        {/* SQLite Database Card */}
        <div
          data-intro="1"
          style={{
            marginTop: '12px',
            padding: '10px 12px',
            borderRadius: '12px',
            background: 'rgba(148,188,227,.07)',
            border: '1px solid rgba(148,188,227,.18)',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '9.5px',
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                color: '#94bce3',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#38ef7d',
                  display: 'inline-block',
                  boxShadow: '0 0 6px rgba(56,239,125,.7)'
                }}
              />
              SQLite WAL Active
            </span>
            <span
              style={{
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '9px',
                color: '#b5d9fd'
              }}
            >
              {dbSize || 'archive.db'}
            </span>
          </div>

          <div
            style={{
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '10px',
              color: 'rgba(233,237,242,.75)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
            title={dbPath || 'D:\\Archive\\archive.db'}
          >
            {dbPath ? dbPath.replace(/^.*[\\/]/, '') : 'archive.db'} · FTS5 Search
          </div>

          <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                style={{
                  padding: '5px 7px',
                  borderRadius: '7px',
                  border: '1px solid rgba(148,188,227,.2)',
                  background: 'rgba(148,188,227,.1)',
                  color: '#b5d9fd',
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: '9.5px',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  transition: 'background 0.2s'
                }}
                title="Open Settings & Database Backups"
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(148,188,227,.2)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(148,188,227,.1)')}
              >
                Backups
              </button>
            )}
            {onOptimizeDb && (
              <button
                onClick={onOptimizeDb}
                style={{
                  flex: 1,
                  padding: '5px 7px',
                  borderRadius: '7px',
                  border: '1px solid rgba(148,188,227,.2)',
                  background: 'rgba(148,188,227,.1)',
                  color: '#b5d9fd',
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: '9.5px',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  transition: 'background 0.2s'
                }}
                title="Runs SQLite VACUUM and PRAGMA optimize"
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(148,188,227,.2)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(148,188,227,.1)')}
              >
                Optimize
              </button>
            )}

            {onClearAll && (
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to clear all assets from SQLite archive.db?')) {
                    onClearAll();
                  }
                }}
                style={{
                  padding: '5px 8px',
                  borderRadius: '7px',
                  border: '1px solid rgba(255,100,100,.3)',
                  background: 'rgba(255,80,80,.1)',
                  color: '#ff8899',
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: '9.5px',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  transition: 'background 0.2s'
                }}
                title="Clears all assets from archive.db"
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,80,80,.2)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,80,80,.1)')}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};

