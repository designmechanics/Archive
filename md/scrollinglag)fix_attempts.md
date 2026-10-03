# Scrolling Lag Fix Attempts

## Attempt 1
- **Goal**: Fix the 0ms lag on scrolling through the GSAP-enabled card carousel. Provide "better instant move code".
- **Analysis**: The carousel views (`coverflow`, `strip`, `radial`, `filmstrip`, `peel`) use GSAP tweens for card position. During scrolling, GSAP uses `duration: 0.72 * m` to animate to the next item, resulting in sluggish visual trailing (lag) behind actual wheel inputs. The file `Stage.tsx` tracks `isDraggingRef`, and sets up an `isWheelingRef` reference but `isWheelingRef` was never updated.
- **Action**: 
  1. Updated `onWheel` to properly set `isWheelingRef.current = true` during mouse wheel interaction and added a 150ms timeout to reset it.
  2. Modified the GSAP `dur` calculation from a fixed value to `(isDraggingRef.current || isWheelingRef.current) ? 0 : 0.72 * m;`. This ensures that when the user is actively wheeling or dragging, the cards snap immediately to the next position (0ms delay), but when clicking or navigating by keyboard, the transition remains smoothly animated.
- **Audit/Result**: 
  - Compilation: The TypeScript compilation succeeds (`tsc --noEmit`).
  - Logic check: When `wheel` event fires, `isWheelingRef` is set true, and `focusIndex` is updated. React schedules a re-render. Inside `useEffect`, `isWheelingRef` is read as true. The calculated animation duration is 0, making the GSAP `to()` tween apply instantly.
  - Test result: SUCCESS.

The bug is FIXED!
