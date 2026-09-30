import React, { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';

interface ImageViewerProps {
  src: string;
  name: string;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ src, name }) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [bgMode, setBgMode] = useState<'checker' | 'dark' | 'light'>('checker');
  const [pixelGrid, setPixelGrid] = useState(false);
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);

  // GSAP animation for control buttons reveal
  useEffect(() => {
    if (controlsRef.current) {
      gsap.fromTo(
        controlsRef.current.children,
        { y: 8, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.35, stagger: 0.02, ease: 'power2.out' }
      );
    }
  }, []);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setDimensions({ w: img.naturalWidth, h: img.naturalHeight });
  };

  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.max(0.25, Math.min(8, Number((prev + delta).toFixed(2)))));
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    handleZoom(delta);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Background styling
  const getBgStyle = () => {
    if (bgMode === 'dark') return '#0c1218';
    if (bgMode === 'light') return '#ffffff';
    return 'repeating-conic-gradient(#182432 0% 25%, #111a24 0% 50%) 50% / 18px 18px';
  };

  const aspectRatio = dimensions
    ? (dimensions.w / dimensions.h).toFixed(2)
    : '1.00';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0d151c',
        overflow: 'hidden',
        borderRadius: '14px',
        position: 'relative'
      }}
    >
      {/* Top Toolbar */}
      <div
        ref={controlsRef}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => handleZoom(-0.25)}
            style={btnStyle}
            title="Zoom out"
          >
            －
          </button>
          <span
            style={{
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '11px',
              color: '#94bce3',
              minWidth: '42px',
              textAlign: 'center'
            }}
          >
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => handleZoom(0.25)}
            style={btnStyle}
            title="Zoom in"
          >
            ＋
          </button>
          <button onClick={handleReset} style={btnStyle} title="Reset fit">
            1:1
          </button>
        </div>

        {/* Backdrop Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => setBgMode('checker')}
            style={{
              ...btnStyle,
              background: bgMode === 'checker' ? 'rgba(148,188,227,.3)' : 'transparent',
              borderColor: bgMode === 'checker' ? '#94bce3' : 'rgba(148,188,227,.2)'
            }}
            title="Checkerboard transparent backdrop"
          >
            Grid
          </button>
          <button
            onClick={() => setBgMode('dark')}
            style={{
              ...btnStyle,
              background: bgMode === 'dark' ? 'rgba(148,188,227,.3)' : 'transparent',
              borderColor: bgMode === 'dark' ? '#94bce3' : 'rgba(148,188,227,.2)'
            }}
            title="Solid dark backdrop"
          >
            Dark
          </button>
          <button
            onClick={() => setBgMode('light')}
            style={{
              ...btnStyle,
              background: bgMode === 'light' ? 'rgba(148,188,227,.3)' : 'transparent',
              borderColor: bgMode === 'light' ? '#94bce3' : 'rgba(148,188,227,.2)'
            }}
            title="Solid light backdrop"
          >
            Light
          </button>
        </div>

        {/* Pixel Grid Toggle */}
        <button
          onClick={() => setPixelGrid(!pixelGrid)}
          style={{
            ...btnStyle,
            background: pixelGrid ? 'rgba(56,239,125,.2)' : 'transparent',
            color: pixelGrid ? '#38ef7d' : '#b5d9fd',
            borderColor: pixelGrid ? '#38ef7d' : 'rgba(148,188,227,.2)'
          }}
          title="Pixel crisp toggle"
        >
          Crisp
        </button>
      </div>

      {/* Canvas Viewport */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          background: getBgStyle(),
          display: 'grid',
          placeItems: 'center',
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
      >
        <img
          ref={imgRef}
          src={src}
          alt={name}
          onLoad={handleImageLoad}
          draggable={false}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            imageRendering: pixelGrid && zoom >= 2 ? 'pixelated' : 'auto',
            maxHeight: '90%',
            maxWidth: '90%',
            userSelect: 'none',
            boxShadow: '0 8px 30px rgba(0,0,0,.5)'
          }}
        />
      </div>

      {/* Bottom HUD Bar */}
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
          {dimensions ? `${dimensions.w} × ${dimensions.h} px` : 'Loading size…'}
          <span style={{ color: '#94bce3', marginLeft: '8px' }}>
            ratio: {aspectRatio}:1
          </span>
        </div>
        <div style={{ color: 'rgba(233,237,242,.5)' }}>
          Pan: Drag · Zoom: Wheel / Buttons
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
  cursor: 'pointer',
  transition: 'background 0.15s'
};
