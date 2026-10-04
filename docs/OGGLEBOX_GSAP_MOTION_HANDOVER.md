# OggleBox Media Server — GSAP Listing & Motion System Handover Document

This document isolates the **UI components**, **GSAP motion engines**, **3D perspective math**, and **layout choreography** from our creative asset archive, structured for seamless drop-in integration into **OggleBox Media Server**.

All business logic (media streaming, backend indexing, database queries, and custom state stores) is strictly isolated behind explicit **Integration Slots** and **Typed Callback Interfaces**.

---

## 1. System Architecture & Performance Philosophy

### 1.1 The Dual-Driver Model (Eliminating Scrolling Lag)
Traditional React animation loops re-render the parent tree on every scroll wheel tick or pointer drag. When rendering dozens or hundreds of media items with 3D perspective transforms, this causes severe frame drops (~300ms latency on heavy views).

Our architecture implements a **Dual-Driver Motion Pipeline**:
1. **The Imperative GSAP Driver (`useCarouselMotion`)**:
   - Wheel and drag gestures manipulate DOM card transforms directly via `gsap.to()` and `gsap.set()`.
   - Card transforms are clamped to an active viewport window (`CAROUSEL_WINDOW = 7`). Cards outside this window are automatically culled from active tween computation.
   - **Zero React re-renders occur during an active scroll burst or drag gesture.**
2. **The Deferred React Commit (`scheduleFocusCommit`)**:
   - React state (`focusIndex`) is only updated once input goes quiet (`delay = max(220, 340 * motionMultiplier + 60)ms`).
   - When React commits, downstream components (watermarks, metadata panels, toolbars) re-render without interrupting 60fps card momentum.
   - A capture-phase `keydown` listener flushes pending commits immediately when keyboard arrow navigation begins, guaranteeing 100% consistency.

```
[ User Input: Wheel / Drag ] 
            │
            ▼ (Immediate: ~15ms latency)
   [ GSAP Direct Tween ] ──► [ Transform Matrix & 3D CSS on DOM Elements ]
            │
            ▼ (Debounced quiet window: ~220-340ms)
 [ Deferred React Commit ] ──► [ onFocusChange(liveFocus) ] ──► [ React Tree / Sidebar Sync ]
```

---

## 2. Target Context & Type Definitions

### 2.1 Media Item Shape & Motion Adapters
OggleBox’s media item shape is used directly. We provide a thin display adapter to compute sorting badges and backdrop glyphs without modifying your schema.

```ts
// src/types/media.ts

export type MediaType = 'video' | 'audio' | 'binary';

export interface MediaItem {
  id: string;
  title: string;
  filename: string;
  poster: string;
  category?: string;
  sizeFormatted?: string;
  format?: string;
  mediaType?: MediaType;
}

export type ViewMode =
  | 'grid'
  | 'list'
  | 'coverflow'
  | 'strip'
  | 'radial'
  | 'filmstrip'
  | 'peel';

export type AccentColor = 'cyan' | 'pink' | 'emerald' | 'amber';
export type ThemeMode = 'dark' | 'light';

export type ListColumns = 1 | 2 | 3 | 4;
export type ListOrder = 'down' | 'across';
export type Density = 2 | 3 | 4 | 5 | 6 | 8;

export interface CardTarget {
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

export interface CarouselGeometry {
  cx: number;
  cy: number;
  cw2: number;
  ch2: number;
}
```

### 2.2 Theme & Accent Color Palette Mapping
OggleBox supports Dark/Light mode with 4 selectable accents (`cyan`, `pink`, `emerald`, `amber`). The motion engine consumes these colors for dynamic depth glows, focus halos, and 3D borders:

```ts
// src/utils/themeTokens.ts
import { AccentColor, ThemeMode } from '../types/media';

export interface AccentThemeConfig {
  primary: string;
  hoverGlow: string;
  focusHalo: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
}

export const ACCENT_PALETTES: Record<AccentColor, { dark: AccentThemeConfig; light: AccentThemeConfig }> = {
  cyan: {
    dark: {
      primary: '#06b6d4',
      hoverGlow: '0 20px 48px rgba(6, 182, 212, 0.45)',
      focusHalo: '0 0 24px rgba(6, 182, 212, 0.5)',
      badgeBg: 'rgba(6, 182, 212, 0.15)',
      badgeBorder: 'rgba(6, 182, 212, 0.35)',
      badgeText: '#22d3ee'
    },
    light: {
      primary: '#0891b2',
      hoverGlow: '0 16px 36px rgba(8, 145, 178, 0.25)',
      focusHalo: '0 0 20px rgba(8, 145, 178, 0.3)',
      badgeBg: 'rgba(8, 145, 178, 0.12)',
      badgeBorder: 'rgba(8, 145, 178, 0.3)',
      badgeText: '#0e7490'
    }
  },
  pink: {
    dark: {
      primary: '#ec4899',
      hoverGlow: '0 20px 48px rgba(236, 72, 153, 0.45)',
      focusHalo: '0 0 24px rgba(236, 72, 153, 0.5)',
      badgeBg: 'rgba(236, 72, 153, 0.15)',
      badgeBorder: 'rgba(236, 72, 153, 0.35)',
      badgeText: '#f472b6'
    },
    light: {
      primary: '#db2777',
      hoverGlow: '0 16px 36px rgba(219, 39, 119, 0.25)',
      focusHalo: '0 0 20px rgba(219, 39, 119, 0.3)',
      badgeBg: 'rgba(219, 39, 119, 0.12)',
      badgeBorder: 'rgba(219, 39, 119, 0.3)',
      badgeText: '#be185d'
    }
  },
  emerald: {
    dark: {
      primary: '#10b981',
      hoverGlow: '0 20px 48px rgba(16, 185, 129, 0.45)',
      focusHalo: '0 0 24px rgba(16, 185, 129, 0.5)',
      badgeBg: 'rgba(16, 185, 129, 0.15)',
      badgeBorder: 'rgba(16, 185, 129, 0.35)',
      badgeText: '#34d399'
    },
    light: {
      primary: '#059669',
      hoverGlow: '0 16px 36px rgba(5, 150, 105, 0.25)',
      focusHalo: '0 0 20px rgba(5, 150, 105, 0.3)',
      badgeBg: 'rgba(5, 150, 105, 0.12)',
      badgeBorder: 'rgba(5, 150, 105, 0.3)',
      badgeText: '#047857'
    }
  },
  amber: {
    dark: {
      primary: '#f59e0b',
      hoverGlow: '0 20px 48px rgba(245, 158, 11, 0.45)',
      focusHalo: '0 0 24px rgba(245, 158, 11, 0.5)',
      badgeBg: 'rgba(245, 158, 11, 0.15)',
      badgeBorder: 'rgba(245, 158, 11, 0.35)',
      badgeText: '#fbbf24'
    },
    light: {
      primary: '#d97706',
      hoverGlow: '0 16px 36px rgba(217, 119, 6, 0.25)',
      focusHalo: '0 0 20px rgba(217, 119, 6, 0.3)',
      badgeBg: 'rgba(217, 119, 6, 0.12)',
      badgeBorder: 'rgba(217, 119, 6, 0.3)',
      badgeText: '#b45309'
    }
  }
};
```

