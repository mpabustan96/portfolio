/* =============================================
   INDEX MATRIX — binary background for the Portal
   Warp scene (index.html only).

   This is a SEPARATE file from matrix-bg.js on
   purpose: matrix-bg.js is still shared by other
   pages on this site with its original mixed
   charset (numerals, katakana, symbols), and
   changing that shared file would silently change
   the background on every other page too. This file
   only ever runs on index.html.

   The rendering technique itself — the trailing
   rgba fillRect fade, the every-other-frame step,
   the narrow per-glyph opacity band, the same reset
   probability — is ported directly from matrix-bg.js,
   so it reads as the same effect as the rest of the
   site. The one deliberate difference is the charset:
   binary (0/1) only, per direction for this page.

   Mounts on <canvas id="pw-matrix-bg">, sits behind
   the Portal Warp WebGL canvas (see index.css), and
   is fully independent of scroll position, camera
   position, and portal/card rotation — it just runs.

   Always-on by design, same as matrix-bg.js: no
   prefers-reduced-motion branch. Only pauses when the
   tab itself is hidden, purely for battery.
============================================= */
(function () {
  var CHARSET = ['0', '1'];

  // Same tuning as matrix-bg.js's "dense fine static" variant.
  var SPEED = 0.28;
  var CLEAR_ALPHA = 0.15;
  var LIME_RATIO = 0.05;
  var MIN_OPACITY = 0.06;
  var MAX_OPACITY = 0.16;

  var canvas = document.getElementById('pw-matrix-bg');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  function isMobile() { return window.innerWidth <= 640; }

  var dpr, state;

  function makeState(w, h, fontSize, colWidth) {
    var columns = Math.max(1, Math.ceil(w / colWidth));
    var drops = [];
    for (var i = 0; i < columns; i++) drops.push(Math.random() * (h / fontSize));
    return { w: w, h: h, fontSize: fontSize, colWidth: colWidth, drops: drops, frame: 0 };
  }

  function drawFrame() {
    ctx.fillStyle = 'rgba(10, 12, 18, ' + CLEAR_ALPHA + ')';
    ctx.fillRect(0, 0, state.w, state.h);

    state.frame++;
    var shouldStep = state.frame % 2 === 0;

    for (var i = 0; i < state.drops.length; i++) {
      var y = state.drops[i];
      var ch = CHARSET[(Math.random() * CHARSET.length) | 0];
      var alpha = MIN_OPACITY + Math.random() * (MAX_OPACITY - MIN_OPACITY);

      ctx.fillStyle = Math.random() < LIME_RATIO
        ? 'rgba(0, 255, 0, ' + alpha.toFixed(3) + ')'
        : 'rgba(122, 156, 255, ' + alpha.toFixed(3) + ')';

      ctx.fillText(ch, i * state.colWidth, y * state.fontSize);

      if (shouldStep) {
        var next = y + SPEED;
        state.drops[i] = (next * state.fontSize > state.h && Math.random() > 0.985) ? 0 : next;
      }
    }
  }

  function setup() {
    dpr = window.devicePixelRatio || 1;
    var w = window.innerWidth;
    var h = window.innerHeight;

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var fontSize = isMobile() ? 10 : 9;
    var colWidth = isMobile() ? 22 : 15;
    state = makeState(w, h, fontSize, colWidth);

    ctx.font = fontSize + 'px monospace';
    ctx.textBaseline = 'top';

    ctx.fillStyle = '#0A0C12';
    ctx.fillRect(0, 0, w, h);
  }

  var running = true;

  function loop() {
    if (running) drawFrame();
    requestAnimationFrame(loop);
  }

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
