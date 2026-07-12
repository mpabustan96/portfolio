/* =============================================
   PAGE TRANSITIONS — Iris Core
   Replaces the old four-effect system (Portal Iris
   Close / Grid Wipe / Data Cascade / Decrypt Flicker)
   with ONE unified transition used on every page:
   a Jarvis/HUD-style scan sequence built from a real
   WebGL object (Three.js), not a flat panel.

   What plays, every time, on every page:
     - a wireframe icosahedron core with two
       counter-rotating rings around it (this directly
       echoes the homepage's own Portal Warp torus
       rings, so the transition reads as the site's
       one continuous visual system, not a bolted-on
       loading spinner)
     - a circular HUD progress ring filling 0 -> 100%
       over a fixed duration
     - the destination page's name, resolving out of
       scrambled glyphs into plain text, set in that
       destination's OWN display typeface
     - a short status line ("DISCONNECTING" /
       "ARRIVING" / etc.)
   All of it recolored per-page from THEMES below
   (each page's own bg + accent), so Home, About,
   and each case study still look like themselves
   mid-transition, not a generic gray loader.

   TWO-PHASE ILLUSION (normal navigation):
   Same mechanism as before. Clicking an internal link
   plays the EXIT phase themed to the DESTINATION,
   stores a flag in sessionStorage, then navigates.
   The destination page reads that flag on load and
   plays the ENTRANCE phase, themed to itself.

   RELOAD (new): reloading the current page has no
   "other side" to hand off to, so instead of only
   playing an entrance, it replays the FULL exit ->
   pause -> entrance sequence on load, themed to
   itself both times — the same "leaving and
   re-arriving" motion, just looped back on one page.
   Detected via the Navigation Timing API.

   Requires Three.js. If a page hasn't already loaded
   it (case-study pages that run their own 3D scenes
   already have), this file loads it dynamically so
   the transition works identically on every page
   without editing every page's <head>.

   No prefers-reduced-motion branch here, by design —
   matching every other animated file on this site
   (index-3d.js, counseling-3d.js, matrix-bg.js): this
   is meant to always play, on every device.

   Usage: include this once, near the very top of
   <body>, on every page listed in THEMES below:
     <script src="page-transitions.js"></script>
============================================= */
(function () {
  var THEMES = {
    'index.html': {
      name: 'Home', bg: '#0A0C12', accent: '#7A9CFF',
      font: "'Unbounded', sans-serif", weight: 600, italic: false, gfont: 'Unbounded:wght@600'
    },
    'about.html': {
      // Pulled straight from about.css's own tokens (--void, --cyan),
      // so the transition matches the HUD identity it's landing on
      // instead of an older, now-stale placeholder color.
      name: 'About', bg: '#030509', accent: '#22D3EE',
      font: "'Share Tech Mono', monospace", weight: 400, italic: false, gfont: 'Share+Tech+Mono'
    },
    'education.html': {
      name: 'Bootcamp Projects', bg: '#0A2440', accent: '#8ECFFF',
      font: "'Share Tech Mono', monospace", weight: 400, italic: false, gfont: 'Share+Tech+Mono'
    },
    'chiron.html': {
      name: 'Chiron', bg: '#14171F', accent: '#C58A3F',
      font: "'Russo One', sans-serif", weight: 400, italic: false, gfont: 'Russo+One'
    },
    'counseling.html': {
      // Matches counseling.css's --mist / --harbor exactly.
      name: 'Connett Family Counseling', bg: '#F0F6FA', accent: '#0F4C66',
      font: "'Cormorant', Georgia, serif", weight: 500, italic: false, gfont: 'Cormorant:wght@500'
    },
    'ui-ux-nest.html': {
      name: 'UI/UX Nest', bg: '#F1F6F8', accent: '#06405A',
      font: "'Space Grotesk', sans-serif", weight: 700, italic: false, gfont: 'Space+Grotesk:wght@700'
    },
    'albertinas-angels.html': {
      name: "Albertina's Angels", bg: '#1B2128', accent: '#9C8FC4',
      font: "'EB Garamond', Georgia, serif", weight: 400, italic: true, gfont: 'EB+Garamond:ital,wght@1,400'
    },
    'big-cat-rescue.html': {
      name: 'Big Cat Rescue', bg: '#3A3A26', accent: '#E3B633',
      font: "'Bevan', Georgia, serif", weight: 400, italic: false, gfont: 'Bevan'
    }
  };

  var STORAGE_KEY = 'mp-page-transition';
  var STALE_MS = 4500;

  // Fixed timed durations (not tied to real asset/network load) —
  // simple and reliable, matches every other animated file's approach.
  var EXIT_MS = 1100;
  var PAUSE_MS = 150;
  var ENTRANCE_MS = 1100;

  var GLYPHS = '01ABCDEF#$%&*<>/\\'.split('');

  function filename(pathOrHref) {
    var clean = pathOrHref.replace(/[?#].*$/, '');
    var parts = clean.split('/');
    var base = parts[parts.length - 1];
    return base === '' ? 'index.html' : base;
  }

  function themeFor(name) {
    return THEMES[name] || { name: name, bg: '#0A0C12', accent: '#7A9CFF', font: 'inherit', weight: 400, italic: false };
  }

  function readableFg(bgHex) {
    var r = parseInt(bgHex.slice(1, 3), 16), g = parseInt(bgHex.slice(3, 5), 16), b = parseInt(bgHex.slice(5, 7), 16);
    var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.6 ? '#0A0C12' : '#EAF6FF';
  }

  /* ---------- font preload (every page) ----------
     Same reasoning as before: a Decrypt-style name reveal can render
     in a font the CURRENT page never linked (e.g. About handing off
     to Chiron shows Chiron's Russo One while still on About), so
     this loads every destination's display font on every page. */
  function ensureFontsLoaded() {
    if (document.getElementById('mp-transition-fonts')) return;
    var families = [];
    for (var key in THEMES) { if (THEMES[key].gfont) families.push('family=' + THEMES[key].gfont); }
    var link = document.createElement('link');
    link.id = 'mp-transition-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?' + families.join('&') + '&display=swap';
    document.head.appendChild(link);
  }
  ensureFontsLoaded();

  /* ---------- Three.js loader ----------
     Pages that already run their own 3D scene (Home, Connett
     Counseling) have already loaded r128 by the time this runs, so
     this resolves instantly there. Any other page gets it injected
     here, once, so the transition never needs page-by-page <head>
     edits to work. */
  var threeReady = null;
  function ensureThree() {
    if (threeReady) return threeReady;
    threeReady = new Promise(function (resolve) {
      if (window.THREE) { resolve(true); return; }
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      s.onload = function () { resolve(true); };
      s.onerror = function () { resolve(false); }; // HUD still runs without the 3D layer
      document.head.appendChild(s);
    });
    return threeReady;
  }
  ensureThree();

  /* ---------- scramble reveal (Decrypt-style, unchanged idiom) ---------- */
  function scramble(el, target, ms, onDone) {
    var frames = 22, start = null, cancelled = false;
    function tick(ts) {
      if (cancelled) return;
      if (start === null) start = ts;
      var f = Math.min(frames, Math.floor((ts - start) / (ms / frames)));
      var revealCount = Math.floor((f / frames) * target.length);
      var out = '';
      for (var i = 0; i < target.length; i++) {
        out += (i < revealCount || target[i] === ' ') ? target[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (f < frames) requestAnimationFrame(tick); else if (onDone) onDone();
    }
    requestAnimationFrame(tick);
    return function cancel() { cancelled = true; };
  }

  /* ============================================================
     IRIS CORE OVERLAY — one instance is built per transition and
     torn down after, since transitions are infrequent (unlike the
     per-page 3D scenes, which run continuously).
     ============================================================ */
  var RING_R = 85;
  var RING_CIRC = 2 * Math.PI * RING_R;

  function buildOverlay() {
    var wrap = document.createElement('div');
    wrap.id = 'mp-transition-overlay';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText = 'position:fixed; inset:0; z-index:99999; pointer-events:none; overflow:hidden; opacity:0; transition:opacity 240ms ease;';

    var bgPanel = document.createElement('div');
    bgPanel.style.cssText = 'position:absolute; inset:0;';

    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute; inset:0; width:100%; height:100%;';

    var hud = document.createElement('div');
    hud.style.cssText = 'position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; font-family:"Share Tech Mono", monospace;';

    var ringWrap = document.createElement('div');
    ringWrap.style.cssText = 'position:relative; width:190px; height:190px; margin-bottom:1.5rem;';
    ringWrap.innerHTML =
      '<svg viewBox="0 0 190 190" style="transform:rotate(-90deg); width:100%; height:100%;">' +
        '<circle cx="95" cy="95" r="' + RING_R + '" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="2"></circle>' +
        '<circle class="mp-ring-fill" cx="95" cy="95" r="' + RING_R + '" fill="none" stroke-width="2" stroke-linecap="round" ' +
          'stroke-dasharray="' + RING_CIRC + '" stroke-dashoffset="' + RING_CIRC + '"></circle>' +
      '</svg>' +
      '<div class="mp-ring-pct" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:0.95rem;">0%</div>';

    var status = document.createElement('div');
    status.className = 'mp-status';
    status.style.cssText = 'font-size:0.7rem; letter-spacing:0.18em; text-transform:uppercase; opacity:0.75; margin-bottom:0.9rem;';

    var name = document.createElement('div');
    name.className = 'mp-name';
    name.style.cssText = 'font-size:clamp(1.4rem, 4vw, 2.6rem); letter-spacing:0.03em; min-height:1.3em; text-align:center; padding:0 1.5rem;';

    hud.appendChild(ringWrap);
    hud.appendChild(status);
    hud.appendChild(name);

    wrap.appendChild(bgPanel);
    wrap.appendChild(canvas);
    wrap.appendChild(hud);
    document.body.appendChild(wrap);

    var ringFillEl = ringWrap.querySelector('.mp-ring-fill');
    var ringPctEl = ringWrap.querySelector('.mp-ring-pct');

    return {
      wrap: wrap, bgPanel: bgPanel, canvas: canvas,
      status: status, name: name, ringFill: ringFillEl, ringPct: ringPctEl
    };
  }

  function buildScene(canvas) {
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 50);
    camera.position.z = 6;

    var group = new THREE.Group();
    scene.add(group);

    var coreGeo = new THREE.IcosahedronGeometry(1.15, 1);
    var coreMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.9 });
    var core = new THREE.LineSegments(new THREE.EdgesGeometry(coreGeo), coreMat);
    group.add(core);

    var ring1Mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55 });
    var ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.008, 8, 90), ring1Mat);
    var ring2Mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.35 });
    var ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.006, 8, 90), ring2Mat);
    ring2.rotation.x = Math.PI / 2.4;
    group.add(ring1, ring2);

    function setColor(hex) {
      var c = new THREE.Color(hex);
      coreMat.color = c; ring1Mat.color = c; ring2Mat.color = c;
    }

    var raf = null, t0 = null;
    function animate(ts) {
      if (t0 === null) t0 = ts;
      var t = (ts - t0) / 1000;
      core.rotation.y = t * 0.5; core.rotation.x = t * 0.2;
      ring1.rotation.z = t * 0.4;
      ring2.rotation.z = -t * 0.3;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    }
    raf = requestAnimationFrame(animate);

    function resize() {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);

    function dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      coreGeo.dispose(); coreMat.dispose(); ring1.geometry.dispose(); ring1Mat.dispose();
      ring2.geometry.dispose(); ring2Mat.dispose();
      renderer.dispose();
    }

    return { setColor: setColor, dispose: dispose };
  }

  function animateProgress(el, pctEl, durationMs, onDone) {
    var start = null;
    function tick(ts) {
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / durationMs);
      var pct = Math.round(t * 100);
      el.style.strokeDashoffset = RING_CIRC - (RING_CIRC * pct / 100);
      pctEl.textContent = pct + '%';
      if (t < 1) requestAnimationFrame(tick); else if (onDone) onDone();
    }
    requestAnimationFrame(tick);
  }

  function applyTheme(o, theme) {
    var fg = readableFg(theme.bg);
    o.bgPanel.style.background = theme.bg;
    o.status.style.color = fg;
    o.name.style.color = theme.accent;
    o.name.style.fontFamily = theme.font || 'inherit';
    o.name.style.fontWeight = theme.weight || 400;
    o.name.style.fontStyle = theme.italic ? 'italic' : 'normal';
    o.ringFill.style.stroke = theme.accent;
    o.ringFill.style.filter = 'drop-shadow(0 0 6px ' + theme.accent + ')';
    o.ringPct.style.color = fg;
  }

  /* ---------- one phase: fade to theme, fill ring, resolve name ---------- */
  function runPhase(o, scene, theme, label, statusText, durationMs, cb) {
    applyTheme(o, theme);
    if (scene) scene.setColor(theme.accent);
    o.status.textContent = statusText;
    scramble(o.name, label, Math.min(500, durationMs * 0.4));
    o.ringFill.style.strokeDashoffset = RING_CIRC;
    o.ringPct.textContent = '0%';
    animateProgress(o.ringFill, o.ringPct, durationMs, cb);
  }

  /* ---------- EXIT: play, then actually navigate ---------- */
  function playExit(destName, href) {
    var theme = themeFor(destName);
    var o = buildOverlay();
    requestAnimationFrame(function () { o.wrap.style.opacity = '1'; });

    ensureThree().then(function (ok) {
      var scene = ok ? buildScene(o.canvas) : null;
      runPhase(o, scene, theme, theme.name, 'DISCONNECTING', EXIT_MS, function () {
        setTimeout(function () { window.location.href = href; }, 40);
      });
    });
  }

  /* ---------- ENTRANCE: normal arrival, themed to THIS page ---------- */
  function playEntrance() {
    var ownName = filename(location.pathname);
    var theme = themeFor(ownName);
    var o = buildOverlay();
    o.wrap.style.opacity = '1';

    ensureThree().then(function (ok) {
      var scene = ok ? buildScene(o.canvas) : null;
      runPhase(o, scene, theme, theme.name, 'ARRIVING', ENTRANCE_MS, function () {
        o.wrap.style.opacity = '0';
        setTimeout(function () { if (scene) scene.dispose(); o.wrap.remove(); }, 300);
      });
    });
  }

  /* ---------- RELOAD: no real "other side" to hand off to, so this
     replays the full exit -> pause -> entrance motion on load,
     themed to this page both times. ---------- */
  function playReloadSequence() {
    var ownName = filename(location.pathname);
    var theme = themeFor(ownName);
    var o = buildOverlay();
    o.wrap.style.opacity = '1';

    ensureThree().then(function (ok) {
      var scene = ok ? buildScene(o.canvas) : null;
      runPhase(o, scene, theme, theme.name, 'RE-ESTABLISHING LINK', EXIT_MS, function () {
        setTimeout(function () {
          runPhase(o, scene, theme, theme.name, 'SYNCING', ENTRANCE_MS, function () {
            o.wrap.style.opacity = '0';
            setTimeout(function () { if (scene) scene.dispose(); o.wrap.remove(); }, 300);
          });
        }, PAUSE_MS);
      });
    });
  }

  /* ---------- navigation-type detection ---------- */
  function isReload() {
    try {
      var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      if (nav) return nav.type === 'reload';
      if (performance.navigation) return performance.navigation.type === 1;
    } catch (err) {}
    return false;
  }

  /* ---------- orchestration ---------- */
  function checkEntrance() {
    if (isReload()) {
      // A stale sessionStorage flag from a prior real navigation would
      // otherwise also try to fire an entrance-only replay right after
      // this; clear it so reload always plays its own full sequence.
      try { sessionStorage.removeItem(STORAGE_KEY); } catch (err) {}
      playReloadSequence();
      return;
    }
    var raw;
    try { raw = sessionStorage.getItem(STORAGE_KEY); } catch (err) { raw = null; }
    if (!raw) return;
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (err) {}
    var state;
    try { state = JSON.parse(raw); } catch (err) { return; }
    if (!state || Date.now() - state.ts > STALE_MS) return;
    playEntrance();
  }

  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      var stale = document.getElementById('mp-transition-overlay');
      if (stale) stale.remove();
    }
  });

  checkEntrance();

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#' || a.target === '_blank' || a.hasAttribute('download')) return;
    if (/^https?:\/\//i.test(href) || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0) return;

    var destName = filename(href);
    var originName = filename(location.pathname);
    if (!THEMES[destName] || destName === originName) return;

    e.preventDefault();
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ts: Date.now() }));
    } catch (err) {}
    playExit(destName, href);
  });
})();
