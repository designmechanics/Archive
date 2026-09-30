import React, { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';

interface AudioViewerProps {
  src: string;
  name: string;
}

export const AudioViewer: React.FC<AudioViewerProps> = ({ src, name }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [loop, setLoop] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // Generate synthetic waveform bars on canvas
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let offset = 0;

    const renderWave = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const bars = 64;
      const barWidth = w / bars - 2;
      const progress = duration > 0 ? currentTime / duration : 0;
      const currentBar = Math.floor(progress * bars);

      for (let i = 0; i < bars; i++) {
        // Pseudo-random deterministic audio amplitude wave
        const seed = Math.sin(i * 0.4) * 0.5 + Math.cos(i * 0.8) * 0.3;
        const dynamicFactor = isPlaying ? Math.sin(offset + i * 0.2) * 0.15 : 0;
        const amp = Math.max(0.12, Math.min(0.9, Math.abs(seed) + 0.2 + dynamicFactor));
        const barHeight = amp * (h * 0.76);

        const x = i * (barWidth + 2);
        const y = (h - barHeight) / 2;

        if (i <= currentBar) {
          ctx.fillStyle = '#94bce3';
        } else {
          ctx.fillStyle = 'rgba(148,188,227,.2)';
        }

        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, y, barWidth, barHeight, 3) : ctx.rect(x, y, barWidth, barHeight);
        ctx.fill();
      }

      if (isPlaying) {
        offset += 0.08;
      }
      animFrameRef.current = requestAnimationFrame(renderWave);
    };

    renderWave();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, currentTime, duration]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !audioRef.current || duration === 0) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = pos * duration;
    setCurrentTime(pos * duration);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = Math.floor(secs % 60);
    return `${String(mins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0d151c',
        borderRadius: '14px',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      <audio
        ref={audioRef}
        src={src}
        loop={loop}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Visualizer Canvas Area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          background: 'radial-gradient(ellipse at center, rgba(44,69,93,.3) 0%, rgba(13,21,28,1) 80%)'
        }}
      >
        <div style={{ width: '100%', maxWidth: '480px', height: '140px', position: 'relative' }}>
          <canvas
            ref={canvasRef}
            width={480}
            height={140}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>

        <div
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '18px',
            fontWeight: 600,
            textTransform: 'uppercase',
            color: '#b5d9fd',
            marginTop: '12px',
            textAlign: 'center',
            letterSpacing: '.03em'
          }}
        >
          {name}
        </div>
      </div>

      {/* Scrub Timeline */}
      <div
        ref={timelineRef}
        onClick={handleSeek}
        style={{
          height: '8px',
          background: 'rgba(148,188,227,.12)',
          position: 'relative',
          cursor: 'pointer'
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
            background: 'linear-gradient(90deg, #5980a6, #94bce3)'
          }}
        />
      </div>

      {/* Bottom Controls Bar */}
      <div
        style={{
          padding: '12px 16px',
          background: 'rgba(24,36,50,.96)',
          borderTop: '1px solid rgba(148,188,227,.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={togglePlay}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: '1px solid #416180',
              background: 'linear-gradient(180deg, #6b91b6, #5980a6)',
              color: '#ffffff',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 2px 0 #2c455d'
            }}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          <span
            style={{
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '12px',
              color: '#94bce3'
            }}
          >
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setLoop(!loop)}
            style={{
              ...btnStyle,
              background: loop ? 'rgba(56,239,125,.18)' : 'transparent',
              color: loop ? '#38ef7d' : '#b5d9fd',
              borderColor: loop ? '#38ef7d' : 'rgba(148,188,227,.2)'
            }}
          >
            Loop
          </button>

          <button
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.muted = !isMuted;
                setIsMuted(!isMuted);
              }
            }}
            style={btnStyle}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>

          <span
            style={{
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '9.5px',
              color: 'rgba(233,237,242,.45)',
              marginLeft: '4px'
            }}
          >
            48kHz · Stereo
          </span>
        </div>
      </div>
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  padding: '5px 9px',
  borderRadius: '6px',
  border: '1px solid rgba(148,188,227,.2)',
  background: 'rgba(148,188,227,.1)',
  color: '#b5d9fd',
  fontFamily: 'ui-monospace, Menlo, monospace',
  fontSize: '10.5px',
  cursor: 'pointer'
};
