/* =============================================
   INDEX WORK REEL — horizontal case-study reel
   for the homepage (index.html only).

   "Aperture Gallery" version: click-and-drag panning
   (pointer events) on top of native swipe/scroll-snap,
   plus:
     1. Wheel: a plain mouse has no horizontal axis,
        so a vertical wheel delta is applied to
        scrollLeft instead, letting a normal scroll
        wheel move the reel too.
     2. Dots: real tab-role buttons now, not decoration.
        Kept in sync by finding whichever frame's center
        is closest to the reel's own center, recalculated
        on every scroll event, and clickable to jump
        straight to that project.
     3. Arrow buttons: step one project at a time in
        either direction, disabled at the first/last
        frame the way a standard carousel controls pair
        behaves, so it never wraps or gets stuck.
     4. Keyboard: left/right arrow keys move the reel
        one project at a time whenever it has focus,
        same step logic as the arrow buttons.
   A drag that moves more than a few pixels suppresses
   the click that would otherwise follow on the
   frame's <a>, so dragging never accidentally
   navigates away.
============================================= */
(function () {
  var reel = document.getElementById('reel');
  var dots = document.querySelectorAll('#dots button');
  var prevBtn = document.getElementById('reelPrev');
  var nextBtn = document.getElementById('reelNext');
  if (!reel) return;
  var frames = reel.querySelectorAll('.home-frame');

  function activeIndex() {
    // At either scroll boundary, pure center-distance math breaks down:
    // the first and last cards can't always be scrolled all the way to
    // the viewport's center, so they'd never "win" the closest-match
    // check even when they're the true leading edge. Snapping directly
    // to index 0 or the last index at each boundary fixes both the
    // wrong card being marked active on load and the reel appearing to
    // get stuck a card early when stepping through with the dots.
    var maxScroll = reel.scrollWidth - reel.clientWidth;
    if (reel.scrollLeft <= 4) return 0;
    if (reel.scrollLeft >= maxScroll - 4) return frames.length - 1;

    var center = reel.scrollLeft + reel.clientWidth / 2;
    var closest = 0, closestDist = Infinity;
    frames.forEach(function (frame, i) {
      var mid = frame.offsetLeft + frame.offsetWidth / 2;
      var dist = Math.abs(mid - center);
      if (dist < closestDist) { closestDist = dist; closest = i; }
    });
    return closest;
  }

  function updateControls() {
    var maxScroll = reel.scrollWidth - reel.clientWidth;
    var current = activeIndex();

    // Dots only ever render on mobile, where one card roughly fills the
    // viewport, so "closest card to center" maps cleanly to one dot.
    dots.forEach(function (d, i) {
      var isActive = i === current;
      d.classList.toggle('is-active', isActive);
      d.setAttribute('aria-selected', String(isActive));
    });

    // Arrows are boundary-based, not index-based: on wider viewports
    // several cards are visible at once, so there isn't a clean 1:1
    // mapping between "card index" and "scroll position" the way dots
    // assume. Disabling purely off how much scroll room is left avoids
    // that mismatch entirely.
    if (prevBtn) prevBtn.disabled = reel.scrollLeft <= 4;
    if (nextBtn) nextBtn.disabled = reel.scrollLeft >= maxScroll - 4;
  }

  function goToFrame(i) {
    var target = Math.max(0, Math.min(frames.length - 1, i));
    var frame = frames[target];
    var maxScroll = reel.scrollWidth - reel.clientWidth;
    var destination = frame.offsetLeft + frame.offsetWidth / 2 - reel.clientWidth / 2;
    destination = Math.max(0, Math.min(maxScroll, destination));
    reel.scrollTo({ left: destination, behavior: 'smooth' });
  }

  function step(direction) {
    // Move by one card's width plus its gap, clamped to the scrollable
    // range. A fixed pixel step, rather than trying to center a specific
    // card index, is what keeps this correct regardless of how many
    // cards happen to be visible at once at the current viewport width.
    var gap = frames.length > 1 ? frames[1].offsetLeft - frames[0].offsetLeft - frames[0].offsetWidth : 0;
    var stepSize = frames[0].offsetWidth + Math.max(gap, 0);
    var maxScroll = reel.scrollWidth - reel.clientWidth;
    var destination = reel.scrollLeft + direction * stepSize;
    destination = Math.max(0, Math.min(maxScroll, destination));
    reel.scrollTo({ left: destination, behavior: 'smooth' });
  }

  reel.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      reel.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, { passive: false });

  reel.addEventListener('scroll', updateControls);
  updateControls();

  // Dots — click to jump straight to that project.
  dots.forEach(function (dot, i) {
    dot.addEventListener('click', function () { goToFrame(i); });
  });

  // Arrows — step by one card's width, disabled at either scroll end.
  if (prevBtn) prevBtn.addEventListener('click', function () { step(-1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { step(1); });

  // Keyboard — left/right arrows step the reel when it has focus,
  // matching the standard carousel convention.
  reel.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  });

  // Click-and-drag panning. Pointer capture is deliberately NOT
  // engaged on pointerdown — only once real movement crosses the
  // threshold below. Engaging capture on every pointerdown (even a
  // plain click that never moves) is what was silently swallowing
  // clicks on the frames: some browsers suppress or retarget the
  // follow-up 'click' once capture is active, even without motion.
  var DRAG_THRESHOLD = 4;
  var tracking = false;   // pointer is down, watching for movement
  var dragging = false;   // movement crossed the threshold — capture engaged
  var moved = false;      // true for the remainder of this gesture once dragging starts
  var startX = 0, startScroll = 0, pointerId = null;

  reel.addEventListener('pointerdown', function (e) {
    // Only the primary mouse button (or a touch/pen contact) starts a
    // drag — this leaves middle/right-click and modifier-clicks (e.g.
    // cmd-click to open in a new tab) alone.
    if (e.button !== undefined && e.button !== 0) return;
    tracking = true;
    dragging = false;
    moved = false;
    pointerId = e.pointerId;
    startX = e.clientX;
    startScroll = reel.scrollLeft;
  });

  reel.addEventListener('pointermove', function (e) {
    if (!tracking) return;
    var dx = e.clientX - startX;

    if (!dragging) {
      if (Math.abs(dx) <= DRAG_THRESHOLD) return;
      // Threshold crossed — this gesture is now a drag, not a click.
      dragging = true;
      moved = true;
      reel.classList.add('is-dragging');
      reel.setPointerCapture(pointerId);
    }

    reel.scrollLeft = startScroll - dx;
  });

  function endDrag() {
    tracking = false;
    if (dragging) {
      reel.classList.remove('is-dragging');
      try { reel.releasePointerCapture(pointerId); } catch (err) { /* already released */ }
    }
    dragging = false;
    pointerId = null;
  }
  reel.addEventListener('pointerup', endDrag);
  reel.addEventListener('pointercancel', endDrag);
  reel.addEventListener('pointerleave', endDrag);

  // Capture-phase click veto: if the pointerdown turned into a drag,
  // swallow the click so it doesn't navigate the frame's <a href>.
  // A plain click (moved stays false) is left completely alone.
  reel.addEventListener('click', function (e) {
    if (moved) { e.preventDefault(); e.stopPropagation(); }
  }, true);
})();
