import React, { useState, useRef, useEffect } from 'react';
import { Density, ViewMode, MaxPerPage, MAX_PER_PAGE_OPTIONS, SortOption, SortDirection } from '../types';
import { SORT_CONFIGS, SORT_OPTIONS } from '../services/sortService';

interface ToolbarProps {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  density: Density;
  onDensityChange: (d: Density) => void;
  focusIndex: number;
  totalVisible: number;
  totalCount?: number;
  onPrev: () => void;
  onNext: () => void;
  accent: string;
  maxPerPage: MaxPerPage;
  onMaxPerPageChange: (m: MaxPerPage) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  sortOption: SortOption;
  sortDirection: SortDirection;
  onSortChange: (option: SortOption, direction?: SortDirection) => void;
  onToggleSortDirection: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  view,
  onViewChange,
  density,
  onDensityChange,
  focusIndex,
  totalVisible,
  totalCount,
  onPrev,
  onNext,
  accent,
  maxPerPage,
  onMaxPerPageChange,
  currentPage,
  totalPages,
  onPageChange,
  sortOption,
  sortDirection,
  onSortChange,
  onToggleSortDirection
}) => {
  const [maxMenuOpen, setMaxMenuOpen] = useState(false);
  const maxMenuRef = useRef<HTMLDivElement>(null);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!maxMenuOpen && !sortMenuOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (maxMenuRef.current && !maxMenuRef.current.contains(e.target as Node)) {
        setMaxMenuOpen(false);
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setSortMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMaxMenuOpen(false);
        setSortMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [maxMenuOpen, sortMenuOpen]);
  const VIEWS: [ViewMode, string, string][] = [
    ['grid', 'Grid', 'Density grid'],
    ['list', 'List', 'Dense table'],
    ['coverflow', 'Coverflow', '3D perspective tilt'],
    ['strip', 'Strip', 'Elastic momentum + snap'],
    ['radial', 'Arc', 'Radial wheel'],
    ['filmstrip', 'Film', 'Vertical scrub'],
    ['peel', 'Peel', 'Stacked cards']
  ];

  const DENSITIES: Density[] = [2, 3, 4, 5, 6, 8];
  const isCarousel = ['coverflow', 'strip', 'radial', 'filmstrip', 'peel'].includes(view);

  return (
    <div
      data-toolbar="1"
      data-intro="1"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '8px',
        padding: '0 26px 14px',
        background: 'var(--bg, #f2f2f3)',
        position: 'relative',
        zIndex: 20
      }}
    >
      {/* 7-way View Switcher */}
      <div
        style={{
          display: 'flex',
          padding: '3px',
          gap: '2px',
          borderRadius: '13px',
          background: 'var(--well, #e3e4e6)',
          border: '1px solid rgba(var(--inkc, 29,31,32), .09)',
          boxShadow: 'inset 0 2px 5px rgba(29,45,61,.09)'
        }}
      >
        {VIEWS.map(([v, label, title]) => {
          const isActive = view === v;
          return (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              title={title}
              style={{
                padding: '7px 13px',
                border: 0,
                borderRadius: '10px',
                cursor: 'pointer',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '13.5px',
                fontWeight: 600,
                letterSpacing: '.05em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                color: isActive ? '#f2f2f3' : 'var(--ink, #1d1f20)',
                background: isActive ? `linear-gradient(180deg, #6b91b6, ${accent})` : 'transparent',
                boxShadow: isActive ? '0 2px 0 #416180, inset 0 1px 0 rgba(255,255,255,.24)' : 'none',
                transition: 'background 0.2s, color 0.2s'
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Density Selector (Grid only) */}
      <div
        data-density="1"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          padding: '3px',
          borderRadius: '13px',
          background: 'var(--well, #e3e4e6)',
          border: '1px solid rgba(var(--inkc, 29,31,32), .09)',
          boxShadow: 'inset 0 2px 5px rgba(29,45,61,.09)',
          opacity: view === 'grid' ? 1 : 0.3,
          pointerEvents: view === 'grid' ? 'auto' : 'none',
          transition: 'opacity 0.3s'
        }}
      >
        <span
          style={{
            padding: '0 8px',
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: '9.5px',
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            color: 'rgba(var(--inkc, 29,31,32), .5)',
            whiteSpace: 'nowrap'
          }}
        >
          Per row
        </span>
        {DENSITIES.map((n) => {
          const isActive = density === n && view === 'grid';
          return (
            <button
              key={n}
              onClick={() => onDensityChange(n)}
              style={{
                width: '28px',
                padding: '7px 0',
                border: 0,
                borderRadius: '9px',
                cursor: 'pointer',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '11px',
                color: isActive ? '#f2f2f3' : 'rgba(var(--inkc, 29,31,32), .6)',
                background: isActive ? accent : 'transparent',
                transition: 'background 0.18s, color 0.18s'
              }}
            >
              {n}
            </button>
          );
        })}
      </div>

      {/* Maximum Per Page Toggle & Popover */}
      <div
        ref={maxMenuRef}
        data-max-per-page="1"
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center'
        }}
      >
        <button
          onClick={() => setMaxMenuOpen((prev) => !prev)}
          title="Change maximum assets per page"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 11px',
            borderRadius: '13px',
            cursor: 'pointer',
            border: maxMenuOpen ? '1px solid #94bce3' : '1px solid rgba(var(--inkc, 29,31,32), .14)',
            background: maxMenuOpen ? 'var(--tint, #eef6ff)' : 'var(--surface, #ffffff)',
            color: 'var(--ink, #1d1f20)',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '13.5px',
            fontWeight: 600,
            letterSpacing: '.05em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            boxShadow: '0 1px 2px rgba(43,43,45,.14)',
            transition: 'background 0.18s, border-color 0.18s, box-shadow 0.18s'
          }}
          onMouseEnter={(e) => {
            if (!maxMenuOpen) {
              e.currentTarget.style.background = 'var(--tint, #eef6ff)';
              e.currentTarget.style.borderColor = '#94bce3';
            }
          }}
          onMouseLeave={(e) => {
            if (!maxMenuOpen) {
              e.currentTarget.style.background = 'var(--surface, #ffffff)';
              e.currentTarget.style.borderColor = 'rgba(var(--inkc, 29,31,32), .14)';
            }
          }}
        >
          <span
            style={{
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '9.5px',
              letterSpacing: '.1em',
              color: 'rgba(var(--inkc, 29,31,32), .55)'
            }}
          >
            Max:
          </span>
          <span
            style={{
              fontWeight: 700,
              fontFamily: maxPerPage === 'ALL' ? "'Barlow Condensed', sans-serif" : 'ui-monospace, Menlo, monospace',
              fontSize: maxPerPage === 'ALL' ? '13px' : '12px',
              color: maxPerPage === 'ALL' ? '#f87171' : 'var(--ink, #1d1f20)'
            }}
          >
            {maxPerPage}
          </span>
          {maxPerPage === 'ALL' && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '1px 5px',
                borderRadius: '4px',
                background: 'rgba(239, 68, 68, 0.16)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '8.5px',
                fontWeight: 700,
                letterSpacing: '.08em',
                lineHeight: 1.2
              }}
            >
              DANGEROUS
            </span>
          )}
          <span
            style={{
              fontSize: '8.5px',
              opacity: 0.55,
              transform: maxMenuOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.18s'
            }}
          >
            ▼
          </span>
        </button>

        {/* Revealed Popover Selection Menu */}
        {maxMenuOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              minWidth: '190px',
              borderRadius: '13px',
              background: 'var(--surface, #1e293b)',
              color: 'var(--ink, #e9edf2)',
              border: '1px solid rgba(148,188,227,.28)',
              boxShadow: '0 14px 34px rgba(0,0,0,.45), 0 3px 8px rgba(0,0,0,.25)',
              padding: '6px',
              zIndex: 60,
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              animation: 'panelBackdropFadeIn 0.15s ease-out'
            }}
          >
            <div
              style={{
                padding: '6px 9px 5px',
                borderBottom: '1px solid rgba(148,188,227,.12)',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '9px',
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                color: '#94bce3',
                marginBottom: '2px'
              }}
            >
              Maximum Per Page
            </div>

            {MAX_PER_PAGE_OPTIONS.map((opt) => {
              const isSelected = maxPerPage === opt;
              const isAll = opt === 'ALL';
              return (
                <button
                  key={String(opt)}
                  onClick={() => {
                    onMaxPerPageChange(opt);
                    setMaxMenuOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 9px',
                    borderRadius: '8px',
                    border: 0,
                    background: isSelected ? 'rgba(148,188,227,.18)' : 'transparent',
                    color: isSelected ? '#ffffff' : 'var(--ink, #e9edf2)',
                    cursor: 'pointer',
                    fontFamily: isAll ? "'Barlow Condensed', sans-serif" : 'ui-monospace, Menlo, monospace',
                    fontSize: isAll ? '13.5px' : '12px',
                    fontWeight: isSelected ? 700 : 500,
                    textAlign: 'left',
                    transition: 'background 0.12s, color 0.12s'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'rgba(148,188,227,.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: isAll ? (isSelected ? '#fca5a5' : '#f87171') : 'inherit' }}>
                      {opt}
                    </span>
                    {isAll ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          background: 'rgba(239, 68, 68, 0.22)',
                          border: '1px solid rgba(239, 68, 68, 0.45)',
                          color: '#f87171',
                          fontFamily: 'ui-monospace, Menlo, monospace',
                          fontSize: '8.5px',
                          fontWeight: 700,
                          letterSpacing: '.08em',
                          textTransform: 'uppercase',
                          lineHeight: 1.2
                        }}
                      >
                        DANGEROUS
                      </span>
                    ) : (
                      <span style={{ fontSize: '9.5px', color: 'rgba(var(--inkc, 233,237,242), .45)' }}>
                        assets
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <span style={{ color: '#94bce3', fontSize: '12px', fontWeight: 700 }}>
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Sort Selector Popover & Direction Toggle */}
      <div
        ref={sortMenuRef}
        data-sort-selector="1"
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px'
        }}
      >
        <button
          onClick={() => setSortMenuOpen((prev) => !prev)}
          title={`Sort assets by: ${SORT_CONFIGS[sortOption]?.label || sortOption} (${sortDirection === 'asc' ? 'Ascending' : 'Descending'})`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 11px',
            borderRadius: '13px',
            cursor: 'pointer',
            border: sortMenuOpen ? '1px solid #94bce3' : '1px solid rgba(var(--inkc, 29,31,32), .14)',
            background: sortMenuOpen ? 'var(--tint, #eef6ff)' : 'var(--surface, #ffffff)',
            color: 'var(--ink, #1d1f20)',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '13.5px',
            fontWeight: 600,
            letterSpacing: '.05em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            boxShadow: '0 1px 2px rgba(43,43,45,.14)',
            transition: 'background 0.18s, border-color 0.18s, box-shadow 0.18s'
          }}
          onMouseEnter={(e) => {
            if (!sortMenuOpen) {
              e.currentTarget.style.background = 'var(--tint, #eef6ff)';
              e.currentTarget.style.borderColor = '#94bce3';
            }
          }}
          onMouseLeave={(e) => {
            if (!sortMenuOpen) {
              e.currentTarget.style.background = 'var(--surface, #ffffff)';
              e.currentTarget.style.borderColor = 'rgba(var(--inkc, 29,31,32), .14)';
            }
          }}
        >
          <span
            style={{
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '9.5px',
              letterSpacing: '.1em',
              color: 'rgba(var(--inkc, 29,31,32), .55)'
            }}
          >
            Sort:
          </span>
          <span
            style={{
              fontWeight: 700,
              color: 'var(--ink, #1d1f20)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span style={{ fontSize: '11px' }}>{SORT_CONFIGS[sortOption]?.icon}</span>
            <span>{SORT_CONFIGS[sortOption]?.label}</span>
          </span>
          <span
            style={{
              fontSize: '8.5px',
              opacity: 0.55,
              transform: sortMenuOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.18s'
            }}
          >
            ▼
          </span>
        </button>

        {/* Direction Toggle: Ascending / Descending */}
        <button
          onClick={onToggleSortDirection}
          title={`Order: ${sortDirection === 'asc' ? 'Ascending (A–Z / Recent / Smallest) — Click for Descending' : 'Descending (Z–A / Oldest / Largest) — Click for Ascending'}`}
          style={{
            padding: '7px 10px',
            borderRadius: '11px',
            border: '1px solid rgba(var(--inkc, 29,31,32), .14)',
            background: 'var(--surface, #ffffff)',
            color: 'var(--ink, #1d1f20)',
            cursor: 'pointer',
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: '12px',
            fontWeight: 700,
            boxShadow: '0 1px 2px rgba(43,43,45,.14)',
            transition: 'background 0.15s, border-color 0.15s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--tint, #eef6ff)';
            e.currentTarget.style.borderColor = '#94bce3';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--surface, #ffffff)';
            e.currentTarget.style.borderColor = 'rgba(var(--inkc, 29,31,32), .14)';
          }}
        >
          {sortDirection === 'asc' ? '↑' : '↓'}
        </button>

        {/* Revealed Popover Selection Menu */}
        {sortMenuOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              minWidth: '200px',
              borderRadius: '13px',
              background: 'var(--surface, #1e293b)',
              color: 'var(--ink, #e9edf2)',
              border: '1px solid rgba(148,188,227,.28)',
              boxShadow: '0 14px 34px rgba(0,0,0,.45), 0 3px 8px rgba(0,0,0,.25)',
              padding: '6px',
              zIndex: 60,
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              animation: 'panelBackdropFadeIn 0.15s ease-out'
            }}
          >
            <div
              style={{
                padding: '6px 9px 5px',
                borderBottom: '1px solid rgba(148,188,227,.12)',
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '9px',
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                color: '#94bce3',
                marginBottom: '2px'
              }}
            >
              Sort Assets By
            </div>

            {SORT_OPTIONS.map((opt) => {
              const meta = SORT_CONFIGS[opt];
              const isSelected = sortOption === opt;
              return (
                <button
                  key={opt}
                  onClick={() => {
                    if (isSelected) {
                      onToggleSortDirection();
                    } else {
                      onSortChange(opt, meta.defaultDirection);
                    }
                    setSortMenuOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 9px',
                    borderRadius: '8px',
                    border: 0,
                    background: isSelected ? 'rgba(148,188,227,.18)' : 'transparent',
                    color: isSelected ? '#ffffff' : 'var(--ink, #e9edf2)',
                    cursor: 'pointer',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: '13.5px',
                    fontWeight: isSelected ? 700 : 500,
                    textAlign: 'left',
                    transition: 'background 0.12s, color 0.12s'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'rgba(148,188,227,.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px' }}>{meta.icon}</span>
                    <span>{meta.label}</span>
                  </div>
                  {isSelected && (
                    <span
                      style={{
                        color: '#94bce3',
                        fontSize: '10px',
                        fontFamily: 'ui-monospace, monospace',
                        fontWeight: 700,
                        letterSpacing: '.06em'
                      }}
                    >
                      {sortDirection === 'asc' ? 'ASC ↑' : 'DESC ↓'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Page Navigation Controls (when totalPages > 1) */}
      {totalPages > 1 && maxPerPage !== 'ALL' && (
        <div
          data-page-nav="1"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            padding: '3px 5px',
            borderRadius: '13px',
            background: 'var(--well, #e3e4e6)',
            border: '1px solid rgba(var(--inkc, 29,31,32), .09)',
            boxShadow: 'inset 0 2px 5px rgba(29,45,61,.09)'
          }}
        >
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            title="Previous page"
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '8px',
              border: 0,
              background: currentPage <= 1 ? 'transparent' : 'var(--surface, #ffffff)',
              color: currentPage <= 1 ? 'rgba(var(--inkc, 29,31,32), .25)' : 'var(--ink, #1d1f20)',
              cursor: currentPage <= 1 ? 'default' : 'pointer',
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '12px',
              boxShadow: currentPage <= 1 ? 'none' : '0 1px 2px rgba(43,43,45,.14)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s'
            }}
          >
            ‹
          </button>
          <span
            style={{
              padding: '0 6px',
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '10px',
              letterSpacing: '.06em',
              color: 'rgba(var(--inkc, 29,31,32), .7)',
              whiteSpace: 'nowrap'
            }}
          >
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            title="Next page"
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '8px',
              border: 0,
              background: currentPage >= totalPages ? 'transparent' : 'var(--surface, #ffffff)',
              color: currentPage >= totalPages ? 'rgba(var(--inkc, 29,31,32), .25)' : 'var(--ink, #1d1f20)',
              cursor: currentPage >= totalPages ? 'default' : 'pointer',
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '12px',
              boxShadow: currentPage >= totalPages ? 'none' : '0 1px 2px rgba(43,43,45,.14)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s'
            }}
          >
            ›
          </button>
        </div>
      )}

      {/* Carousel Prev/Next & Focus Counter */}
      <div
        data-carounav="1"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          opacity: isCarousel ? 1 : 0,
          pointerEvents: isCarousel ? 'auto' : 'none',
          transform: isCarousel ? 'translateX(0)' : 'translateX(-10px)',
          transition: 'opacity 0.35s, transform 0.35s'
        }}
      >
        <button
          onClick={onPrev}
          title="Previous (Left arrow)"
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '11px',
            cursor: 'pointer',
            border: '1px solid rgba(var(--inkc, 29,31,32), .14)',
            background: 'var(--surface, #ffffff)',
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: '13px',
            color: 'var(--ink, #1d1f20)',
            boxShadow: '0 1px 2px rgba(43,43,45,.14)',
            transition: 'background 0.18s, transform 0.1s'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--tint, #eef6ff)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface, #ffffff)')}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'translateY(1px)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
        >
          ‹
        </button>

        <span
          style={{
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: '10px',
            letterSpacing: '.08em',
            color: 'rgba(var(--inkc, 29,31,32), .5)',
            minWidth: '64px',
            textAlign: 'center'
          }}
        >
          {isCarousel ? `${Math.min(focusIndex + 1, totalVisible || 1)} / ${totalVisible}` : ''}
        </span>

        <button
          onClick={onNext}
          title="Next (Right arrow)"
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '11px',
            cursor: 'pointer',
            border: '1px solid rgba(var(--inkc, 29,31,32), .14)',
            background: 'var(--surface, #ffffff)',
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: '13px',
            color: 'var(--ink, #1d1f20)',
            boxShadow: '0 1px 2px rgba(43,43,45,.14)',
            transition: 'background 0.18s, transform 0.1s'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--tint, #eef6ff)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface, #ffffff)')}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'translateY(1px)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
        >
          ›
        </button>
      </div>

      {/* Contextual Hint Line */}
      <div
        style={{
          marginLeft: 'auto',
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: '9.5px',
          letterSpacing: '.1em',
          textTransform: 'uppercase',
          color: 'rgba(var(--inkc, 29,31,32), .38)',
          whiteSpace: 'nowrap'
        }}
      >
        {isCarousel ? 'drag · wheel · ← → · click to focus' : '⌘-click to multi-select · hover a pool to cluster'}
      </div>
    </div>
  );
};
