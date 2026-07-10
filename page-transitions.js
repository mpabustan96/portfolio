/* =============================================
   PAGE TRANSITIONS — two-phase illusion
   Plays an "exit" animation on the page you're
   leaving, remembers what was playing in
   sessionStorage, then the destination page reads
   that flag on load and plays the matching
   "entrance" animation. No reload is skipped —
   this is an illusion of continuity across a real
   navigation, not a single-page-app swap.

   Rules (per project):
   - index.html, about.html, education.html are
     "hub" pages; the other five are case studies.
     The effect is chosen by the DESTINATION alone:
   - Landing on index.html specifically plays NO
     cover at all — the homepage's own Portal Warp
     scene (index-3d.js) is the entrance now, and a
     Data Cascade cover flashing in front of it would
     just duplicate/clash with that scene's own
     opening beat. This is the one exception below.
   - Landing on another HUB page (about.html,
     education.html, from anywhere) plays
     DATA CASCADE: a bank of vertical bars sweeps
     closed in a stagger, then lifts away in reverse,
     same structure the old Shutter Slats used — but
     each bar is now a live column of falling code
     instead of a flat panel, colored by the
     DESTINATION'S own accent, over the destination's
     own background.
   - Landing on a CASE STUDY (from anywhere — a hub
     page or another case study) plays DECRYPT
     FLICKER: the destination's name scrambles in
     from random glyphs to plain text, like a cipher
     resolving, set in that case study's OWN hero
     display typeface, in its own accent color, over
     its own background, with a couple of thin
     glitch bands flashing top and bottom. This is
     the direct replacement for the old diagonal
     Signature Stroke — same personalization (font +
     color pulled from the destination), different
     mechanic (decrypt instead of a sweeping panel).
     This still plays when leaving index.html for a
     case study — only entering index.html itself is
     the exception.
   - The covering fill always matches the
     DESTINATION page's own theme colors (and, for
     Decrypt Flicker, its own typeface).
   - Pacing sits between snappy and theatrical
     (~550-650ms per phase) — deliberate enough to
     register as a moment, not so slow it drags.
   - Plays unconditionally, on every device and
     regardless of OS/browser motion settings, by
     request — there is no prefers-reduced-motion
     check in this file.
   - All overlay geometry is percentage/viewport
     based (no fixed pixel panels), so it holds up
     identically from a phone to an ultrawide monitor.
   - Because Decrypt Flicker can render a case
     study's font on a DIFFERENT page that never
     loaded it (e.g. leaving Counseling for Chiron
     shows Chiron's Russo One while still physically
     on the Counseling page), this file injects a
     combined Google Fonts stylesheet on every
     page covering all five case fonts, so the label
     never flashes a fallback typeface.

   Usage: include this once, near the very top of
   <body>, on every page listed in PAGES below:
     <script src="page-transitions.js"></script>
============================================= */
(function () {
  var PAGES = {
    'index.html':     { type: 'hub', bg: '#0A0C12', accent: '#7A9CFF', name: 'Home' },
    'about.html':     { type: 'hub', bg: '#080E1C', accent: '#0052D6', name: 'About' },
    'education.html': { type: 'hub', bg: '#1E3A2D', accent: '#F2EFE3', name: 'Bootcamp Projects' },

    'chiron.html': {
      type: 'case', bg: '#14171F', accent: '#C58A3F', name: 'Chiron',
      font: "'Russo One', sans-serif", weight: 400, italic: false,
      gfont: 'Russo+One'
    },
    'counseling.html': {
      type: 'case', bg: '#F0F6FA', accent: '#0F4C66', name: 'Connett Family Counseling',
      font: "'Cormorant', Georgia, serif", weight: 500, italic: false,
      gfont: 'Cormorant:wght@500'
    },
    'ui-ux-nest.html': {
      type: 'case', bg: '#F1F6F8', accent: '#06405A', name: 'UI/UX Nest',
      font: "'Space Grotesk', sans-serif", weight: 700, italic: false,
      gfont: 'Space+Grotesk:wght@700'
    },
    'albertinas-angels.html': {
      type: 'case', bg: '#1B2128', accent: '#9C8FC4', name: "Albertina's Angels",
      font: "'EB Garamond', Georgia, serif", weight: 400, italic: true,
      gfont: 'EB+Garamond:ital,wght@1,400'
    },
    'big-cat-rescue.html': {
      type: 'case', bg: '#3A3A26', accent: '#E3B633', name: 'Big Cat Rescue',
      font: "'Bevan', Georgia, serif", weight: 400, italic: false,
      gfont: 'Bevan'
    }
  };

  var STORAGE_KEY = 'mp-page-transition';
  var STALE_MS = 4500;

  // Data Cascade timing — medium (between snappy and theatrical)
  var CASCADE_BARS = 9;
  var CASCADE_STAGGER_MS = 34;
  var CASCADE_CLOSE_MS = 560;
  var CASCADE_PAUSE_MS = 130;
  var CASCADE_OPEN_MS = 580;
  // Hex/terminal glyph pool — reads as a real cipher resolving rather than
  // a font showcase. Feeds both the Data Cascade rain and the Decrypt
  // Flicker scramble below, so the two effects stay visually consistent.
  var CASCADE_GLYPHS = '0123456789ABCDEF#$%&*+=/\\<>'.split('');
  var CASCADE_FONT_SIZE = 12;   // px, size of each falling glyph
  var CASCADE_FALL_SPEED = 0.55; // rows per animation step (slowed from 0.9)
  var CASCADE_SPARKLE_RATIO = 0.12; // fraction of glyphs drawn in the lightened "sparkle" tint

  // Decrypt Flicker timing — medium (between snappy and theatrical)
  var DECRYPT_SCRAMBLE_DELAY_MS = 160; // gap before the scramble starts, after the cover fades in
  var DECRYPT_SCRAMBLE_FRAMES = 24;
  var DECRYPT_FRAME_MS = 46;
  var DECRYPT_HOLD_MS = 1320;  // exit: total time covered before navigating (delay + scramble + hold)
  var DECRYPT_PAUSE_MS = 150;  // entrance: how long the resolved name holds before clearing away
  var DECRYPT_CLEAR_MS = 460;  // how long the cover takes to fade + bands sweep away

  function filename(pathOrHref) {
    var clean = pathOrHref.replace(/[?#].*$/, '');
    var parts = clean.split('/');
    var base = parts[parts.length - 1];
    return base === '' ? 'index.html' : base;
  }

  function pageInfo(name) {
    return PAGES[name] || { type: 'hub', bg: '#0A0C12', accent: '#7A9CFF', name: name };
  }

  /* ---------- Color helpers (Data Cascade + Decrypt Flicker are both
     themed off each destination's own accent, so both need a couple of
     small hex utilities rather than fixed palette constants) ---------- */

  function hexToRgb(hex) {
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16)
    ];
  }

  function lighten(hex, amt) {
    var rgb = hexToRgb(hex);
    var r = Math.round(rgb[0] + (255 - rgb[0]) * amt);
    var g = Math.round(rgb[1] + (255 - rgb[1]) * amt);
    var b = Math.round(rgb[2] + (255 - rgb[2]) * amt);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /* ---------- Font preload (every page) ----------
     Ensures every case study's hero display font is available
     before a Decrypt Flicker label needs to render it, even
     when that label is showing on a DIFFERENT page that never
     linked that font itself (a hub page linking out to a case
     study, or one case study linking to another). */

  function ensureCaseFontsLoaded() {
    if (document.getElementById('mp-transition-fonts')) return;

    var families = [];
    for (var key in PAGES) {
      if (PAGES[key].gfont) families.push('family=' + PAGES[key].gfont);
    }
    var link = document.createElement('link');
    link.id = 'mp-transition-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?' + families.join('&') + '&display=swap';
    document.head.appendChild(link);
  }

  ensureCaseFontsLoaded();

  function overlayShell() {
    var wrap = document.createElement('div');
    wrap.id = 'mp-transition-overlay';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText = 'position:fixed; inset:0; z-index:99999; pointer-events:none; overflow:hidden;';
    document.body.appendChild(wrap);
    return wrap;
  }

  function ease(el, ms, delay) {
    el.style.transition = 'transform ' + ms + 'ms cubic-bezier(.6,0,.4,1)' + (delay ? ' ' + delay + 'ms' : '');
  }

  /* ---------- DATA CASCADE ----------
     Same staggered vertical-bar skeleton as the old Shutter
     Slats, but each bar renders its own live canvas of falling
     glyphs instead of a flat color panel. Bar background and
     glyph color both come from the DESTINATION theme, so the
     effect looks different landing on Home vs. About vs.
     Bootcamp Projects. */

  function buildCascadeBar(theme, barWidthPx, heightPx) {
    var bar = document.createElement('div');
    bar.style.cssText =
      'position:relative; overflow:hidden;' +
      'width:' + (100 / CASCADE_BARS) + '%; height:100%;' +
      'background:' + theme.bg + ';' +
      'transform:scaleY(0); transform-origin:top;';

    var canvas = document.createElement('canvas');
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(barWidthPx * dpr));
    canvas.height = Math.max(1, Math.floor(heightPx * dpr));
    canvas.style.cssText = 'position:absolute; inset:0; width:100%; height:100%;';
    bar.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    var colWidth = CASCADE_FONT_SIZE + 3;
    var colCount = Math.max(1, Math.floor(barWidthPx / colWidth));
    var drops = [];
    for (var c = 0; c < colCount; c++) drops.push(Math.random() * (heightPx / CASCADE_FONT_SIZE));

    return { el: bar, ctx: ctx, w: barWidthPx, h: heightPx, colWidth: colWidth, drops: drops };
  }

  function buildCascadeBars(theme) {
    var wrap = overlayShell();
    var row = document.createElement('div');
    row.style.cssText = 'position:absolute; inset:0; display:flex;';
    wrap.appendChild(row);

    var w = window.innerWidth;
    var h = window.innerHeight;
    var barWidthPx = w / CASCADE_BARS;

    var rgb = hexToRgb(theme.accent);
    var primary = 'rgba(' + rgb.join(',') + ',';
    var sparkle = lighten(theme.accent, 0.55);

    var bars = [];
    for (var i = 0; i < CASCADE_BARS; i++) {
      var b = buildCascadeBar(theme, barWidthPx, h);
      row.appendChild(b.el);
      bars.push(b);
    }

    var running = true;
    function paint() {
      bars.forEach(function (bar) {
        bar.ctx.fillStyle = 'rgba(0,0,0,0.20)';
        bar.ctx.fillRect(0, 0, bar.w, bar.h);
        bar.ctx.font = CASCADE_FONT_SIZE + 'px monospace';
        bar.ctx.textBaseline = 'top';
        for (var k = 0; k < bar.drops.length; k++) {
          var y = bar.drops[k];
          var ch = CASCADE_GLYPHS[(Math.random() * CASCADE_GLYPHS.length) | 0];
          var a = 0.45 + Math.random() * 0.4;
          bar.ctx.fillStyle = Math.random() < CASCADE_SPARKLE_RATIO ? sparkle : (primary + a.toFixed(2) + ')');
          bar.ctx.fillText(ch, k * bar.colWidth, y * CASCADE_FONT_SIZE);
          var next = y + CASCADE_FALL_SPEED;
          bar.drops[k] = (next * CASCADE_FONT_SIZE > bar.h && Math.random() > 0.9) ? -Math.random() * 6 : next;
        }
      });
      if (running) requestAnimationFrame(paint);
    }
    paint();

    return { wrap: wrap, bars: bars, stop: function () { running = false; } };
  }

  function playCascadeExit(theme, href) {
    var s = buildCascadeBars(theme);
    requestAnimationFrame(function () {
      s.bars.forEach(function (bar, i) {
        ease(bar.el, CASCADE_CLOSE_MS, i * CASCADE_STAGGER_MS);
        bar.el.style.transform = 'scaleY(1)';
      });
    });
    var total = CASCADE_CLOSE_MS + (CASCADE_BARS - 1) * CASCADE_STAGGER_MS;
    setTimeout(function () { window.location.href = href; }, total);
  }

  function playCascadeEntrance(theme) {
    var s = buildCascadeBars(theme);
    s.bars.forEach(function (bar) { bar.el.style.transform = 'scaleY(1)'; });
    void s.wrap.offsetHeight;
    setTimeout(function () {
      s.bars.forEach(function (bar, i) {
        var idx = CASCADE_BARS - 1 - i;
        bar.el.style.transformOrigin = 'bottom';
        ease(bar.el, CASCADE_OPEN_MS, idx * CASCADE_STAGGER_MS);
        bar.el.style.transform = 'scaleY(0)';
      });
      var total = CASCADE_OPEN_MS + (CASCADE_BARS - 1) * CASCADE_STAGGER_MS;
      setTimeout(function () { s.stop(); s.wrap.remove(); }, total + 60);
    }, CASCADE_PAUSE_MS);
  }

  /* ---------- DECRYPT FLICKER ----------
     Replaces the old diagonal Signature Stroke. A full-cover
     panel in the DESTINATION'S own background fades in, a
     couple of thin glitch bands flash top and bottom in its
     accent color, and the destination's name resolves out of
     scrambled glyphs into its own display typeface — the same
     "typography carries the personalization" idea Signature
     Stroke had, via a decrypt instead of a sweep. */

  function buildDecryptPanel(theme, label, resolved) {
    var wrap = overlayShell();

    var panel = document.createElement('div');
    panel.style.cssText =
      'position:absolute; inset:0; background:' + theme.bg + '; opacity:0;';

    var bandTop = document.createElement('div');
    bandTop.style.cssText =
      'position:absolute; left:0; right:0; top:0; height:16%;' +
      'background:' + theme.accent + '22; mix-blend-mode:screen;' +
      'transform:translateY(-100%);';

    var bandBottom = document.createElement('div');
    bandBottom.style.cssText =
      'position:absolute; left:0; right:0; bottom:0; height:11%;' +
      'background:' + theme.accent + '18; mix-blend-mode:screen;' +
      'transform:translateY(100%);';

    var text = document.createElement('div');
    text.style.cssText =
      'position:absolute; inset:0; display:flex; align-items:center; justify-content:center;' +
      'text-align:center; padding:0 2rem;' +
      'font-family:' + (theme.font || 'inherit') + ';' +
      'font-weight:' + (theme.weight || 400) + ';' +
      'font-style:' + (theme.italic ? 'italic' : 'normal') + ';' +
      'letter-spacing:0.01em;' +
      'font-size:clamp(1.6rem, 6vw, 3.6rem);' +
      'color:' + theme.accent + ';' +
      'opacity:0;';
    text.textContent = resolved ? label : '';

    wrap.appendChild(panel);
    wrap.appendChild(bandTop);
    wrap.appendChild(bandBottom);
    wrap.appendChild(text);

    return { wrap: wrap, panel: panel, bandTop: bandTop, bandBottom: bandBottom, text: text };
  }

  // Paced off requestAnimationFrame (elapsed time per frame) rather than
  // setInterval. Data Cascade's rain already runs on rAF; a setInterval
  // ticking independently on top of that was the actual smoothness bug —
  // two uncoordinated timer types competing for the same paint budget shows
  // up as stutter under load, especially on busier desktop tabs. Returns a
  // cancel function in place of the old setInterval id.
  function scramble(el, target, onDone) {
    var start = null;
    var cancelled = false;
    var lastFrame = -1;

    function tick(ts) {
      if (cancelled) return;
      if (start === null) start = ts;
      var frame = Math.min(DECRYPT_SCRAMBLE_FRAMES, Math.floor((ts - start) / DECRYPT_FRAME_MS));

      if (frame !== lastFrame) {
        lastFrame = frame;
        var revealCount = Math.floor((frame / DECRYPT_SCRAMBLE_FRAMES) * target.length);
        var out = '';
        for (var i = 0; i < target.length; i++) {
          if (i < revealCount || target[i] === ' ') out += target[i];
          else out += CASCADE_GLYPHS[(Math.random() * CASCADE_GLYPHS.length) | 0];
        }
        el.textContent = out;
      }

      if (frame >= DECRYPT_SCRAMBLE_FRAMES) {
        el.textContent = target;
        if (onDone) onDone();
        return;
      }
      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
    return function cancel() { cancelled = true; };
  }

  function playDecryptExit(theme, label, href) {
    var s = buildDecryptPanel(theme, label, false);

    requestAnimationFrame(function () {
      s.panel.style.transition = 'opacity 140ms ease';
      s.bandTop.style.transition = 'transform 420ms cubic-bezier(.6,0,.4,1)';
      s.bandBottom.style.transition = 'transform 420ms cubic-bezier(.6,0,.4,1) 40ms';
      s.text.style.transition = 'opacity 140ms ease';
      s.panel.style.opacity = '1';
      s.bandTop.style.transform = 'translateY(0)';
      s.bandBottom.style.transform = 'translateY(0)';
      s.text.style.opacity = '1';
    });

    var cancelScramble = function () {};
    setTimeout(function () {
      cancelScramble = scramble(s.text, label);
    }, DECRYPT_SCRAMBLE_DELAY_MS);

    setTimeout(function () {
      cancelScramble();
      window.location.href = href;
    }, DECRYPT_HOLD_MS);
  }

  function playDecryptEntrance(theme, label) {
    var s = buildDecryptPanel(theme, label, true);
    s.panel.style.opacity = '1';
    s.bandTop.style.transform = 'translateY(0)';
    s.bandBottom.style.transform = 'translateY(0)';
    s.text.style.opacity = '1';
    void s.wrap.offsetHeight;

    setTimeout(function () {
      s.panel.style.transition = 'opacity ' + DECRYPT_CLEAR_MS + 'ms ease';
      s.bandTop.style.transition = 'transform ' + DECRYPT_CLEAR_MS + 'ms cubic-bezier(.6,0,.4,1)';
      s.bandBottom.style.transition = 'transform ' + DECRYPT_CLEAR_MS + 'ms cubic-bezier(.6,0,.4,1) 40ms';
      s.text.style.transition = 'opacity ' + (DECRYPT_CLEAR_MS - 100) + 'ms ease';
      s.panel.style.opacity = '0';
      s.bandTop.style.transform = 'translateY(-100%)';
      s.bandBottom.style.transform = 'translateY(100%)';
      s.text.style.opacity = '0';
      setTimeout(function () { s.wrap.remove(); }, DECRYPT_CLEAR_MS + 60);
    }, DECRYPT_PAUSE_MS);
  }

  /* ---------- PLAN RESOLUTION ----------
     'none' is new: landing on index.html plays no cover at all,
     since the Portal Warp scene is now the entrance itself. */

  function resolvePlan(originName, destName) {
    if (destName === 'index.html') return { type: 'none' };
    var dest = pageInfo(destName);
    return { type: dest.type === 'case' ? 'decrypt' : 'cascade' };
  }

  function playExit(plan, destTheme, destName, href) {
    if (plan.type === 'none') {
      window.location.href = href;
      return;
    }
    if (plan.type === 'decrypt') {
      playDecryptExit(destTheme, pageInfo(destName).name, href);
    } else {
      playCascadeExit(destTheme, href);
    }
  }

  function playEntrance(state) {
    var ownName = filename(location.pathname);
    var theme = pageInfo(ownName);
    if (state.type === 'decrypt') {
      playDecryptEntrance(theme, theme.name);
    } else {
      playCascadeEntrance(theme);
    }
  }

  /* ---------- ORCHESTRATION (unchanged pattern) ---------- */

  function checkEntrance() {
    var raw;
    try { raw = sessionStorage.getItem(STORAGE_KEY); } catch (err) { raw = null; }
    if (!raw) return;
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (err) {}
    var state;
    try { state = JSON.parse(raw); } catch (err) { return; }
    if (!state || Date.now() - state.ts > STALE_MS) return;
    playEntrance(state);
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
    if (!PAGES[destName] || destName === originName) return;

    e.preventDefault();
    var plan = resolvePlan(originName, destName);
    if (plan.type !== 'none') {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ type: plan.type, ts: Date.now() }));
      } catch (err) {}
    }
    playExit(plan, pageInfo(destName), destName, href);
  });
})();
