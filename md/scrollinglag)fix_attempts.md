# Scrolling Lag Fix Attempts

## Attempt 1 (Gemini) — NOT A REAL FIX
- **Action**: Set GSAP tween duration to `0` while `isWheelingRef`/`isDraggingRef` was true (150 ms timeout).
- **Why it failed**: It only removed the animation; the lag source was untouched. Every wheel step still went
  through React state (`setFocusIndex`) → App + Toolbar + every Stage card re-render → `gsap.to` on all cards.
  The wheel handler also had a 90 px threshold, max 1 card per event, discarded the remainder and ignored `deltaMode`.
- **Audit**: Only `tsc --noEmit` was run. "SUCCESS" was logged without any runtime test. User reported lag remained.
- Commit: `504e8f8` "Carousel: snap cards instantly during wheel/drag (unverified)".

## Attempt 2 (Opus) — imperative carousel driver
- `computeCarouselTarget(view, i, focus, geom)` — pure layout math for coverflow / strip / radial / filmstrip / peel.
- `moveCarouselTo(target)` — tweens only cards within ±7 (`CAROUSEL_WINDOW`) of old/new focus directly with GSAP
  (`0.34·m`, `power3.out`, `overwrite: true`). No React render per wheel step.
- Wheel handler rewrite: `deltaMode` normalisation (lines ×33, pages ×100), dominant axis, fresh-gesture reset
  (220 ms idle / direction change), notch unit 100 vs trackpad unit 40, remainder accumulated, first notch always
  moves one card, steps clamped to ±6.
- Drag and card-click use the same driver. `willChange: auto` for hidden cards. Dur=0 hack removed (`0.72·m` restored
  for non-gesture transitions).

## Attempt 3 (Opus) — deferred React commit
- Focus is committed to React (`onFocusChange`) only after input goes quiet (`max(220, 340·m + 60)` ms), so the
  ~50 ms (1×) / ~210 ms (4× CPU) full-card React render never lands mid-gesture. Sub-step wheel events and drag
  moves re-arm the pending commit.
- Commit-originated renders skip card tweens (cards are already in place). External focus changes cancel pending commits.
- Capture-phase keydown flushes a pending commit so arrow keys step from the live card.

### Measurements (isolated headless Chrome, 256 cards, coverflow, 4× CPU throttle)
| Metric | Before (`504e8f8`) | After |
|---|---|---|
| Notch → visible motion | ~310–370 ms | ~15 ms |
| Fast spin, 15 notches | 14 cards moved, ~5–5.8 s long tasks | 15/15 moved, ~370 ms long tasks |
| Trackpad 600 px | 6 cards moved, ~1.1 s latency | 14 cards moved |
| Hard flick 3×400 px | 1–3 cards moved | 12 cards moved |

Consistency check (gesture layout vs full React layout after arrow keys): diff 0.000.

### Result: SUCCESS — confirmed by the user in Firefox (2026-10-03). Commit `322fd48` "GSAP scrolling fix."

### Lessons
- Never log SUCCESS from a compile check; measure input→motion latency at runtime.
- Benchmark harness must use its own Chrome (`--remote-debugging-port=0` + unique profile); a fixed debug port
  clashed with another agent's browser and contaminated results.
- Possible future gain: memoize the Stage card component to shrink the single deferred commit render.
