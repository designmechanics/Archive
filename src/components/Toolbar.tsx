import React from 'react';
import { Density, ViewMode } from '../types';

interface ToolbarProps {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  density: Density;
  onDensityChange: (d: Density) => void;
  focusIndex: number;
  totalVisible: number;
  onPrev: () => void;
  onNext: () => void;
  accent: string;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  view,
  onViewChange,
  density,
  onDensityChange,
  focusIndex,
  totalVisible,
  onPrev,
  onNext,
  accent
}) => {
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
