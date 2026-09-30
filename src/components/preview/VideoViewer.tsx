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
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
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

  // Listen to browser and player fullscreen events (and sync controls / state)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!(
        document.fullscreenElement === videoRef.current ||
        document.fullscreenElement === containerRef.current ||
        (document as any).webkitFullscreenElement === videoRef.current ||
        (document as any).webkitFullscreenElement === containerRef.current ||
        (videoRef.current as any)?.webkitDisplayingFullscreen
      );
      setIsFullscreen(isFs);
      if (videoRef.current) {
        // When in native fullscreen, enable the player's built-in controls
        // so the user can interact with the native player's built-in controls and built-in fullscreen exit toggle!
        videoRef.current.controls = isFs;
      }
    };

    const handleWebkitBegin = () => {
      setIsFullscreen(true);
      if (videoRef.current) videoRef.current.controls = true;
    };

    const handleWebkitEnd = () => {
      setIsFullscreen(false);
      if (videoRef.current) videoRef.current.controls = false;
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    const v = videoRef.current;
    if (v) {
      v.addEventListener('webkitbeginfullscreen', handleWebkitBegin);
      v.addEventListener('webkitendfullscreen', handleWebkitEnd);
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      if (v) {
        v.removeEventListener('webkitbeginfullscreen', handleWebkitBegin);
        v.removeEventListener('webkitendfullscreen', handleWebkitEnd);
      }
    };
  }, []);

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;

    const isFs = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement ||
      (video as any).webkitDisplayingFullscreen
    );

    if (isFs) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      } else if ((video as any).webkitExitFullscreen) {
        (video as any).webkitExitFullscreen();
      }
    } else {
      // Prioritize the video element's built-in fullscreen API so the native player's
      // built-in fullscreen toggle and player controls engage
      if (video.requestFullscreen) {
        video.requestFullscreen().catch((err) => {
          console.warn('Video requestFullscreen failed, falling back to container:', err);
          if (containerRef.current?.requestFullscreen) {
            containerRef.current.requestFullscreen().catch(() => {});
          }
        });
      } else if ((video as any).webkitRequestFullscreen) {
        (video as any).webkitRequestFullscreen();
      } else if ((video as any).webkitEnterFullscreen) {
        (video as any).webkitEnterFullscreen();
      } else if ((video as any).mozRequestFullScreen) {
        (video as any).mozRequestFullScreen();
      } else if ((video as any).msRequestFullscreen) {
        (video as any).msRequestFullscreen();
      } else if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
    }
  };

  // Keyboard shortcut 'f' / 'F' to toggle fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
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
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: '#090e13',
        borderRadius: isFullscreen ? 0 : '14px',
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
        onDoubleClick={(e) => {
          e.stopPropagation();
          toggleFullscreen();
        }}
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
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            onVolumeChange={() => {
              if (videoRef.current) setIsMuted(videoRef.current.muted);
            }}
            playsInline
            style={{
              width: '100%',
              height: '100%',
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: isFullscreen ? 0 : '8px',
              boxShadow: isFullscreen ? 'none' : '0 8px 32px rgba(0,0,0,0.65)',
              display: 'block'
            }}
          />

          {/* Center Play Overlay Icon if paused - centered to video frame */}
          {!isPlaying && !isFullscreen && (
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

        {/* Volume, Loop, Resolution & Fullscreen */}
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
                marginLeft: '2px',
                marginRight: '2px'
              }}
            >
              {resolution.w}×{resolution.h}
            </span>
          )}

          <button
            onClick={toggleFullscreen}
            style={{
              ...btnStyle,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px 7px',
              background: isFullscreen ? 'rgba(56,239,125,.2)' : 'rgba(148,188,227,.1)',
              borderColor: isFullscreen ? '#38ef7d' : 'rgba(148,188,227,.2)',
              color: isFullscreen ? '#38ef7d' : '#b5d9fd'
            }}
            title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
          >
            {isFullscreen ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            )}
          </button>
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