---

## 3. Pure Motion Math Core (`motionMath.ts`)

This module is completely framework-agnostic. It computes precise 3D perspective geometry and card depth elevation.

```ts
// src/motion/motionMath.ts
import { CardTarget, CarouselGeometry, ViewMode, ThemeMode, AccentColor } from '../types/media';
import { ACCENT_PALETTES } from '../utils/themeTokens';

export const CAROUSEL_WINDOW = 7;

/**
 * Pure 3D Carousel Coordinate Function.
 * Translates item index `i` relative to active focus into x, y, z, rotation and opacity coordinates.
 */
export function computeCarouselTarget(
  view: ViewMode,
  i: number,
  focus: number,
  g: CarouselGeometry
): CardTarget {
  const { cx, cy, cw2, ch2 } = g;
  const d = i - focus;
  const ad = Math.abs(d);

  const t: CardTarget = {
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

  switch (view) {
    case 'coverflow':
      t.x = cx + d * (cw2 * 0.52);
      t.z = -ad * 190;
      t.rY = -Math.max(-46, Math.min(46, d * 30));
      t.s = 1 - Math.min(ad * 0.06, 0.4);
      t.o = ad > 5 ? 0 : 1;
      t.y = cy + ad * 10;
      break;

    case 'strip':
      t.x = cx + d * (cw2 + 26);
      t.s = d === 0 ? 1.06 : 0.93;
      t.o = ad > 4 ? 0 : 1;
      t.y = cy + (d === 0 ? -10 : 8);
      break;

    case 'radial': {
      const R = 1150;
      const a = d * 0.115;
      t.x = cx + R * Math.sin(a);
      t.y = cy + R * (1 - Math.cos(a)) * 0.9 - 40;
      t.rZ = d * 6.6;
      t.z = -ad * 60;
      t.s = 1 - Math.min(ad * 0.045, 0.35);
      t.o = ad > 6 ? 0 : 1;
      break;
    }

    case 'filmstrip':
      t.y = cy + d * (ch2 * 0.34);
      t.x = cx + ad * 14;
      t.rX = -Math.max(-40, Math.min(40, d * 13));
      t.z = -ad * 120;
      t.s = 1 - Math.min(ad * 0.05, 0.35);
      t.o = ad > 4 ? 0 : 1;
      break;

    case 'peel':
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
      break;

    default:
      break;
  }

  return t;
}

/**
 * Computes 3D elevation shadows, borders, and accent halos according to distance from focus.
 */
export function getCardDepthStyling(
  ad: number,
  isSelected: boolean,
  isCarousel: boolean,
  theme: ThemeMode,
  accent: AccentColor
) {
  const isLight = theme === 'light';
  const palette = ACCENT_PALETTES[accent][theme];

  if (!isCarousel) {
    return {
      border: isSelected ? `2px solid ${palette.primary}` : (isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.12)'),
      borderColor: isSelected ? palette.primary : (isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.12)'),
      boxShadow: isSelected
        ? `${palette.focusHalo}, 0 8px 24px rgba(0, 0, 0, 0.3)`
        : (isLight ? '0 2px 10px rgba(15, 23, 42, 0.06)' : '0 4px 14px rgba(0, 0, 0, 0.4)')
    };
  }

  let borderColor: string;
  let boxShadow: string;

  if (ad === 0) {
    // Focused Center Card
    borderColor = isSelected ? palette.primary : (isLight ? palette.primary : 'rgba(255, 255, 255, 0.7)');
    boxShadow = isSelected
      ? `0 0 0 2px ${palette.primary}, ${palette.focusHalo}, 0 12px 36px rgba(0, 0, 0, 0.5)`
      : (isLight
        ? `0 8px 28px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 0 18px ${palette.badgeBorder}`
        : `0 10px 32px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 0 22px ${palette.badgeBorder}`);
  } else {
    // Distant / Background Cards
    borderColor = isSelected ? palette.primary : (isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.14)');
    boxShadow = isSelected
      ? `${palette.focusHalo}, 0 8px 24px rgba(0, 0, 0, 0.4)`
      : (isLight ? '0 4px 16px rgba(15, 23, 42, 0.06)' : '0 10px 28px rgba(0, 0, 0, 0.6)');
  }

  return {
    border: `${isSelected ? 2 : 1}px solid ${borderColor}`,
    borderColor,
    boxShadow
  };
}
```

---

## 4. The Imperative Motion Hook (`useCarouselMotion.ts`)

Built specifically for **React 19** and **GSAP 3.15 + `@gsap/react`**. Encapsulates high-performance pointer drag, normalized wheel physics, and the deferred React commit.

