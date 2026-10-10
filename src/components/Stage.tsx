import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { AssetEntry, Density, ViewMode, WatchedFolder, SortOption, SortDirection, ThemeMode, ListColumns, ListOrder } from '../types';
import { KINDS } from '../data/seedData';
import { ListView } from './ListView';
import { isZipArchive } from '../services/zipService';
import { computeItemWatermark, getInitialGlyph, getSortDisplayInfo, SORT_CONFIGS } from '../services/sortService';

interface StageProps {
  theme?: ThemeMode;
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
  isPreviewOpen?: boolean;
  isStudioMode?: boolean;
  listColumns?: ListColumns;
  listOrder?: ListOrder;
  onListColumnsChange?: (cols: ListColumns) => void;
  onListOrderChange?: (order: ListOrder) => void;
}

const getCardDepthStyling = (
  ad: number,
  isSelected: boolean,
  isCarousel: boolean,
  isLight: boolean,
  isBlack: boolean = false
) => {

  if (!isCarousel) {
    if (isBlack) {
      return {
        border: isSelected
          ? '2px solid #ffffff'
          : '1px solid rgba(255, 255, 255, 0.14)',
        borderColor: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.14)',
        boxShadow: isSelected
          ? '0 0 0 2px #ffffff, 0 8px 30px rgba(0, 0, 0, 0.95)'
          : '0 4px 14px rgba(0, 0, 0, 0.6), 0 1px 3px rgba(0, 0, 0, 0.4)'
      };
    }
    return {
      border: isSelected
        ? '2px solid #5980a6'
        : (isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(233, 237, 242, 0.18)'),
      borderColor: isSelected
        ? '#5980a6'
        : (isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(233, 237, 242, 0.18)'),
      boxShadow: isSelected
        ? (isLight ? '0 8px 24px rgba(37, 99, 235, 0.35), 0 2px 6px rgba(15, 23, 42, 0.08)' : '0 8px 24px rgba(89, 128, 166, 0.4), 0 2px 6px rgba(0, 0, 0, 0.25)')
        : (isLight ? '0 2px 10px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04)' : '0 4px 14px rgba(0, 0, 0, 0.26), 0 1px 3px rgba(0, 0, 0, 0.16)')
    };
  }

  // 2. Carousel views:
  let borderColor: string;
  let boxShadow: string;

  if (isBlack) {
    if (ad === 0) {
      borderColor = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.75)';
      boxShadow = isSelected
        ? '0 0 0 2px #ffffff, 0 10px 36px rgba(0, 0, 0, 0.95), inset 0 1px 0 rgba(255, 255, 255, 0.4)'
        : '0 8px 24px -2px rgba(0, 0, 0, 0.8), 0 2px 8px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
    } else {
      borderColor = isSelected ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.14)';
      boxShadow = isSelected
        ? '0 12px 32px rgba(0, 0, 0, 0.9), 0 0 24px rgba(255, 255, 255, 0.3)'
        : '0 10px 28px rgba(0, 0, 0, 0.75)';
    }
  } else if (isLight) {
    if (ad === 0) {
      borderColor = isSelected ? '#2563eb' : 'rgba(37, 99, 235, 0.45)';
      boxShadow = isSelected
        ? '0 8px 28px rgba(37, 99, 235, 0.35), 0 2px 8px rgba(15, 23, 42, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.9)'
        : '0 6px 20px -2px rgba(15, 23, 42, 0.09), 0 2px 6px rgba(15, 23, 42, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.9)';
    } else {
      borderColor = isSelected ? 'rgba(37, 99, 235, 0.75)' : 'rgba(15, 23, 42, 0.08)';
      boxShadow = isSelected
        ? '0 8px 24px rgba(37, 99, 235, 0.3), 0 0 20px rgba(37, 99, 235, 0.2)'
        : '0 4px 16px rgba(15, 23, 42, 0.08)';
    }
  } else {
    if (ad === 0) {
      borderColor = isSelected ? '#5980a6' : 'rgba(255, 255, 255, 0.55)';
      boxShadow = isSelected
        ? '0 8px 28px rgba(89, 128, 166, 0.5), 0 2px 8px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
        : '0 6px 18px -2px rgba(0, 0, 0, 0.34), 0 2px 6px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.22)';
    } else {
      borderColor = isSelected ? 'rgba(89, 128, 166, 0.85)' : 'rgba(255, 255, 255, 0.12)';
      boxShadow = isSelected
        ? '0 10px 28px rgba(0, 0, 0, 0.7), 0 0 22px rgba(89, 128, 166, 0.35)'
        : '0 8px 24px rgba(0, 0, 0, 0.45)';
    }
  }

  const border = `${isSelected ? 2 : 1}px solid ${borderColor}`;
  return { border, borderColor, boxShadow };
};

