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
   - Landing on a CASE STUDY (from anywhere — a hub
     page or another case study) plays SIGNATURE
     STROKE: a single bold diagonal bar carrying the
     destination's name, set in that case study's OWN
     hero display typeface, sweeping across like a
     signature being drawn. Direction depends on
     whether the clicked link has class="next" or
     class="prev" (already present on every
     project-nav link; defaults to "next" otherwise).
   - Landing on a HUB page (from anywhere) plays
     SHUTTER SLATS: a bank of vertical bars that sweep
     closed in a stagger, then lift away in reverse.
   - The covering fill always matches the
     DESTINATION page's own theme colors.
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
   - Because a Signature Stroke can render a case
     study's font on a DIFFERENT page that never
     loaded it (e.g. leaving Counseling for Chiron
     shows Chiron's Russo One while still physically
     on the Counseling page), this file injects a
     combined Google Fonts stylesheet on every
     case-study page covering all five case fonts, so
     the label never flashes a fallback typeface.

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

  // Shutter Slats timing — medium (between snappy and theatrical)
  var SHUTTER_BARS = 8;
  var SHUTTER_STAGGER_MS = 32;
  var SHUTTER_CLOSE_MS = 560;
  var SHUTTER_PAUSE_MS = 130;
  var SHUTTER_OPEN_MS = 580;

  // Signature Stroke timing — medium (between snappy and theatrical)
  var SIGNATURE_COVER_MS = 620;
  var SIGNATURE_PAUSE_MS = 130;
  var SIGNATURE_OPEN_MS = 640;

  function filename(pathOrHref) {
    var clean = pathOrHref.replace(/[?#].*$/, '');
    var parts = clean.split('/');
    var base = parts[parts.length - 1];
    return base === '' ? 'index.html' : base;
  }

  function pageInfo(name) {
    return PAGES[name] || { type: 'hub', bg: '#0A0C12', accent: '#7A9CFF', name: name };
  }

  /* ---------- Font preload (case-study pages only) ----------
     Ensures every case study's hero display font is available
     before a Signature Stroke label needs to render it, even
     when that label is showing on a DIFFERENT case study's page
     that never linked that font itself. */

  function ensureCaseFontsLoaded() {
    // Loaded on every page (hub or case): a hub page can now trigger a
    // Signature Stroke label whenever it links OUT to a case study, so
    // the destination's font needs to be ready there too, not just on
    // case-study pages themselves.
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

  /* ---------- SHUTTER SLATS ---------- */

  function buildShutterBars(theme) {
    var wrap = overlayShell();
    var bars = [];
    for (var i = 0; i < SHUTTER_BARS; i++) {
      var bar = document.createElement('div');
      bar.style.cssText =
        'position:absolute; top:0; bottom:0;' +
        'left:' + (i * 100 / SHUTTER_BARS) + '%;' +
        'width:' + (100 / SHUTTER_BARS) + '%;' +
        'background:' + theme.bg + ';' +
        'border-right:1px solid ' + theme.accent + '55;' +
        'transform:scaleY(0); transform-origin:top;';
      wrap.appendChild(bar);
      bars.push(bar);
    }
    return { wrap: wrap, bars: bars };
  }

  function playShutterExit(theme, href) {
    var s = buildShutterBars(theme);
    requestAnimationFrame(function () {
      s.bars.forEach(function (bar, i) {
        ease(bar, SHUTTER_CLOSE_MS, i * SHUTTER_STAGGER_MS);
        bar.style.transform = 'scaleY(1)';
      });
    });
    var total = SHUTTER_CLOSE_MS + (SHUTTER_BARS - 1) * SHUTTER_STAGGER_MS;
    setTimeout(function () { window.location.href = href; }, total);
  }

  function playShutterEntrance(theme) {
    var s = buildShutterBars(theme);
    s.bars.forEach(function (bar) { bar.style.transform = 'scaleY(1)'; });
    void s.wrap.offsetHeight;
    setTimeout(function () {
      s.bars.forEach(function (bar, i) {
        var idx = SHUTTER_BARS - 1 - i;
        bar.style.transformOrigin = 'bottom';
        ease(bar, SHUTTER_OPEN_MS, idx * SHUTTER_STAGGER_MS);
        bar.style.transform = 'scaleY(0)';
      });
      var total = SHUTTER_OPEN_MS + (SHUTTER_BARS - 1) * SHUTTER_STAGGER_MS;
      setTimeout(function () { s.wrap.remove(); }, total + 80);
    }, SHUTTER_PAUSE_MS);
  }

  /* ---------- SIGNATURE STROKE ---------- */

  function buildSignaturePanel(theme, label) {
    var wrap = overlayShell();
    var panel = document.createElement('div');
    panel.style.cssText =
      'position:absolute; top:-100%; bottom:-100%; left:-100%; width:300%;' +
      'background:' + theme.bg + ';' +
      'border-top:2px solid ' + theme.accent + ';' +
      'border-bottom:2px solid ' + theme.accent + ';' +
      'display:flex; align-items:center; justify-content:center;' +
      'transform:rotate(-6deg) translateX(-140%);';
    var tag = document.createElement('span');
    tag.textContent = label;
    tag.style.cssText =
      'display:inline-block; transform:rotate(6deg);' +
      'font-family:' + (theme.font || 'inherit') + ';' +
      'font-weight:' + (theme.weight || 400) + ';' +
      'font-style:' + (theme.italic ? 'italic' : 'normal') + ';' +
      'letter-spacing:0.01em; white-space:nowrap;' +
      'font-size:clamp(1.6rem, 6vw, 3.6rem);' +
      'color:' + theme.accent + ';';
    panel.appendChild(tag);
    wrap.appendChild(panel);
    return { wrap: wrap, panel: panel };
  }

  function playSignatureExit(theme, label, direction, href) {
    var startX = direction === 'prev' ? '140%' : '-140%';
    var s = buildSignaturePanel(theme, label);
    s.panel.style.transform = 'rotate(-6deg) translateX(' + startX + ')';
    requestAnimationFrame(function () {
      ease(s.panel, SIGNATURE_COVER_MS);
      s.panel.style.transform = 'rotate(-6deg) translateX(0%)';
    });
    setTimeout(function () { window.location.href = href; }, SIGNATURE_COVER_MS);
  }

  function playSignatureEntrance(theme, label, direction) {
    var s = buildSignaturePanel(theme, label);
    s.panel.style.transform = 'rotate(-6deg) translateX(0%)';
    void s.wrap.offsetHeight;
    var exitX = direction === 'prev' ? '-140%' : '140%';
    setTimeout(function () {
      ease(s.panel, SIGNATURE_OPEN_MS);
      s.panel.style.transform = 'rotate(-6deg) translateX(' + exitX + ')';
      setTimeout(function () { s.wrap.remove(); }, SIGNATURE_OPEN_MS + 80);
    }, SIGNATURE_PAUSE_MS);
  }

  /* ---------- PLAN RESOLUTION ---------- */

  function resolvePlan(originName, destName, linkEl) {
    var dest = pageInfo(destName);
    if (dest.type === 'case') {
      var direction = linkEl && linkEl.classList.contains('prev') ? 'prev' : 'next';
      return { type: 'signature', direction: direction };
    }
    return { type: 'shutter', direction: null };
  }

  function playExit(plan, destTheme, destName, href) {
    if (plan.type === 'signature') {
      playSignatureExit(destTheme, pageInfo(destName).name, plan.direction, href);
    } else {
      playShutterExit(destTheme, href);
    }
  }

  function playEntrance(state) {
    var ownName = filename(location.pathname);
    var theme = pageInfo(ownName);
    if (state.type === 'signature') {
      playSignatureEntrance(theme, theme.name, state.direction);
    } else {
      playShutterEntrance(theme);
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
    var plan = resolvePlan(originName, destName, a);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ type: plan.type, direction: plan.direction, ts: Date.now() }));
    } catch (err) {}
    playExit(plan, pageInfo(destName), destName, href);
  });
})();
