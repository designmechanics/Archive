import React, { useState, useRef, useEffect, useMemo } from 'react';
import gsap from 'gsap';

interface VideoViewerProps {
  src: string;
  name: string;
}

export const VideoViewer: React.FC<VideoViewerProps> = ({ src, name }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loop, setLoop] = useState(true);
  const [resolution, setResolution] = useState<{ w: number; h: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState<{ width: number; height: number } | null>(null);

  // Dynamically observe stage size so the video is always 100% contained without clipping
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setStageSize({ width, height });
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Ensure resolution is picked up if video metadata was already available
  useEffect(() => {
    if (videoRef.current) {
      if (videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
        setResolution({
          w: videoRef.current.videoWidth,
          h: videoRef.current.videoHeight
        });
        setDuration(videoRef.current.duration || 0);
      }
    }
  }, [src]);

  // Exact aspect-fit calculation guaranteeing the entire video is shown without truncation
  const fitStyle = useMemo<React.CSSProperties>(() => {
    if (!resolution || !stageSize || stageSize.width === 0 || stageSize.height === 0) {
      return {
        maxWidth: '100%',
        maxHeight: '100%',
        width: 'auto',
        height: '100%',
        objectFit: 'contain'
      };
    }

    const stageRatio = stageSize.width / stageSize.height;
    const videoRatio = resolution.w / resolution.h;

    if (videoRatio < stageRatio) {
      // Portrait (e.g. 9:16) / taller than stage: bound strictly to stage height so entire video is shown
      const targetHeight = Math.floor(stageSize.height);
      const targetWidth = Math.round(targetHeight * videoRatio);
      return {
        height: `${targetHeight}px`,
        width: `${targetWidth}px`,
        maxWidth: '100%',
        maxHeight: '100%'
      };
    } else {
      // Landscape (e.g. 16:9) / wider than stage: bound strictly to stage width
      const targetWidth = Math.floor(stageSize.width);
      const targetHeight = Math.round(targetWidth / videoRatio);
      return {
        width: `${targetWidth}px`,
        height: `${targetHeight}px`,
        maxWidth: '100%',
        maxHeight: '100%'
      };
    }
  }, [resolution, stageSize]);

  useEffect(() => {
    if (controlsRef.current) {
      gsap.fromTo(
        controlsRef.current.children,
        { y: 8, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.35, stagger: 0.02, ease: 'power2.out' }
      );
    }
  }, []);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setResolution({
        w: videoRef.current.videoWidth,
        h: videoRef.current.videoHeight
      });
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !videoRef.current || duration === 0) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoRef.current.currentTime = pos * duration;
    setCurrentTime(pos * duration);
  };

  const stepFrame = (deltaFrames: number) => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setIsPlaying(false);
    const frameDuration = 1 / 30; // Standard 30fps step
    const newTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + deltaFrames * frameDuration));
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const setSpeed = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 100);
    return `${String(mins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  };

  const currentFrame = Math.floor(currentTime * 30);
  const totalFrames = Math.floor(duration * 30);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: '#090e13',
        borderRadius: '14px',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* Video Stage */}
      <div
        ref={stageRef}
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#04070a',
          cursor: 'pointer',
          padding: '12px 16px',
          overflow: 'hidden'
        }}
        onClick={togglePlay}
      >
        {/* Aspect-fit container: dynamically calculated from stage contentRect and video aspect ratio */}
        <div
          style={{
            position: 'relative',
            ...fitStyle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none'
          }}
        >
          <video
            ref={videoRef}
            src={src}
            loop={loop}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onLoadedData={handleLoadedMetadata}
            onCanPlay={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            playsInline
            style={{
              width: '100%',
              height: '100%',
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.65)',
              display: 'block'
            }}
          />

          {/* Center Play Overlay Icon if paused - centered to video frame */}
          {!isPlaying && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(15, 23, 42, 0.78)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '2px solid rgba(148, 188, 227, 0.45)',
                color: '#b5d9fd',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                boxShadow: '0 8px 30px rgba(0,0,0,.6)',
                pointerEvents: 'none',
                paddingLeft: '3px',
                transition: 'transform 0.15s ease'
              }}
            >
              ▶
            </div>
          )}
        </div>
      </div>

      {/* Scrub Timeline */}
      <div
        ref={timelineRef}
        onClick={handleSeek}
        style={{
          flex: 'none',
          height: '10px',
          background: 'rgba(148,188,227,.12)',
          position: 'relative',
          cursor: 'pointer'
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
            background: 'linear-gradient(90deg, #5980a6, #94bce3)',
            borderRadius: '0 4px 4px 0',
            position: 'relative'
          }}
        >
          <div
            style={{
              position: 'absolute',
              right: '-4px',
              top: '-3px',
              width: '10px',
              height: '16px',
              borderRadius: '3px',
              background: '#b5d9fd',
              boxShadow: '0 0 6px rgba(181,217,253,.8)'
            }}
          />
        </div>
      </div>

      {/* Bottom Controls Bar */}
      <div
        ref={controlsRef}
        style={{
          flex: 'none',
          padding: '8px 12px',
          background: 'rgba(24,36,50,.96)',
          borderTop: '1px solid rgba(148,188,227,.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'nowrap',
          overflowX: 'auto',
          gap: '8px'
        }}
      >
        {/* Play & Frame Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button onClick={togglePlay} style={btnStyle} title={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button onClick={() => stepFrame(-1)} style={btnStyle} title="Step -1 frame (30fps)">
            ⏮ -1f
          </button>
          <button onClick={() => stepFrame(1)} style={btnStyle} title="Step +1 frame (30fps)">
            +1f ⏭
          </button>
          <span
            style={{
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '11px',
              color: 'rgba(233,237,242,.85)',
              marginLeft: '4px'
            }}
          >
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <span
            style={{
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '9.5px',
              color: '#94bce3'
            }}
          >
            [{currentFrame}/{totalFrames}f]
          </span>
        </div>

        {/* Speed Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {[0.25, 0.5, 1, 1.5, 2].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              style={{
                ...btnStyle,
                background: playbackRate === s ? 'rgba(148,188,227,.3)' : 'transparent',
                borderColor: playbackRate === s ? '#94bce3' : 'rgba(148,188,227,.2)',
                color: playbackRate === s ? '#ffffff' : '#b5d9fd'
              }}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Volume & Loop */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setLoop(!loop)}
            style={{
              ...btnStyle,
              background: loop ? 'rgba(56,239,125,.18)' : 'transparent',
              color: loop ? '#38ef7d' : '#b5d9fd',
              borderColor: loop ? '#38ef7d' : 'rgba(148,188,227,.2)'
            }}
            title="Toggle loop"
          >
            Loop
          </button>

          <button
            onClick={() => {
              if (videoRef.current) {
                videoRef.current.muted = !isMuted;
                setIsMuted(!isMuted);
              }
            }}
            style={btnStyle}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>

          {resolution && (
            <span
              style={{
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: '9.5px',
                color: 'rgba(233,237,242,.5)',
                marginLeft: '4px'
              }}
            >
              {resolution.w}×{resolution.h}
            </span>
          )}
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
