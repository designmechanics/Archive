import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { CATS } from '../data/seedData';
import { Pool } from '../types';

interface SelectionBarProps {
  selectedCount: number;
  onClear: () => void;
  onThrowToPool: (cat: string) => void;
  motionMultiplier: number;
  pools?: Pool[];
}

export const SelectionBar: React.FC<SelectionBarProps> = ({
  selectedCount,
  onClear,
  onThrowToPool,
  motionMultiplier,
  pools = []
}) => {
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
        background: 'var(--rail, #1d2d3d)',
        color: '#e9edf2',
        boxShadow: '0 18px 44px rgba(29,45,61,.4)',
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

      <span style={{ width: '1px', height: '22px', background: 'rgba(148,188,227,.28)' }} />

      <span
        style={{
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: '9.5px',
          letterSpacing: '.1em',
          textTransform: 'uppercase',
          color: 'rgba(233,237,242,.55)',
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
              border: 0,
              borderRadius: '10px',
              cursor: 'pointer',
              background: 'rgba(148,188,227,.16)',
              color: '#e9edf2',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '13.5px',
              fontWeight: 600,
              letterSpacing: '.04em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#5980a6')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(148,188,227,.16)')}
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
          border: 0,
          borderRadius: '10px',
          cursor: 'pointer',
          background: 'rgba(148,188,227,.16)',
          color: '#e9edf2',
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: '12px',
          transition: 'background 0.15s'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(148,188,227,.3)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(148,188,227,.16)')}
      >
        ✕
      </button>
    </div>
  );
};
