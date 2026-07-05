/* =============================================
   MATRIX BACKGROUND — full-page, subtle, slow
   "Dense fine static" variant: many thin columns,
   low opacity, mostly periwinkle with a rare lime
   glyph. Deliberately kept slow and always running
   (not paused for prefers-reduced-motion — that's
   an intentional design choice, not an oversight).
   Only pauses when the browser tab itself is hidden,
   purely to save battery, not for motion preference.
============================================= */
(function () {
  var canvas = document.getElementById('matrix-bg');
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext('2d');
  var CHARSET = '01アイウエオカキクケコ.:'.split('');

  // Slower fall + longer trail = calmer, ambient feel rather than
  // classic fast "code rain". Kept intentionally understated.
  var SPEED = 0.28;
  var CLEAR_ALPHA = 0.15;
  var LIME_RATIO = 0.05;
  var MIN_OPACITY = 0.06;
  var MAX_OPACITY = 0.16;

  function isMobile() {
    return window.innerWidth <= 640;
  }

  var w, h, dpr, columns, colWidth, fontSize, drops, frame = 0;

  function setup() {
    dpr = window.devicePixelRatio || 1;
    w = window.innerWidth;
    h = window.innerHeight;

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Wider column spacing on mobile = fewer columns = lighter workload,
    // same subtle look at a lower cost.
    fontSize = isMobile() ? 10 : 9;
    colWidth = isMobile() ? 22 : 15;
    columns = Math.max(1, Math.ceil(w / colWidth));

    drops = [];
    for (var i = 0; i < columns; i++) {
      drops.push(Math.random() * (h / fontSize));
    }

    ctx.font = fontSize + 'px monospace';
    ctx.textBaseline = 'top';

    // Prime the canvas with the base color so there's no flash of
    // transparent canvas before the first frame paints.
    ctx.fillStyle = '#0A0C12';
    ctx.fillRect(0, 0, w, h);
  }

  function draw() {
    ctx.fillStyle = 'rgba(10, 12, 18, ' + CLEAR_ALPHA + ')';
    ctx.fillRect(0, 0, w, h);

    frame++;
    var shouldStep = frame % 2 === 0;

    for (var i = 0; i < drops.length; i++) {
      var y = drops[i];
      var ch = CHARSET[(Math.random() * CHARSET.length) | 0];
      var alpha = MIN_OPACITY + Math.random() * (MAX_OPACITY - MIN_OPACITY);

      ctx.fillStyle = Math.random() < LIME_RATIO
        ? 'rgba(0, 255, 0, ' + alpha.toFixed(3) + ')'
        : 'rgba(122, 156, 255, ' + alpha.toFixed(3) + ')';

      ctx.fillText(ch, i * colWidth, y * fontSize);

      if (shouldStep) {
        var next = y + SPEED;
        drops[i] = (next * fontSize > h && Math.random() > 0.985) ? 0 : next;
      }
    }
  }

  var running = true;

  function loop() {
    if (running) draw();
    requestAnimationFrame(loop);
  }

  // Pause only when the tab is actually hidden (battery/perf), not
  // for prefers-reduced-motion — kept intentionally always-moving.
  document.addEventListener('visibilitychange', function () {
    running = !document.hidden;
  });

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(setup, 150);
  });

  setup();
  loop();
})();
