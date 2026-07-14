/* =============================================
   PAGE TRANSITIONS — Center Split
   Replaces the old Three.js rigid-hinge page turn
   with a pure CSS 3D transform: the page splits down
   the center and both halves swing outward (like a
   book cover opening), revealing the destination
   underneath. No canvas, no WebGL, no font-loading
   race for a render surface — just DOM + CSS
   transforms, so there's nothing to wait on before
   the animation can start.

   TWO SPLITS PER NAVIGATION, across TWO real page loads:

     SPLIT 1 — "this page" -> "destination cover"
       Plays on the page you're LEAVING (the EXIT
       phase), before navigation actually happens.
       The current page splits open down the center to
       reveal the destination's COVER: its name, set in
       that page's own display font/weight (from THEMES),
       on that page's own bg/accent.

     [ real browser navigation happens here ]

     SPLIT 2 — "cover" -> "table of contents"
       Plays on the page you just ARRIVED at (the
       ENTRANCE phase). It paints the exact same Cover
       instantly on load (no flash / refade — state is
       handed off via sessionStorage), then splits again
       to reveal that page's CONTENTS list, still on the
       destination's own palette, before fading into the
       real page underneath.

   RELOAD: no "other side" to hand off to, so it
   replays both splits on the same page: cover ->
   (pause) -> cover -> contents -> (pause) -> fade into
   the real page.

   SECTION LABELS: the Contents page needs real section
   names per case study. I only have index.html/index.css
   in this project, so the entries below for every OTHER
   page are best-guess PLACEHOLDERS — search "PLACEHOLDER"
   below and replace with the real beat/section names
   whenever those files are handed over. Nothing else in
   this file needs to change when you do that.

   No prefers-reduced-motion branch, by design, same
   precedent as every other animated file on this site.

   Usage — include once, near the very top of <body>,
   on every page:
     <script src="page-transitions.js"></script>
============================================= */
(function () {
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  // A single scrollTo(0,0) at script-eval time isn't enough on its own:
  // it can still get overridden by the browser's own scroll-restore pass
  // on a hard reload, and it never runs at all on a bfcache restore
  // (back/forward), since the script doesn't re-execute there. Forcing
  // it again on DOMContentLoaded, on load, and on every pageshow covers
  // all three of those cases, so the page always opens at the top
  // regardless of how it was reached.
  function forceScrollTop() {
    window.scrollTo(0, 0);
  }
  forceScrollTop();
  document.addEventListener('DOMContentLoaded', forceScrollTop);
  window.addEventListener('load', forceScrollTop);

  /* ---------- per-page theme + section labels ---------- */
  var THEMES = {
    'index.html': {
      name: 'Home', bg: '#F0E9D6', accent: '#233A5E',
      font: "'Fraunces', serif", weight: 500, italic: false, gfont: 'Fraunces:opsz,wght@9..144,500'
    },
    'about.html': {
      name: 'About', bg: '#F0E9D6', accent: '#233A5E',
      font: "'Fraunces', serif", weight: 500, italic: false, gfont: 'Fraunces:opsz,wght@9..144,500'
    },
    'education.html': {
      name: 'Bootcamp Projects', bg: '#0A1830', accent: '#6FE3FF',
      font: "'Space Grotesk', sans-serif", weight: 500, italic: false, gfont: 'Space+Grotesk:wght@500'
    },
    'chiron.html': {
      name: 'Chiron', bg: '#14171F', accent: '#C58A3F',
      font: "'Russo One', sans-serif", weight: 400, italic: false, gfont: 'Russo+One'
    },
    'counseling.html': {
      name: 'Connett Family Counseling', bg: '#F0F6FA', accent: '#0F4C66',
      font: "'Cormorant', Georgia, serif", weight: 500, italic: false, gfont: 'Cormorant:wght@500',
      sans: "'Nunito', -apple-system, BlinkMacSystemFont, sans-serif", sansGfont: 'Nunito:wght@600;700',
      labelColor: '#2F7A9E', lineColor: '#D7E5EC'
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

  // Real section / page contents per page, pulled directly from each
  // page's own section headings (or, for the education hub, its three
  // project titles) — no more placeholders.
  var SECTIONS = {
    'index.html': ['Work', 'About', "Let's talk"],
    'about.html': ['Philosophy', 'How I Got Here', 'Background & Skills', 'Availability'],
    'education.html': ['Big Cat Rescue', 'UI/UX Nest', 'Chiron'],
    'chiron.html': ['The Problem', 'Research & Discovery', 'Define & Ideate', 'User Flow', 'Design Decisions', 'Results & Reflection'],
    'counseling.html': ['The Problem', 'Research & Discovery', 'Define & Ideate', 'Design Decisions', 'Results & Reflection'],
    'ui-ux-nest.html': ['The Problem', 'Research & Discovery', 'Define & Ideate', 'Design Decisions', 'Usability Testing', 'Results & Reflection'],
    'albertinas-angels.html': ['The Problem', 'Research & Discovery', 'Define & Ideate', 'Design Decisions', 'Results & Reflection'],
    'big-cat-rescue.html': ['The Problem', 'Research & Discovery', 'Define & Ideate', 'Design Decisions', 'Usability Testing', 'Results & Reflection']
  };

  var BOOK_MONO = "'Space Mono', monospace";

  var STORAGE_KEY = 'mp-page-transition';
  var STALE_MS = 5000;

  // Fast, CSS-driven timings — the whole point of switching off the
  // Three.js hinge was to make this feel snappier, not just different.
  var SPLIT_MS = 620;
  var HOLD_MS = 450;
  var FADE_MS = 320;
  var NAV_DELAY = 50;

  function filename(pathOrHref) {
    var clean = pathOrHref.replace(/[?#].*$/, '');
    var parts = clean.split('/');
    var base = parts[parts.length - 1];
    return base === '' ? 'index.html' : base;
  }

  function themeFor(name) {
    return THEMES[name] || { name: name, bg: '#0A0C12', accent: '#7A9CFF', font: "'Fraunces', serif", weight: 500, italic: false };
  }

  function sectionsFor(name) {
    return SECTIONS[name] || [];
  }

  function withPageName(theme, pageName) {
    var t = {};
    for (var k in theme) t[k] = theme[k];
    t._pageName = pageName;
    return t;
  }

  function readableFg(bgHex) {
    var r = parseInt(bgHex.slice(1, 3), 16), g = parseInt(bgHex.slice(3, 5), 16), b = parseInt(bgHex.slice(5, 7), 16);
    var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.6 ? '#0A0C12' : '#EAF6FF';
  }

  /* ---------- font preload ---------- */
  function ensureFontsLoaded() {
    if (document.getElementById('mp-transition-fonts')) return;
    var families = ['family=Space+Mono:wght@400;700'];
    for (var key in THEMES) {
      if (THEMES[key].gfont) families.push('family=' + THEMES[key].gfont);
      if (THEMES[key].sansGfont) families.push('family=' + THEMES[key].sansGfont);
    }
    var link = document.createElement('link');
    link.id = 'mp-transition-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?' + families.join('&') + '&display=swap';
    document.head.appendChild(link);
  }
  ensureFontsLoaded();

  /* ---------- one-time injected styles for the overlay ----------
     Everything here is plain DOM + CSS transforms: a "page" is two
     halves (left/right), each clipped to 50% width and holding a
     200%-wide copy of the origin content, positioned so the visible
     half lines up with center. Each half pivots from its OUTER edge
     (like a book cover) and rotates away while fading, revealing the
     destination layer sitting underneath the whole time. */
  function ensureStyles() {
    if (document.getElementById('mp-transition-styles')) return;
    var css =
      '#mp-transition-overlay{position:fixed;inset:0;z-index:99999;pointer-events:none;overflow:hidden;' +
        'perspective:1600px;opacity:0;transition:opacity ' + FADE_MS + 'ms ease;}' +
      '.mp-page-layer{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;' +
        'justify-content:center;text-align:center;padding:2rem;font-family:' + BOOK_MONO + ';box-sizing:border-box;}' +
      '.mp-page-layer.mp-toc{align-items:flex-start;text-align:left;padding:3rem clamp(2rem,6vw,4rem);}' +
      '.mp-tag{font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;opacity:.7;margin-bottom:1rem;display:block;}' +
      '.mp-name{font-size:clamp(1.7rem,5vw,3rem);line-height:1.2;display:block;}' +
      '.mp-toc-list{list-style:none;margin:0;padding:0;font-size:.92rem;width:100%;max-width:360px;}' +
      '.mp-toc-list li{display:flex;gap:1.2rem;padding:.6rem 0;border-top:1px solid rgba(128,128,128,0.25);}' +
      '.mp-toc-list li:first-child{border-top:none;}' +
      '.mp-toc-num{opacity:.5;}' +
      '.mp-under{position:absolute;inset:0;}' +
      '.mp-half{position:absolute;top:0;bottom:0;width:50%;overflow:hidden;transform-style:preserve-3d;}' +
      '.mp-half>.mp-page-layer{width:200%;}' +
      '.mp-half-left{left:0;transform-origin:0% 50%;}' +
      '.mp-half-right{right:0;transform-origin:100% 50%;}' +
      '.mp-half-left>.mp-page-layer{left:0;}' +
      '.mp-half-right>.mp-page-layer{right:0;}' +
      '#mp-transition-overlay.mp-playing .mp-half-left{transition:transform var(--mp-split-ms,620ms) ' +
        'cubic-bezier(.45,.05,.15,1),opacity var(--mp-split-ms,620ms) ease;transform:rotateY(-100deg);opacity:0;}' +
      '#mp-transition-overlay.mp-playing .mp-half-right{transition:transform var(--mp-split-ms,620ms) ' +
        'cubic-bezier(.45,.05,.15,1),opacity var(--mp-split-ms,620ms) ease;transform:rotateY(100deg);opacity:0;}';
    var style = document.createElement('style');
    style.id = 'mp-transition-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ---------- building a page-layer face ---------- */
  function pageLayerEl(theme, contents) {
    var div = document.createElement('div');
    div.className = 'mp-page-layer' + (contents ? ' mp-toc' : '');
    div.style.background = theme.bg;
    div.style.color = readableFg(theme.bg);

    var labelColor = theme.labelColor || theme.accent;
    var labelFont = theme.sans || BOOK_MONO;

    if (contents) {
      var items = sectionsFor(theme._pageName);
      if (!items.length) items = ['More inside'];
      var html = '<span class="mp-tag" style="color:' + labelColor + ';font-family:' + labelFont + '">CONTENTS</span>' +
        '<ol class="mp-toc-list" style="font-family:' + labelFont + '">';
      items.forEach(function (item, i) {
        var liStyle = theme.lineColor ? ' style="border-top-color:' + theme.lineColor + '"' : '';
        html += '<li' + liStyle + '><span class="mp-toc-num" style="color:' + labelColor + ';opacity:1">0' + (i + 1) + '</span><span>' + item + '</span></li>';
      });
      html += '</ol>';
      div.innerHTML = html;
    } else {
      var tagSpan = document.createElement('span');
      tagSpan.className = 'mp-tag';
      tagSpan.style.color = labelColor;
      tagSpan.style.fontFamily = labelFont;
      tagSpan.textContent = 'A CASE STUDY';

      var nameSpan = document.createElement('span');
      nameSpan.className = 'mp-name';
      nameSpan.style.color = theme.accent;
      nameSpan.style.fontFamily = theme.font;
      nameSpan.style.fontWeight = theme.weight || 500;
      nameSpan.style.fontStyle = theme.italic ? 'italic' : 'normal';
      nameSpan.textContent = theme.name;

      div.appendChild(tagSpan);
      div.appendChild(nameSpan);
    }
    return div;
  }

  /* ---------- overlay lifecycle ---------- */
  function buildOverlay() {
    ensureStyles();
    var wrap = document.createElement('div');
    wrap.id = 'mp-transition-overlay';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.setProperty('--mp-split-ms', SPLIT_MS + 'ms');
    document.body.appendChild(wrap);
    return wrap;
  }

  /* paint a single face flat, no motion — used to show the Cover the
     instant a new page loads, matching the last frame the EXIT phase
     ended on so there's no flash between pages */
  function paintFlat(wrap, theme, contents) {
    wrap.innerHTML = '';
    var layer = pageLayerEl(theme, contents);
    layer.classList.add('mp-under');
    wrap.appendChild(layer);
  }

  /* split from originTheme (+ contents flag) to destTheme (+ contents
     flag) — destination sits underneath the whole time, origin is
     duplicated into two halves that swing outward and fade */
  function playSplit(wrap, originTheme, originContents, destTheme, destContents, cb) {
    wrap.classList.remove('mp-playing');
    wrap.innerHTML = '';

    var under = pageLayerEl(destTheme, destContents);
    under.classList.add('mp-under');

    var left = document.createElement('div');
    left.className = 'mp-half mp-half-left';
    left.appendChild(pageLayerEl(originTheme, originContents));

    var right = document.createElement('div');
    right.className = 'mp-half mp-half-right';
    right.appendChild(pageLayerEl(originTheme, originContents));

    wrap.appendChild(under);
    wrap.appendChild(left);
    wrap.appendChild(right);

    // force layout before triggering the transition classes below
    wrap.offsetHeight;

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        wrap.classList.add('mp-playing');
      });
    });

    setTimeout(function () { cb && cb(); }, SPLIT_MS);
  }

  /* ---------- EXIT: play on the page being left, then navigate ---------- */
  function playExit(destName, href) {
    var originTheme = themeFor(filename(location.pathname));
    var destTheme = withPageName(themeFor(destName), destName);
    var wrap = buildOverlay();

    requestAnimationFrame(function () { wrap.style.opacity = '1'; });

    playSplit(wrap, originTheme, false, destTheme, false, function () {
      setTimeout(function () {
        setTimeout(function () { window.location.href = href; }, NAV_DELAY);
      }, HOLD_MS);
    });
  }

  /* ---------- ENTRANCE: normal arrival ---------- */
  function playEntrance() {
    var ownName = filename(location.pathname);
    var ownTheme = withPageName(themeFor(ownName), ownName);
    var wrap = buildOverlay();
    wrap.style.opacity = '1';

    // paint the Cover instantly — this must match the last frame the
    // EXIT phase ended on, so there's no flash between pages
    paintFlat(wrap, ownTheme, false);

    setTimeout(function () {
      playSplit(wrap, ownTheme, false, ownTheme, true, function () {
        setTimeout(function () {
          wrap.style.opacity = '0';
          setTimeout(function () { wrap.remove(); }, FADE_MS);
        }, HOLD_MS);
      });
    }, 150);
  }

  /* ---------- RELOAD: replay both splits on the same page ---------- */
  function playReloadSequence() {
    var ownName = filename(location.pathname);
    var ownTheme = withPageName(themeFor(ownName), ownName);
    var wrap = buildOverlay();
    wrap.style.opacity = '1';

    playSplit(wrap, ownTheme, false, ownTheme, false, function () {
      setTimeout(function () {
        playSplit(wrap, ownTheme, false, ownTheme, true, function () {
          setTimeout(function () {
            wrap.style.opacity = '0';
            setTimeout(function () { wrap.remove(); }, FADE_MS);
          }, HOLD_MS);
        });
      }, HOLD_MS);
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
    forceScrollTop();
    if (isReload()) {
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
    forceScrollTop();
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
