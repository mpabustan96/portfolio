/* =============================================
   INDEX WORK REEL — horizontal case-study reel
   for the homepage (index.html only).

   "Aperture Gallery" version: adds click-and-drag
   panning (pointer events) on top of native swipe/
   scroll-snap, plus the same two additions as before:
     1. Wheel: a plain mouse has no horizontal axis,
        so a vertical wheel delta is applied to
        scrollLeft instead, letting a normal scroll
        wheel move the reel too.
     2. Dots: kept in sync by finding whichever frame's
        center is closest to the reel's own center,
        recalculated on every scroll event.
   A drag that moves more than a few pixels suppresses
   the click that would otherwise follow on the
   frame's <a>, so dragging never accidentally
   navigates away.
============================================= */
(function () {
  var reel = document.getElementById('reel');
  var dots = document.querySelectorAll('#dots span');
  if (!reel) return;
  var frames = reel.querySelectorAll('.home-frame');

  reel.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      reel.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, { passive: false });

  function updateDots() {
    if (!dots.length) return;
    var center = reel.scrollLeft + reel.clientWidth / 2;
    var closest = 0, closestDist = Infinity;
    frames.forEach(function (frame, i) {
      var mid = frame.offsetLeft + frame.offsetWidth / 2;
      var dist = Math.abs(mid - center);
      if (dist < closestDist) { closestDist = dist; closest = i; }
    });
    dots.forEach(function (d, i) { d.classList.toggle('is-active', i === closest); });
  }

  reel.addEventListener('scroll', updateDots);
  updateDots();

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
