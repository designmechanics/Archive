import React from 'react';

interface DropOverlayProps {
  isVisible: boolean;
}

export const DropOverlay: React.FC<DropOverlayProps> = ({ isVisible }) => {
  return (
    <div
      data-drop="1"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
        background: 'rgba(29,45,61,.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(3px)',
        transition: 'opacity 0.28s ease'
      }}
    >
      <div
        data-dropcard="1"
        style={{
          padding: '52px 68px',
          borderRadius: '22px',
          border: '2px dashed #b5d9fd',
          background: 'rgba(29,45,61,.6)',
          color: '#e9edf2',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          transform: isVisible ? 'scale(1)' : 'scale(0.92)',
          transition: 'transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
      >
        <div
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 700,
            fontSize: '40px',
            letterSpacing: '.02em',
            textTransform: 'uppercase',
            lineHeight: 1
          }}
        >
          Drop to ingest
        </div>
        <div
          style={{
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: '10.5px',
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            color: '#94bce3'
          }}
        >
          zip · rar · 7z · tar · psd · ai · svg · mp4 · otf · html/css/js
        </div>
      </div>
    </div>
  );
};
