import React, { useLayoutEffect, useRef } from 'react';
import { WatchedFolder, Pool, AssetEntry, ThemeMode } from '../types';
import { isZipArchive } from '../services/zipService';

interface RailProps {
  theme?: ThemeMode;
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
  selectedFolder?: WatchedFolder | null;
  onSelectFolder?: (folder: WatchedFolder | null) => void;
  onToggleFolderEnabled?: (id: string, enabled: boolean) => void;
  folderCounts?: Record<string, number>;
  indexPct: number;
  indexFile: string;
  indexStatus?: 'idle' | 'scanning' | 'indexing' | 'complete' | 'error';
  dbSize?: string;
  dbPath?: string;
  onOptimizeDb?: () => void;
  onClearAll?: () => void;
  onOpenSettings?: () => void;
  pools?: Pool[];
  entries?: AssetEntry[];
  viewedHistory?: string[];
  onSelectEntry?: (id: string) => void;
  onOpenZipContents?: (entry: AssetEntry) => void;
}

export const Rail: React.FC<RailProps> = ({
  theme,
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
  selectedFolder = null,
  onSelectFolder,
  onToggleFolderEnabled,
  folderCounts,
  indexPct,
  indexFile,
  indexStatus = 'idle',
  dbSize,
  dbPath,
  onOptimizeDb,
  onClearAll,
  onOpenSettings,
  pools = [],
  entries = [],
  viewedHistory = [],
  onSelectEntry,
  onOpenZipContents
}) => {
  const poolList = pools.length > 0
    ? pools
    : [
        { id: 'p1', name: 'Effects', color: '#94bce3' },
        { id: 'p2', name: 'Buttons', color: '#60a5fa' },
        { id: 'p3', name: 'Loaders', color: '#38bdf8' },
        { id: 'p4', name: 'Backgrounds', color: '#a78bfa' },
        { id: 'p5', name: 'Transitions', color: '#c084fc' },
        { id: 'p6', name: 'Typography', color: '#f472b6' },
        { id: 'p7', name: 'Layouts', color: '#fb7185' },
        { id: 'p8', name: 'Scroll', color: '#fb923c' },
        { id: 'p9', name: 'Physics', color: '#facc15' },
        { id: 'p10', name: 'Shaders', color: '#4ade80' },
        { id: 'p11', name: 'Routines/utils', color: '#2dd4bf' },
        { id: 'p12', name: 'Experiments', color: '#e879f9' }
      ];

  const brandContainerRef = useRef<HTMLDivElement>(null);
  const brandTextRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = brandContainerRef.current;
    const text = brandTextRef.current;
    if (!container || !text) return;

    const fit = () => {
      if (!container || !text) return;
      const containerWidth = container.clientWidth;
      if (containerWidth <= 0) return;

      const currentSize = parseFloat(window.getComputedStyle(text).fontSize) || 48;
      const currentWidth = text.getBoundingClientRect().width;
      if (currentWidth > 0) {
        let targetSize = (containerWidth / currentWidth) * currentSize;
        text.style.fontSize = `${targetSize}px`;

        // Secondary check to guarantee no subpixel overflow
        const adjustedWidth = text.getBoundingClientRect().width;
        if (adjustedWidth > containerWidth && adjustedWidth > 0) {
          targetSize = (containerWidth / adjustedWidth) * targetSize;
          text.style.fontSize = `${targetSize}px`;
        }
      }
    };

    fit();

    if (document.fonts?.ready) {
      document.fonts.ready.then(fit);
    }

    const ro = new ResizeObserver(() => fit());
    ro.observe(container);

    window.addEventListener('resize', fit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, []);

  const isLight = theme === 'light';
  const isBlack = theme === 'black';

  return (
    <aside
      data-rail="1"
      style={{
        position: 'relative',
        zIndex: 30,
        background: 'var(--rail, #1d2d3d)',
        color: 'var(--rail-ink, var(--ink, #1d1f20))',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRight: '1px solid var(--rail-border, rgba(148,188,227,.18))',
        boxShadow: isLight ? '4px 0 24px rgba(15,23,42,.03)' : '14px 0 40px rgba(29,45,61,.28)',
        height: '100%',
        userSelect: 'none'
      }}
    >
      {/* Brand Header */}
      <div style={{ padding: '22px 20px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div
          ref={brandContainerRef}
          style={{
            width: '100%',
            overflow: 'hidden',
            lineHeight: 1
          }}
        >
          <div
            ref={brandTextRef}
            data-intro="1"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700,
              fontSize: '48px',
              letterSpacing: '0.01em',
              lineHeight: 0.9,
              textTransform: 'uppercase',
              display: 'inline-block',
              whiteSpace: 'nowrap',
              width: 'fit-content'
            }}
          >
            ARCHIVE
          </div>
        </div>
        <div
          data-intro="1"
          style={{
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: '10px',
            letterSpacing: '.14em',
            color: isLight ? 'var(--tint-ink, #1d4ed8)' : '#94bce3',
            textTransform: 'uppercase'
          }}
        >
          index · {totalCount.toLocaleString()} assets · {poolList.length} pools
        </div>
      </div>

      {/* Indexing status card */}
      <div
        data-intro="1"
        style={{
          margin: '0 16px 14px',
          padding: '10px 12px',
          borderRadius: '12px',
          background: isLight ? 'rgba(15,23,42,.04)' : 'rgba(148,188,227,.1)',
          border: isLight ? '1px solid rgba(15,23,42,.08)' : '1px solid rgba(148,188,227,.22)',
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
            color: isBlack ? '#ffffff' : (isLight ? 'var(--tint-ink, #1d4ed8)' : '#b5d9fd'),
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
            background: isBlack ? 'rgba(255, 255, 255, 0.12)' : (isLight ? 'rgba(15,23,42,.08)' : 'rgba(148,188,227,.2)'),
            overflow: 'hidden'
          }}
        >
          <div
            data-idxbar="1"
            style={{
              height: '100%',
              width: `${indexPct}%`,
              borderRadius: '99px',
              background: isBlack ? 'linear-gradient(90deg, #555555, #ffffff)' : (isLight ? 'linear-gradient(90deg, #3b82f6, #60a5fa)' : 'linear-gradient(90deg, #5980a6, #b5d9fd)'),
              transition: 'width 0.4s ease'
            }}
          />
        </div>
        <div
          style={{
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: '9.5px',
            color: isLight ? 'rgba(15,23,42,.55)' : 'rgba(233,237,242,.55)',
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
            color: isLight ? 'rgba(15,23,42,.45)' : 'rgba(233,237,242,.45)',
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
            color: 'var(--rail-ink, var(--ink, #1d1f20))',
            background: selectedPool === null
              ? (isLight ? 'rgba(15,23,42,.08)' : 'rgba(148,188,227,.22)')
              : 'transparent',
            transition: 'background 0.18s'
          }}
          onMouseEnter={(e) => {
            if (selectedPool !== null) e.currentTarget.style.background = isLight ? 'rgba(15,23,42,.05)' : 'rgba(148,188,227,.16)';
          }}
          onMouseLeave={(e) => {
            if (selectedPool !== null) e.currentTarget.style.background = 'transparent';
          }}
        >
          <span style={{ flex: 1 }}>Everything</span>
          <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '10px', color: isLight ? 'var(--tint-ink, #1d4ed8)' : '#94bce3' }}>
            {totalCount}
          </span>
        </button>

        {/* Pool Rows */}
        {poolList.map((poolItem) => {
          const p = poolItem.name;
          const dotColor = isBlack ? '#ffffff' : (poolItem.color || '#94bce3');
          const isSelected = selectedPool === p;
          const isFanOpen = fanPool === p;
          const count = poolCounts[p] || 0;

          // Obtain last 5 items viewed in this pool (falling back to recent pool items if fewer than 5 viewed)
          const poolItems: AssetEntry[] = (() => {
            if (!entries || entries.length === 0) return [];
            const viewedInPool: AssetEntry[] = [];
            const seen = new Set<string>();

            // 1. Pick items from viewedHistory belonging to this pool (most recently viewed first)
            if (viewedHistory && viewedHistory.length > 0) {
              for (const id of viewedHistory) {
                const entry = entries.find((e) => e.id === id && e.cat === p);
                if (entry && !seen.has(entry.id)) {
                  seen.add(entry.id);
                  viewedInPool.push(entry);
                  if (viewedInPool.length >= 5) break;
                }
              }
            }

            // 2. If fewer than 5 viewed, fill with latest pool entries so fan always has up to 5 items if available
            if (viewedInPool.length < 5) {
              const poolAll = entries.filter((e) => e.cat === p && !seen.has(e.id));
              for (const entry of poolAll) {
                viewedInPool.push(entry);
                if (viewedInPool.length >= 5) break;
              }
            }

            return viewedInPool;
          })();

          return (
            <div key={poolItem.id || p} data-pool={p} style={{ marginBottom: '3px' }}>
              <button
                onClick={() => onSelectPool(isSelected ? null : p)}
                onMouseEnter={(e) => {
                  onHoverPool(p);
                  if (!isSelected) e.currentTarget.style.background = isBlack ? 'rgba(255, 255, 255, 0.08)' : (isLight ? 'rgba(15,23,42,.05)' : 'rgba(148,188,227,.14)');
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
                  background: isSelected
                    ? (isBlack ? 'rgba(255, 255, 255, 0.16)' : (isLight ? 'rgba(15,23,42,.08)' : 'rgba(148,188,227,.22)'))
                    : 'transparent',
                  color: 'var(--rail-ink, var(--ink, #1d1f20))',
                  transition: 'background 0.18s'
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '3px',
                    background: dotColor,
                    flex: 'none',
                    opacity: 0.85,
                    boxShadow: isBlack ? '0 0 4px rgba(255,255,255,0.4)' : `0 0 6px ${dotColor}`
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
                    color: isBlack ? 'rgba(255, 255, 255, 0.5)' : (isLight ? 'rgba(15,23,42,.5)' : 'rgba(233,237,242,.5)')
                  }}
                >
                  {count}
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFan(p);
                  }}
                  title="Fan preview: last viewed in pool"
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
                    color: isBlack ? '#ffffff' : (isLight ? 'var(--tint-ink, #1d4ed8)' : '#b5d9fd'),
                    background: isBlack ? 'rgba(255, 255, 255, 0.12)' : (isLight ? 'rgba(15,23,42,.06)' : 'rgba(148,188,227,.14)'),
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isBlack ? 'rgba(255, 255, 255, 0.22)' : (isLight ? 'rgba(15,23,42,.12)' : 'rgba(148,188,227,.32)');
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isBlack ? 'rgba(255, 255, 255, 0.12)' : (isLight ? 'rgba(15,23,42,.06)' : 'rgba(148,188,227,.14)');
                  }}
                >
                  {isFanOpen ? '–' : '⊞'}
                </span>
              </button>

              {/* Fan Mini Cards Preview */}
              <div
                data-fanwrap={p}
                style={{
                  height: isFanOpen ? '92px' : '0px',
                  overflow: isFanOpen ? 'visible' : 'hidden',
                  opacity: isFanOpen ? 1 : 0,
                  transition: 'height 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s'
                }}
              >
                {/* Micro Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 14px 2px',
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontSize: '8.5px',
                    letterSpacing: '.08em',
                    textTransform: 'uppercase',
                    color: isLight ? 'rgba(15,23,42,.5)' : 'rgba(148,188,227,.6)'
                  }}
                >
                  <span>Last Viewed</span>
                  <span>{poolItems.length} cards</span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    padding: '6px 22px 14px',
                    alignItems: 'flex-end',
                    position: 'relative'
                  }}
                >
                  {poolItems.length === 0 ? (
                    <div
                      style={{
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        fontSize: '9.5px',
                        color: 'rgba(233,237,242,.4)',
                        fontStyle: 'italic',
                        padding: '6px 0'
                      }}
                    >
                      No items in this pool
                    </div>
                  ) : (
                    poolItems.map((item, i) => {
                      const n = poolItems.length;
                      const offset = i - (n - 1) / 2;
                      const rotate = isFanOpen ? offset * 13 : 0;
                      const transY = isFanOpen ? -Math.abs(offset) * 5 : 0;
                      const transX = isFanOpen ? offset * 8 : 0;
                      const hasThumb = !!item.thumb;
                      const isZip = isZipArchive(item) && !item.isZipInnerFile;
                      const isVideo =
                        !isZip && (
                          item.type === 'video' ||
                          (item.exts && ['mp4', 'webm', 'mov', 'm4v'].some((x) => item.exts.includes(x)))
                        );

                      return (
                        <div
                          key={item.id}
                          data-mini="1"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            if (isZip && onOpenZipContents) {
                              onOpenZipContents(item);
                            } else if (onSelectEntry) {
                              onSelectEntry(item.id);
                            }
                          }}
                          title={
                            isZip
                              ? `${item.title} (ZIP Archive) — Click to view contents`
                              : `${item.title} (${item.type.toUpperCase()}) — Click to preview`
                          }
                          style={{
                            width: '42px',
                            height: '56px',
                            marginLeft: i === 0 ? 0 : '-12px',
                            flex: 'none',
                            borderRadius: '8px',
                            border: isZip ? '1.5px solid rgba(250,204,21,.55)' : '1.5px solid rgba(181,217,253,.35)',
                            background: hasThumb
                              ? `url(${item.thumb}) center/cover no-repeat`
                              : 'repeating-linear-gradient(135deg, rgba(148,188,227,.5) 0 3px, rgba(29,45,61,.1) 3px 7px)',
                            boxShadow: '0 4px 12px rgba(0,0,0,.45)',
                            transformOrigin: '50% 100%',
                            transform: `translate(${transX}px, ${transY}px) rotate(${rotate}deg)`,
                            transition: `transform 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275) ${i * 0.03}s, box-shadow 0.2s, border-color 0.2s`,
                            cursor: 'pointer',
                            position: 'relative',
                            overflow: 'hidden',
                            zIndex: isFanOpen ? n - i : 1
                          }}
                          onMouseEnter={(ev) => {
                            ev.currentTarget.style.zIndex = '50';
                            ev.currentTarget.style.borderColor = isZip ? '#facc15' : '#38ef7d';
                            ev.currentTarget.style.boxShadow = isZip
                              ? '0 8px 24px rgba(250,204,21,.45)'
                              : '0 8px 24px rgba(56,239,125,.35)';
                            ev.currentTarget.style.transform = `translate(${transX}px, ${transY - 8}px) scale(1.18) rotate(${rotate}deg)`;
                          }}
                          onMouseLeave={(ev) => {
                            ev.currentTarget.style.zIndex = String(isFanOpen ? n - i : 1);
                            ev.currentTarget.style.borderColor = isZip ? 'rgba(250,204,21,.55)' : 'rgba(181,217,253,.35)';
                            ev.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.45)';
                            ev.currentTarget.style.transform = `translate(${transX}px, ${transY}px) rotate(${rotate}deg)`;
                          }}
                        >
                          {/* Mini ZIP indicator badge */}
                          {isZip && (
                            <span
                              style={{
                                position: 'absolute',
                                bottom: '2px',
                                right: '2px',
                                padding: '1px 3px',
                                borderRadius: '3px',
                                background: 'rgba(0,0,0,0.85)',
                                color: '#facc15',
                                fontSize: '6.5px',
                                fontWeight: 700,
                                fontFamily: 'ui-monospace, monospace',
                                letterSpacing: '.06em',
                                lineHeight: '8px'
                              }}
                            >
                              ZIP
                            </span>
                          )}

                          {/* Mini Video / Format indicator */}
                          {isVideo && (
                            <span
                              style={{
                                position: 'absolute',
                                bottom: '2px',
                                right: '2px',
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                background: 'rgba(0,0,0,0.7)',
                                color: '#ffffff',
                                fontSize: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                paddingLeft: '1px'
                              }}
                            >
                              ▶
                            </span>
                          )}
                          {!hasThumb && (
                            <span
                              style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontFamily: 'ui-monospace, monospace',
                                fontSize: '8px',
                                fontWeight: 700,
                                color: isZip ? '#facc15' : '#b5d9fd',
                                textTransform: 'uppercase',
                                background: 'rgba(15,23,42,0.6)'
                              }}
                            >
                              {isZip ? 'ZIP' : item.exts?.[0] || item.type.slice(0, 3)}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Watched Folders Section */}
        <div
          data-intro="1"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 8px 8px',
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: '9.5px',
            letterSpacing: '.14em',
            color: isLight ? 'rgba(15,23,42,.45)' : 'rgba(233,237,242,.45)',
            textTransform: 'uppercase'
          }}
        >
          <span>Watched folders ({folders.length})</span>
          {selectedFolder && onSelectFolder && (
            <button
              onClick={() => onSelectFolder(null)}
              style={{
                background: 'transparent',
                border: 0,
                color: isLight ? 'var(--tint-ink, #1d4ed8)' : '#b5d9fd',
                fontSize: '9.5px',
                cursor: 'pointer',
                padding: '0',
                textTransform: 'uppercase',
                textDecoration: 'underline'
              }}
              title="Clear folder filter"
            >
              Clear ✕
            </button>
          )}
        </div>

        {folders.map((f) => {
          const isSelected = selectedFolder?.id === f.id;
          const isEnabled = f.enabled !== false;
          const isIngesting = !!f.isIngesting;
          const folderCount = folderCounts?.[f.id] ?? f.count;

          return (
            <div
              key={f.id}
              data-intro="1"
              data-folder={f.id}
              onClick={() => {
                if (isIngesting) return;
                if (onSelectFolder) {
                  onSelectFolder(isSelected ? null : f);
                }
              }}
              title={
                isIngesting
                  ? `Ingesting ${f.path}… Assets will appear once complete.`
                  : isEnabled
                  ? `Filter by ${f.path} (Click to toggle filter)`
                  : `${f.path} is disabled (assets hidden)`
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 10px',
                borderRadius: '10px',
                background: isSelected
                  ? (isLight ? 'rgba(15,23,42,.08)' : 'rgba(148,188,227,.24)')
                  : isIngesting
                  ? 'rgba(250,204,21,.1)'
                  : isEnabled
                  ? (isLight ? 'rgba(15,23,42,.03)' : 'rgba(148,188,227,.06)')
                  : 'transparent',
                border: isSelected
                  ? (isLight ? '1px solid rgba(15,23,42,.16)' : '1px solid rgba(148,188,227,.4)')
                  : isIngesting
                  ? '1px dashed rgba(250,204,21,.4)'
                  : '1px solid transparent',
                marginBottom: '4px',
                cursor: isIngesting ? 'wait' : 'pointer',
                opacity: isIngesting ? 0.6 : isEnabled ? 1 : 0.45,
                animation: isIngesting ? 'idxpulse 1.6s ease-in-out infinite' : 'none',
                pointerEvents: isIngesting ? 'none' : 'auto',
                transition: 'background 0.18s, border-color 0.18s, opacity 0.18s'
              }}
              onMouseEnter={(e) => {
                if (!isSelected && !isIngesting) e.currentTarget.style.background = isLight ? 'rgba(15,23,42,.06)' : 'rgba(148,188,227,.12)';
              }}
              onMouseLeave={(e) => {
                if (!isSelected && !isIngesting) {
                  e.currentTarget.style.background = isEnabled ? (isLight ? 'rgba(15,23,42,.03)' : 'rgba(148,188,227,.06)') : 'transparent';
                }
              }}
            >
              {/* Enable / Disable toggle dot */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isIngesting && onToggleFolderEnabled) {
                    onToggleFolderEnabled(f.id, !isEnabled);
                  }
                }}
                disabled={isIngesting}
                title={
                  isIngesting
                    ? 'Indexing in progress'
                    : isEnabled
                    ? 'Active: Click to disable folder'
                    : 'Disabled: Click to enable folder'
                }
                style={{
                  background: 'transparent',
                  border: 0,
                  padding: '2px',
                  cursor: isIngesting ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: isBlack ? (isEnabled ? '#ffffff' : '#6b7280') : (isIngesting ? '#facc15' : isEnabled ? '#22c55e' : '#6b7280'),
                    boxShadow: isBlack
                      ? (isEnabled ? '0 0 6px rgba(255,255,255,.7)' : 'none')
                      : (isIngesting
                      ? '0 0 8px rgba(250,204,21,.8)'
                      : isEnabled
                      ? '0 0 6px rgba(34,197,94,.7)'
                      : 'none'),
                    animation: isIngesting
                      ? 'idxpulse 0.9s ease-in-out infinite'
                      : isEnabled
                      ? 'idxpulse 2.4s ease-in-out infinite'
                      : 'none',
                    transition: 'background 0.2s, box-shadow 0.2s'
                  }}
                />
              </button>

              {/* Folder name / path */}
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: '10px',
                  color: isSelected
                    ? 'var(--ink)'
                    : isIngesting
                    ? '#ca8a04'
                    : isEnabled
                    ? (isLight ? 'rgba(15,23,42,.85)' : 'rgba(233,237,242,.85)')
                    : (isLight ? 'rgba(15,23,42,.4)' : 'rgba(233,237,242,.4)'),
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textDecoration: isEnabled || isIngesting ? 'none' : 'line-through'
                }}
              >
                {f.path}
              </span>

              {/* Item count or INGESTING / OFF badge */}
              {isIngesting ? (
                <span
                  style={{
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontSize: '8px',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: isBlack ? 'rgba(255, 255, 255, 0.15)' : 'rgba(250,204,21,.18)',
                    color: isBlack ? '#ffffff' : '#facc15',
                    border: isBlack ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(250,204,21,.35)',
                    letterSpacing: '.06em',
                    fontWeight: 700,
                    textTransform: 'uppercase'
                  }}
                >
                  INGESTING…
                </span>
              ) : !isEnabled ? (
                <span
                  style={{
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontSize: '8.5px',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: isLight ? 'rgba(15,23,42,.06)' : 'rgba(255,255,255,.08)',
                    color: isLight ? 'rgba(15,23,42,.45)' : 'rgba(233,237,242,.45)',
                    letterSpacing: '.05em'
                  }}
                >
                  OFF
                </span>
              ) : (
                <span
                  style={{
                    fontFamily: 'ui-monospace, Menlo, monospace',
                    fontSize: '9.5px',
                    color: isSelected
                      ? (isBlack ? '#ffffff' : (isLight ? 'var(--tint-ink, #1d4ed8)' : '#b5d9fd'))
                      : (isBlack ? 'rgba(255, 255, 255, 0.7)' : (isLight ? 'rgba(15,23,42,.6)' : '#94bce3'))
                  }}
                >
                  {folderCount}
                </span>
              )}

              {/* Quick toggle switch */}
              {onToggleFolderEnabled && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFolderEnabled(f.id, !isEnabled);
                  }}
                  title={isEnabled ? 'Click to disable folder' : 'Click to enable folder'}
                  style={{
                    width: '24px',
                    height: '13px',
                    borderRadius: '10px',
                    background: isBlack ? (isEnabled ? '#ffffff' : 'rgba(255,255,255,.18)') : (isEnabled ? '#22c55e' : (isLight ? 'rgba(15,23,42,.15)' : 'rgba(255,255,255,.18)')),
                    display: 'flex',
                    alignItems: 'center',
                    padding: '1px 2px',
                    justifyContent: isEnabled ? 'flex-end' : 'flex-start',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                >
                  <span
                    style={{
                      width: '9px',
                      height: '9px',
                      borderRadius: '50%',
                      background: isBlack && isEnabled ? '#000000' : '#ffffff',
                      boxShadow: '0 1px 2px rgba(0,0,0,.3)'
                    }}
                  />
                </span>
              )}

              {/* Remove button */}
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
                    color: isLight ? 'rgba(15,23,42,.35)' : 'rgba(233,237,242,.4)',
                    cursor: 'pointer',
                    padding: '2px 4px'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ff5566')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = isLight ? 'rgba(15,23,42,.35)' : 'rgba(233,237,242,.4)')}
                >
                  ✕
                </span>
              )}
            </div>
          );
        })}

        <button
          data-intro="1"
          onClick={onOpenModal}
          style={{
            width: '100%',
            marginTop: '6px',
            padding: '9px',
            borderRadius: '10px',
            cursor: 'pointer',
            border: isLight ? '1px dashed rgba(15,23,42,.2)' : '1px dashed rgba(181,217,253,.4)',
            background: 'transparent',
            color: isLight ? 'var(--tint-ink, #1d4ed8)' : '#b5d9fd',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '14px',
            fontWeight: 600,
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            transition: 'background 0.2s, border-color 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = isLight ? 'rgba(15,23,42,.04)' : 'rgba(148,188,227,.14)';
            e.currentTarget.style.borderColor = isLight ? 'var(--tint-ink, #1d4ed8)' : '#94bce3';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = isLight ? '1px dashed rgba(15,23,42,.2)' : 'rgba(181,217,253,.4)';
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
            background: isBlack ? 'rgba(255, 255, 255, 0.05)' : (isLight ? 'rgba(15,23,42,.03)' : 'rgba(148,188,227,.07)'),
            border: isBlack ? '1px solid rgba(255, 255, 255, 0.15)' : (isLight ? '1px solid rgba(15,23,42,.08)' : '1px solid rgba(148,188,227,.18)'),
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
                color: isBlack ? '#ffffff' : (isLight ? 'var(--tint-ink, #1d4ed8)' : '#94bce3'),
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
                  background: isBlack ? '#ffffff' : '#22c55e',
                  display: 'inline-block',
                  boxShadow: isBlack ? '0 0 6px rgba(255,255,255,.7)' : '0 0 6px rgba(34,197,94,.7)'
                }}
              />
              SQLite WAL Active
            </span>
            <span
              style={{
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '9px',
                color: isBlack ? '#ffffff' : (isLight ? 'var(--ink, #0f172a)' : '#b5d9fd')
              }}
            >
              {dbSize || 'archive.db'}
            </span>
          </div>

          <div
            style={{
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '10px',
              color: isLight ? 'rgba(15,23,42,.7)' : 'rgba(233,237,242,.75)',
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
                  border: isBlack ? '1px solid rgba(255, 255, 255, 0.2)' : (isLight ? '1px solid rgba(15,23,42,.12)' : '1px solid rgba(148,188,227,.2)'),
                  background: isBlack ? 'rgba(255, 255, 255, 0.08)' : (isLight ? 'rgba(15,23,42,.04)' : 'rgba(148,188,227,.1)'),
                  color: isBlack ? '#ffffff' : (isLight ? 'var(--tint-ink, #1d4ed8)' : '#b5d9fd'),
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: '9.5px',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  transition: 'background 0.2s'
                }}
                title="Open Settings & Database Backups"
                onMouseEnter={(e) => (e.currentTarget.style.background = isBlack ? 'rgba(255, 255, 255, 0.16)' : (isLight ? 'rgba(15,23,42,.08)' : 'rgba(148,188,227,.2)'))}
                onMouseLeave={(e) => (e.currentTarget.style.background = isBlack ? 'rgba(255, 255, 255, 0.08)' : (isLight ? 'rgba(15,23,42,.04)' : 'rgba(148,188,227,.1)'))}
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
                  border: isBlack ? '1px solid rgba(255, 255, 255, 0.2)' : (isLight ? '1px solid rgba(15,23,42,.12)' : '1px solid rgba(148,188,227,.2)'),
                  background: isBlack ? 'rgba(255, 255, 255, 0.08)' : (isLight ? 'rgba(15,23,42,.04)' : 'rgba(148,188,227,.1)'),
                  color: isBlack ? '#ffffff' : (isLight ? 'var(--tint-ink, #1d4ed8)' : '#b5d9fd'),
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: '9.5px',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  transition: 'background 0.2s'
                }}
                title="Runs SQLite VACUUM and PRAGMA optimize"
                onMouseEnter={(e) => (e.currentTarget.style.background = isBlack ? 'rgba(255, 255, 255, 0.16)' : (isLight ? 'rgba(15,23,42,.08)' : 'rgba(148,188,227,.2)'))}
                onMouseLeave={(e) => (e.currentTarget.style.background = isBlack ? 'rgba(255, 255, 255, 0.08)' : (isLight ? 'rgba(15,23,42,.04)' : 'rgba(148,188,227,.1)'))}
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
                  border: isBlack ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(255,100,100,.3)',
                  background: isBlack ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255,80,80,.1)',
                  color: isBlack ? '#ffffff' : '#ff8899',
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: '9.5px',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  transition: 'background 0.2s'
                }}
                title="Clears all assets from archive.db"
                onMouseEnter={(e) => { e.currentTarget.style.background = isBlack ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255,80,80,.2)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = isBlack ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255,80,80,.1)'; }}
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

