/* =============================================
   MATRIX BACKGROUND — full-page, subtle, slow
   "Dense fine static" variant: many thin columns,
   low opacity, mostly periwinkle with a rare lime
   glyph. Deliberately kept slow and always running
   (not paused for prefers-reduced-motion — that's
   an intentional design choice, not an oversight).
   Only pauses when the browser tab itself is hidden,
   purely to save battery, not for motion preference.

   Node 24 compatibility
   ----------------------
   This file is written to run in the browser (as a
   <script> on index.html), but it can also be run
   directly with `node matrix-bg.js` (Node 18/20/24)
   for local previewing/testing outside a browser.

   Node has no `document`/`window`/`requestAnimationFrame`,
   so when those aren't present this file switches to a
   small headless mode: it renders a fixed number of frames
   onto an off-screen canvas (using the optional "canvas"
   npm package, i.e. node-canvas) and writes the result out
   as matrix-bg-preview.png next to this file. If the
   "canvas" package isn't installed, it prints install
   instructions instead of crashing.
============================================= */
(function () {
  var CHARSET = '01アイウエオカキクケコ.:'.split('');

  // Slower fall + longer trail = calmer, ambient feel rather than
  // classic fast "code rain". Kept intentionally understated.
  var SPEED = 0.28;
  var CLEAR_ALPHA = 0.15;
  var LIME_RATIO = 0.05;
  var MIN_OPACITY = 0.06;
  var MAX_OPACITY = 0.16;

  var isBrowser = typeof document !== 'undefined' &&
    typeof document.getElementById === 'function' &&
    typeof window !== 'undefined';

  if (isBrowser) {
    runInBrowser();
  } else {
    runInNode();
  }

  // ---------------------------------------------
  // Shared drawing step. Mutates `state.drops` in
  // place and paints one frame onto `ctx`. Works
  // the same whether `ctx` came from a <canvas> in
  // the browser or from node-canvas in Node.
  // ---------------------------------------------
  function drawFrame(ctx, state) {
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

  function makeState(w, h, fontSize, colWidth) {
    var columns = Math.max(1, Math.ceil(w / colWidth));
    var drops = [];
    for (var i = 0; i < columns; i++) {
      drops.push(Math.random() * (h / fontSize));
    }
    return { w: w, h: h, fontSize: fontSize, colWidth: colWidth, drops: drops, frame: 0 };
  }

  // ---------------------------------------------
  // Browser mode (original behavior, unchanged)
  // ---------------------------------------------
  function runInBrowser() {
    var canvas = document.getElementById('matrix-bg');
    if (!canvas || !canvas.getContext) return;

    var ctx = canvas.getContext('2d');

    function isMobile() {
      return window.innerWidth <= 640;
    }

    var dpr, state;

    function setup() {
      dpr = window.devicePixelRatio || 1;
      var w = window.innerWidth;
      var h = window.innerHeight;

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Wider column spacing on mobile = fewer columns = lighter workload,
      // same subtle look at a lower cost.
      var fontSize = isMobile() ? 10 : 9;
      var colWidth = isMobile() ? 22 : 15;

      state = makeState(w, h, fontSize, colWidth);

      ctx.font = fontSize + 'px monospace';
      ctx.textBaseline = 'top';

      // Prime the canvas with the base color so there's no flash of
      // transparent canvas before the first frame paints.
      ctx.fillStyle = '#0A0C12';
      ctx.fillRect(0, 0, w, h);
    }

    var running = true;

    function loop() {
      if (running) drawFrame(ctx, state);
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
  }

  // ---------------------------------------------
  // Node mode: headless preview render.
  // `node matrix-bg.js` on Node 18/20/24.
  // ---------------------------------------------
  function runInNode() {
    var path = require('path');
    var fs = require('fs');

    var createCanvas;
    try {
      createCanvas = require('canvas').createCanvas;
    } catch (err) {
      console.error('matrix-bg.js: no browser "document" found, so this ran in Node headless mode,');
      console.error('but the optional "canvas" package (node-canvas) is not installed, so there is');
      console.error('nothing to draw to.');
      console.error('');
      console.error('  Install it and re-run to generate a preview PNG:');
      console.error('    npm install canvas');
      console.error('    node matrix-bg.js');
      process.exitCode = 1;
      return;
    }

    var w = 1200;
    var h = 630;
    var fontSize = 9;
    var colWidth = 15;
    var framesToRender = 240; // ~ a few seconds of motion at the browser's step rate

    var canvas = createCanvas(w, h);
    var ctx = canvas.getContext('2d');
    ctx.font = fontSize + 'px monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#0A0C12';
    ctx.fillRect(0, 0, w, h);

    var state = makeState(w, h, fontSize, colWidth);

    for (var i = 0; i < framesToRender; i++) {
      drawFrame(ctx, state);
    }

    var outPath = path.join(__dirname, 'matrix-bg-preview.png');
    var out = fs.createWriteStream(outPath);
    var stream = canvas.createPNGStream();
    stream.pipe(out);
    out.on('finish', function () {
      console.log('matrix-bg.js: rendered ' + framesToRender + ' frames headlessly.');
      console.log('Saved preview to ' + outPath);
    });
    out.on('error', function (err) {
      console.error('matrix-bg.js: failed to write preview PNG:', err);
      process.exitCode = 1;
    });
  }
})();