interface CardTarget {
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

interface CarouselGeometry {
  cx: number;
  cy: number;
  cw2: number;
  ch2: number;
}

// Cards further than this from the focused card are invisible in every carousel view (max visible distance is 6),
// so gesture-driven moves only need to touch cards inside this window instead of every card on the page.
const CAROUSEL_WINDOW = 7;

// Pure carousel layout: where card `i` sits when card `focus` is centred. Shared by the React layout effect
// and the imperative wheel/drag path so both always agree on positions.
const computeCarouselTarget = (view: ViewMode, i: number, focus: number, g: CarouselGeometry): CardTarget => {
  const { cx, cy, cw2, ch2 } = g;
  const d = i - focus;
  const ad = Math.abs(d);
  const t: CardTarget = { x: cx, y: cy, w: cw2, h: ch2, rY: 0, rX: 0, rZ: 0, z: 0, s: 1, o: 1, zi: 200 - ad * 2 };

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
    t.y = cy + d * (ch2 * 0.34);
    t.x = cx + ad * 14;
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
  return t;
};

interface StageWatermarkProps {
  entries: AssetEntry[];
  focusIndex: number;
  view: ViewMode;
  density: Density;
  sortOption?: SortOption;
  isCarousel: boolean;
  wrapRef: React.RefObject<HTMLDivElement>;
  stageRef: React.RefObject<HTMLDivElement>;
  motionMultiplier: number;
  isBlack: boolean;
  isLight: boolean;
  isDocked56vw: boolean;
  leftoverCenter: number;
}

const StageWatermark: React.FC<StageWatermarkProps> = React.memo(({
  entries,
  focusIndex,
  view,
  density,
  sortOption,
  isCarousel,
  wrapRef,
  stageRef,
  motionMultiplier,
  isBlack,
  isLight,
  isDocked56vw,
  leftoverCenter
}) => {
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
    exitSide: number;
    returnSide: number;
    animKey: number;
  }>({
    current: '',
    exiting: null,
    dir: 1,
    axis: 'Y',
    exitSide: -1,
    returnSide: 1,
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
    const lastExitedIdx = Math.max(0, focusIndex - 1);
    const exitSide = (lastExitedIdx % 2 === 0) ? -1 : 1;
    const returnSide = (focusIndex % 2 === 0) ? -1 : 1;
    setWatermarkState((prev) => ({
      current: mark,
      exiting: oldMark || null,
      dir,
      axis,
      exitSide,
      returnSide,
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
        const exitSide = watermarkState.exitSide;
        if (dir === 1) {
          gsap.fromTo(
            exitEl,
            { opacity: 1, x: 0, y: 0, rotateZ: 0, scale: 1 },
            {
              opacity: 0,
              x: exitSide * 180,
              y: -50,
              rotateZ: exitSide * 16,
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
          const returnSide = watermarkState.returnSide;
          gsap.fromTo(
            exitEl,
            { opacity: 1, x: 0, y: 0, rotateZ: 0, scale: 1 },
            {
              opacity: 0,
              x: -returnSide * 30,
              y: 20,
              rotateZ: -returnSide * 4,
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
        gsap.fromTo(
          currentEl,
          { opacity: 0, y: dir * 130, rotateX: -dir * 32, scale: 0.94 },
          { opacity: 1, y: 0, rotateX: 0, scale: 1, duration: 0.52 * m, ease: 'power3.out', overwrite: true }
        );
      } else if (view === 'peel') {
        const exitSide = watermarkState.exitSide;
        const returnSide = watermarkState.returnSide;
        if (dir === 1) {
          gsap.fromTo(
            currentEl,
            { opacity: 0, x: -exitSide * 30, y: 20, rotateZ: -exitSide * 4, scale: 0.90 },
            { opacity: 1, x: 0, y: 0, rotateZ: 0, scale: 1, duration: 0.52 * m, ease: 'power3.out', overwrite: true }
          );
        } else {
          gsap.fromTo(
            currentEl,
            { opacity: 0, x: returnSide * 180, y: -50, rotateZ: returnSide * 16, scale: 0.92 },
            { opacity: 1, x: 0, y: 0, rotateZ: 0, scale: 1, duration: 0.52 * m, ease: 'power3.out', overwrite: true }
          );
        }
      } else if (view === 'radial') {
        gsap.fromTo(
          currentEl,
          { opacity: 0, x: dir * 170, y: 65, rotateZ: dir * 14, rotateY: -dir * 18, scale: 0.92 },
          { opacity: 1, x: 0, y: 0, rotateZ: 0, rotateY: 0, scale: 1, duration: 0.52 * m, ease: 'power3.out', overwrite: true }
        );
      } else if (view === 'coverflow') {
        gsap.fromTo(
          currentEl,
          { opacity: 0, x: dir * 160, rotateY: -dir * 42, scale: 0.93 },
          { opacity: 1, x: 0, rotateY: 0, scale: 1, duration: 0.52 * m, ease: 'power3.out', overwrite: true }
        );
      } else if (view === 'strip') {
        gsap.fromTo(
          currentEl,
          { opacity: 0, x: dir * 180, scale: 0.93 },
          { opacity: 1, x: 0, scale: 1, duration: 0.5 * m, ease: 'power3.out', overwrite: true }
        );
      } else {
        gsap.fromTo(
          currentEl,
          { opacity: 0, y: dir * 120, rotateX: -dir * 28, scale: 0.94 },
          { opacity: 1, y: 0, rotateX: 0, scale: 1, duration: 0.52 * m, ease: 'power3.out', overwrite: true }
        );
      }
    }
  }, [watermarkState.animKey, motionMultiplier, view]);

  const isFilmstrip = view === 'filmstrip';
  const isListView = view === 'list';

  if (!watermarkState.current && !watermarkState.exiting) return null;

  return (
    <div
      aria-hidden="true"
      className="watermark-backdrop"
      style={{
        perspectiveOrigin: isDocked56vw
          ? `${leftoverCenter}px 50%`
          : (isFilmstrip ? '67% 50%' : '50% 50%')
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
            left: isDocked56vw ? `${leftoverCenter}px` : (isFilmstrip ? '67%' : '50%'),
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
              opacity: isBlack ? (isListView ? 0.05 : 0.035) : (isListView ? 0.08 : 0.05),
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
              opacity: isBlack ? (isListView ? 0.18 : 0.15) : (isListView ? 0.26 : 0.25),
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
            left: isDocked56vw ? `${leftoverCenter}px` : (isFilmstrip ? '67%' : '50%'),
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
              opacity: isBlack ? (isListView ? 0.05 : 0.035) : (isListView ? 0.08 : 0.05),
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
              opacity: isBlack ? (isListView ? 0.18 : 0.15) : (isListView ? 0.26 : 0.25),
              transform: 'translateX(-50%) translateZ(20px)'
            }}
          >
            {watermarkState.current}
          </span>
        </div>
      )}
    </div>
  );
});

export const Stage: React.FC<StageProps> = React.memo(({
  theme,
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
  onSortChange,
  isPreviewOpen = false,
  isStudioMode = false,
  listColumns = 1,
  listOrder = 'down',
  onListColumnsChange,
  onListOrderChange
}) => {
  const isLight = theme === 'light';
  const isBlack = theme === 'black';
  const rootRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const ioRef = useRef<IntersectionObserver | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [stageWidth, setStageWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? Math.max(300, window.innerWidth - 220) : 1200
  );
  const containerHeightRef = useRef<number>(800);
  const prevViewRef = useRef<ViewMode>(view);

  useEffect(() => {
    const updateDimensions = () => {
      const w = rootRef.current?.clientWidth || stageRef.current?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth - 220 : 1200);
      const h = wrapRef.current?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight - 180 : 800);
      setStageWidth(w);
      containerHeightRef.current = h;
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const isDocked56vw = !!isPreviewOpen && !isStudioMode;
  const panelWidth = Math.min(
    typeof window !== 'undefined' ? window.innerWidth * 0.96 : 1400,
    Math.max(580, typeof window !== 'undefined' ? window.innerWidth * 0.56 : 700)
  );
  const leftoverW = Math.max(0, stageWidth - panelWidth);
  const leftoverCenter = Math.max(120, Math.round(leftoverW / 2));

  const isPointerDownRef = useRef(false);
  const isDraggingRef = useRef(false);
  const hasMovedRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const dragStartFocusRef = useRef(0);
  const capturedPointerIdRef = useRef<number | null>(null);
  const wheelAccRef = useRef(0);
  const lastWheelTimeRef = useRef(0);
  const wheelVelocityRef = useRef(1);
  const scrollDurRef = useRef<number | null>(null);
  const isWheelingRef = useRef(false);
  const wheelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const motionMultiplierRef = useRef(motionMultiplier);
  motionMultiplierRef.current = motionMultiplier;

  // Keep live references to avoid re-binding listeners during continuous gestures
  const focusIndexRef = useRef(focusIndex);
  const focusIndexRef_curr = focusIndex;
  focusIndexRef.current = focusIndexRef_curr;

  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const viewRef = useRef(view);
  viewRef.current = view;

  const onFocusChangeRef = useRef(onFocusChange);
  onFocusChangeRef.current = onFocusChange;

  const isCarousel = ['coverflow', 'strip', 'radial', 'filmstrip', 'peel'].includes(view);

  // ---- Imperative carousel driver -------------------------------------------------------------
  // Wheel/drag gestures move the cards directly with GSAP. React's focusIndex (which lives in App and
  // re-renders the whole tree) is only committed once the gesture settles, so a scroll burst costs
  // a handful of tweens per step instead of a full App + Stage re-render and a tween for every card.
  const liveFocusRef = useRef(focusIndex);
  const prevFocusPropRef = useRef(focusIndex);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureCommitRef = useRef(false);
  const carouselGeomRef = useRef<CarouselGeometry | null>(null);
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const themeFlagsRef = useRef({ isLight, isBlack });
  themeFlagsRef.current = { isLight, isBlack };

  const moveCarouselTo = (target: number) => {
    const list = entriesRef.current;
    const maxIdx = list.length - 1;
    const geom = carouselGeomRef.current;
    if (maxIdx < 0 || !geom) return;
    const prev = Math.max(0, Math.min(maxIdx, liveFocusRef.current));
    const next = Math.max(0, Math.min(maxIdx, target));
    if (next === prev) return;
    liveFocusRef.current = next;

    const v = viewRef.current;
    const m = motionMultiplierRef.current;
    const sel = selectedIdsRef.current;
    const { isLight: lt, isBlack: bk } = themeFlagsRef.current;
    const lo = Math.max(0, Math.min(prev, next) - CAROUSEL_WINDOW);
    const hi = Math.min(maxIdx, Math.max(prev, next) + CAROUSEL_WINDOW);

    for (let i = lo; i <= hi; i++) {
      const entry = list[i];
      const el = cardRefs.current.get(entry.id);
      if (!el) continue;
      const isSel = !!sel[entry.id];
      const selScale = isSel ? 0.94 : 1;

      // Cards parked outside the old window hold stale positions; place them where they belong for the
      // old focus first so they glide in from the correct side instead of sweeping across the stage.
      if (Math.abs(i - prev) > CAROUSEL_WINDOW) {
        const p = computeCarouselTarget(v, i, prev, geom);
        gsap.set(el, { x: p.x, y: p.y, z: p.z, rotateY: p.rY, rotateX: p.rX, rotateZ: p.rZ, scale: p.s * selScale, opacity: p.o });
      }

      const t = computeCarouselTarget(v, i, next, geom);
      el.style.zIndex = String(t.zi);
      el.style.pointerEvents = t.o === 0 ? 'none' : 'auto';
      el.style.willChange = t.o === 0 ? 'auto' : 'transform, opacity';

      const depth = getCardDepthStyling(Math.abs(i - next), isSel, true, lt, bk);
      const inner = el.firstElementChild?.firstElementChild as HTMLElement | null;
      if (inner) {
        if (inner.style.border !== depth.border) inner.style.border = depth.border;
        if (inner.style.boxShadow !== depth.boxShadow) inner.style.boxShadow = depth.boxShadow;
      }

      gsap.to(el, {
        x: t.x,
        y: t.y,
        z: t.z,
        rotateY: t.rY,
        rotateX: t.rX,
        rotateZ: t.rZ,
        scale: t.s * selScale,
        opacity: t.o,
        duration: 0.34 * m,
        ease: 'power3.out',
        overwrite: true
      });
    }
  };

  // Commit the live focus to React once the gesture goes quiet (updates watermark, toolbar, preview etc.).
  // Waits until the settle tween has finished so the single React render never lands mid-motion.
  const scheduleFocusCommit = () => {
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    const delay = Math.max(220, 340 * motionMultiplierRef.current + 60);
    commitTimerRef.current = setTimeout(() => {
      commitTimerRef.current = null;
      const f = liveFocusRef.current;
      if (f !== focusIndexRef.current) {
        gestureCommitRef.current = true;
        onFocusChangeRef.current(f);
      }
    }, delay);
  };

  useEffect(() => () => {
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
  }, []);

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
      // A click supersedes any pending gesture commit
      if (commitTimerRef.current) {
        clearTimeout(commitTimerRef.current);
        commitTimerRef.current = null;
      }
      if (isCarousel) {
        moveCarouselTo(idx);
        if (idx !== focusIndex) gestureCommitRef.current = true;
      }
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
      dragStartFocusRef.current = liveFocusRef.current;
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
      if (newFocus !== liveFocusRef.current) {
        moveCarouselTo(newFocus);
        scheduleFocusCommit();
      } else if (commitTimerRef.current) {
        scheduleFocusCommit(); // still dragging: don't let React re-render mid-gesture
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
      
      isWheelingRef.current = true;
      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
      wheelTimeoutRef.current = setTimeout(() => {
        isWheelingRef.current = false;
      }, 150);

      // Normalise to pixels: Firefox reports lines (deltaMode 1), some devices report pages (deltaMode 2)
      let dx = e.deltaX;
      let dy = e.deltaY;
      if (e.deltaMode === 1) {
        dx *= 33;
        dy *= 33;
      } else if (e.deltaMode === 2) {
        dx *= 100;
        dy *= 100;
      }
      const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      if (!delta) return;

      // Start a fresh gesture after a pause or on direction reversal so old remainder never fights new input
      const now = performance.now();
      const fresh =
        now - lastWheelTimeRef.current > 220 || Math.sign(delta) !== Math.sign(wheelAccRef.current || delta);
      if (fresh) wheelAccRef.current = 0;
      lastWheelTimeRef.current = now;

      // Mouse-wheel notches (~100px) step one card each; small trackpad deltas accumulate at a finer pitch.
      // The remainder is kept (not thrown away) and several cards can advance from one big event.
      const isNotch = Math.abs(delta) >= 50;
      const unit = isNotch ? 100 : 40;
      wheelAccRef.current = (wheelAccRef.current || 0) + delta;
      let steps = Math.trunc(wheelAccRef.current / unit);
      if (steps === 0 && fresh && isNotch) steps = Math.sign(delta); // first notch always responds instantly
      wheelAccRef.current -= steps * unit;
      if (Math.sign(wheelAccRef.current) === -Math.sign(delta)) wheelAccRef.current = 0;
      steps = Math.max(-6, Math.min(6, steps));
      if (!steps) {
        // Gesture still in progress (sub-step trackpad delta): keep postponing the React commit
        if (commitTimerRef.current) scheduleFocusCommit();
        return;
      }

      moveCarouselTo(liveFocusRef.current + steps);
      scheduleFocusCommit();
    };

    // Arrow keys are handled in App against React's focusIndex: flush any pending gesture commit first
    // (capture phase runs before App's listener; both updates batch, so the key steps from the live card).
    const onKeyDownCapture = () => {
      if (!commitTimerRef.current) return;
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
      if (liveFocusRef.current !== focusIndexRef.current) onFocusChangeRef.current(liveFocusRef.current);
    };

    wr.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDownCapture, true);
    return () => {
      wr.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDownCapture, true);
    };
  }, [isCarousel]);

  // Main Layout Choreography with GSAP
  useEffect(() => {
    const st = stageRef.current;
    const wr = wrapRef.current;
    if (!st || !wr || view === 'list') return;

    const W = stageWidth;
    const displayH = containerHeightRef.current || wr.clientHeight || 800;
    const m = motionMultiplier;
    const clampFocus = (f: number) => Math.max(0, Math.min(f, entries.length - 1));

    // Resolve which focus to lay out. A focusIndex change that did NOT come from our own gesture commit
    // (keyboard, filters, page change...) wins and cancels any pending commit. Otherwise keep the live
    // on-screen focus so an unrelated re-render mid-gesture never snaps the carousel back.
    const focusPropChanged = focusIndex !== prevFocusPropRef.current;
    prevFocusPropRef.current = focusIndex;
    const fromGesture = gestureCommitRef.current;
    gestureCommitRef.current = false;
    if (focusPropChanged && !fromGesture) {
      if (commitTimerRef.current) {
        clearTimeout(commitTimerRef.current);
        commitTimerRef.current = null;
      }
      liveFocusRef.current = focusIndex;
    }
    const focus = isCarousel ? clampFocus(liveFocusRef.current) : clampFocus(focusIndex);
    liveFocusRef.current = focus;

    const T: Record<string, CardTarget> = {};

    let stageH = displayH;

    if (view === 'grid') {
      wr.style.overflowY = 'scroll';
      wr.style.overflowX = 'hidden';
      const gridW = isDocked56vw ? leftoverW : st.clientWidth;
      const cols = isDocked56vw ? Math.max(1, Math.min(density, 3)) : density;
      const gap = 18;
      const cw = Math.max(120, Math.floor((gridW - gap * (cols - 1)) / cols));
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

      const activeW = isDocked56vw ? leftoverW : st.clientWidth;
      const cw2 = Math.min(300, Math.max(200, activeW * 0.22));
      const ch2 = Math.round(cw2 * 1.3);
      const cx = (isDocked56vw ? leftoverCenter : activeW / 2) - cw2 / 2;
      const cy = Math.max(6, (displayH - ch2) / 2);
      const geom: CarouselGeometry = { cx, cy, cw2, ch2 };
      carouselGeomRef.current = geom;

      entries.forEach((e, i) => {
        T[e.id] = computeCarouselTarget(view, i, focus, geom);
      });
    }

    st.style.height = `${view === 'grid' ? stageH : displayH}px`;

    // React is only catching up with a wheel/drag/click the imperative driver already animated:
    // the cards are already heading to these exact targets, so don't restart a tween on every card.
    const skipCardTweens = fromGesture && isCarousel && prevViewRef.current === view;

    const dur = 0.72 * m;
    const ease = view === 'strip' ? 'elastic.out(0.55, 0.72)' : 'expo.out';

    if (!skipCardTweens) entries.forEach((entry, idxInVis) => {
      const el = cardRefs.current.get(entry.id);
      if (!el) return;

      const t = T[entry.id];
      const isSelected = !!selectedIds[entry.id];

      if (!t) return;

      el.style.pointerEvents = t.o === 0 ? 'none' : 'auto';
      el.style.width = `${t.w}px`;
      el.style.height = `${t.h}px`;
      el.style.zIndex = String(t.zi);
      // Hidden carousel cards don't need their own compositor layer
      el.style.willChange = isCarousel && t.o === 0 ? 'auto' : 'transform, opacity';

      const ad = isCarousel ? Math.abs(idxInVis - focus) : 0;
      const depth = getCardDepthStyling(ad, isSelected, isCarousel, isLight, isBlack);

      const innerSurface = (el.firstElementChild?.firstElementChild || el.querySelector('[data-reveal] > div')) as HTMLElement | null;
      if (innerSurface) {
        if (innerSurface.style.border !== depth.border) innerSurface.style.border = depth.border;
        if (innerSurface.style.boxShadow !== depth.boxShadow) innerSurface.style.boxShadow = depth.boxShadow;
      }

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
        overwrite: true,
        delay: isCarousel ? 0 : Math.min(idxInVis * 0.016 * m, 0.5)
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
    } else if (prevViewRef.current === 'grid') {
      document.querySelectorAll('[data-reveal]').forEach((r) => {
        gsap.set(r, { opacity: 1, y: 0, rotateX: 0 });
      });
    }
    prevViewRef.current = view;
  }, [entries, view, density, focusIndex, selectedIds, motionMultiplier, isPreviewOpen, isStudioMode, stageWidth]);

  // Clean up detached card refs when entries change to prevent memory leaks and zombie tweens
  useEffect(() => {
    const activeIds = new Set(entries.map((e) => e.id));
    for (const [id, el] of cardRefs.current.entries()) {
      if (!activeIds.has(id)) {
        gsap.killTweensOf(el);
        cardRefs.current.delete(id);
      }
    }
  }, [entries]);

  // Magnetic hover effect when pool in rail is hovered
  const prevHoverPoolRef = useRef<string | null>(null);
  useEffect(() => {
    if (!hoverPool && !prevHoverPoolRef.current) return;
    prevHoverPoolRef.current = hoverPool;

    entries.forEach((entry) => {
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
  }, [hoverPool, entries, motionMultiplier]);

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Background Watermark/Glyph isolated from Stage renders */}
      <StageWatermark
        entries={entries}
        focusIndex={focusIndex}
        view={view}
        density={density}
        sortOption={sortOption}
        isCarousel={isCarousel}
        wrapRef={wrapRef}
        stageRef={stageRef}
        motionMultiplier={motionMultiplier}
        isBlack={isBlack}
        isLight={isLight}
        isDocked56vw={isDocked56vw}
        leftoverCenter={leftoverCenter}
      />

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
          padding: view === 'list'
            ? (isDocked56vw ? '6px 12px 120px' : '6px 26px 120px')
            : view === 'grid'
            ? '6px 26px 120px'
            : '0 26px',
          marginRight: (view === 'list' && isDocked56vw) ? `${panelWidth}px` : 0,
          transition: 'margin-right 0.45s cubic-bezier(0.16, 1, 0.3, 1), padding 0.45s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {view === 'list' ? (
          <ListView
            theme={theme}
            entries={entries}
            stars={stars}
            onToggleStar={onToggleStar}
            onSelectEntry={onSelectEntry}
            accent={accent}
            onOpenZipContents={onOpenZipContents}
            sortOption={sortOption}
            sortDirection={sortDirection}
            onSortChange={onSortChange}
            listColumns={listColumns}
            listOrder={listOrder}
            onListColumnsChange={onListColumnsChange}
            onListOrderChange={onListOrderChange}
            isPreviewOpen={isPreviewOpen}
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
              border: isLight ? '1px dashed rgba(15, 23, 42, 0.2)' : '1px dashed rgba(148, 188, 227, 0.25)',
              background: isLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(27, 36, 46, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px',
              boxShadow: isLight ? '0 10px 30px rgba(15, 23, 42, 0.08)' : '0 20px 40px rgba(0,0,0,0.3)'
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                background: isLight ? 'rgba(37, 99, 235, 0.08)' : 'rgba(148, 188, 227, 0.1)',
                border: isLight ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid rgba(148, 188, 227, 0.2)',
                display: 'grid',
                placeItems: 'center',
                fontSize: '24px',
                color: isLight ? 'var(--tint-ink, #1d4ed8)' : '#94bce3'
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
                  background: isBlack ? 'rgba(255, 255, 255, 0.08)' : 'rgba(56,239,125,.1)',
                  border: isBlack ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(56,239,125,.3)',
                  color: isBlack ? '#ffffff' : '#38ef7d',
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
                    background: isBlack ? '#ffffff' : '#38ef7d',
                    boxShadow: isBlack ? '0 0 6px rgba(255,255,255,.7)' : '0 0 6px rgba(56,239,125,.7)'
                  }}
                />
                SQLite WAL Active · archive.db
              </div>
              <div
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700,
                  fontSize: '26px',
                  letterSpacing: '.04em',
                  textTransform: 'uppercase',
                  color: isLight ? '#0f172a' : '#e9edf2'
                }}
              >
                Archive is empty
              </div>
              <div
                style={{
                  fontFamily: 'ui-monospace, Menlo, monospace',
                  fontSize: '11px',
                  color: isLight ? 'rgba(15, 23, 42, 0.65)' : 'rgba(233, 237, 242, 0.6)',
                  marginTop: '6px',
                  lineHeight: 1.5
                }}
              >
                Nothing indexed yet. Ingest a zip, drop loose files, or scan a folder to build your library.
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
                    border: isBlack ? '1px solid rgba(255, 255, 255, 0.3)' : (isLight ? '1px solid rgba(15, 23, 42, 0.15)' : '1px solid #416180'),
                    color: isLight ? '#ffffff' : '#f2f2f3',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: '14px',
                    fontWeight: 600,
                    letterSpacing: '.05em',
                    textTransform: 'uppercase',
                    background: isBlack ? 'linear-gradient(180deg, #262626, #141414)' : (isLight ? 'linear-gradient(180deg, #3b82f6, #2563eb)' : 'linear-gradient(180deg, #6b91b6, #5980a6)'),
                    boxShadow: isBlack ? '0 2px 0 rgba(255,255,255,0.15), 0 6px 14px rgba(0,0,0,0.6)' : (isLight ? '0 2px 8px rgba(37,99,235,.25)' : '0 2px 0 #416180, 0 6px 14px rgba(65,97,128,.3)')
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
                    border: isBlack ? '1px solid rgba(255, 255, 255, 0.25)' : (isLight ? '1px solid rgba(15, 23, 42, 0.16)' : '1px solid rgba(148, 188, 227, 0.3)'),
                    background: 'transparent',
                    color: isBlack ? '#ffffff' : (isLight ? 'var(--tint-ink, #1d4ed8)' : '#b5d9fd'),
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
                  color: isBlack ? '#ffffff' : (isLight ? 'var(--tint-ink, #1d4ed8)' : 'rgba(148, 188, 227, 0.5)'),
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
            color: isLight ? 'rgba(15, 23, 42, 0.7)' : 'rgba(233, 237, 242, 0.7)',
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
                border: isBlack ? '1px solid rgba(255, 255, 255, 0.25)' : (isLight ? '1px solid rgba(15, 23, 42, 0.15)' : '1px solid rgba(148, 188, 227, 0.3)'),
                background: isBlack ? 'rgba(255, 255, 255, 0.08)' : (isLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(148, 188, 227, 0.1)'),
                color: isBlack ? '#ffffff' : (isLight ? 'var(--tint-ink, #1d4ed8)' : '#b5d9fd'),
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
            perspectiveOrigin: isDocked56vw
              ? `${leftoverCenter}px 50%`
              : (view === 'filmstrip' ? '33% 50%' : '50% 50%'),
            userSelect: 'none'
          }}
        >
          {entries.map((e, idxInEntries) => {
            const isStarred = !!stars[e.id];
            const isSelected = !!selectedIds[e.id];
            const isCopied = copiedKey === e.id;
            const focus = Math.max(0, Math.min(focusIndex, entries.length - 1));
            const ad = isCarousel ? Math.abs(idxInEntries - focus) : 0;
            const depth = getCardDepthStyling(ad, isSelected, isCarousel, isLight, isBlack);
            const sortInfo = getSortDisplayInfo(e, sortOption);
            const sortMeta = SORT_CONFIGS[sortOption] || SORT_CONFIGS.name;

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
                      background: 'var(--surface, #1b242e)',
                      border: depth.border,
                      boxShadow: depth.boxShadow,
                      cursor: 'pointer',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      transition:
                        'box-shadow .32s cubic-bezier(.16,1,.3,1), border-color .24s, transform .28s cubic-bezier(.16,1,.3,1)'
                    }}
                    onMouseEnter={(el) => {
                      if (isWheelingRef.current) return;
                      el.currentTarget.style.boxShadow = isSelected
                        ? (isBlack ? '0 16px 36px rgba(0,0,0,.95), 0 0 24px rgba(255,255,255,.4)' : isLight ? '0 16px 36px rgba(37,99,235,.4), 0 0 20px rgba(37,99,235,.2)' : '0 16px 36px rgba(89,128,166,.5), 0 0 20px rgba(89,128,166,.3)')
                        : (isBlack ? '0 20px 48px rgba(0,0,0,.9), 0 0 0 1px rgba(255,255,255,.6)' : isLight ? '0 16px 36px rgba(15,23,42,.15), 0 0 0 1px rgba(37,99,235,.5)' : '0 20px 48px rgba(0,0,0,.65), 0 0 0 1px rgba(181,217,253,.6)');
                      el.currentTarget.style.borderColor = isBlack ? '#ffffff' : (isLight ? '#2563eb' : '#b5d9fd');
                      el.currentTarget.style.transform = 'translateY(-3px)';
                    }}
                    onMouseLeave={(el) => {
                      if (isWheelingRef.current) return;
                      el.currentTarget.style.boxShadow = depth.boxShadow;
                      el.currentTarget.style.borderColor = depth.borderColor;
                      el.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {/* Thumbnail Slot */}
                    <div
                      style={{
                        position: 'relative',
                        flex: 1,
                        minHeight: 0,
                        background: isBlack
                          ? 'repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 4px, rgba(255,255,255,.01) 4px 9px)'
                          : (isLight
                          ? 'repeating-linear-gradient(135deg, rgba(37,99,235,.07) 0 4px, rgba(37,99,235,.02) 4px 9px)'
                          : 'repeating-linear-gradient(135deg, rgba(89,128,166,.15) 0 4px, rgba(89,128,166,.04) 4px 9px)'),
                        borderBottom: isBlack ? '1px solid rgba(255, 255, 255, 0.12)' : (isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(var(--inkc, 29,31,32), .1)')
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
                      ) : e.thumbNote ? (
                        // Why there is no preview ("Empty file", "Damaged — file is blank")
                        <span
                          style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0 14px',
                            textAlign: 'center',
                            fontFamily: 'ui-monospace, Menlo, monospace',
                            fontSize: '10px',
                            letterSpacing: '.04em',
                            color: isBlack ? 'rgba(255,255,255,.62)' : (isLight ? 'rgba(15,23,42,.6)' : 'rgba(233,237,242,.6)')
                          }}
                        >
                          {e.thumbNote}
                        </span>
                      ) : null}

                      {/* Format Kind Badge */}
                      <span
                        style={{
                          position: 'absolute',
                          left: '10px',
                          top: '9px',
                          padding: '3px 8px',
                          borderRadius: '7px',
                          background: isBlack
                            ? 'rgba(255, 255, 255, 0.08)'
                            : (isZipArchive(e) && !e.isZipInnerFile
                            ? (isLight ? 'rgba(34, 197, 94, 0.16)' : 'rgba(56,239,125,.22)')
                            : (isLight ? 'rgba(241, 245, 249, 0.92)' : 'rgba(29,45,61,.85)')),
                          border: isBlack
                            ? '1px solid rgba(255, 255, 255, 0.18)'
                            : (isZipArchive(e) && !e.isZipInnerFile
                            ? (isLight ? '1px solid rgba(34, 197, 94, 0.45)' : '1px solid rgba(56,239,125,.45)')
                            : (isLight ? '1px solid rgba(15, 23, 42, 0.12)' : '1px solid rgba(255,255,255,.08)')),
                          color: isBlack
                            ? '#ffffff'
                            : (isZipArchive(e) && !e.isZipInnerFile
                            ? (isLight ? '#15803d' : '#38ef7d')
                            : (isLight ? '#0f172a' : '#e9edf2')),
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
                            background: isBlack ? 'rgba(0,0,0,0.88)' : (isLight ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.85)'),
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            border: isBlack ? '1px solid rgba(255, 255, 255, 0.25)' : (isLight ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(56,239,125,0.3)'),
                            color: isBlack ? '#ffffff' : (isLight ? '#15803d' : '#b5d9fd'),
                            fontFamily: 'ui-monospace, Menlo, monospace',
                            fontSize: '9.5px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            letterSpacing: '.04em',
                            zIndex: 2
                          }}
                        >
                          <span style={{ color: isBlack ? '#ffffff' : (isLight ? '#15803d' : '#38ef7d'), fontWeight: 600 }}>Explore Archive</span>
                          <span style={{ fontSize: '11px', color: isBlack ? '#ffffff' : (isLight ? '#15803d' : '#38ef7d') }}>›</span>
                        </div>
                      )}

                      {/* Active Sort Metric Badge on Thumbnail */}
                      <span
                        style={{
                          position: 'absolute',
                          right: '38px',
                          top: '7px',
                          padding: '3px 8px',
                          borderRadius: '7px',
                          background: isBlack ? 'rgba(0, 0, 0, 0.9)' : (isLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(15, 23, 42, 0.88)'),
                          backdropFilter: 'blur(8px)',
                          WebkitBackdropFilter: 'blur(8px)',
                          border: isBlack ? '1px solid rgba(255, 255, 255, 0.28)' : (isLight ? '1px solid rgba(37, 99, 235, 0.35)' : '1px solid rgba(148, 188, 227, 0.45)'),
                          color: isBlack ? '#ffffff' : (isLight ? '#1d4ed8' : '#b5d9fd'),
                          fontFamily: 'ui-monospace, Menlo, monospace',
                          fontSize: '9.5px',
                          fontWeight: 700,
                          letterSpacing: '.04em',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          boxShadow: isLight ? '0 2px 6px rgba(15, 23, 42, 0.1)' : '0 2px 8px rgba(0, 0, 0, 0.4)',
                          zIndex: 2
                        }}
                        title={`Sorted by ${sortMeta.label}: ${sortInfo.full}`}
                      >
                        <span style={{ fontSize: '10px' }}>{sortMeta.icon}</span>
                        <span>{sortInfo.badge}</span>
                      </span>

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
                          color: isStarred ? (isBlack ? '#ffffff' : accent) : 'rgba(var(--inkc, 29,31,32), .35)',
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
                          border: isBlack ? '2px solid #ffffff' : (isLight ? '2px solid #2563eb' : '2px solid #5980a6'),
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
                        {/* Active Sort Attribute Pill */}
                        <span
                          style={{
                            padding: '3px 9px',
                            borderRadius: '99px',
                            fontFamily: 'ui-monospace, Menlo, monospace',
                            fontSize: '9.5px',
                            fontWeight: 700,
                            letterSpacing: '.04em',
                            textTransform: 'uppercase',
                            background: isBlack ? 'rgba(255, 255, 255, 0.1)' : (isLight ? 'rgba(37, 99, 235, 0.14)' : 'rgba(89, 128, 166, 0.35)'),
                            color: isBlack ? '#ffffff' : (isLight ? '#1d4ed8' : '#b5d9fd'),
                            border: isBlack ? '1px solid rgba(255, 255, 255, 0.25)' : (isLight ? '1px solid rgba(37, 99, 235, 0.45)' : '1px solid rgba(148, 188, 227, 0.55)'),
                            boxShadow: isLight ? '0 1px 3px rgba(37, 99, 235, 0.12)' : '0 1px 3px rgba(0, 0, 0, 0.3)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title={`Active Sort: ${sortMeta.label} (${sortInfo.full})`}
                        >
                          <span style={{ fontSize: '10px' }}>{sortMeta.icon}</span>
                          <span>{sortInfo.label}</span>
                        </span>

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
                            border: isBlack ? '1px solid rgba(255, 255, 255, 0.15)' : (isLight ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid rgba(89,128,166,.28)')
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
                                  border: isBlack ? '1px solid rgba(255, 255, 255, 0.15)' : (isLight ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid rgba(89,128,166,.28)')
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
                          title={`${e.author} · ${sortInfo.byline}`}
                        >
                          {e.author} · {sortInfo.byline}
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
});
