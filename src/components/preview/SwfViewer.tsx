import React, { useEffect, useRef, useState } from 'react';
import { viewerRoot, viewerBar, viewerMono, viewerMessage } from './viewerStyles';

interface SwfViewerProps {
  src: string;
  name: string;
}

let ruffleLoading: Promise<void> | null = null;

/** Loads the self-hosted Ruffle Flash emulator once (files are copied to /ruffle by scripts/copy-vendor.mjs). */
function loadRuffle(): Promise<void> {
  const w = window as any;
  if (w.RufflePlayer?.newest) return Promise.resolve();
  if (ruffleLoading) return ruffleLoading;
  w.RufflePlayer = w.RufflePlayer || {};
  w.RufflePlayer.config = { publicPath: '/ruffle/', polyfills: false, ...(w.RufflePlayer.config || {}) };
  ruffleLoading = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/ruffle/ruffle.js';
    s.onload = () => resolve();
    s.onerror = () => {
      ruffleLoading = null;
      reject(new Error('The Flash player files are missing. Run "npm install" so they are copied into public/ruffle.'));
    };
    document.head.appendChild(s);
  });
  return ruffleLoading;
}

export const SwfViewer: React.FC<SwfViewerProps> = ({ src, name }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let player: any = null;
    setError('');
    setLoading(true);

    (async () => {
      try {
        await loadRuffle();
        if (cancelled || !hostRef.current) return;
        const ruffle = (window as any).RufflePlayer.newest();
        player = ruffle.createPlayer();
        player.style.width = '100%';
        player.style.height = '100%';
        hostRef.current.innerHTML = '';
        hostRef.current.appendChild(player);
        await player.ruffle().load({ url: src, autoplay: 'auto', unmuteOverlay: 'visible', letterbox: 'on' });
        if (!cancelled) setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Could not play this Flash file');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        player?.remove();
      } catch {}
    };
  }, [src]);

  return (
    <div style={viewerRoot}>
      <div style={viewerBar}>
        <span style={viewerMono}>Flash (SWF), played with the Ruffle emulator. Click the player to start audio.</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
        {loading && !error && <div style={{ ...viewerMessage, position: 'absolute', inset: 0 }}>Starting Flash player…</div>}
        {error && (
          <div style={{ ...viewerMessage, position: 'absolute', inset: 0 }}>
            {error}
            <div style={{ marginTop: 8 }}>{name}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SwfViewer;