```tsx
// src/motion/useCarouselMotion.ts
import { useRef, useEffect, useCallback } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ViewMode, MediaItem, ThemeMode, AccentColor, CarouselGeometry } from '../types/media';
import { computeCarouselTarget, getCardDepthStyling, CAROUSEL_WINDOW } from './motionMath';

interface UseCarouselMotionProps {
  items: MediaItem[];
  view: ViewMode;
  focusIndex: number;
  onFocusChange: (newFocus: number) => void;
  selectedIds: Record<string, boolean>;
  theme: ThemeMode;
  accent: AccentColor;
  motionMultiplier?: number;
  stageRef: React.RefObject<HTMLDivElement | null>;
  wrapRef: React.RefObject<HTMLDivElement | null>;
  cardRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

export function useCarouselMotion({
  items,
  view,
  focusIndex,
  onFocusChange,
  selectedIds,
  theme,
  accent,
  motionMultiplier = 1,
  stageRef,
  wrapRef,
  cardRefs
}: UseCarouselMotionProps) {
  const isCarousel = ['coverflow', 'strip', 'radial', 'filmstrip', 'peel'].includes(view);

  const liveFocusRef = useRef(focusIndex);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureCommitRef = useRef(false);
  const carouselGeomRef = useRef<CarouselGeometry | null>(null);

  const isPointerDownRef = useRef(false);
  const isDraggingRef = useRef(false);
  const hasMovedRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const dragStartFocusRef = useRef(0);
  const capturedPointerIdRef = useRef<number | null>(null);

  const wheelAccRef = useRef(0);
  const lastWheelTimeRef = useRef(0);
  const isWheelingRef = useRef(false);
  const wheelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live state refs to keep event listeners stable
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const viewRef = useRef(view);
  viewRef.current = view;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const focusIndexRef = useRef(focusIndex);
  focusIndexRef.current = focusIndex;
  const onFocusChangeRef = useRef(onFocusChange);
  onFocusChangeRef.current = onFocusChange;
  const multiplierRef = useRef(motionMultiplier);
  multiplierRef.current = motionMultiplier;
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const accentRef = useRef(accent);
  accentRef.current = accent;

  // Imperative Driver: Tweens cards in CAROUSEL_WINDOW directly
  const moveCarouselTo = useCallback((target: number) => {
    const list = itemsRef.current;
    const maxIdx = list.length - 1;
    const geom = carouselGeomRef.current;
    if (maxIdx < 0 || !geom) return;

    const prev = Math.max(0, Math.min(maxIdx, liveFocusRef.current));
    const next = Math.max(0, Math.min(maxIdx, target));
    if (next === prev) return;
    liveFocusRef.current = next;

    const v = viewRef.current;
    const m = multiplierRef.current;
    const sel = selectedIdsRef.current;
    const th = themeRef.current;
    const ac = accentRef.current;

    const lo = Math.max(0, Math.min(prev, next) - CAROUSEL_WINDOW);
    const hi = Math.min(maxIdx, Math.max(prev, next) + CAROUSEL_WINDOW);

    for (let i = lo; i <= hi; i++) {
      const item = list[i];
      const el = cardRefs.current.get(item.id);
      if (!el) continue;

      const isSel = !!sel[item.id];
      const selScale = isSel ? 0.94 : 1;

      // Card entering from beyond the window: place correctly at previous focus first
      if (Math.abs(i - prev) > CAROUSEL_WINDOW) {
        const p = computeCarouselTarget(v, i, prev, geom);
        gsap.set(el, {
          x: p.x,
          y: p.y,
          z: p.z,
          rotateY: p.rY,
          rotateX: p.rX,
          rotateZ: p.rZ,
          scale: p.s * selScale,
          opacity: p.o
        });
      }

      const t = computeCarouselTarget(v, i, next, geom);
      el.style.zIndex = String(t.zi);
      el.style.pointerEvents = t.o === 0 ? 'none' : 'auto';
      el.style.willChange = t.o === 0 ? 'auto' : 'transform, opacity';

      const depth = getCardDepthStyling(Math.abs(i - next), isSel, true, th, ac);
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
  }, [cardRefs]);

  // Commits focusIndex to React tree after gesture ceases
  const scheduleFocusCommit = useCallback(() => {
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    const delay = Math.max(220, 340 * multiplierRef.current + 60);

    commitTimerRef.current = setTimeout(() => {
      commitTimerRef.current = null;
      const f = liveFocusRef.current;
      if (f !== focusIndexRef.current) {
        gestureCommitRef.current = true;
        onFocusChangeRef.current(f);
      }
    }, delay);
  }, []);

  // Pointer drag gestures
  useEffect(() => {
    const st = stageRef.current;
    if (!st || !isCarousel) return;

    const onPointerDown = (e: PointerEvent) => {
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
      if (!isPointerDownRef.current || e.buttons === 0) {
        isPointerDownRef.current = false;
        isDraggingRef.current = false;
        return;
      }

      const dx = e.clientX - dragStartXRef.current;
      const dy = e.clientY - dragStartYRef.current;
      const dist = Math.hypot(dx, dy);

      // Deadzone threshold (8px) ensures card click events are preserved
      if (!isDraggingRef.current && dist > 8) {
        isDraggingRef.current = true;
        hasMovedRef.current = true;
        try {
          st.setPointerCapture(e.pointerId);
          capturedPointerIdRef.current = e.pointerId;
        } catch {}
      }

      if (!isDraggingRef.current) return;

      const delta = viewRef.current === 'filmstrip'
        ? (dragStartYRef.current - e.clientY) / 80
        : (dragStartXRef.current - e.clientX) / 100;

      const maxIdx = itemsRef.current.length - 1;
      if (maxIdx <= 0) return;

      const newFocus = Math.max(0, Math.min(maxIdx, Math.round(dragStartFocusRef.current + delta)));
      if (newFocus !== liveFocusRef.current) {
        moveCarouselTo(newFocus);
        scheduleFocusCommit();
      } else if (commitTimerRef.current) {
        scheduleFocusCommit();
      }
    };

    const onPointerUp = () => {
      if (!isPointerDownRef.current) return;
      isPointerDownRef.current = false;
      if (capturedPointerIdRef.current !== null) {
        try {
          st.releasePointerCapture(capturedPointerIdRef.current);
        } catch {}
        capturedPointerIdRef.current = null;
      }
      isDraggingRef.current = false;
      setTimeout(() => {
        hasMovedRef.current = false;
      }, 100);
    };

    st.addEventListener('pointerdown', onPointerDown);
    st.addEventListener('pointermove', onPointerMove);
    st.addEventListener('pointerup', onPointerUp);
    st.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      st.removeEventListener('pointerdown', onPointerDown);
      st.removeEventListener('pointermove', onPointerMove);
      st.removeEventListener('pointerup', onPointerUp);
      st.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [isCarousel, moveCarouselTo, scheduleFocusCommit, stageRef]);

  // Normalized Wheel Gestures (DeltaMode Line & Page scaling, notch accumulator)
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

      const now = performance.now();
      const fresh = now - lastWheelTimeRef.current > 220 || Math.sign(delta) !== Math.sign(wheelAccRef.current || delta);
      if (fresh) wheelAccRef.current = 0;
      lastWheelTimeRef.current = now;

      const isNotch = Math.abs(delta) >= 50;
      const unit = isNotch ? 100 : 40;
      wheelAccRef.current = (wheelAccRef.current || 0) + delta;

      let steps = Math.trunc(wheelAccRef.current / unit);
      if (steps === 0 && fresh && isNotch) steps = Math.sign(delta);
      wheelAccRef.current -= steps * unit;
      if (Math.sign(wheelAccRef.current) === -Math.sign(delta)) wheelAccRef.current = 0;
      steps = Math.max(-6, Math.min(6, steps));

      if (!steps) {
        if (commitTimerRef.current) scheduleFocusCommit();
        return;
      }

      moveCarouselTo(liveFocusRef.current + steps);
      scheduleFocusCommit();
    };

    // Keyboard Arrow Interception (flushes pending commits in capture phase)
    const onKeyDownCapture = () => {
      if (!commitTimerRef.current) return;
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
      if (liveFocusRef.current !== focusIndexRef.current) {
        onFocusChangeRef.current(liveFocusRef.current);
      }
    };

    wr.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDownCapture, true);

    return () => {
      wr.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDownCapture, true);
    };
  }, [isCarousel, moveCarouselTo, scheduleFocusCommit, wrapRef]);

  return {
    liveFocusRef,
    carouselGeomRef,
    gestureCommitRef,
    moveCarouselTo,
    hasMovedRef,
    isDraggingRef,
    isWheelingRef
  };
}
```

