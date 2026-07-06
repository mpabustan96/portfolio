/* =============================================
   GLITCH BACKGROUND — full-page, subtle, slow
   "Ambient system glitch" variant: rare, faint
   flickers of data corruption (blue/gold blocks,
   an even rarer red one) plus an occasional soft
   glitch bar. Deliberately slow and understated —
   a quiet background hum, not a foreground effect.
   Colors are pulled from about.css's own palette
   (--blue-bright, --gold, --red) so this reads as
   native to the About page rather than a reused
   asset from elsewhere on the site.

   Like matrix-bg.js, this is always running (not
   paused for prefers-reduced-motion — an
   intentional, matching design choice) and only
   pauses when the browser tab itself is hidden,
   purely to save battery.

   Node 24 compatibility
   ----------------------
   This file runs in the browser (as a <script> on
   about.html), but it can also be run directly with
   `node glitch-bg.js` (Node 18/20/24) for local
   previewing/testing outside a browser.

   Node has no `document`/`window`/`requestAnimationFrame`,
   so when those aren't present this file switches to a
   small headless mode: it renders a fixed number of frames
   onto an off-screen canvas (using the optional "canvas"
   npm package, i.e. node-canvas) and writes the result out
   as glitch-bg-preview.png next to this file. If the
   "canvas" package isn't installed, it prints install
   instructions instead of crashing.
============================================= */
(function () {
  var BG = '#080E1C'; // about.css --void

  // Tuned slow + subtle: rare spawns, low alpha ceiling, long fade —
  // meant to sit quietly behind content, not draw the eye.
  var BLOCK_SPAWN_CHANCE = 0.05;
  var GLITCH_BAR_CHANCE = 0.004;
  var LIFE_DECAY = 0.015;
  var MAX_ALPHA = 0.16;
  var GOLD_RATIO = 0.12;
  var RED_RATIO = 0.03;

  var isBrowser = typeof document !== 'undefined' &&
    typeof document.getElementById === 'function' &&
    typeof window !== 'undefined';

  if (isBrowser) {
    runInBrowser();
  } else {
    runInNode();
  }

  // ---------------------------------------------
  // Shared drawing step. Mutates `state` in place
  // and paints one frame onto `ctx`. Works the same
  // whether `ctx` came from a <canvas> in the
  // browser or from node-canvas in Node.
  // ---------------------------------------------
  function spawnBlock(state) {
    var roll = Math.random();
    var color = roll < RED_RATIO
      ? '206,32,40'
      : (roll < RED_RATIO + GOLD_RATIO ? '245,197,24' : '74,127,232');
    state.blocks.push({
      x: Math.random() * state.w,
      y: Math.random() * state.h,
      w: 8 + Math.random() * 46,
      h: 1.5 + Math.random() * 5,
      life: 1,
      color: color
    });
  }

  function drawFrame(ctx, state) {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, state.w, state.h);

    if (Math.random() < BLOCK_SPAWN_CHANCE) spawnBlock(state);
    if (!state.glitchBar && Math.random() < GLITCH_BAR_CHANCE) {
      state.glitchBar = { y: Math.random() * state.h, life: 1 };
    }

    for (var i = state.blocks.length - 1; i >= 0; i--) {
      var b = state.blocks[i];
      b.life -= LIFE_DECAY;
      if (b.life <= 0) {
        state.blocks.splice(i, 1);
        continue;
      }
      ctx.fillStyle = 'rgba(' + b.color + ',' + (b.life * MAX_ALPHA) + ')';
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }

    if (state.glitchBar) {
      ctx.fillStyle = 'rgba(200,210,235,' + (state.glitchBar.life * 0.12) + ')';
      ctx.fillRect(0, state.glitchBar.y, state.w, 2);
      state.glitchBar.life -= 0.08;
      if (state.glitchBar.life <= 0) state.glitchBar = null;
    }
  }

  function makeState(w, h) {
    return { w: w, h: h, blocks: [], glitchBar: null };
  }

  // ---------------------------------------------
  // Browser mode
  // ---------------------------------------------
  function runInBrowser() {
    var canvas = document.getElementById('glitch-bg');
    if (!canvas || !canvas.getContext) return;

    var ctx = canvas.getContext('2d');
    var dpr, state;

    function setup() {
      dpr = window.devicePixelRatio || 1;
      var w = window.innerWidth;
      var h = window.innerHeight;

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      state = makeState(w, h);

      // Prime the canvas with the base color so there's no flash of
      // transparent canvas before the first frame paints.
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);
    }

    var running = true;

    function loop() {
      if (running) drawFrame(ctx, state);
      requestAnimationFrame(loop);
    }

    // Pause only when the tab is actually hidden (battery/perf), not
    // for prefers-reduced-motion — kept intentionally always-moving,
    // matching matrix-bg.js.
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
  // `node glitch-bg.js` on Node 18/20/24.
  // ---------------------------------------------
  function runInNode() {
    var path = require('path');
    var fs = require('fs');

    var createCanvas;
    try {
      createCanvas = require('canvas').createCanvas;
    } catch (err) {
      console.error('glitch-bg.js: no browser "document" found, so this ran in Node headless mode,');
      console.error('but the optional "canvas" package (node-canvas) is not installed, so there is');
      console.error('nothing to draw to.');
      console.error('');
      console.error('  Install it and re-run to generate a preview PNG:');
      console.error('    npm install canvas');
      console.error('    node glitch-bg.js');
      process.exitCode = 1;
      return;
    }

    var w = 1200;
    var h = 630;
    // Spawns are rare by design, so render more frames than
    // matrix-bg.js's preview to give the effect room to show up.
    var framesToRender = 420;

    var canvas = createCanvas(w, h);
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    var state = makeState(w, h);

    for (var i = 0; i < framesToRender; i++) {
      drawFrame(ctx, state);
    }

    var outPath = path.join(__dirname, 'glitch-bg-preview.png');
    var out = fs.createWriteStream(outPath);
    var stream = canvas.createPNGStream();
    stream.pipe(out);
    out.on('finish', function () {
      console.log('glitch-bg.js: rendered ' + framesToRender + ' frames headlessly.');
      console.log('Saved preview to ' + outPath);
    });
    out.on('error', function (err) {
      console.error('glitch-bg.js: failed to write preview PNG:', err);
      process.exitCode = 1;
    });
  }
})();
