import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { AssetEntry, Density, ViewMode, WatchedFolder, SortOption, SortDirection } from '../types';
import { KINDS } from '../data/seedData';
import { ListView } from './ListView';
import { isZipArchive } from '../services/zipService';
import { computeItemWatermark, getInitialGlyph } from '../services/sortService';

interface StageProps {
  entries: AssetEntry[];
  allEntries: AssetEntry[];
  view: ViewMode;
  density: Density;
  focusIndex: number;
  onFocusChange: (i: number) => void;
  onSelectEntry: (id: string) => void;
  selectedIds: Record<string, boolean>;
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  stars: Record<string, boolean>;
  onToggleStar: (id: string, e: React.MouseEvent) => void;
  hoverPool: string | null;
  accent: string;
  motionMultiplier: number;
  onOpenModal?: () => void;
  onScanNativeFolder?: () => void;
  onLoadDemoCatalog?: () => void;
  onClearFilters?: () => void;
  query?: string;
  selectedPool?: string | null;
  selectedFolder?: WatchedFolder | null;
  onOpenZipContents?: (entry: AssetEntry) => void;
  sortOption?: SortOption;
  sortDirection?: SortDirection;
  onSortChange?: (option: SortOption, direction?: SortDirection) => void;
}

export const Stage: React.FC<StageProps> = ({
  entries,
  allEntries,
  view,
  density,
  focusIndex,
  onFocusChange,
  onSelectEntry,
  selectedIds,
  onToggleSelect,
  stars,
  onToggleStar,
  hoverPool,
  accent,
  motionMultiplier,
  onOpenModal,
  onScanNativeFolder,
  onLoadDemoCatalog,
  onClearFilters,
  query,
  selectedPool,
  selectedFolder,
  onOpenZipContents,
  sortOption = 'name',
  sortDirection = 'asc',
  onSortChange
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const ioRef = useRef<IntersectionObserver | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const isPointerDownRef = useRef(false);
  const isDraggingRef = useRef(false);
  const hasMovedRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const dragStartFocusRef = useRef(0);
  const capturedPointerIdRef = useRef<number | null>(null);
  const wheelAccRef = useRef(0);

  // Keep live references to avoid re-binding listeners during continuous gestures
  const focusIndexRef = useRef(focusIndex);
  focusIndexRef.current = focusIndex;

  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const viewRef = useRef(view);
  viewRef.current = view;

  const onFocusChangeRef = useRef(onFocusChange);
  onFocusChangeRef.current = onFocusChange;

  const isCarousel = ['coverflow', 'strip', 'radial', 'filmstrip', 'peel'].includes(view);

  // Copy helper
  const handleCopy = (txt: string, key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(txt);
      }
    } catch {}
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 1400);
  };

  // Card click handler - opens zip contents for zip archives, or preview in ALL views
  const handleCardClick = (e: AssetEntry, ev: React.MouseEvent) => {
    if (hasMovedRef.current || isDraggingRef.current) return;
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey) {
      onToggleSelect(e.id, ev);
      return;
    }
    const idx = entries.findIndex((x) => x.id === e.id);
    if (idx >= 0) {
      onFocusChange(idx);
    }
    if (isZipArchive(e) && !e.isZipInnerFile && onOpenZipContents) {
      onOpenZipContents(e);
    } else {
      onSelectEntry(e.id);
    }
  };

  // Drag handling on stage with movement threshold (so clicks are never eaten)
  useEffect(() => {
    const st = stageRef.current;
    if (!st || !isCarousel) return;

    const onPointerDown = (e: PointerEvent) => {
      // Only process primary mouse button (left button) or touch
      if (e.button !== 0) return;
      isPointerDownRef.current = true;
      isDraggingRef.current = false;
      hasMovedRef.current = false;
      dragStartXRef.current = e.clientX;
      dragStartYRef.current = e.clientY;
      dragStartFocusRef.current = focusIndexRef.current;
      capturedPointerIdRef.current = null;
    };

    const onPointerMove = (e: PointerEvent) => {
      // CRITICAL: If the mouse button is NOT currently pressed, hover movement MUST DO NOTHING!
      if (!isPointerDownRef.current || e.buttons === 0) {
        if (isPointerDownRef.current) {
          isPointerDownRef.current = false;
          isDraggingRef.current = false;
        }
        return;
      }

      const dx = e.clientX - dragStartXRef.current;
      const dy = e.clientY - dragStartYRef.current;
      const dist = Math.hypot(dx, dy);

      // Deadzone threshold (8px) before treating movement as a drag gesture
      if (!isDraggingRef.current && dist > 8) {
        isDraggingRef.current = true;
        hasMovedRef.current = true;
        try {
          st.setPointerCapture(e.pointerId);
          capturedPointerIdRef.current = e.pointerId;
        } catch {}
      }

      if (!isDraggingRef.current) return;

      // Calculate delta based on view mode's movement axis
      let delta = 0;
      if (viewRef.current === 'filmstrip') {
        // Filmstrip stacks vertically
        delta = (dragStartYRef.current - e.clientY) / 80;
      } else {
        // Coverflow, Strip, Radial, Peel stack horizontally
        delta = (dragStartXRef.current - e.clientX) / 100;
      }

      const maxIdx = entriesRef.current.length - 1;
      if (maxIdx <= 0) return;
      const newFocus = Math.max(0, Math.min(maxIdx, Math.round(dragStartFocusRef.current + delta)));
      if (newFocus !== focusIndexRef.current) {
        onFocusChangeRef.current(newFocus);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isPointerDownRef.current) return;
      isPointerDownRef.current = false;

      if (capturedPointerIdRef.current !== null) {
        try {
          st.releasePointerCapture(capturedPointerIdRef.current);
        } catch {}
        capturedPointerIdRef.current = null;
      }

      isDraggingRef.current = false;
      // Delay resetting hasMovedRef slightly so click events know a drag gesture just completed
      setTimeout(() => {
        hasMovedRef.current = false;
      }, 100);
    };

    const onWindowPointerUp = () => {
      if (isPointerDownRef.current) {
        isPointerDownRef.current = false;
        isDraggingRef.current = false;
        if (capturedPointerIdRef.current !== null) {
          try {
            st.releasePointerCapture(capturedPointerIdRef.current);
          } catch {}
          capturedPointerIdRef.current = null;
        }
        setTimeout(() => {
          hasMovedRef.current = false;
        }, 100);
      }
    };

    st.addEventListener('pointerdown', onPointerDown);
    st.addEventListener('pointermove', onPointerMove);
    st.addEventListener('pointerup', onPointerUp);
    st.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerUp);

    return () => {
      st.removeEventListener('pointerdown', onPointerDown);
      st.removeEventListener('pointermove', onPointerMove);
      st.removeEventListener('pointerup', onPointerUp);
      st.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerUp);
    };
  }, [isCarousel]);

  // Wheel handling on wrapper
  useEffect(() => {
    const wr = wrapRef.current;
    if (!wr || !isCarousel) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      wheelAccRef.current += e.deltaY + e.deltaX;
      if (Math.abs(wheelAccRef.current) > 80) {
        const step = wheelAccRef.current > 0 ? 1 : -1;
        const maxIdx = entriesRef.current.length - 1;
        if (maxIdx > 0) {
          const nextIdx = Math.max(0, Math.min(maxIdx, focusIndexRef.current + step));
          if (nextIdx !== focusIndexRef.current) {
            onFocusChangeRef.current(nextIdx);
          }
        }
        wheelAccRef.current = 0;
      }
    };

    wr.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      wr.removeEventListener('wheel', onWheel);
    };
  }, [isCarousel]);

  // Main Layout Choreography with GSAP
  useEffect(() => {
    const st = stageRef.current;
    const wr = wrapRef.current;
    if (!st || !wr || view === 'list') return;

    const W = st.clientWidth;
    const H = Math.max(320, wr.clientHeight - 120);
    const m = motionMultiplier;
    const focus = Math.max(0, Math.min(focusIndex, entries.length - 1));

    const T: Record<
      string,
      {
        x: number;
        y: number;
        w: number;
        h: number;
        rY: number;
        rX: number;
        rZ: number;
        z: number;
        s: number;
        o: number;
        zi: number;
      }
    > = {};

    let stageH = H;

    if (view === 'grid') {
      wr.style.overflowY = 'scroll';
      wr.style.overflowX = 'hidden';
      const cols = density;
      const gap = 18;
      const cw = Math.max(120, Math.floor((W - gap * (cols - 1)) / cols));
      const ch = Math.round(cw * 0.74 + 132);

      entries.forEach((e, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        T[e.id] = {
          x: c * (cw + gap),
          y: r * (ch + gap),
          w: cw,
          h: ch,
          rY: 0,
          rX: 0,
          rZ: 0,
          z: 0,
          s: 1,
          o: 1,
          zi: 10 + i
        };
      });
      stageH = Math.ceil(entries.length / cols) * (ch + gap) + 8;
    } else {
      wr.style.overflow = 'hidden';
      const cw2 = Math.min(300, Math.max(200, W * 0.22));
      const ch2 = Math.round(cw2 * 1.3);
      const cx = W / 2 - cw2 / 2;
      const cy = Math.max(6, (H - ch2) / 2);

      entries.forEach((e, i) => {
        const d = i - focus;
        const ad = Math.abs(d);
        const t = {
          x: cx,
          y: cy,
          w: cw2,
          h: ch2,
          rY: 0,
          rX: 0,
          rZ: 0,
          z: 0,
          s: 1,
          o: 1,
          zi: 200 - ad * 2
        };

        if (view === 'coverflow') {
          t.x = cx + d * (cw2 * 0.52);
          t.z = -ad * 190;
          t.rY = -Math.max(-46, Math.min(46, d * 30));
          t.s = 1 - Math.min(ad * 0.06, 0.4);
          t.o = ad > 5 ? 0 : 1;
          t.y = cy + ad * 10;
        } else if (view === 'strip') {
          t.x = cx + d * (cw2 + 26);
          t.s = d === 0 ? 1.06 : 0.93;
          t.o = ad > 4 ? 0 : 1;
          t.y = cy + (d === 0 ? -10 : 8);
        } else if (view === 'radial') {
          const R = 1150;
          const a = d * 0.115;
          t.x = cx + R * Math.sin(a);
          t.y = cy + R * (1 - Math.cos(a)) * 0.9 - 40;
          t.rZ = d * 6.6;
          t.z = -ad * 60;
          t.s = 1 - Math.min(ad * 0.045, 0.35);
          t.o = ad > 6 ? 0 : 1;
        } else if (view === 'filmstrip') {
          const cxFilm = Math.round(W * 0.33 - cw2 / 2);
          t.y = cy + d * (ch2 * 0.34);
          t.x = cxFilm + ad * 14;
          t.rX = -Math.max(-40, Math.min(40, d * 13));
          t.z = -ad * 120;
          t.s = 1 - Math.min(ad * 0.05, 0.35);
          t.o = ad > 4 ? 0 : 1;
        } else if (view === 'peel') {
          if (d < 0) {
            const k = Math.min(3, -d);
            t.y = cy - 460;
            t.x = cx - 160 * k;
            t.rZ = -16 * k;
            t.o = 0;
            t.s = 0.9;
          } else {
            t.y = cy + d * 13;
            t.x = cx + d * 5;
            t.s = 1 - d * 0.035;
            t.o = d > 5 ? 0 : 1;
            t.rZ = d * 1.4;
            t.zi = 300 - d;
          }
        }
        T[e.id] = t;
      });
    }

    st.style.height = `${view === 'grid' ? stageH : H}px`;

    const dur = 0.72 * m;
    const ease = view === 'strip' ? 'elastic.out(0.55, 0.72)' : 'expo.out';

    allEntries.forEach((entry) => {
      const el = cardRefs.current.get(entry.id);
      if (!el) return;

      const t = T[entry.id];
      const isSelected = !!selectedIds[entry.id];

      if (!t) {
        // Filtered out: animate towards rail
        gsap.to(el, {
          x: -160,
          y: 120,
          z: -300,
          scale: 0.12,
          rotateZ: -24,
          opacity: 0,
          duration: 0.6 * m,
          ease: 'power3.inOut',
          overwrite: true,
          onComplete: () => {
            el.style.pointerEvents = 'none';
          }
        });
        return;
      }

      el.style.pointerEvents = t.o === 0 ? 'none' : 'auto';
      el.style.width = `${t.w}px`;
      el.style.height = `${t.h}px`;
      el.style.zIndex = String(t.zi);

      const idxInVis = entries.findIndex((x) => x.id === entry.id);

      gsap.to(el, {
        x: t.x,
        y: t.y,
        z: t.z,
        rotateY: t.rY,
        rotateX: t.rX,
        rotateZ: t.rZ,
        scale: t.s * (isSelected ? 0.94 : 1),
        opacity: t.o,
        duration: dur,
        ease: ease,
        overwrite: 'auto',
        delay: Math.min(idxInVis * 0.016 * m, 0.5)
      });
    });

    // Reveal IntersectionObserver for Grid view
    if (ioRef.current) ioRef.current.disconnect();

    if (view === 'grid') {
      ioRef.current = new IntersectionObserver(
        (entriesObs) => {
          entriesObs.forEach((entryObs) => {
            const revealEl = entryObs.target.querySelector('[data-reveal]') as HTMLElement;
            if (!revealEl || (entryObs.target as HTMLElement).style.pointerEvents === 'none') return;

            if (entryObs.isIntersecting) {
              gsap.to(revealEl, {
                opacity: 1,
                y: 0,
                rotateX: 0,
                duration: 0.55 * m,
                ease: 'power3.out',
                overwrite: true
              });
            } else {
              gsap.to(revealEl, {
                opacity: 0.08,
                y: 26,
                rotateX: -9,
                duration: 0.4 * m,
                ease: 'power2.in',
                overwrite: true
              });
            }
          });
        },
        { root: wr, rootMargin: '16% 0px 16% 0px', threshold: 0.01 }
      );

      cardRefs.current.forEach((c) => {
        if (c) ioRef.current?.observe(c);
      });
    } else {
      document.querySelectorAll('[data-reveal]').forEach((r) => {
        gsap.set(r, { opacity: 1, y: 0, rotateX: 0 });
      });
    }
  }, [entries, allEntries, view, density, focusIndex, selectedIds, motionMultiplier]);

  // Magnetic hover effect when pool in rail is hovered
  useEffect(() => {
    allEntries.forEach((entry) => {
      const el = cardRefs.current.get(entry.id);
      if (!el || el.style.pointerEvents === 'none') return;
      const isMatch = hoverPool && entry.cat === hoverPool;
      gsap.to(el, {
        scale: isMatch ? 1.06 : 1,
        xPercent: isMatch ? -3.5 : 0,
        duration: 0.6 * motionMultiplier,
        ease: 'elastic.out(0.5, 0.55)',
        overwrite: 'auto'
      });
    });
  }, [hoverPool, allEntries, motionMultiplier]);

  // Direction and watermark transition state
  const prevFocusRef = useRef(focusIndex);
  const prevScrollTopRef = useRef(0);
  const lastDirRef = useRef<number>(1);
  const currentWatermarkRef = useRef<string>('');
  const currentGroupRef = useRef<HTMLDivElement>(null);
  const exitGroupRef = useRef<HTMLDivElement>(null);

  const [watermarkState, setWatermarkState] = useState<{
    current: string;
    exiting: string | null;
    dir: number;
    axis: 'Y' | 'X';
    animKey: number;
  }>({
    current: '',
    exiting: null,
    dir: 1,
    axis: 'Y',
    animKey: 0
  });

  // Track carousel focus direction changes
  useEffect(() => {
    if (focusIndex > prevFocusRef.current) {
      lastDirRef.current = 1;
    } else if (focusIndex < prevFocusRef.current) {
      lastDirRef.current = -1;
    }
    prevFocusRef.current = focusIndex;
  }, [focusIndex]);

  const applyWatermark = (mark: string) => {
    if (mark === currentWatermarkRef.current) return;
    const oldMark = currentWatermarkRef.current;
    currentWatermarkRef.current = mark;
    const dir = lastDirRef.current;
    const axis: 'Y' | 'X' = view === 'filmstrip' ? 'X' : 'Y';
    setWatermarkState((prev) => ({
      current: mark,
      exiting: oldMark || null,
      dir,
      axis,
      animKey: prev.animKey + 1
    }));
  };

  const updateWatermark = () => {
    if (!entries || entries.length === 0) {
      applyWatermark('');
      return;
    }

    const activeSort = sortOption || 'name';

    // 1. Carousel views: use active/focused card
    if (isCarousel) {
      const activeItem = entries[focusIndex] || entries[0];
      if (!activeItem) {
        applyWatermark('');
        return;
      }
      applyWatermark(computeItemWatermark(activeItem, activeSort));
      return;
    }

    const wr = wrapRef.current;
    if (!wr) return;

    // 2. Grid view
    if (view === 'grid') {
      const st = stageRef.current;
      const W = st?.clientWidth || wr.clientWidth || window.innerWidth;
      const H = wr.clientHeight || window.innerHeight;
      const cols = density;
      const gap = 18;
      const cw = Math.max(120, Math.floor((W - gap * (cols - 1)) / cols));
      const ch = Math.round(cw * 0.74 + 132);
      const rowH = ch + gap;

      const scrollTop = wr.scrollTop;
      const scrollBottom = scrollTop + H;
      const centerY = scrollTop + H / 2;

      if (activeSort === 'name' || activeSort === 'number') {
        const tallies: Record<string, number> = {};
        const startRow = Math.max(0, Math.floor(scrollTop / rowH));
        const endRow = Math.min(Math.ceil(entries.length / cols) - 1, Math.floor(scrollBottom / rowH));

        for (let r = startRow; r <= endRow; r++) {
          const itemTop = r * rowH;
          const itemBottom = itemTop + ch;
          const visiblePixels = Math.max(0, Math.min(itemBottom, scrollBottom) - Math.max(itemTop, scrollTop));
          if (visiblePixels > 0) {
            const weight = visiblePixels / ch;
            for (let c = 0; c < cols; c++) {
              const idx = r * cols + c;
              if (idx < entries.length) {
                const glyph = getInitialGlyph(entries[idx].title, activeSort);
                if (glyph) {
                  tallies[glyph] = (tallies[glyph] || 0) + weight;
                }
              }
            }
          }
        }

        let maxTally = -1;
        let dominantGlyph = '';
        for (const [glyph, tally] of Object.entries(tallies)) {
          if (tally > maxTally) {
            maxTally = tally;
            dominantGlyph = glyph;
          }
        }
        applyWatermark(dominantGlyph);
      } else {
        const centerRow = Math.max(0, Math.min(Math.ceil(entries.length / cols) - 1, Math.floor(centerY / rowH)));
        const centerCol = Math.floor(cols / 2);
        const centerIdx = Math.max(0, Math.min(entries.length - 1, centerRow * cols + centerCol));
        const centerItem = entries[centerIdx];
        if (centerItem) {
          applyWatermark(computeItemWatermark(centerItem, activeSort));
        }
      }
      return;
    }

    // 3. List view
    if (view === 'list') {
      const H = wr.clientHeight || window.innerHeight;
      const scrollTop = wr.scrollTop;
      const scrollBottom = scrollTop + H;
      const centerY = scrollTop + H / 2;

      const rowElements = wr.querySelectorAll<HTMLElement>('[data-row]');
      if (rowElements.length === 0) {
        if (entries[0]) {
          applyWatermark(computeItemWatermark(entries[0], activeSort));
        }
        return;
      }

      if (activeSort === 'name' || activeSort === 'number') {
        const tallies: Record<string, number> = {};
        rowElements.forEach((el) => {
          const top = el.offsetTop;
          const h = el.offsetHeight;
          const bottom = top + h;
          const visH = Math.max(0, Math.min(bottom, scrollBottom) - Math.max(top, scrollTop));
          if (visH > 0) {
            const id = el.getAttribute('data-row');
            const entry = entries.find((x) => x.id === id);
            if (entry) {
              const glyph = getInitialGlyph(entry.title, activeSort);
              if (glyph) {
                tallies[glyph] = (tallies[glyph] || 0) + (visH / h);
              }
            }
          }
        });

        let maxTally = -1;
        let dominantGlyph = '';
        for (const [glyph, tally] of Object.entries(tallies)) {
          if (tally > maxTally) {
            maxTally = tally;
            dominantGlyph = glyph;
          }
        }
        applyWatermark(dominantGlyph);
      } else {
        let closestDist = Infinity;
        let centerEntry = entries[0];

        rowElements.forEach((el) => {
          const top = el.offsetTop;
          const h = el.offsetHeight;
          const mid = top + h / 2;
          const dist = Math.abs(mid - centerY);
          if (dist < closestDist) {
            closestDist = dist;
            const id = el.getAttribute('data-row');
            const found = entries.find((x) => x.id === id);
            if (found) centerEntry = found;
          }
        });

        if (centerEntry) {
          applyWatermark(computeItemWatermark(centerEntry, activeSort));
        }
      }
    }
  };

  useEffect(() => {
    const wr = wrapRef.current;
    if (!wr) return;

    let rafId: number | null = null;
    const handleScrollOrUpdate = () => {
      const scrollTop = wr.scrollTop;
      const diff = scrollTop - prevScrollTopRef.current;
      if (diff > 2) {
        lastDirRef.current = 1;
      } else if (diff < -2) {
        lastDirRef.current = -1;
      }
      prevScrollTopRef.current = scrollTop;

      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        updateWatermark();
      });
    };

    updateWatermark();

    if (view === 'grid' || view === 'list') {
      wr.addEventListener('scroll', handleScrollOrUpdate, { passive: true });
      window.addEventListener('resize', handleScrollOrUpdate, { passive: true });
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      wr.removeEventListener('scroll', handleScrollOrUpdate);
      window.removeEventListener('resize', handleScrollOrUpdate);
    };
  }, [entries, view, density, focusIndex, sortOption, isCarousel]);

  // Animate entering & exiting watermark letters matching 3D rotation and direction to center for each view mode
  useEffect(() => {
    if (!watermarkState.animKey) return;
    const currentEl = currentGroupRef.current;
    const exitEl = exitGroupRef.current;
    const m = motionMultiplier;
    const dir = watermarkState.dir;
    const animKey = watermarkState.animKey;

    if (exitEl && watermarkState.exiting) {
      if (view === 'filmstrip') {
        // Filmstrip: cards move vertically and pitch along X axis
        gsap.fromTo(
          exitEl,
          { opacity: 1, y: 0, rotateX: 0, scale: 1 },
          {
            opacity: 0,
            y: -dir * 130,
            rotateX: dir * 32,
            scale: 0.94,
            duration: 0.44 * m,
            ease: 'power3.inOut',
            overwrite: true,
            onComplete: () => {
              setWatermarkState((prev) => (prev.animKey === animKey ? { ...prev, exiting: null } : prev));
            }
          }
        );
      } else if (view === 'peel') {
        // Peel: card peels off to top-left (-x, -y, -rotateZ)
        if (dir === 1) {
          gsap.fromTo(
            exitEl,
            { opacity: 1, x: 0, y: 0, rotateZ: 0, scale: 1 },
            {
              opacity: 0,
              x: -150,
              y: -190,
              rotateZ: -18,
              scale: 0.92,
              duration: 0.46 * m,
              ease: 'power3.inOut',
              overwrite: true,
              onComplete: () => {
                setWatermarkState((prev) => (prev.animKey === animKey ? { ...prev, exiting: null } : prev));
              }
            }
          );
        } else {
          gsap.fromTo(
            exitEl,
            { opacity: 1, x: 0, y: 0, rotateZ: 0, scale: 1 },
            {
              opacity: 0,
              x: 30,
              y: 30,
              rotateZ: 6,
              scale: 0.90,
              duration: 0.44 * m,
              ease: 'power3.inOut',
              overwrite: true,
              onComplete: () => {
                setWatermarkState((prev) => (prev.animKey === animKey ? { ...prev, exiting: null } : prev));
              }
            }
          );
        }
      } else if (view === 'radial') {
        // Arc / Radial: cards sweep along curved circular arc (dipping Y, rotating Z and Y)
        gsap.fromTo(
          exitEl,
          { opacity: 1, x: 0, y: 0, rotateZ: 0, rotateY: 0, scale: 1 },
          {
            opacity: 0,
            x: -dir * 170,
            y: 65,
            rotateZ: -dir * 14,
            rotateY: dir * 18,
            scale: 0.92,
            duration: 0.46 * m,
            ease: 'power3.inOut',
            overwrite: true,
            onComplete: () => {
              setWatermarkState((prev) => (prev.animKey === animKey ? { ...prev, exiting: null } : prev));
            }
          }
        );
      } else if (view === 'coverflow') {
        // Coverflow: classic horizontal 3D card rotation along Y axis
        gsap.fromTo(
          exitEl,
          { opacity: 1, x: 0, rotateY: 0, scale: 1 },
          {
            opacity: 0,
            x: -dir * 160,
            rotateY: dir * 42,
            scale: 0.93,
            duration: 0.44 * m,
            ease: 'power3.inOut',
            overwrite: true,
            onComplete: () => {
              setWatermarkState((prev) => (prev.animKey === animKey ? { ...prev, exiting: null } : prev));
            }
          }
        );
      } else if (view === 'strip') {
        // Strip: linear horizontal slide
        gsap.fromTo(
          exitEl,
          { opacity: 1, x: 0, scale: 1 },
          {
            opacity: 0,
            x: -dir * 180,
            scale: 0.93,
            duration: 0.42 * m,
            ease: 'power3.inOut',
            overwrite: true,
            onComplete: () => {
              setWatermarkState((prev) => (prev.animKey === animKey ? { ...prev, exiting: null } : prev));
            }
          }
        );
      } else {
        // Grid & List: vertical scrolling
        gsap.fromTo(
          exitEl,
          { opacity: 1, y: 0, rotateX: 0, scale: 1 },
          {
            opacity: 0,
            y: -dir * 120,
            rotateX: dir * 28,
            scale: 0.94,
            duration: 0.44 * m,
            ease: 'power3.inOut',
            overwrite: true,
            onComplete: () => {
              setWatermarkState((prev) => (prev.animKey === animKey ? { ...prev, exiting: null } : prev));
            }
          }
        );
      }
    }

    if (currentEl && watermarkState.current) {
      const isFirst = !watermarkState.exiting;
      if (isFirst) {
        gsap.fromTo(
          currentEl,
          { opacity: 0, scale: 0.94 },
          { opacity: 1, scale: 1, duration: 0.5 * m, ease: 'power3.out', overwrite: true }
        );
      } else if (view === 'filmstrip') {
        // Filmstrip: incoming letter comes from below (dir=1) or above (dir=-1)
        gsap.fromTo(
          currentEl,
          {
            opacity: 0,
            y: dir * 130,
            rotateX: -dir * 32,
            scale: 0.94
          },
          {
            opacity: 1,
            y: 0,
            rotateX: 0,
            scale: 1,
            duration: 0.52 * m,
            ease: 'power3.out',
            overwrite: true
          }
        );
      } else if (view === 'peel') {
        // Peel: incoming letter reveals from underneath the stack (dir=1) or peels back in (dir=-1)
        if (dir === 1) {
          gsap.fromTo(
            currentEl,
            {
              opacity: 0,
              x: 30,
              y: 30,
              rotateZ: 6,
              scale: 0.90
            },
            {
              opacity: 1,
              x: 0,
              y: 0,
              rotateZ: 0,
              scale: 1,
              duration: 0.52 * m,
              ease: 'power3.out',
              overwrite: true
            }
          );
        } else {
          gsap.fromTo(
            currentEl,
            {
              opacity: 0,
              x: -150,
              y: -190,
              rotateZ: -18,
              scale: 0.92
            },
            {
              opacity: 1,
              x: 0,
              y: 0,
              rotateZ: 0,
              scale: 1,
              duration: 0.52 * m,
              ease: 'power3.out',
              overwrite: true
            }
          );
        }
      } else if (view === 'radial') {
        // Arc / Radial: incoming letter sweeps along the arc
        gsap.fromTo(
          currentEl,
          {
            opacity: 0,
            x: dir * 170,
            y: 65,
            rotateZ: dir * 14,
            rotateY: -dir * 18,
            scale: 0.92
          },
          {
            opacity: 1,
            x: 0,
            y: 0,
            rotateZ: 0,
            rotateY: 0,
            scale: 1,
            duration: 0.52 * m,
            ease: 'power3.out',
            overwrite: true
          }
        );
      } else if (view === 'coverflow') {
        // Coverflow: horizontal 3D card rotation into center
        gsap.fromTo(
          currentEl,
          {
            opacity: 0,
            x: dir * 160,
            rotateY: -dir * 42,
            scale: 0.93
          },
          {
            opacity: 1,
            x: 0,
            rotateY: 0,
            scale: 1,
            duration: 0.52 * m,
            ease: 'power3.out',
            overwrite: true
          }
        );
      } else if (view === 'strip') {
        // Strip: linear slide
        gsap.fromTo(
          currentEl,
          {
            opacity: 0,
            x: dir * 180,
            scale: 0.93
          },
          {
            opacity: 1,
            x: 0,
            scale: 1,
            duration: 0.5 * m,
            ease: 'power3.out',
            overwrite: true
          }
        );
      } else {
        // Grid & List: vertical scrolling
        gsap.fromTo(
          currentEl,
          {
            opacity: 0,
            y: dir * 120,
            rotateX: -dir * 28,
            scale: 0.94
          },
          {
            opacity: 1,
            y: 0,
            rotateX: 0,
            scale: 1,
            duration: 0.52 * m,
            ease: 'power3.out',
            overwrite: true
          }
        );
      }
    }
  }, [watermarkState.animKey, motionMultiplier, view]);

  const isFilmstrip = view === 'filmstrip';

  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Background Watermark/Glyph at 10% opacity with handwriting overlay at 50% opacity, 25vh */}
      {(watermarkState.current || watermarkState.exiting) && (
        <div
          aria-hidden="true"
          className="watermark-backdrop"
          style={{
            perspectiveOrigin: isFilmstrip ? '67% 50%' : '50% 50%'
          }}
        >
          {/* Exiting Letter & Script Group */}
          {watermarkState.exiting && (
            <div
              key={`exit-${watermarkState.animKey}`}
              ref={exitGroupRef}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: isFilmstrip ? '67%' : '50%',
                width: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                transformStyle: 'preserve-3d',
                willChange: 'transform, opacity',
                transition: 'left 0.65s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              <span
                className="watermark-glyph"
                style={{
                  fontSize: '128vh',
                  lineHeight: 1,
                  marginTop: '-13.5vh',
                  position: 'absolute',
                  left: 0,
                  transform: 'translateX(-50%) translateZ(0)'
                }}
              >
                {watermarkState.exiting}
              </span>
              <span
                className="watermark-script"
                style={{
                  fontSize: '25vh',
                  position: 'absolute',
                  bottom: '2vh',
                  left: 0,
                  transform: 'translateX(-50%) translateZ(20px)'
                }}
              >
                {watermarkState.exiting}
              </span>
            </div>
          )}

          {/* Current / Entering Letter & Script Group */}
          {watermarkState.current && (
            <div
              key={`current-${watermarkState.animKey}`}
              ref={currentGroupRef}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: isFilmstrip ? '67%' : '50%',
                width: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                transformStyle: 'preserve-3d',
                willChange: 'transform, opacity',
                transition: 'left 0.65s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              <span
                className="watermark-glyph"
                style={{
                  fontSize: '128vh',
                  lineHeight: 1,
                  marginTop: '-13.5vh',
                  position: 'absolute',
                  left: 0,
                  transform: 'translateX(-50%) translateZ(0)'
                }}
              >
                {watermarkState.current}
              </span>
              <span
                className="watermark-script"
                style={{
                  fontSize: '25vh',
                  position: 'absolute',
                  bottom: '2vh',
                  left: 0,
                  transform: 'translateX(-50%) translateZ(20px)'
                }}
              >
                {watermarkState.current}
              </span>
            </div>
          )}
        </div>
      )}

      <div
        ref={wrapRef}
        data-wrap="1"
        data-scroll="1"
        style={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          minHeight: 0,
          overflow: view === 'grid' || view === 'list' ? 'auto' : 'hidden',
          padding: '6px 26px 120px'
        }}
      >
        {view === 'list' ? (
          <ListView
            entries={entries}
            stars={stars}
            onToggleStar={onToggleStar}
            onSelectEntry={onSelectEntry}
            accent={accent}
            onOpenZipContents={onOpenZipContents}
            sortOption={sortOption}
            sortDirection={sortDirection}
            onSortChange={onSortChange}
          />
        ) : allEntries.length === 0 ? (
        <div
          style={{
            height: '100%',
            minHeight: '360px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              maxWidth: '460px',
              padding: '36px 30px',
              borderRadius: '20px',
              border: '1px dashed rgba(148, 188, 227, 0.25)',
              background: 'rgba(27, 36, 46, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                background: 'rgba(148, 188, 227, 0.1)',
                border: '1px solid rgba(148, 188, 227, 0.2)',
                display: 'grid',
                placeItems: 'center',
                fontSize: '24px',
                color: '#94bce3'
              }}
            >
              📁
            </div>
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 10px',
                  borderRadius: '99px',
                  background: 'rgba(56,239,125,.1)',
                  border: '1px solid rgba(56,239,125,.3)',
                  color: '#38ef7d',
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: '9.5px',
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  marginBottom: '10px'
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#38ef7d',
                    boxShadow: '0 0 6px rgba(56,239,125,.7)'
                  }}
                />
                SQLite WAL Active · D:\Archive\archive.db
              </div>
              <div
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700,
                  fontSize: '26px',
                  letterSpacing: '.04em',
                  textTransform: 'uppercase',
                  color: '#e9edf2'
                }}
              >
                Archive is empty
              </div>
              <div
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: '11px',
                  color: 'rgba(233, 237, 242, 0.6)',
                  marginTop: '6px',
                  lineHeight: 1.5
                }}
              >
                Zero mock assets. Ready for your 20 years of creative assets. Ingest zips, drop loose files, or run the high-speed disk crawler into SQLite.
              </div>

            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '6px' }}>
              {onOpenModal && (
                <button
                  onClick={onOpenModal}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    border: '1px solid #416180',
                    color: '#f2f2f3',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: '14px',
                    fontWeight: 600,
                    letterSpacing: '.05em',
                    textTransform: 'uppercase',
                    background: 'linear-gradient(180deg, #6b91b6, #5980a6)',
                    boxShadow: '0 2px 0 #416180, 0 6px 14px rgba(65,97,128,.3)'
                  }}
                >
                  + Ingest Zips & Files
                </button>
              )}
              {(onOpenModal || onScanNativeFolder) && (
                <button
                  onClick={onOpenModal || onScanNativeFolder}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    border: '1px solid rgba(148, 188, 227, 0.3)',
                    background: 'transparent',
                    color: '#b5d9fd',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: '14px',
                    fontWeight: 600,
                    letterSpacing: '.05em',
                    textTransform: 'uppercase'
                  }}
                >
                  📁 Crawl Folder
                </button>
              )}
            </div>
            {onLoadDemoCatalog && (
              <button
                onClick={onLoadDemoCatalog}
                style={{
                  marginTop: '4px',
                  background: 'transparent',
                  border: 0,
                  cursor: 'pointer',
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: '10px',
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  color: 'rgba(148, 188, 227, 0.5)',
                  textDecoration: 'underline'
                }}
              >
                Optional: Load 54 reference demo assets
              </button>
            )}
          </div>
        </div>
      ) : entries.length === 0 ? (
        <div
          style={{
            height: '100%',
            minHeight: '280px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '40px 20px',
            color: 'rgba(233, 237, 242, 0.7)',
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: '12px',
            gap: '12px'
          }}
        >
          <div>
            No assets match {query ? `query "${query}"` : ''}{selectedPool ? ` in pool "${selectedPool}"` : ''}{selectedFolder ? ` in folder "${selectedFolder.path}"` : ''}
          </div>
          {onClearFilters && (
            <button
              onClick={onClearFilters}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                border: '1px solid rgba(148, 188, 227, 0.3)',
                background: 'rgba(148, 188, 227, 0.1)',
                color: '#b5d9fd',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '13px',
                fontWeight: 600,
                textTransform: 'uppercase',
                cursor: 'pointer'
              }}
            >
              Clear filter
            </button>
          )}
        </div>
      ) : (
        <div
          ref={stageRef}
          data-stage="1"
          style={{
            position: 'relative',
            width: '100%',
            perspective: '1500px',
            perspectiveOrigin: view === 'filmstrip' ? '33% 42%' : '50% 42%',
            transformStyle: 'preserve-3d',
            userSelect: 'none'
          }}
        >
          {allEntries.map((e) => {
            const isStarred = !!stars[e.id];
            const isSelected = !!selectedIds[e.id];
            const isCopied = copiedKey === e.id;

            return (
              <div
                key={e.id}
                ref={(el) => {
                  if (el) cardRefs.current.set(e.id, el);
                  else cardRefs.current.delete(e.id);
                }}
                data-card={e.id}
                onClick={(ev) => handleCardClick(e, ev)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '250px',
                  height: '300px',
                  opacity: 0,
                  transformStyle: 'preserve-3d',
                  willChange: 'transform, opacity',
                  cursor: 'pointer'
                }}
              >
                <div data-reveal="1" style={{ width: '100%', height: '100%' }}>
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '16px',
                      background: 'var(--surface, #ffffff)',
                      border: isSelected
                        ? '2px solid #5980a6'
                        : '1px solid rgba(var(--inkc, 29,31,32), .12)',
                      boxShadow: isSelected
                        ? '0 8px 24px rgba(89,128,166,.35)'
                        : '0 1px 2px rgba(43,43,45,.14)',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      transition:
                        'box-shadow .28s cubic-bezier(.16,1,.3,1), border-color .2s, transform .28s cubic-bezier(.16,1,.3,1)'
                    }}
                    onMouseEnter={(el) => {
                      el.currentTarget.style.boxShadow = '0 16px 34px rgba(43,43,45,.2)';
                      el.currentTarget.style.borderColor = '#94bce3';
                      el.currentTarget.style.transform = 'translateY(-3px)';
                    }}
                    onMouseLeave={(el) => {
                      el.currentTarget.style.boxShadow = isSelected
                        ? '0 8px 24px rgba(89,128,166,.35)'
                        : '0 1px 2px rgba(43,43,45,.14)';
                      el.currentTarget.style.borderColor = isSelected
                        ? '#5980a6'
                        : 'rgba(var(--inkc, 29,31,32), .12)';
                      el.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {/* Thumbnail Slot */}
                    <div
                      style={{
                        position: 'relative',
                        flex: 1,
                        minHeight: 0,
                        background:
                          'repeating-linear-gradient(135deg, rgba(89,128,166,.15) 0 4px, rgba(89,128,166,.04) 4px 9px)',
                        borderBottom: '1px solid rgba(var(--inkc, 29,31,32), .1)'
                      }}
                    >
                      {e.thumb ? (
                        <img
                          src={e.thumb}
                          alt={e.title}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: (e.exts && e.exts.includes('pdf')) || e.type === 'file' ? 'contain' : 'cover',
                            background: (e.exts && e.exts.includes('pdf')) ? '#ffffff' : 'transparent',
                            padding: (e.exts && e.exts.includes('pdf')) ? '8px' : '0',
                            opacity: 1
                          }}
                        />
                      ) : null}

                      {/* Format Kind Badge */}
                      <span
                        style={{
                          position: 'absolute',
                          left: '10px',
                          top: '9px',
                          padding: '3px 8px',
                          borderRadius: '7px',
                          background: isZipArchive(e) && !e.isZipInnerFile ? 'rgba(56,239,125,.22)' : 'rgba(29,45,61,.85)',
                          border: isZipArchive(e) && !e.isZipInnerFile ? '1px solid rgba(56,239,125,.45)' : '1px solid rgba(255,255,255,.08)',
                          color: isZipArchive(e) && !e.isZipInnerFile ? '#38ef7d' : '#e9edf2',
                          fontFamily: 'ui-monospace, Menlo, monospace',
                          fontSize: '9px',
                          fontWeight: isZipArchive(e) && !e.isZipInnerFile ? 700 : 400,
                          letterSpacing: '.1em',
                          textTransform: 'uppercase',
                          zIndex: 2
                        }}
                      >
                        {isZipArchive(e) && !e.isZipInnerFile
                          ? `📦 ZIP · ${e.fileCount || 'Multiple'} files`
                          : (KINDS[e.type]?.[0] || e.type)}
                      </span>

                      {/* Video Play Indicator on video thumbnails */}
                      {e.thumb && (e.type === 'video' || (e.exts && ['mp4', 'webm', 'mov', 'm4v'].some((x) => e.exts.includes(x)))) && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '10px',
                            right: '10px',
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            background: 'rgba(15, 23, 42, 0.75)',
                            backdropFilter: 'blur(6px)',
                            WebkitBackdropFilter: 'blur(6px)',
                            border: '1px solid rgba(255, 255, 255, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            fontSize: '10px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                            pointerEvents: 'none',
                            zIndex: 2,
                            paddingLeft: '2px'
                          }}
                        >
                          ▶
                        </div>
                      )}

                      {/* Explore Archive prompt bar on zip archives */}
                      {isZipArchive(e) && !e.isZipInnerFile && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '8px',
                            left: '10px',
                            right: '10px',
                            padding: '4px 10px',
                            borderRadius: '7px',
                            background: 'rgba(15,23,42,0.85)',
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            border: '1px solid rgba(56,239,125,0.3)',
                            color: '#b5d9fd',
                            fontFamily: 'ui-monospace, Menlo, monospace',
                            fontSize: '9.5px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            letterSpacing: '.04em',
                            zIndex: 2
                          }}
                        >
                          <span style={{ color: '#38ef7d', fontWeight: 600 }}>Explore Archive</span>
                          <span style={{ fontSize: '11px', color: '#38ef7d' }}>›</span>
                        </div>
                      )}

                      {/* Star Button */}
                      <span
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onToggleStar(e.id, ev);
                        }}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '7px',
                          width: '24px',
                          height: '24px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '13px',
                          color: isStarred ? accent : 'rgba(var(--inkc, 29,31,32), .35)',
                          background: 'var(--surface, rgba(255,255,255,.78))',
                          boxShadow: '0 1px 2px rgba(43,43,45,.14)',
                          cursor: 'pointer'
                        }}
                        title={isStarred ? 'Unstar' : 'Star'}
                      >
                        {isStarred ? '★' : '☆'}
                      </span>

                      {/* Center Placeholder Label if no thumbnail */}
                      {!e.thumb && (
                        <span
                          style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%,-50%)',
                            fontFamily: 'ui-monospace, Menlo, monospace',
                            fontSize: '9.5px',
                            letterSpacing: '.14em',
                            textTransform: 'uppercase',
                            color: 'rgba(var(--inkc, 29,45,61), .42)',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {KINDS[e.type]?.[1] || 'asset'} preview
                        </span>
                      )}

                      {/* Selection Outline Marker */}
                      <span
                        data-selmark="1"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          border: '2px solid #5980a6',
                          opacity: isSelected ? 1 : 0,
                          pointerEvents: 'none',
                          transition: 'opacity 0.2s'
                        }}
                      />
                    </div>

                    {/* Card Content Footer */}
                    <div
                      style={{
                        flex: 'none',
                        padding: '11px 13px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '7px'
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontWeight: 600,
                          fontSize: '18px',
                          lineHeight: 1.08,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}
                      >
                        {e.title}
                      </div>

                      {/* Tag Chips */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        <span
                          style={{
                            padding: '3px 9px',
                            borderRadius: '99px',
                            fontFamily: 'ui-monospace, Menlo, monospace',
                            fontSize: '9.5px',
                            letterSpacing: '.04em',
                            textTransform: 'uppercase',
                            background: 'var(--tint, #eef6ff)',
                            color: 'var(--tint-ink, #2c455d)',
                            border: '1px solid rgba(89,128,166,.28)'
                          }}
                        >
                          {e.cat}
                        </span>
                        {e.deps &&
                          e.deps
                            .split(' · ')
                            .slice(0, 2)
                            .map((d) => (
                              <span
                                key={d}
                                style={{
                                  padding: '3px 9px',
                                  borderRadius: '99px',
                                  fontFamily: 'ui-monospace, Menlo, monospace',
                                  fontSize: '9.5px',
                                  letterSpacing: '.04em',
                                  textTransform: 'uppercase',
                                  background: 'var(--tint, #eef6ff)',
                                  color: 'var(--tint-ink, #2c455d)',
                                  border: '1px solid rgba(89,128,166,.28)'
                                }}
                              >
                                {d}
                              </span>
                            ))}
                      </div>

                      {/* Byline & Copy Action */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontFamily: 'ui-monospace, Menlo, monospace',
                          fontSize: '9.5px',
                          color: 'rgba(var(--inkc, 29,31,32), .5)'
                        }}
                      >
                        <span
                          style={{
                            flex: 1,
                            minWidth: 0,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {e.author} · {e.date}
                        </span>
                        <span
                          onClick={(ev) => handleCopy(`${e.title} — ${KINDS[e.type]?.[0]}`, e.id, ev)}
                          style={{
                            padding: '3px 7px',
                            borderRadius: '7px',
                            background: 'var(--well, #e9e9ea)',
                            color: 'var(--tint-ink, #416180)',
                            letterSpacing: '.06em',
                            textTransform: 'uppercase',
                            cursor: 'pointer'
                          }}
                        >
                          {isCopied ? 'copied' : 'copy'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
};