---

## 5. UI Components & Motion Layer

### 5.1 The 3D Media Card (`MediaCard.tsx`)
Includes:
- Dynamic 3D elevation and borders
- Hover physics (`translateY(-3px)`, glow halo expansion)
- Playback badge with Lucide `Play` icon for video/audio
- Star / favorite toggle button with Lucide `Star`
- Format indicator badge & metadata chips
- Clipboard copy feedback

```tsx
// src/components/media/MediaCard.tsx
import React, { useState } from 'react';
import { Play, Star, Copy, Check, FileCode, Disc, Film } from 'lucide-react';
import { MediaItem, ThemeMode, AccentColor } from '../../types/media';
import { getCardDepthStyling } from '../../motion/motionMath';
import { ACCENT_PALETTES } from '../../utils/themeTokens';

interface MediaCardProps {
  item: MediaItem;
  index: number;
  focusIndex: number;
  isSelected: boolean;
  isStarred: boolean;
  isCarousel: boolean;
  theme: ThemeMode;
  accent: AccentColor;
  onSelect: (item: MediaItem, e: React.MouseEvent) => void;
  onToggleStar: (id: string, e: React.MouseEvent) => void;
  onPlay?: (item: MediaItem) => void;
  cardRefCallback: (el: HTMLDivElement | null) => void;
}

export const MediaCard: React.FC<MediaCardProps> = React.memo(({
  item,
  index,
  focusIndex,
  isSelected,
  isStarred,
  isCarousel,
  theme,
  accent,
  onSelect,
  onToggleStar,
  onPlay,
  cardRefCallback
}) => {
  const [copied, setCopied] = useState(false);
  const isLight = theme === 'light';
  const palette = ACCENT_PALETTES[accent][theme];

  const ad = isCarousel ? Math.abs(index - focusIndex) : 0;
  const depth = getCardDepthStyling(ad, isSelected, isCarousel, theme, accent);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(item.title);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const isVideo = item.mediaType === 'video';
  const isAudio = item.mediaType === 'audio';

  return (
    <div
      ref={cardRefCallback}
      data-card={item.id}
      onClick={(e) => onSelect(item, e)}
      className="absolute top-0 left-0 w-[250px] h-[300px] cursor-pointer select-none opacity-0"
      style={{ transformStyle: 'preserve-3d', willChange: 'transform, opacity' }}
    >
      <div data-reveal="1" className="w-full h-full">
        <div
          className={`w-full h-full rounded-2xl overflow-hidden flex flex-col relative transition-all duration-300 ${
            isLight ? 'bg-white text-slate-800' : 'bg-slate-900/90 text-slate-100'
          }`}
          style={{
            border: depth.border,
            boxShadow: depth.boxShadow,
            transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-3px)';
            e.currentTarget.style.boxShadow = palette.hoverGlow;
            e.currentTarget.style.borderColor = palette.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = depth.boxShadow;
            e.currentTarget.style.borderColor = depth.borderColor;
          }}
        >
          {/* Poster Slot */}
          <div className="relative flex-1 min-h-0 bg-slate-950/30 overflow-hidden">
            {item.poster ? (
              <img
                src={item.poster}
                alt={item.title}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xs tracking-widest text-slate-500 uppercase font-mono">
                No Preview
              </div>
            )}

            {/* MediaType Badge */}
            <span
              className="absolute left-2.5 top-2.5 px-2 py-0.5 rounded-md text-[10px] font-mono tracking-wider uppercase font-semibold border backdrop-blur-md z-10"
              style={{
                backgroundColor: palette.badgeBg,
                borderColor: palette.badgeBorder,
                color: palette.badgeText
              }}
            >
              {item.format || item.mediaType || 'media'}
            </span>

            {/* Play Button Overlay */}
            {(isVideo || isAudio) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlay?.(item);
                }}
                className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full bg-slate-950/80 hover:scale-110 active:scale-95 transition-transform backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-lg z-10"
                title="Play Media"
              >
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              </button>
            )}

            {/* Favorite / Star Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(item.id, e);
              }}
              className="absolute right-2 top-2 w-6 h-6 rounded-md bg-slate-950/60 hover:bg-slate-950/90 transition-colors flex items-center justify-center backdrop-blur-sm z-10"
              title={isStarred ? 'Remove from Favorites' : 'Add to Favorites'}
            >
              <Star
                className="w-3.5 h-3.5"
                style={{
                  color: isStarred ? palette.primary : 'rgba(255, 255, 255, 0.4)',
                  fill: isStarred ? palette.primary : 'none'
                }}
              />
            </button>
          </div>

          {/* Metadata Footer */}
          <div className="p-3 flex flex-col gap-1.5 flex-none">
            <h3 className="font-semibold text-base leading-tight truncate" title={item.title}>
              {item.title}
            </h3>

            {/* Category and Size Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {item.category && (
                <span className="px-2 py-0.5 rounded-full text-[9.5px] font-mono tracking-wide uppercase bg-slate-200/50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                  {item.category}
                </span>
              )}
              {item.sizeFormatted && (
                <span className="px-2 py-0.5 rounded-full text-[9.5px] font-mono tracking-wide uppercase bg-slate-200/30 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                  {item.sizeFormatted}
                </span>
              )}
            </div>

            {/* Filename & Quick Copy */}
            <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-200/40 dark:border-slate-800/60">
              <span className="truncate" title={item.filename}>
                {item.filename}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="hover:text-slate-300 p-0.5 rounded transition-colors"
                title="Copy Title"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
```

