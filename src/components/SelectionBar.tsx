import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { CATS } from '../data/seedData';
import { Pool, ThemeMode } from '../types';

interface SelectionBarProps {
  theme?: ThemeMode;
  selectedCount: number;
  onClear: () => void;
  onThrowToPool: (cat: string) => void;
  motionMultiplier: number;
  pools?: Pool[];
}

export const SelectionBar: React.FC<SelectionBarProps> = ({
  theme,
  selectedCount,
  onClear,
  onThrowToPool,
  motionMultiplier,
  pools = []
}) => {
  const isLight = theme === 'light';
  const isBlack = theme === 'black';
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const b = barRef.current;
    if (!b) return;
    const hasSelection = selectedCount > 0;

    gsap.to(b, {
      opacity: hasSelection ? 1 : 0,
      y: hasSelection ? 0 : '140%',
      duration: (hasSelection ? 0.5 : 0.25) * motionMultiplier,
      ease: hasSelection ? 'expo.out' : 'power2.in',
      pointerEvents: hasSelection ? 'auto' : 'none'
    });
  }, [selectedCount, motionMultiplier]);

  return (
    <div
      ref={barRef}
      data-selbar="1"
      style={{
        position: 'absolute',
        left: '50%',
        bottom: '22px',
        zIndex: 26,
        transform: 'translate(-50%, 140%)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px 10px 18px',
        borderRadius: '16px',
        background: isBlack ? '#000000' : isLight ? '#ffffff' : 'var(--rail, #1d2d3d)',
        color: isBlack ? '#ffffff' : isLight ? '#0f172a' : '#e9edf2',
        border: isBlack ? '1px solid rgba(255, 255, 255, 0.2)' : isLight ? '1px solid rgba(15, 23, 42, 0.1)' : 'none',
        boxShadow: isBlack
          ? '0 18px 44px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.15)'
          : isLight
          ? '0 16px 40px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(15, 23, 42, 0.06)'
          : '0 18px 44px rgba(29,45,61,.4)',
        opacity: 0,
        pointerEvents: 'none'
      }}
    >
      {/* Count */}
      <span
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: '17px',
          fontWeight: 600,
          letterSpacing: '.04em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap'
        }}
      >
        {selectedCount} {selectedCount === 1 ? 'asset' : 'assets'}
      </span>

      <span style={{ width: '1px', height: '22px', background: isBlack ? 'rgba(255, 255, 255, 0.2)' : isLight ? 'rgba(15, 23, 42, 0.12)' : 'rgba(148,188,227,.28)' }} />

      <span
        style={{
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: '9.5px',
          letterSpacing: '.1em',
          textTransform: 'uppercase',
          color: isBlack ? 'rgba(255, 255, 255, 0.6)' : isLight ? 'rgba(15, 23, 42, 0.55)' : 'rgba(233,237,242,.55)',
          whiteSpace: 'nowrap'
        }}
      >
        Throw into
      </span>

      {/* Pool Targets */}
      <div
        data-scroll="1"
        style={{
          display: 'flex',
          gap: '5px',
          maxWidth: '430px',
          overflowX: 'auto',
          paddingBottom: '2px'
        }}
      >
        {(pools.length > 0 ? pools.map((p) => p.name) : CATS).map((p) => (
          <button
            key={p}
            onClick={() => onThrowToPool(p)}
            style={{
              flex: 'none',
              padding: '6px 11px',
              border: isBlack ? '1px solid rgba(255, 255, 255, 0.15)' : isLight ? '1px solid rgba(15, 23, 42, 0.08)' : 0,
              borderRadius: '10px',
              cursor: 'pointer',
              background: isBlack ? 'rgba(255, 255, 255, 0.1)' : isLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(148,188,227,.16)',
              color: isBlack ? '#ffffff' : isLight ? '#0f172a' : '#e9edf2',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '13.5px',
              fontWeight: 600,
              letterSpacing: '.04em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              transition: 'background 0.15s, color 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isBlack ? '#ffffff' : isLight ? '#2563eb' : '#5980a6';
              e.currentTarget.style.color = isBlack ? '#000000' : '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isBlack ? 'rgba(255, 255, 255, 0.1)' : isLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(148,188,227,.16)';
              e.currentTarget.style.color = isBlack ? '#ffffff' : isLight ? '#0f172a' : '#e9edf2';
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Clear Selection */}
      <button
        onClick={onClear}
        title="Clear selection"
        style={{
          flex: 'none',
          width: '30px',
          height: '30px',
          border: isBlack ? '1px solid rgba(255, 255, 255, 0.15)' : isLight ? '1px solid rgba(15, 23, 42, 0.1)' : 0,
          borderRadius: '10px',
          cursor: 'pointer',
          background: isBlack ? 'rgba(255, 255, 255, 0.1)' : isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(148,188,227,.16)',
          color: isBlack ? '#ffffff' : isLight ? '#0f172a' : '#e9edf2',
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: '12px',
          transition: 'background 0.15s'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = isBlack ? 'rgba(255, 255, 255, 0.25)' : isLight ? 'rgba(15, 23, 42, 0.12)' : 'rgba(148,188,227,.3)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = isBlack ? 'rgba(255, 255, 255, 0.1)' : isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(148,188,227,.16)')}
      >
        ✕
      </button>
    </div>
  );
};