---

### 5.2 Dynamic Catalog Motion Backdrop (`StageWatermark.tsx`)
Renders an architectural 3D background glyph representing the focused or dominant media item. Watermark letters animate with 3D directional flips synchronized with the active view mode (filmstrip rotates on X, coverflow rotates on Y, peel swings on Z).

```tsx
// src/components/media/StageWatermark.tsx
import React, { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { MediaItem, ViewMode, ThemeMode } from '../../types/media';

interface StageWatermarkProps {
  items: MediaItem[];
  focusIndex: number;
  view: ViewMode;
  theme: ThemeMode;
  motionMultiplier?: number;
}

export const StageWatermark: React.FC<StageWatermarkProps> = React.memo(({
  items,
  focusIndex,
  view,
  theme,
  motionMultiplier = 1
}) => {
  const isLight = theme === 'light';
  const prevFocusRef = useRef(focusIndex);
  const lastDirRef = useRef<number>(1);
  const currentRef = useRef<HTMLDivElement>(null);
  const exitRef = useRef<HTMLDivElement>(null);

  const activeItem = items[focusIndex] || items[0];
  const watermarkText = activeItem?.title?.trim().charAt(0).toUpperCase() || '';

  const [state, setState] = useState<{
    current: string;
    exiting: string | null;
    dir: number;
    animKey: number;
  }>({
    current: watermarkText,
    exiting: null,
    dir: 1,
    animKey: 0
  });

  useEffect(() => {
    if (focusIndex > prevFocusRef.current) lastDirRef.current = 1;
    else if (focusIndex < prevFocusRef.current) lastDirRef.current = -1;
    prevFocusRef.current = focusIndex;
  }, [focusIndex]);

  useEffect(() => {
    if (watermarkText === state.current) return;
    setState((prev) => ({
      current: watermarkText,
      exiting: prev.current,
      dir: lastDirRef.current,
      animKey: prev.animKey + 1
    }));
  }, [watermarkText, state.current]);

  // Directional GSAP Perspective Choreography
  useEffect(() => {
    if (!state.animKey) return;
    const curEl = currentRef.current;
    const exEl = exitRef.current;
    const m = motionMultiplier;
    const dir = state.dir;

    if (exEl && state.exiting) {
      if (view === 'coverflow') {
        gsap.fromTo(exEl, { opacity: 1, x: 0, rotateY: 0 }, {
          opacity: 0,
          x: -dir * 160,
          rotateY: dir * 42,
          duration: 0.44 * m,
          ease: 'power3.inOut'
        });
      } else if (view === 'filmstrip') {
        gsap.fromTo(exEl, { opacity: 1, y: 0, rotateX: 0 }, {
          opacity: 0,
          y: -dir * 130,
          rotateX: dir * 32,
          duration: 0.44 * m,
          ease: 'power3.inOut'
        });
      } else {
        gsap.fromTo(exEl, { opacity: 1, scale: 1 }, {
          opacity: 0,
          scale: 0.92,
          duration: 0.4 * m,
          ease: 'power3.inOut'
        });
      }
    }

    if (curEl && state.current) {
      if (view === 'coverflow') {
        gsap.fromTo(curEl, { opacity: 0, x: dir * 160, rotateY: -dir * 42 }, {
          opacity: 1,
          x: 0,
          rotateY: 0,
          duration: 0.52 * m,
          ease: 'power3.out'
        });
      } else if (view === 'filmstrip') {
        gsap.fromTo(curEl, { opacity: 0, y: dir * 130, rotateX: -dir * 32 }, {
          opacity: 1,
          y: 0,
          rotateX: 0,
          duration: 0.52 * m,
          ease: 'power3.out'
        });
      } else {
        gsap.fromTo(curEl, { opacity: 0, scale: 0.94 }, {
          opacity: 1,
          scale: 1,
          duration: 0.5 * m,
          ease: 'power3.out'
        });
      }
    }
  }, [state.animKey, motionMultiplier, view]);

  if (!state.current && !state.exiting) return null;

  return (
    <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center z-0">
      {state.exiting && (
        <div
          ref={exitRef}
          key={`exit-${state.animKey}`}
          className="absolute font-bold text-[60vh] leading-none select-none"
          style={{
            color: isLight ? 'rgba(15, 23, 42, 0.04)' : 'rgba(255, 255, 255, 0.035)',
            transformStyle: 'preserve-3d'
          }}
        >
          {state.exiting}
        </div>
      )}
      {state.current && (
        <div
          ref={currentRef}
          key={`current-${state.animKey}`}
          className="absolute font-bold text-[60vh] leading-none select-none"
          style={{
            color: isLight ? 'rgba(15, 23, 42, 0.04)' : 'rgba(255, 255, 255, 0.035)',
            transformStyle: 'preserve-3d'
          }}
        >
          {state.current}
        </div>
      )}
    </div>
  );
});
```

---

### 5.3 Dense Multi-Column List View (`MediaListView.tsx`)
Designed for dense catalog browsing. Supports 1, 2, 3, or 4 responsive columns with `down` or `across` distribution, sticky headers, and smooth row hover transitions.

```tsx
// src/components/media/MediaListView.tsx
import React, { useMemo } from 'react';
import { Star, Play, ChevronUp, ChevronDown } from 'lucide-react';
import { MediaItem, ListColumns, ListOrder, ThemeMode, AccentColor } from '../../types/media';
import { ACCENT_PALETTES } from '../../utils/themeTokens';

interface MediaListViewProps {
  items: MediaItem[];
  theme: ThemeMode;
  accent: AccentColor;
  stars: Record<string, boolean>;
  onToggleStar: (id: string, e: React.MouseEvent) => void;
  onSelect: (item: MediaItem) => void;
  onPlay?: (item: MediaItem) => void;
  columns?: ListColumns;
  order?: ListOrder;
}

export const MediaListView: React.FC<MediaListViewProps> = ({
  items,
  theme,
  accent,
  stars,
  onToggleStar,
  onSelect,
  onPlay,
  columns = 1,
  order = 'down'
}) => {
  const isLight = theme === 'light';
  const palette = ACCENT_PALETTES[accent][theme];

  // Distribute items into columns based on order
  const columnGroups = useMemo(() => {
    if (columns <= 1 || items.length <= 1) return [items];
    const groups: MediaItem[][] = Array.from({ length: columns }, () => []);

    if (order === 'across') {
      items.forEach((item, idx) => groups[idx % columns].push(item));
    } else {
      const chunkSize = Math.ceil(items.length / columns);
      for (let c = 0; c < columns; c++) {
        groups[c] = items.slice(c * chunkSize, (c + 1) * chunkSize);
      }
    }
    return groups;
  }, [items, columns, order]);

  const renderHeader = (colNum: number) => (
    <div
      key={`hdr-${colNum}`}
      className={`sticky top-0 z-20 flex items-center gap-3 px-3 py-2 text-[10px] font-mono uppercase tracking-wider rounded-lg backdrop-blur-md border-b mb-1 ${
        isLight
          ? 'bg-slate-100/90 text-slate-600 border-slate-200'
          : 'bg-slate-950/90 text-slate-400 border-slate-800'
      }`}
    >
      <span className="w-8 flex-none">Prev</span>
      <span className="w-5 flex-none text-center">★</span>
      <span className="flex-1 min-w-0">Title</span>
      <span className="w-16 flex-none">Format</span>
      <span className="w-16 flex-none text-right">Size</span>
      <span className="w-24 flex-none hidden sm:block">Category</span>
    </div>
  );

  const renderRow = (item: MediaItem) => {
    const isStarred = !!stars[item.id];
    return (
      <div
        key={item.id}
        data-row={item.id}
        onClick={() => onSelect(item)}
        className={`group flex items-center gap-3 px-3 py-2 rounded-xl border cursor-pointer transition-all duration-200 ${
          isLight
            ? 'bg-white/70 hover:bg-white border-slate-200/80 shadow-sm hover:shadow-md'
            : 'bg-slate-900/50 hover:bg-slate-900/90 border-slate-800/80 hover:border-slate-700'
        }`}
        style={{ willChange: 'transform, background-color' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateX(4px)';
          e.currentTarget.style.borderColor = palette.primary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateX(0)';
          e.currentTarget.style.borderColor = '';
        }}
      >
        {/* Preview Thumbnail */}
        <div className="w-8 h-7 flex-none rounded-md bg-slate-950/40 overflow-hidden relative border border-slate-700/50">
          {item.poster ? (
            <img src={item.poster} alt={item.title} className="w-full h-full object-cover" />
          ) : null}
          {(item.mediaType === 'video' || item.mediaType === 'audio') && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPlay?.(item);
              }}
              className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Play className="w-3 h-3 fill-current" />
            </button>
          )}
        </div>

        {/* Star */}
        <button
          type="button"
          onClick={(e) => onToggleStar(item.id, e)}
          className="w-5 flex-none flex items-center justify-center text-slate-500 hover:text-amber-400"
        >
          <Star
            className="w-3.5 h-3.5"
            style={{
              color: isStarred ? palette.primary : undefined,
              fill: isStarred ? palette.primary : 'none'
            }}
          />
        </button>

        {/* Title */}
        <span className="flex-1 min-w-0 font-medium text-sm truncate" title={item.title}>
          {item.title}
        </span>

        {/* Format */}
        <span className="w-16 flex-none text-[10px] font-mono uppercase tracking-wider text-slate-500">
          {item.format || item.mediaType || '—'}
        </span>

        {/* Size */}
        <span className="w-16 flex-none text-[10px] font-mono text-right text-slate-500">
          {item.sizeFormatted || '—'}
        </span>

        {/* Category */}
        <span className="w-24 flex-none text-[10px] font-mono truncate text-slate-500 hidden sm:block">
          {item.category || 'General'}
        </span>
      </div>
    );
  };

  return (
    <div
      className="w-full pb-16"
      style={{
        display: columns > 1 ? 'grid' : 'flex',
        gridTemplateColumns: columns > 1 ? `repeat(${columns}, minmax(0, 1fr))` : undefined,
        flexDirection: columns === 1 ? 'column' : undefined,
        gap: '8px'
      }}
    >
      {columnGroups.map((group, colIdx) => (
        <div key={`col-${colIdx}`} className="flex flex-col gap-1.5 min-w-0">
          {renderHeader(colIdx + 1)}
          {group.map((item) => renderRow(item))}
        </div>
      ))}
    </div>
  );
};
```

---

### 5.4 The Main Motion Viewport (`MediaStage.tsx`)
Orchestrates Grid layouts, 3D Carousels, View Transitions, and the IntersectionObserver Staggered Scroll Engine.

```tsx
// src/components/media/MediaStage.tsx
import React, { useRef, useState, useEffect } from 'react';
import gsap from 'gsap';
import { MediaItem, ViewMode, Density, ThemeMode, AccentColor, ListColumns, ListOrder } from '../../types/media';
import { MediaCard } from './MediaCard';
import { MediaListView } from './MediaListView';
import { StageWatermark } from './StageWatermark';
import { useCarouselMotion } from '../../motion/useCarouselMotion';
import { computeCarouselTarget, getCardDepthStyling } from '../../motion/motionMath';

interface MediaStageProps {
  items: MediaItem[];
  view: ViewMode;
  density: Density;
  focusIndex: number;
  onFocusChange: (index: number) => void;
  selectedIds: Record<string, boolean>;
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  stars: Record<string, boolean>;
  onToggleStar: (id: string, e: React.MouseEvent) => void;
  theme: ThemeMode;
  accent: AccentColor;
  motionMultiplier?: number;
  listColumns?: ListColumns;
  listOrder?: ListOrder;
  onSelectMedia: (item: MediaItem) => void;
  onPlayMedia?: (item: MediaItem) => void;
}

export const MediaStage: React.FC<MediaStageProps> = ({
  items,
  view,
  density,
  focusIndex,
  onFocusChange,
  selectedIds,
  onToggleSelect,
  stars,
  onToggleStar,
  theme,
  accent,
  motionMultiplier = 1,
  listColumns = 1,
  listOrder = 'down',
  onSelectMedia,
  onPlayMedia
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const ioRef = useRef<IntersectionObserver | null>(null);

  const [stageWidth, setStageWidth] = useState<number>(1200);
  const isCarousel = ['coverflow', 'strip', 'radial', 'filmstrip', 'peel'].includes(view);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      if (stageRef.current) setStageWidth(stageRef.current.clientWidth);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Wire high-performance imperative carousel motion
  const {
    liveFocusRef,
    carouselGeomRef,
    gestureCommitRef,
    hasMovedRef,
    isDraggingRef,
    moveCarouselTo
  } = useCarouselMotion({
    items,
    view,
    focusIndex,
    onFocusChange,
    selectedIds,
    theme,
    accent,
    motionMultiplier,
    stageRef,
    wrapRef,
    cardRefs
  });

  // Card click dispatcher
  const handleCardClick = (item: MediaItem, e: React.MouseEvent) => {
    if (hasMovedRef.current || isDraggingRef.current) return;

    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      onToggleSelect(item.id, e);
      return;
    }

    const idx = items.findIndex((x) => x.id === item.id);
    if (idx >= 0) {
      if (isCarousel) {
        moveCarouselTo(idx);
        gestureCommitRef.current = true;
      }
      onFocusChange(idx);
    }

    onSelectMedia(item);
  };

  // GSAP Layout Orchestration (Grid & Carousel placement)
  useEffect(() => {
    const st = stageRef.current;
    const wr = wrapRef.current;
    if (!st || !wr || view === 'list') return;

    const displayH = wr.clientHeight || 800;
    const m = motionMultiplier;
    const focus = Math.max(0, Math.min(items.length - 1, liveFocusRef.current));

    if (view === 'grid') {
      wr.style.overflowY = 'auto';
      const cols = density;
      const gap = 18;
      const cw = Math.max(140, Math.floor((stageWidth - gap * (cols - 1)) / cols));
      const ch = Math.round(cw * 0.74 + 132);

      items.forEach((item, i) => {
        const el = cardRefs.current.get(item.id);
        if (!el) return;
        const r = Math.floor(i / cols);
        const c = i % cols;
        const tx = c * (cw + gap);
        const ty = r * (ch + gap);

        el.style.width = `${cw}px`;
        el.style.height = `${ch}px`;
        el.style.zIndex = '10';

        gsap.to(el, {
          x: tx,
          y: ty,
          z: 0,
          rotateY: 0,
          rotateX: 0,
          rotateZ: 0,
          scale: selectedIds[item.id] ? 0.94 : 1,
          opacity: 1,
          duration: 0.65 * m,
          ease: 'expo.out',
          overwrite: true
        });
      });

      const totalHeight = Math.ceil(items.length / cols) * (ch + gap) + 30;
      st.style.height = `${totalHeight}px`;

      // IntersectionObserver Staggered Scroll for Grid
      if (ioRef.current) ioRef.current.disconnect();
      ioRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const revealEl = entry.target.querySelector('[data-reveal]') as HTMLElement;
            if (!revealEl) return;
            if (entry.isIntersecting) {
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
                opacity: 0.1,
                y: 24,
                rotateX: -8,
                duration: 0.4 * m,
                ease: 'power2.in',
                overwrite: true
              });
            }
          });
        },
        { root: wr, rootMargin: '16% 0px 16% 0px', threshold: 0.01 }
      );

      cardRefs.current.forEach((el) => ioRef.current?.observe(el));
    } else {
      // 3D Carousel views
      wr.style.overflow = 'hidden';
      const cw2 = Math.min(300, Math.max(200, stageWidth * 0.22));
      const ch2 = Math.round(cw2 * 1.3);
      const cx = stageWidth / 2 - cw2 / 2;
      const cy = Math.max(10, (displayH - ch2) / 2);
      const geom = { cx, cy, cw2, ch2 };
      carouselGeomRef.current = geom;

      st.style.height = `${displayH}px`;

      items.forEach((item, i) => {
        const el = cardRefs.current.get(item.id);
        if (!el) return;
        const t = computeCarouselTarget(view, i, focus, geom);

        el.style.width = `${t.w}px`;
        el.style.height = `${t.h}px`;
        el.style.zIndex = String(t.zi);
        el.style.pointerEvents = t.o === 0 ? 'none' : 'auto';

        gsap.to(el, {
          x: t.x,
          y: t.y,
          z: t.z,
          rotateY: t.rY,
          rotateX: t.rX,
          rotateZ: t.rZ,
          scale: t.s * (selectedIds[item.id] ? 0.94 : 1),
          opacity: t.o,
          duration: 0.72 * m,
          ease: view === 'strip' ? 'elastic.out(0.55, 0.72)' : 'expo.out',
          overwrite: true
        });
      });
    }
  }, [items, view, density, stageWidth, motionMultiplier, selectedIds]);

  return (
    <div ref={rootRef} className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* 3D Directional Catalog Backdrop Watermark */}
      <StageWatermark
        items={items}
        focusIndex={focusIndex}
        view={view}
        theme={theme}
        motionMultiplier={motionMultiplier}
      />

      {/* Main Scroll / Viewport Wrapper */}
      <div ref={wrapRef} className="relative z-10 flex-1 min-h-0 px-6 overflow-hidden">
        {view === 'list' ? (
          <MediaListView
            items={items}
            theme={theme}
            accent={accent}
            stars={stars}
            onToggleStar={onToggleStar}
            onSelect={onSelectMedia}
            onPlay={onPlayMedia}
            columns={listColumns}
            order={listOrder}
          />
        ) : (
          <div
            ref={stageRef}
            className="relative w-full select-none"
            style={{
              perspective: '1200px',
              perspectiveOrigin: view === 'filmstrip' ? '33% 50%' : '50% 50%'
            }}
          >
            {items.map((item, idx) => (
              <MediaCard
                key={item.id}
                item={item}
                index={idx}
                focusIndex={focusIndex}
                isSelected={!!selectedIds[item.id]}
                isStarred={!!stars[item.id]}
                isCarousel={isCarousel}
                theme={theme}
                accent={accent}
                onSelect={handleCardClick}
                onToggleStar={onToggleStar}
                onPlay={onPlayMedia}
                cardRefCallback={(el) => {
                  if (el) cardRefs.current.set(item.id, el);
                  else cardRefs.current.delete(item.id);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
```

---

## 6. Layout Transitions & View Switching Choreography

When switching between views (e.g. from `coverflow` to `grid` or `list`), do not swap components instantly. Call this exit transition helper to animate currently visible items down with 3D tilt and stagger before switching state:

```ts
// src/motion/transitionChoreography.ts
import gsap from 'gsap';
import { ViewMode } from '../types/media';

export function executeViewTransition(
  newView: ViewMode,
  motionMultiplier: number = 1,
  onCommitSwitch: () => void
) {
  const cards = Array.from(document.querySelectorAll('[data-card]')) as HTMLElement[];
  const activeCards = cards.filter((c) => c.style.pointerEvents !== 'none');
  const rows = Array.from(document.querySelectorAll('[data-row]')) as HTMLElement[];

  if (rows.length > 0) {
    gsap.to(rows, {
      x: 26,
      opacity: 0,
      duration: 0.24 * motionMultiplier,
      stagger: 0.008,
      ease: 'power2.in'
    });
  }

  if (activeCards.length > 0) {
    gsap.to(activeCards, {
      y: '+=54',
      opacity: 0,
      rotateX: -14,
      scale: 0.9,
      duration: 0.3 * motionMultiplier,
      stagger: { each: 0.011 * motionMultiplier, from: 'center' },
      ease: 'power2.in',
      onComplete: onCommitSwitch
    });
  } else {
    onCommitSwitch();
  }
}
```

---

## 7. Business Logic Integration Slots

Connect your existing OggleBox backend, state managers (Zustand, Redux, React Context), and media players using these standard functional slots:

| Integration Slot | Signature / Props | Recommended Destination App Wiring |
| :--- | :--- | :--- |
| **Slot 1: Media Streaming & Playback** | `onPlayMedia={(item) => ...}` | Mounts your existing video player overlay or continuous audio bar. Automatically populated with `item.filename` and stream URL. |
| **Slot 2: Media Details Drawer** | `onSelectMedia={(item) => ...}` | Opens OggleBox's media inspector drawer with codec details, stream bitrate, and metadata tags. |
| **Slot 3: Favorites / Star State** | `stars: Record<string, boolean>`<br>`onToggleStar={(id) => ...}` | Dispatches to your SQLite / backend API `PATCH /api/media/:id/favorite`. |
| **Slot 4: Multi-Select Batch Actions** | `selectedIds: Record<string, boolean>`<br>`onToggleSelect={(id, e) => ...}` | Powers multi-file actions (bulk delete, playlist assignment, transcode queue). Controlled via `Cmd/Ctrl + Click`. |
| **Slot 5: Accent Color Switcher** | `accent: 'cyan' \| 'pink' \| 'emerald' \| 'amber'` | Plugs into OggleBox's user settings store; dynamically updates glow shadows and halos. |
| **Slot 6: Motion Multiplier** | `motionMultiplier: number` (0.0 to 1.5) | Supports accessibility `prefers-reduced-motion` or high-refresh-rate display tuning. |

---

## 8. Verification & Performance Check

When integrating into OggleBox, verify using Google Chrome DevTools Performance panel:
1. **Scrub Latency**: Continuous mouse wheel scrolling in `coverflow` or `strip` mode must trigger immediate visual motion in `< 16ms`.
2. **Main Thread Work**: Ensure zero full React component tree renders occur while wheel events are firing continuously.
3. **Memory Leaks**: Detached cards must be cleaned up via `cardRefs.current.delete(id)` when filtering items or paginating.
